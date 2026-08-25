"""tamescroll blur gauntlet — frame-by-frame accuracy harness.

Owner bar (2026-08-25): "there isn't a single frame that the other gender
is visible and there isn't a single frame where the wrong gender is
blurred up".

This drives the DEV APP over CDP and produces, per run, a directory of
player-only frame captures plus the exact overlay geometry and track
state behind each one. A vision agent then scores the frames against the
bar; the score file feeds the next fix round.

Usage:
    python gauntlet.py <outdir> <gender: man|woman> <videoId> <startSec> <count> [stepSec]

Every frame is cropped to the PLAYER, not the page: the model output is
what is being judged, and a full-page screenshot wastes most of its
pixels on YouTube chrome.
"""

import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request

import websocket  # websocket-client; suppress_origin needed (WebView2 403s cross-origin WS)

PORT = 9223
SETTLE_S = 2.0  # after a seek, before the first capture


def targets():
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
        return [t for t in json.load(r) if t["type"] == "page"]


class Tab:
    def __init__(self, t):
        self.ws = websocket.create_connection(
            t["webSocketDebuggerUrl"], suppress_origin=True, timeout=180
        )
        self.mid = 0

    def cmd(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.mid:
                return m.get("result", m)

    def eval(self, expr, await_promise=True):
        r = self.cmd(
            "Runtime.evaluate", expression=expr, awaitPromise=await_promise, returnByValue=True
        )
        if "exceptionDetails" in r:
            return {
                "error": r["exceptionDetails"].get("exception", {}).get("description", "?")
            }
        return r.get("result", {}).get("value")

    def clip_shot(self, path, rect):
        r = self.cmd(
            "Page.captureScreenshot",
            format="png",
            clip={
                "x": rect["x"],
                "y": rect["y"],
                "width": rect["w"],
                "height": rect["h"],
                "scale": 1,
            },
        )
        open(path, "wb").write(base64.b64decode(r["data"]))


def pick(substr):
    for t in targets():
        if substr in t["url"] or substr in t.get("title", ""):
            return Tab(t)
    raise SystemExit("no target matching " + substr)


# --- page-side probe -------------------------------------------------
# Overlay rects are reported in VIDEO-normalized coordinates so a scorer
# can talk about "the patch over the left person" without knowing the
# player's pixel size. Track state comes from the same probe the fix
# rounds read, so a frame and its explanation never disagree.
PROBE = r"""
(function () {
  var v = document.querySelector('video');
  var host = document.querySelector('#movie_player');
  if (!v || !host) return null;
  var vr = v.getBoundingClientRect();
  var patches = [];
  // Overlays are .ts-gaze-vregion-host elements parented to the player
  // (video-region.mjs), NOT a single wrapper layer.
  var kids = host.querySelectorAll('.ts-gaze-vregion-host');
  for (var i = 0; i < kids.length; i++) {
    var r = kids[i].getBoundingClientRect();
    if (!r.width || !r.height) continue;
    patches.push({
      x1: +(((r.left - vr.left) / vr.width).toFixed(3)),
      y1: +(((r.top - vr.top) / vr.height).toFixed(3)),
      x2: +(((r.right - vr.left) / vr.width).toFixed(3)),
      y2: +(((r.bottom - vr.top) / vr.height).toFixed(3)),
    });
  }
  var d = window.__TS_GAZE_IDS || {};
  var tr = (d.tracks || []).slice(-1)[0] || [];
  return {
    t: +v.currentTime.toFixed(2),
    // Which video these pixels actually came from, so a run that
    // overran its video and got autoplayed into another one is caught
    // instead of scored.
    vid: (location.search.match(/[?&]v=([\w-]{11})/) || [])[1] || null,
    paused: v.paused,
    // True while YouTube is playing an AD in the same element. Ad frames
    // are not this video's frames: r6e scored ten frames of a pre-roll
    // and the numbers looked like a regression in the TED talk.
    ad: /ad-showing|ad-interrupting/.test(host.className || ''),
    persons: window.__TS_GAZE_PERSONS,
    passFails: d.passFails || 0,
    lastFail: d.lastFail || null,
    patches: patches,
    tracks: tr,
    // NATIVE video resolution. Every pixel calculation about face size —
    // and therefore every claim about why a small face reads as noise —
    // was parameterised on a number no round had ever recorded. YouTube
    // picks the format from the element size, so this is not guessable.
    vw: v.videoWidth || 0,
    vh: v.videoHeight || 0,
    // R10 had 5 tracks and this was slice(-4): reads were being DROPPED
    // before they reached the log.
    reads: (d.reads || []).slice(-8),
    // Face ATTRIBUTION, already pushed by the bundle and captured by
    // nothing. `own` separates the three states the score alone cannot:
    // no face found, a face found but not attributable to this person's
    // head, and a face actually used for the verdict.
    attr: (d.attr || []).slice(-4),
    // Identity-memory forensics (R7 critic F7): memoryLookup can REVOKE
    // a clear when a stored exemplar false-matches at MEM_SIM_FLAG 0.85,
    // and the module's own calibration says 17% of DIFFERENT-person pairs
    // score >=0.9. Both numbers were already logged by the bundle and
    // simply never captured, so the round could not tell "he never earned
    // a clear" from "he earned one and memory took it away".
    sims: (d.sims || []).slice(-8),
    mem: d.mem || 0,
    // Track lifecycle counters (person-track.mjs bump()): newTrack,
    // sizeReject, identityBroke, ... Churn conclusions are worthless
    // without them.
    // Track lifecycle counters (person-track.mjs bump()). These are
    // CUMULATIVE FROM PAGE LOAD — bump() only ever increments and nothing
    // resets them, not on seek, not on loadstart. Three rounds quoted
    // them as per-window RATES and were wrong every time ("7 newTrack per
    // 10 frames" was 7 since the page loaded, across ~20s of pre-seek
    // autoplay plus the seek wipe). The harness now stamps a baseline at
    // the seek and reports the DELTA alongside the raw total, so a rate
    // can be quoted honestly or not at all.
    life: d.life || null,
    // How many samplers are alive. __TS_GAZE_IDS is a WINDOW global while
    // videoTracks is per-element, so two live samplers would interleave
    // every snapshot above and the measured churn would be an artifact of
    // the measurement. R7's critic flagged this as gating its own
    // findings. Must be 1.
    samplers: window.__TS_SAMPLERS || 0,
    // Raw MoveNet slots BEFORE parsePersons' evidence gate, as
    // "score/confidentKeypoints/height" per slot. This is what separates
    // "the model saw nobody" from "the model saw someone and OUR gate
    // discarded them" — R8 hit persons:0 on ten straight frames of a man
    // filling a third of the frame and could not tell which. The bundle
    // has logged it all along (init-entry.js slots probe); only the
    // harness was not reading it.
    slots: (d.slots || []).slice(-3),
    cost: (function () {
      var c = d.cost || { verdict: [], pass: [] };
      function stat(a) {
        if (!a.length) return null;
        var s = a.slice().sort(function (x, y) { return x - y; });
        // `first` is the UNSORTED head of the array — the very first pass
        // of the video. The cost arrays are push-ordered and capped at
        // 120, so while n < 120 index 0 really is pass one, and model
        // warm-up (faceres + BlazeFace + MoveNet shader compile) lands
        // there. Without it a one-off compile is indistinguishable from a
        // recurring stall, and the two need opposite fixes.
        return { n: s.length, first: a[0], p50: s[(s.length / 2) | 0], p95: s[Math.min(s.length - 1, (s.length * 0.95) | 0)], max: s[s.length - 1] };
      }
      return { verdict: stat(c.verdict), pass: stat(c.pass) };
    })(),
    rect: { x: vr.left, y: vr.top, w: vr.width, h: vr.height },
  };
})()
"""


def open_platform(gender):
    """Set the user's gender, then open a FRESH YouTube window.

    The bundle reads __TS_GAZE_GENDER at boot, so the setting has to land
    before the platform window is created — flipping it on a live page
    does nothing, which is exactly the trap that makes a 'both ways' test
    silently measure the same direction twice.
    """
    lau = pick("localhost:1420")
    # Drive the LAUNCHER'S OWN TOGGLE, not the set_user_gender command.
    # Calling the command directly looks like it works and does nothing:
    # open_platform passes the launcher's stored gender through with the
    # tile click and overwrites the Rust state a moment later. A run
    # "with gender=woman" then silently measures the man direction - the
    # exact failure this whole harness exists to catch.
    ok = lau.eval(
        "(function(){var b=document.querySelector("
        "'#gender-toggle .toggle-opt[data-value=\"%s\"]');"
        "if(!b)return 'no-toggle';b.click();return localStorage.getItem('tamescroll.gender');})()"
        % gender
    )
    if ok != gender:
        raise SystemExit("gender did not take: wanted %s, launcher says %r" % (gender, ok))
    time.sleep(0.8)
    lau.eval(
        "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
        ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
    )
    time.sleep(7)
    return pick("youtube.com")


def search_ids(query, n=6):
    """Resolve a SEARCH QUERY to video ids off the live page.

    Video ids are never hardcoded: a guessed id is a dead link or, worse,
    a video nobody vetted. The loop varies its corpus by varying the
    query, and the ids come from whatever YouTube actually returns.
    """
    tab = pick("youtube.com")
    tab.eval(
        "location.href='https://www.youtube.com/results?search_query=%s'"
        % urllib.parse.quote(query)
    )
    time.sleep(9)
    tab = pick("youtube.com")
    return tab.eval(
        "(function(){var out=[];var a=document.querySelectorAll('a#video-title-link, a#video-title');"
        "for(var i=0;i<a.length&&out.length<%d;i++){var m=(a[i].href||'').match(/[?&]v=([\w-]{11})/);"
        "if(m&&out.indexOf(m[1])===-1)out.push(m[1]);}return out;})()" % n
    )


# --- cold-start probe ------------------------------------------------
# The ordinary run sleeps 20s after navigating, polls the duration for up
# to 30s more, seeks, then settles 2s — so by its first frame the page is
# at least 22 seconds old and every model has long since loaded. That
# makes it STRUCTURALLY BLIND to the first seconds of a video, which is
# where R9's critic traced an EXPOSURE window that fires on every single
# video:
#
#   autoplay -> play -> ensureFaceModels (bypassing the post-load-idle
#   deferral entirely) -> backend, face, gender, `genderSettled = true`,
#   THEN the 6.8MB MoveNet embed.
#
# Between `genderSettled` and `personModel` the region path is closed
# (it needs both), so the player falls through to the WHOLE-BLUR path —
# whose clean-streak of 2 passes at the 120ms floor UNBLURS the video in
# ~250-500ms if full-frame BlazeFace finds no face. That detector is the
# one every earlier round measured as blind on wide shots, small subjects
# and back-turned people. So the player can go sharp and stay sharp for
# the whole MoveNet load plus the first verdict pass.
#
# `__TS_GAZE_PERSONS` is written ONLY by the region path, so `undefined`
# means MoveNet has never produced a pass. The hole is exactly the
# interval where the video carries neither gaze class AND persons is
# still undefined. This probe is deliberately tiny: it runs every ~120ms
# from the moment of navigation, and anything heavier would perturb the
# very window it is measuring.
COLD_PROBE = r"""
(function () {
  var v = document.querySelector('video');
  var host = document.querySelector('#movie_player');
  if (!v) return null;
  var cls = v.className || '';
  var vr = v.getBoundingClientRect();
  var kids = host ? host.querySelectorAll('.ts-gaze-vregion-host').length : 0;
  return {
    t: +(v.currentTime || 0).toFixed(2),
    paused: v.paused,
    ad: host ? /ad-showing|ad-interrupting/.test(host.className || '') : false,
    // The two blur-first classes. Neither present = the player is SHARP.
    pending: cls.indexOf('ts-gaze-pending') !== -1,
    flagged: cls.indexOf('ts-gaze-flagged') !== -1,
    filt: (v.style && v.style.filter) || '',
    patches: kids,
    // undefined until the region path has run once = MoveNet not ready.
    persons: window.__TS_GAZE_PERSONS,
    boot: window.__TS_GAZE_BUNDLE__ || null,
    rect: { x: vr.left, y: vr.top, w: vr.width, h: vr.height },
  };
})()
"""


def coldstart(outdir, gender, video, seconds=25.0):
    """Capture the first seconds of a watch page, from navigation onward.

    Writes one screenshot per STATE CHANGE (not per tick) plus a full
    timeline, so the output is small but the transitions are all there.
    A state is (pending, flagged, patches>0, persons-defined).
    """
    os.makedirs(outdir, exist_ok=True)
    tab = open_platform(gender)
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    t0 = time.time()
    timeline, shots, last_state, i = [], [], None, 0
    while time.time() - t0 < seconds:
        try:
            tab = tab if i else pick("youtube.com")
            p = tab.eval(COLD_PROBE)
        except Exception:
            time.sleep(0.2)
            try:
                tab = pick("youtube.com")
            except Exception:
                pass
            continue
        if not p:
            time.sleep(0.12)
            continue
        p["ms"] = int((time.time() - t0) * 1000)
        timeline.append(p)
        state = (
            bool(p.get("pending")),
            bool(p.get("flagged")),
            (p.get("patches") or 0) > 0,
            p.get("persons") is not None,
        )
        if state != last_state and p.get("rect", {}).get("w"):
            last_state = state
            name = "c%03d_%dms.png" % (i, p["ms"])
            try:
                tab.clip_shot(os.path.join(outdir, name), p["rect"])
                shots.append({"file": name, **p})
                i += 1
            except Exception:
                pass
        time.sleep(0.12)

    # The hole: player sharp (neither class, no patches) while the video
    # is PLAYING and MoveNet has not produced a pass yet.
    hole = [
        s
        for s in timeline
        if not s.get("pending")
        and not s.get("flagged")
        and not (s.get("patches") or 0)
        and s.get("persons") is None
        and not s.get("paused")
        and not s.get("ad")
        and (s.get("t") or 0) > 0
    ]
    meta = {
        "video": video,
        "gender": gender,
        "mode": "coldstart",
        "ticks": len(timeline),
        "shots": shots,
        "hole_ticks": len(hole),
        "hole_first_ms": hole[0]["ms"] if hole else None,
        "hole_last_ms": hole[-1]["ms"] if hole else None,
        "timeline": timeline,
    }
    with open(os.path.join(outdir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(
        json.dumps(
            {
                "out": outdir,
                "shots": len(shots),
                "hole_ticks": len(hole),
                "hole_ms": [meta["hole_first_ms"], meta["hole_last_ms"]],
            }
        )
    )


def run(outdir, gender, video, start, count, step):
    os.makedirs(outdir, exist_ok=True)
    tab = open_platform(gender)
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(20)
    tab = pick("youtube.com")

    boot = tab.eval("JSON.stringify({g: window.__TS_GAZE_GENDER, b: window.__TS_GAZE_BUNDLE__})")
    # Hard gate: a run that booted the wrong direction is worse than no
    # run, because its frames look like evidence.
    if ('"g":"%s"' % gender) not in (boot or ""):
        raise SystemExit("BOOTED WRONG DIRECTION: wanted %s, page says %s" % (gender, boot))
    # A SEEK PAST THE END SILENTLY CLAMPS. Ask for t=240 on a 76-second
    # video and the player parks on the final frame, still `paused:false`
    # and `ended:false` — indistinguishable from a healthy static shot,
    # and it hands back N identical frames carrying the same stale
    # patches. Caught on r5-man, where every frame sat at t=76.08 and the
    # first diagnosis was a buffering stall. Read the duration off the
    # element and refuse rather than guess a replacement offset: the
    # start offset is chosen to land on people, so a silently-moved one
    # is a different test than the round claims to be running.
    # WAIT OUT THE AD / LOAD WINDOW BEFORE TRUSTING `duration`. During a
    # pre-roll the video element reports the AD's duration, so a healthy
    # 843-second talk briefly looks like a 6-second clip and the guard
    # below rejects a perfectly good run. Poll until the player is not
    # ad-showing and the duration has stopped changing.
    dur = 0
    for _ in range(30):
        st = tab.eval(
            "(function(){var v=document.querySelector('video');"
            "var p=document.querySelector('#movie_player');"
            "return JSON.stringify({d:v?v.duration:0,"
            "ad:/ad-showing|ad-interrupting/.test((p&&p.className)||'')});})()"
        )
        try:
            st = json.loads(st or "{}")
        except Exception:
            st = {}
        d = st.get("d") or 0
        if not st.get("ad") and d and d == dur:
            break
        dur = d
        time.sleep(1.0)
    if not dur or dur != dur:  # 0, None or NaN — metadata never arrived
        raise SystemExit("RUN INVALID: no video duration (player never loaded)")
    # An AD can still be occupying the element with ITS duration (72s for
    # a pre-roll on a 2545s episode), and the ad class is not always set
    # when the duration is. Re-read a few times before rejecting, or the
    # guard throws away a perfectly good video.
    for _ in range(6):
        if start <= dur - 5:
            break
        time.sleep(3)
        d2 = tab.eval(
            "(function(){var v=document.querySelector('video');return v?v.duration:0;})()"
        )
        if d2 and d2 > dur:
            dur = d2
    if start > dur - 5:
        raise SystemExit(
            "RUN INVALID: start %ds is past the end of a %.0fs video (%s). "
            "Pick a start inside the video." % (start, dur, video)
        )
    tab.eval(
        "(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start
    )
    time.sleep(SETTLE_S)

    # Baseline for the cumulative lifecycle counters — see `life` in the
    # PROBE. Stamped AFTER the seek so the delta covers the capture window
    # and nothing else.
    life0 = tab.eval("JSON.stringify((window.__TS_GAZE_IDS||{}).life||{})")
    try:
        life0 = json.loads(life0 or "{}")
    except Exception:
        life0 = {}
    meta = {
        "video": video,
        "gender": gender,
        "boot": boot,
        "life_baseline": life0,
        "frames": [],
    }
    for i in range(count):
        p = tab.eval(PROBE)
        if not p:
            time.sleep(step)
            continue
        # PAIRED CAPTURE (owner idea 2026-08-25: "you can enable and
        # disable the blur to check for yourself"). Every frame is shot
        # twice — once as the user sees it, once with the overlays
        # hidden — so scoring is not guesswork about who is underneath a
        # patch. Judging coverage from the blurred image alone is how a
        # correctly-covered person and a wrongly-covered one end up
        # looking identical.
        name = "f%03d.png" % i
        truth = "f%03d_truth.png" % i
        try:
            # PAUSE ACROSS THE PAIR. The blur-on and blur-off shots are two
            # sequential screenshots a few hundred ms apart, and on
            # fast-cut footage the video CUTS between them: r7b f001 was
            # captured as a man pointing, while its "truth" twin showed a
            # completely different shot of a crowd. Scoring a patch against
            # a frame it was never drawn on is worse than not scoring -
            # every judgement it produces is fiction. Pausing makes the two
            # shots genuinely the same instant.
            tab.eval("(function(){var v=document.querySelector('video');v&&v.pause();})()")
            time.sleep(0.15)
            tab.clip_shot(os.path.join(outdir, name), p["rect"])
            tab.eval(
                "(function(){var n=document.querySelectorAll('.ts-gaze-vregion-host');"
                "for(var i=0;i<n.length;i++)n[i].style.visibility='hidden';return n.length;})()"
            )
            tab.clip_shot(os.path.join(outdir, truth), p["rect"])
            tab.eval(
                "(function(){var n=document.querySelectorAll('.ts-gaze-vregion-host');"
                "for(var i=0;i<n.length;i++)n[i].style.visibility='';})()"
            )
            tab.eval("(function(){var v=document.querySelector('video');v&&v.play();})()")
            p["truth"] = truth
        except Exception as e:  # a capture failure must not lose the run
            p["shotError"] = str(e)
        p.pop("rect", None)
        p["file"] = name
        meta["frames"].append(p)
        if p.get("paused"):
            # Autoplay policies, an ad transition or a buffer stall can
            # leave the player paused mid-run; nudge it rather than
            # capturing the same frame N times.
            tab.eval("(function(){var v=document.querySelector('video');v&&v.play();})()")
        time.sleep(step)

    # A STALLED PLAYER IS NOT EVIDENCE. A paused or buffering video hands
    # back N identical frames that look exactly like a clean run with a
    # static shot, and every one of them carries the same stale patches.
    # Scoring that is worse than not running: it invents a result. Caught
    # live on r5-man, where all 12 frames sat at t=76.08 with three
    # patches over nobody.
    # A FRAME CAPTURED BEFORE THE PLAYER EXISTS IS NOT A FRAME. r12-woman2
    # wrote two: videoWidth 0, no <video> yet, the PNG showing the YouTube
    # search bar over black. They still landed in meta.json with a
    # timestamp and an empty patch list, which scores as "0 patches, no
    # people" — a perfect run. The repeated-timestamp guard below missed
    # them because 2 of 10 is under its 30% bar.
    # Any frame with no decoded video is a capture that started too early;
    # the whole run is suspect, because the models were still loading for
    # the frames that follow it too.
    blind = [i for i, f in enumerate(meta["frames"]) if not f.get("vw")]
    if blind:
        meta["invalid"] = (
            "frames %s captured before the player had decoded video "
            "(videoWidth 0): the run started too early, and the frames "
            "after them were taken while the models were still loading"
            % blind
        )
    # An empty PNG is the same failure one layer down: the screenshot
    # succeeded as a call and produced nothing to look at.
    empty = [
        i
        for i in range(len(meta["frames"]))
        if os.path.exists(os.path.join(outdir, "f%03d.png" % i))
        and os.path.getsize(os.path.join(outdir, "f%03d.png" % i)) == 0
    ]
    if empty and not meta.get("invalid"):
        meta["invalid"] = "frames %s captured as 0-byte PNGs" % empty
    # videoWidth alone does not catch it. r12-woman2 f001 reported a full
    # 1920x1080 while the PNG was still the YouTube search bar over black:
    # the element had dimensions before the player had painted a frame.
    # The reliable tell is that currentTime had not moved yet — a LEADING
    # run of identical timestamps means capture began before playback did,
    # and those frames show the page, not the video.
    if not meta.get("invalid") and len(meta["frames"]) > 2:
        lead = 1
        while lead < len(meta["frames"]) and abs(
            meta["frames"][lead]["t"] - meta["frames"][0]["t"]
        ) < 0.01:
            lead += 1
        if lead > 1:
            meta["invalid"] = (
                "the first %d frames share t=%.2f — capture began before "
                "playback, so they show the page rather than the video"
                % (lead, meta["frames"][0]["t"])
            )

    times = [f["t"] for f in meta["frames"]]
    if len(times) > 2 and max(times) - min(times) < 0.5:
        meta["invalid"] = "player never advanced (t=%.2f throughout)" % times[0]
    # ...and a PARTIAL stall slips straight through that test. r10-woman
    # sat frozen at t=900 for eight frames and then advanced to 905 on the
    # last two: spread 5.26s, guard satisfied, run "valid" — and the eight
    # frozen frames were a BLACK SCREEN WITH A PLAY BUTTON, scored as
    # eight clean frames. Eight tenths of that round would have been
    # fiction. The spread test only asks whether the player moved at all;
    # what matters is whether each frame is its own moment.
    frozen = sum(1 for i in range(1, len(times)) if abs(times[i] - times[i - 1]) < 0.05)
    if not meta.get("invalid") and len(times) > 2 and frozen > len(times) * 0.3:
        meta["invalid"] = (
            "player stalled for %d of %d frames (repeated timestamps): those "
            "frames are the same moment, not evidence" % (frozen, len(times))
        )
    # THE VIDEO MUST STILL BE THE VIDEO. If the run overruns the end,
    # YouTube autoplays the NEXT video and the harness keeps shooting
    # happily — r6b captured six frames of one panel discussion and six
    # of something else entirely, with currentTime jumping 185 -> 0.
    # Frames from two different videos scored as one run are worse than
    # no run: the comparison against the previous round is meaningless
    # and nothing in the numbers shows it.
    for i in range(1, len(times)):
        if times[i] < times[i - 1] - 2.0:
            meta["invalid"] = (
                "playback jumped backwards (%.1f -> %.1f at frame %d): the video "
                "ended and autoplay moved on. Start earlier or capture fewer frames."
                % (times[i - 1], times[i], i)
            )
            break
    ads = sum(1 for f in meta["frames"] if f.get("ad"))
    if ads:
        meta["invalid"] = (
            "%d of %d frames were captured during an AD - those are not this "
            "video's frames" % (ads, len(meta["frames"]))
        )
    # Cumulative counters -> a window delta the log can quote as a rate.
    lastlife = (meta["frames"][-1].get("life") or {}) if meta["frames"] else {}
    meta["life_window"] = {
        k: v - (life0.get(k) or 0) for k, v in (lastlife or {}).items()
    }
    ids = set(f.get("vid") for f in meta["frames"] if f.get("vid"))
    if len(ids) > 1:
        meta["invalid"] = "video id changed mid-run: %s" % sorted(ids)
    with open(os.path.join(outdir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    if meta.get("invalid"):
        raise SystemExit("RUN INVALID: " + meta["invalid"])
    print(json.dumps({"out": outdir, "frames": len(meta["frames"]), "boot": boot}))


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "search":
        print(json.dumps(search_ids(a[1], int(a[2]) if len(a) > 2 else 6)))
        raise SystemExit(0)
    # coldstart <outdir> <gender> <videoId> [seconds]
    if a and a[0] == "coldstart":
        coldstart(a[1], a[2], a[3], float(a[4]) if len(a) > 4 else 25.0)
        raise SystemExit(0)
    if len(a) < 5:
        raise SystemExit(__doc__)
    run(a[0], a[1], a[2], int(a[3]), int(a[4]), float(a[5]) if len(a) > 5 else 1.0)
