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
    paused: v.paused,
    persons: window.__TS_GAZE_PERSONS,
    passFails: d.passFails || 0,
    lastFail: d.lastFail || null,
    patches: patches,
    tracks: tr,
    reads: (d.reads || []).slice(-4),
    cost: (function () {
      var c = d.cost || { verdict: [], pass: [] };
      function stat(a) {
        if (!a.length) return null;
        var s = a.slice().sort(function (x, y) { return x - y; });
        return { n: s.length, p50: s[(s.length / 2) | 0], p95: s[Math.min(s.length - 1, (s.length * 0.95) | 0)], max: s[s.length - 1] };
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
    tab.eval(
        "(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start
    )
    time.sleep(SETTLE_S)

    meta = {"video": video, "gender": gender, "boot": boot, "frames": []}
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
    times = [f["t"] for f in meta["frames"]]
    if len(times) > 2 and max(times) - min(times) < 0.5:
        meta["invalid"] = "player never advanced (t=%.2f throughout)" % times[0]
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
    if len(a) < 5:
        raise SystemExit(__doc__)
    run(a[0], a[1], a[2], int(a[3]), int(a[4]), float(a[5]) if len(a) > 5 else 1.0)
