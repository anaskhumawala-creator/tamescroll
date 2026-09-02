"""Latency A/B on a real arm64 device (plan 2026-09-02, Task 5 / Task 11).

    python probe_latency_ab.py <cdpPort> <label> [secs] [videoId] [seekTo] [--delay]

`--delay` may appear anywhere in argv; it does not shift the positional
args. It enables the Stage B delay-line arm: entry-latency and exit-hang
measurements against `window.__TS_DELAY_STATS()` (Task 10's read-only hook,
same contract shape as `__TS_GAZE_VTRACKS`), a refill-window read right
after the seek, a pause/freeze check, and a canvas-vs-video geometry read.
The delay arm CANNOT be exercised until a build wiring Task 10 is
installed -- `__TS_DELAY_STATS` will simply read `undefined` on 1091 and
every device-only field degrades to `None`/empty rather than throwing.

Drives the app through its REAL path (launcher -> open_platform man/smart
-> watch page), then samples for `secs`:
  - verdict / position pass counts and p50 costs from __TS_GAZE_IDS.stages
    (first-seen tagging: the ring saturates, so a diff of lengths is the
    fill, not the rate -- loop 29)
  - "verdicts" IS THE USEFUL COUNT (phase-i I7), not every stage entry
    with v:1. A pass the epoch guard discards (`passDropped`) still gets
    pushed to `stages` in its `.finally`, so counting `v:1` entries alone
    over-counts verdicts and, worse, feeds a drop-forced near-zero gap
    (`lastZoomAt = 0` on drop) into `verdictGapP50/P95`. `verdictsDropped`
    is the discarded half and `passesAll` is the old total (dropped +
    useful) under its own name, not silently reused. A stage entry is
    "useful" iff `typeof e.tracks === 'number'` -- `mark('tracks')` in
    init-entry.js only runs past the epoch check. The raw per-entry
    series (`vAtMs`, `vDroppedFlags`) is banked too, so a future reducer
    can re-derive a different split (cut-forced vs free-running, say)
    offline without a fresh device run.
  - rAF Hz and the fraction of frames with a patch up, in page
  - life counters that name the mechanism (positionPassSkipped,
    genderReadSkipped, personPassSkipped, coastExpired, birthFresh,
    delayVerdictLate)
  - when the delay presenter is live (__TS_DELAY_STATS), its stats too.
  - with --delay: a per-rAF-frame series of {presentedMediaTime, visible
    patch boxes normalized to the player <video> rect} plus a deduped
    series of the tracker's latest timeline snapshot ({mediaTime, tracks:
    [{id, box, state}]}), reduced offline into entry-lag and exit-hang
    distributions (see compute_entry_lag / compute_exit_hang /
    build_delay_arm below -- pure, unit-tested by the bottom selftest).
Banks to latency-ab-<label>.json beside this file.

ASSUMPTIONS ABOUT HOOK SHAPES NOT YET WIRED (Task 10), to check against
the real build once it exists:
  - `window.__TS_DELAY_STATS()` returns
    `{ stats: {captured, presented, refills, flushes, capFailed, ring,
       late, errors}, presentedMediaTime: <seconds|null>,
       snapshots: <{mediaTime, tracks:[{id, box:{x1,y1,x2,y2}, state}]}
       | null> }` -- a SINGLE latest snapshot object (`latestSnapshot`
    return shape from track-timeline.mjs), not the whole timeline
    history. The probe polls it every rAF frame and dedupes by
    `snapshots.mediaTime` to reconstruct a snapshot SERIES offline --
    it cannot see snapshots the timeline has already pruned or that
    were superseded between two of our polls (a poll faster than the
    verdict cadence is assumed sufficient; rAF at 30-60Hz against a
    ~1-2s verdict cadence should not miss one, but a very bursty
    cadence could coalesce two into one dedupe key if they share a
    mediaTime).
  - `window.__TS_GAZE_VTRACKS()` track boxes are `[x1,y1,x2,y2]` arrays
    with NO id/state (confirmed by reading video-region.mjs) -- this
    probe does NOT use it for the delay arm's entry/exit reducers
    (it cannot, without ids); it is only useful for the existing
    coverage/geometry checks this file already had. The id+box+state
    series comes from `__TS_DELAY_STATS().snapshots` instead, per the
    plan text for Task 11.
  - `presenter.cover(true/false)` and whole-blur are outside this
    probe's scope; only the canvas (`.ts-gaze-delay`) and the player
    overlays (`.ts-gaze-vregion-clip > *`) are read.
  - The visible-patch rule mirrors `VISIBLE_PATCHES_JS` in emu_cdp.py
    (`display !== 'none'` and a non-zero rect) but targets the PLAYER
    overlay class (`.ts-gaze-vregion-clip > *`), not the thumbnail
    patch class (`.ts-gaze-region-patch`) that snippet defaults to.
  - Track/patch box coordinates are compared in the SAME normalized
    domain: track boxes from the timeline are already normalized to
    the video (per track-timeline.mjs's docstring); patch boxes are
    normalized here against `#movie_player video`'s (or the first
    `video` element's) live `getBoundingClientRect()`. If the delay
    canvas or the video element is letterboxed differently from what
    `boxesAt` assumes, this normalization could disagree with the
    timeline's own domain -- worth a live sanity check once the build
    exists (the geometry check below is exactly that check, once per
    run, not proof it holds every frame).
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

_argv = [a for a in sys.argv[1:] if a != "--delay"]
DELAY = "--delay" in sys.argv[1:]
PORT = int(_argv[0]) if len(_argv) > 0 else 9227
LABEL = _argv[1] if len(_argv) > 1 else "unlabelled"
SECS = float(_argv[2]) if len(_argv) > 2 else 150.0
VIDEO = _argv[3] if len(_argv) > 3 else "NWoT1ZVd1Lo"
SEEK = float(_argv[4]) if len(_argv) > 4 else 55.0
HERE = os.path.dirname(os.path.abspath(__file__))


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


def iou(a, b):
    """a, b = [x1, y1, x2, y2] in the same normalized domain."""
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    areaA = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    areaB = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    union = areaA + areaB - inter
    return inter / union if union > 0 else 0.0


# --- pure reducers over the delay-arm sample series (device-independent,
# exercised by the selftest at the bottom) --------------------------------

def compute_entry_lag(snaps, frames, iou_min=0.3):
    """For every track id whose FIRST appearance across `snaps` (ordered by
    media time) is state 'blurred' -- a birth-already-covered event, the
    proxy for `birthBlurred` this probe can see -- find the first frame in
    `frames` (ordered by presented media time) whose `pm >= m0` and that
    carries a visible patch overlapping the birth box at IoU >= iou_min.
    Returns the list of (pm - m0) gaps in SECONDS, one per matched birth;
    unmatched births (no presented frame ever showed a patch there, in the
    sampled window) are omitted rather than reported as infinite.
    """
    births = []
    seen = set()
    for s in snaps:
        tr = s.get("tr", [])
        for t in tr:
            if t["id"] not in seen and t.get("state") == "blurred":
                births.append({"id": t["id"], "m0": s["mt"], "box": t["box"]})
        seen |= set(t["id"] for t in tr)
    lags = []
    for b in births:
        for f in frames:
            pm = f.get("pm")
            if pm is None or pm < b["m0"]:
                continue
            if any(iou(p, b["box"]) >= iou_min for p in f.get("p", [])):
                lags.append(pm - b["m0"])
                break
    return lags


def compute_exit_hang(snaps, frames, iou_min=0.3):
    """For every track id present in one snapshot and absent from the very
    next one (death at that snapshot's media time `md`, last known box),
    count the presented frames with `pm >= md` that still carry a visible
    patch overlapping the dead track's last box. A death with presented-
    frame coverage but zero overlapping frames contributes a 0 (a clean
    removal is real data, not a missing measurement). Returns the list of
    per-death frame counts.
    """
    deaths = []
    for i in range(len(snaps) - 1):
        cur = {t["id"]: t for t in snaps[i].get("tr", [])}
        nxt_ids = set(t["id"] for t in snaps[i + 1].get("tr", []))
        for id_, t in cur.items():
            if id_ not in nxt_ids:
                deaths.append({"id": id_, "md": snaps[i]["mt"], "box": t["box"]})
    # The hang is the CONSECUTIVE run of presented frames after the death
    # that still overlap the last box -- it ends at the first clean frame.
    # Counting every later overlapping frame in the run (the first version
    # of this) charged a subject who walked back into the same spot, or a
    # re-minted track, to the death before it: p50 822 frames on the first
    # Stage B run, which no 1000ms delay line can produce.
    ordered = sorted((f for f in frames if f.get("pm") is not None), key=lambda f: f["pm"])
    counts = []
    for d in deaths:
        n = 0
        covered = False
        for f in ordered:
            if f["pm"] < d["md"]:
                continue
            covered = True
            if any(iou(p, d["box"]) >= iou_min for p in f.get("p", [])):
                n += 1
            else:
                break
        if covered:
            counts.append(n)
    return counts


def build_delay_arm(snaps, frames, stats_start, stats_end, life_delta):
    """Assemble the offline-computable half of the delayArm output block.
    Device-only fields (geometry, pauseCheck, refillWindowMs, fullscreen/
    miniplayer) are merged in by main() after this returns.
    """
    entry_lags = compute_entry_lag(snaps, frames)
    exit_hangs = compute_exit_hang(snaps, frames)
    entry_lags_ms = [round(x * 1000, 1) for x in entry_lags]
    presented_delta = None
    if isinstance(stats_start, dict) and isinstance(stats_end, dict):
        presented_delta = stats_end.get("presented", 0) - stats_start.get("presented", 0)
    late_delta = (life_delta or {}).get("delayVerdictLate", 0)
    late_frac = (late_delta / presented_delta) if presented_delta else None
    outside = 0
    for f in frames:
        for p in f.get("p", []):
            if p[0] < -0.01 or p[1] < -0.01 or p[2] > 1.01 or p[3] > 1.01:
                outside += 1
    return {
        "entryLagMediaMs": {
            "n": len(entry_lags_ms),
            "p50": pct(entry_lags_ms, 0.5),
            "p95": pct(entry_lags_ms, 0.95),
            "nNonPositive": sum(1 for x in entry_lags_ms if x <= 0),
        },
        "exitHangFrames": {
            "n": len(exit_hangs),
            "p50": pct(exit_hangs, 0.5),
            "p95": pct(exit_hangs, 0.95),
            "max": max(exit_hangs) if exit_hangs else None,
        },
        "delayVerdictLateFrac": late_frac,
        "presentedDelta": presented_delta,
        "delayStatsStart": stats_start,
        "delayStatsEnd": stats_end,
        "patchesOutsidePlayer": outside,
        "patchSamples": len(frames),
        "snapshotSamples": len(snaps),
        # The per-verdict track snapshots themselves (id, box, state), so a
        # coverage question can be decomposed OFFLINE into "fewer blurred
        # tracks" against "smaller blurred boxes" -- the 2026-09-02 native
        # coverage drop had to wait for a rerun because only the count was
        # banked. Capped so the file stays readable.
        "snaps": snaps[:2500],
    }


# --- device-only helpers (need a live Tab) --------------------------------

def measure_refill(t, timeout=8.0, interval=0.2):
    """Wall-clock ms from the seek until presentedMediaTime is non-null and
    advancing across two consecutive reads. None if it never does inside
    `timeout` (delay line not wired, or the ring never refilled)."""
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        pm = t.eval(
            "(function(){var d=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;"
            "return d?d.presentedMediaTime:null;})()"
        )
        if pm is not None and last is not None and pm > last:
            return round((time.time() - t0) * 1000)
        last = pm
        time.sleep(interval)
    return None


def check_geometry(t):
    """One-shot canvas-vs-video rect read (viewport px)."""
    raw = t.eval(
        """(function(){
      var v=document.querySelector('#movie_player video')||document.querySelector('video');
      var c=document.querySelector('.ts-gaze-delay');
      if(!v) return JSON.stringify({video:null,canvas:null});
      var vr=v.getBoundingClientRect();
      var cr=c?c.getBoundingClientRect():null;
      return JSON.stringify({
        video:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
        canvas:cr?[Math.round(cr.left),Math.round(cr.top),Math.round(cr.width),Math.round(cr.height)]:null
      });
    })()"""
    )
    return json.loads(raw) if isinstance(raw, str) else raw


def check_pause(t):
    """Pause, wait 3s, read presentedMediaTime twice 1s apart (must be
    equal -- the picture must be frozen, not still advancing), confirm
    the delay canvas is still present, then resume playback."""
    t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
    time.sleep(3)
    pm1 = t.eval(
        "(function(){var d=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;"
        "return d?d.presentedMediaTime:null;})()"
    )
    canvas_present = t.eval("(function(){return !!document.querySelector('.ts-gaze-delay');})()")
    time.sleep(1)
    pm2 = t.eval(
        "(function(){var d=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;"
        "return d?d.presentedMediaTime:null;})()"
    )
    t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
    return {"pm1": pm1, "pm2": pm2, "frozen": pm1 == pm2, "canvasPresentDuringPause": bool(canvas_present)}


LAT_JS = """(function(){
  var DELAY = __DELAY__;
  function r3(x){ return (x===null||x===undefined||typeof x!=='number'||isNaN(x))?null:Math.round(x*1000)/1000; }
  function playerVideoRect(){
    var v=document.querySelector('#movie_player video')||document.querySelector('video');
    return v?v.getBoundingClientRect():null;
  }
  var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[]; for(var i=0;i<r.length;i++) r[i].__seen=1;
  var life=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{};
  var st={v:0,p:0,vDropped:0,vms:[],pms:[],t0:performance.now(),stopped:false,raf:0,cov:0,frames:0,
          vAt:[],vAtUseful:[],vDroppedSeries:[],life0:JSON.parse(JSON.stringify(life)),
          delayFrames:[],delaySnaps:[],lastSnapMt:null,delayStatsStart:null,delayStatsEnd:null};
  if (DELAY && window.__TS_DELAY_STATS) {
    try { st.delayStatsStart = window.__TS_DELAY_STATS().stats; } catch(e) { st.delayStatsStart = null; }
  }
  (function raf(){ if(st.stopped) return; st.raf++;
    var hosts=document.querySelectorAll('.ts-gaze-vregion-clip > *');
    var up=0, patches=DELAY?[]:null, vr=DELAY?playerVideoRect():null;
    for(var i=0;i<hosts.length;i++){
      if(getComputedStyle(hosts[i]).display!=='none'){
        up++;
        if (DELAY && vr && vr.width>0 && vr.height>0) {
          var rect=hosts[i].getBoundingClientRect();
          if (rect.width>0 && rect.height>0) {
            patches.push([r3((rect.left-vr.left)/vr.width), r3((rect.top-vr.top)/vr.height),
                          r3((rect.right-vr.left)/vr.width), r3((rect.bottom-vr.top)/vr.height)]);
          }
        }
      }
    }
    if(up) st.cov++; st.frames++;
    if (DELAY) {
      var ds = window.__TS_DELAY_STATS ? window.__TS_DELAY_STATS() : null;
      var pm = ds ? ds.presentedMediaTime : null;
      if (st.delayFrames.length < 6000) st.delayFrames.push({pm: r3(pm), p: patches || []});
      if (ds && ds.snapshots && ds.snapshots.mediaTime !== st.lastSnapMt) {
        st.lastSnapMt = ds.snapshots.mediaTime;
        if (st.delaySnaps.length < 6000) {
          st.delaySnaps.push({mt: r3(ds.snapshots.mediaTime), tr: (ds.snapshots.tracks || []).map(function(t){
            var b=t.box||{}; return {id:t.id, box:[r3(b.x1),r3(b.y1),r3(b.x2),r3(b.y2)], state:t.state};
          })});
        }
      }
    }
    requestAnimationFrame(raf); })();
  var iv=setInterval(function(){
    var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[];
    for(var i=0;i<r.length;i++){ var e=r[i]; if(!e||e.__seen) continue; e.__seen=1;
      if(e.v){
        // A stage entry only reaches `mark('tracks')` (init-entry.js,
        // right after updatePersonTracks) once it is PAST the epoch-drop
        // check -- the branch that bumps `passDropped` and returns early
        // never runs it. So `typeof e.tracks !== 'number'` is exactly a
        // dropped pass (phase-i I7): it still gets counted in `st.v`/
        // `vAt` (banked as `passesAll`/the raw series below, unchanged
        // shape), but excluded from `vAtUseful`, which is what gaps are
        // computed from now.
        var useful=typeof e.tracks==='number';
        st.v++;
        if(!useful) st.vDropped++;
        if(typeof e.end==='number'){ st.vms.push(Math.round(e.end)); }
        var atMs=Math.round(performance.now()-st.t0);
        st.vAt.push(atMs);
        st.vDroppedSeries.push(useful?0:1);
        if(useful) st.vAtUseful.push(atMs);
      }
      else { st.p++; if(typeof e.end==='number') st.pms.push(Math.round(e.end)); } }
  },200);
  window.__TS_LAT=function(){ clearInterval(iv); st.stopped=true;
    st.secs=(performance.now()-st.t0)/1000;
    st.rafHz=Math.round(st.raf/st.secs*10)/10;
    st.coverage=Math.round(st.cov/Math.max(1,st.frames)*1000)/1000;
    st.life=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{};
    st.tuning=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.tuning)||null;
    st.slots=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.slots||[]).slice(-3);
    // Engine health (native-inference round, phase-j J10): which engine
    // carried the player, and whether the WebGL fallback still EXISTS.
    st.native=window.__TS_GAZE_NATIVE||null;
    st.worker={backend:(window.__TS_GAZE_WORKER||{}).backend||null, dead:!!(window.__TS_GAZE_WORKER||{}).dead};
    st.delay=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;
    if (DELAY && window.__TS_DELAY_STATS) {
      try { st.delayStatsEnd = window.__TS_DELAY_STATS().stats; } catch(e) { st.delayStatsEnd = null; }
    }
    var v=document.querySelector('video'); st.video={paused:v.paused,t:v.currentTime,w:v.videoWidth,h:v.videoHeight};
    return JSON.stringify(st);};
  return 'started';})()"""


PLANT_FILE = os.environ.get("TS_PLANT_FILE")


def plant(t):
    """Task 5 kill-switch arm: TS_PLANT_FILE names a JS file evaluated on
    every new document of this CDP session BEFORE the app's own scripts
    (e.g. a getter that pins window.__TS_GAZE_TUNING__ to NATIVE_INFER 0),
    so an arm can be run on one build without pushing rules."""
    if not PLANT_FILE:
        return
    src = open(PLANT_FILE, encoding="utf-8").read()
    t.cmd("Page.enable")
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source=src)


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    plant(t)
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(6)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    plant(t)
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(26)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%f; v.play();} return 1;})()" % SEEK)

    refillWindowMs = None
    if DELAY:
        t0r = time.time()
        refillWindowMs = measure_refill(t)
        spent = time.time() - t0r
        time.sleep(max(0.0, 12.0 - spent))
    else:
        time.sleep(12)

    pre = t.eval("(function(){var v=document.querySelector('video');return JSON.stringify({paused:v.paused,t:v.currentTime,w:v.videoWidth,h:v.videoHeight,bundle:window.__TS_GAZE_BUNDLE__,mode:window.__TS_GAZE_MODE})})()")
    print("pre", pre)
    t.eval(LAT_JS.replace("__DELAY__", "true" if DELAY else "false"))

    geom = None
    pause = None
    if DELAY:
        half = SECS * 0.5
        seventy = SECS * 0.7
        time.sleep(half)
        geom = check_geometry(t)
        time.sleep(max(0.0, seventy - half))
        t_pause0 = time.time()
        pause = check_pause(t)
        pause_spent = time.time() - t_pause0
        time.sleep(max(0.0, SECS - seventy - pause_spent))
    else:
        time.sleep(SECS)

    raw = t.eval("(function(){return window.__TS_LAT?window.__TS_LAT():'{}';})()")
    st = json.loads(raw) if isinstance(raw, str) else (raw or {})
    # PHASE-I I7: `st["vAt"]` includes passes the epoch guard DISCARDED
    # (`passDropped`) -- they still get a stage entry with `v:1`, so a gap
    # computed over the whole series mixes cadence gaps with drop-forced
    # near-zero gaps (`lastZoomAt = 0` on drop) and cut-forced ones. Gaps
    # are computed over `vAtUseful` -- the entries that reached
    # `mark('tracks')`, i.e. were NOT dropped -- only. The full raw series
    # (`vAt` + a same-length `vDroppedSeries` of 0/1 flags) is banked
    # alongside it so a re-derivation offline does not need a fresh device
    # run to change how the gap is computed.
    vAtUseful = st.get("vAtUseful", [])
    gaps = [b - a for a, b in zip(vAtUseful, vAtUseful[1:])]
    life0 = st.get("life0", {})
    life = st.get("life", {})
    dl = {k: life.get(k, 0) - life0.get(k, 0) for k in
          ("positionPassSkipped", "positionYieldVerdict", "genderReadSkipped", "personPassSkipped", "coastExpired", "cutCoastExpired",
           "birthFresh", "birthBlurred", "delayVerdictLate", "faceNoShape", "passDropped", "wipeErasedBlurred", "cutDetected",
           "nativePasses", "nativeReplies", "nativeErrors", "nativeDead", "nativeFailed", "nativeReady")}
    out = {
        "label": LABEL, "video": VIDEO, "seek": SEEK, "secs": round(st.get("secs", 0), 1),
        "bundle": json.loads(pre).get("bundle") if isinstance(pre, str) else None,
        # "verdicts" now means USEFUL verdicts -- passes that were not
        # dropped by the epoch guard and actually reached the tracker.
        # "passesAll" is the OLD meaning of "verdicts" (every stage entry
        # with v:1, dropped or not) -- kept under its own name so nothing
        # that read the old field silently gets a smaller number under
        # the same key. "verdictsDropped" is the other half of passesAll.
        "verdicts": len(vAtUseful), "verdictsDropped": st.get("vDropped"),
        "passesAll": st.get("v"), "positions": st.get("p"),
        "verdictMsP50": pct(st.get("vms", []), 0.5), "verdictMsP95": pct(st.get("vms", []), 0.95),
        "positionMsP50": pct(st.get("pms", []), 0.5),
        "verdictGapP50": pct(gaps, 0.5), "verdictGapP95": pct(gaps, 0.95),
        # Old field, unchanged meaning (secs / OLD "verdicts", i.e. every
        # stage entry). secsPerVerdictUseful is the corrected reading I7
        # asked for -- 1.53s vs 2.94s, not the mixture this used to print.
        "secsPerVerdict": round(st.get("secs", 0) / max(1, st.get("v", 0)), 2),
        "secsPerVerdictUseful": round(st.get("secs", 0) / max(1, len(vAtUseful)), 2),
        "rafHz": st.get("rafHz"), "coverage": st.get("coverage"),
        # Raw per-entry series, banked going forward (I7): the ms-since-t0
        # of every verdict-shaped stage entry, and a same-length 0/1 flag
        # for "this one was dropped". Lets a future reducer re-derive
        # useful/all/cut-forced/free-running gap series offline without a
        # fresh device run.
        "vAtMs": st.get("vAt", []), "vDroppedFlags": st.get("vDroppedSeries", []),
        "lifeDelta": dl, "tuning": (st.get("tuning") or {}).get("applied"),
        "coastMs": (st.get("tuning") or {}).get("coastMs"), "toldMs": (st.get("tuning") or {}).get("toldMs"),
        "slotsN": [s.get("n") for s in st.get("slots", [])], "delay": st.get("delay"), "video_state": st.get("video"),
        "native": st.get("native"), "worker": st.get("worker"),
    }
    if DELAY:
        arm = build_delay_arm(st.get("delaySnaps", []), st.get("delayFrames", []),
                               st.get("delayStatsStart"), st.get("delayStatsEnd"), dl)
        arm["refillWindowMs"] = refillWindowMs
        arm["geometry"] = geom
        arm["pauseCheck"] = pause
        arm["fullscreenChecked"] = False
        arm["miniplayerChecked"] = False
        arm["note"] = "fullscreen and miniplayer need real input events; a separate probe covers those"
        out["delayArm"] = arm
    with open(os.path.join(HERE, "latency-ab-%s.json" % LABEL), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


# --- offline selftest: no device, no network, exercises the reducers -----

def _selftest():
    print("== compute_entry_lag ==")
    snapsA = [
        {"mt": 5.0, "tr": [{"id": "A", "box": [0.2, 0.2, 0.4, 0.4], "state": "blurred"}]},
        {"mt": 5.5, "tr": [
            {"id": "A", "box": [0.2, 0.2, 0.4, 0.4], "state": "blurred"},
            {"id": "B", "box": [0.6, 0.6, 0.8, 0.8], "state": "blurred"},
        ]},
    ]
    framesA = [
        {"pm": 4.9, "p": []},
        {"pm": 5.0, "p": [[0.2, 0.2, 0.4, 0.4]]},                                    # A: patch already on birth frame -> lag 0
        {"pm": 5.2, "p": [[0.2, 0.2, 0.4, 0.4]]},
        {"pm": 5.5, "p": [[0.2, 0.2, 0.4, 0.4]]},                                    # B born here, no B patch yet
        {"pm": 5.75, "p": [[0.2, 0.2, 0.4, 0.4], [0.6, 0.6, 0.8, 0.8]]},             # B patch lands 250ms later
    ]
    lagsA = compute_entry_lag(snapsA, framesA)
    print("lags (s):", lagsA)
    assert lagsA == [0.0, 0.25], lagsA

    print("== compute_exit_hang ==")
    snapsB = [
        {"mt": 8.0, "tr": [{"id": "C", "box": [0.3, 0.3, 0.5, 0.5], "state": "blurred"}]},
        {"mt": 8.5, "tr": []},   # C dies, last seen at md=8.0
    ]
    framesB = [
        {"pm": 7.9, "p": [[0.3, 0.3, 0.5, 0.5]]},   # before death, ignored
        {"pm": 8.0, "p": [[0.3, 0.3, 0.5, 0.5]]},   # at death, still overlapping -> counts
        {"pm": 8.2, "p": [[0.3, 0.3, 0.5, 0.5]]},   # still overlapping -> counts
        {"pm": 8.4, "p": []},                       # gone -> does not count
        {"pm": 8.6, "p": []},
    ]
    hangsB = compute_exit_hang(snapsB, framesB)
    print("hangs (frames):", hangsB)
    assert hangsB == [2], hangsB

    print("== compute_exit_hang, clean removal (0) ==")
    snapsC = [
        {"mt": 12.0, "tr": [{"id": "D", "box": [0.0, 0.0, 0.2, 0.2], "state": "blurred"}]},
        {"mt": 12.5, "tr": []},
    ]
    framesC = [
        {"pm": 12.0, "p": []},
        {"pm": 12.3, "p": []},
    ]
    hangsC = compute_exit_hang(snapsC, framesC)
    print("hangs (frames):", hangsC)
    assert hangsC == [0], hangsC

    print("== compute_exit_hang, a later re-entry is not the hang ==")
    framesD = [
        {"pm": 12.0, "p": [[0.0, 0.0, 0.2, 0.2]]},   # still covered
        {"pm": 12.1, "p": []},                       # clean -> hang ends at 1
        {"pm": 14.0, "p": [[0.0, 0.0, 0.2, 0.2]]},   # someone back in the same spot
        {"pm": 14.1, "p": [[0.0, 0.0, 0.2, 0.2]]},
    ]
    hangsD = compute_exit_hang(snapsC, framesD)
    print("hangs (frames):", hangsD)
    assert hangsD == [1], hangsD

    print("== build_delay_arm (entry-lag scenario) ==")
    armA = build_delay_arm(snapsA, framesA, {"presented": 100}, {"presented": 150}, {"delayVerdictLate": 3})
    print(json.dumps(armA, indent=1))
    assert armA["entryLagMediaMs"]["n"] == 2
    # pct() is nearest-rank (matches the rest of this file), not
    # interpolated -- p50 of a 2-item sorted list is index round(0.5)=0.
    assert armA["entryLagMediaMs"]["p50"] == 0.0
    assert armA["entryLagMediaMs"]["p95"] == 250.0
    assert armA["entryLagMediaMs"]["nNonPositive"] == 1
    assert armA["delayVerdictLateFrac"] == 3 / 50.0
    assert armA["presentedDelta"] == 50

    print("== build_delay_arm (exit-hang scenario) ==")
    armB = build_delay_arm(snapsB, framesB, None, None, {})
    print(json.dumps(armB, indent=1))
    assert armB["exitHangFrames"] == {"n": 1, "p50": 2, "p95": 2, "max": 2}
    assert armB["delayVerdictLateFrac"] is None  # no stats -> no presented delta -> no fraction

    print("== patchesOutsidePlayer ==")
    framesOut = [
        {"pm": 1.0, "p": [[-0.05, 0.0, 0.10, 0.10]]},   # off the left edge -> outside
        {"pm": 1.1, "p": [[0.0, 0.0, 1.02, 1.0]]},        # spills past the right edge -> outside
        {"pm": 1.2, "p": [[0.1, 0.1, 0.3, 0.3]]},         # fully inside -> not counted
    ]
    armOut = build_delay_arm([], framesOut, None, None, {})
    print("patchesOutsidePlayer:", armOut["patchesOutsidePlayer"])
    assert armOut["patchesOutsidePlayer"] == 2

    print("selftest OK")


if __name__ == "__main__":
    if LABEL == "selftest":
        _selftest()
    else:
        main()
