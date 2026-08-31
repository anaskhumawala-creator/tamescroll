# "LINUS DAUGHTER IS NOT BEING BLURRED INSTANTLY" (owner, 2026-09-01).
#
# Turns his report into a DURATION. Two independent instruments, because
# each alone can be argued with:
#
# 1. THE REFUSAL RUN. gateRefused now carries `ms`, so a run of
#    consecutive refusals with no kept face between them is a stretch
#    where the pipeline DETECTED a face and drew nothing for it. That is
#    ground truth for "a face was there and went uncovered", and its
#    length is the number his eye is reporting.
#
# 2. THE UNCOVERED GAP. An in-page rAF collector records patch count per
#    frame, so the gaps between covered runs are measured at frame
#    resolution rather than at CDP resolution (~1s here, which would
#    round every gap this probe is looking for down to nothing).
#
# HONEST LIMIT, stated up front: a frame with no patch is only an
# exposure if she is ON SCREEN, and this instrument cannot assert that.
# Instrument 1 can -- a refusal proves a detected face -- which is why
# both are here.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 110
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 180

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)

print("ARM", t.eval("""(function(){
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  var d=(window.__TS_GAZE_IDS=window.__TS_GAZE_IDS||{});
  d.gateRefused=[]; d.gateKept=[];
  window.__TS_INST=[]; window.__TS_INST_STOP=0;
  (function loop(){
    if(window.__TS_INST_STOP) return;
    try{
      var vv=document.querySelector('#movie_player video')||document.querySelector('video');
      if(vv){
        window.__TS_INST.push([
          Math.round(performance.now()),
          document.querySelectorAll('.ts-gaze-vregion-host').length,
          +vv.currentTime.toFixed(2),
          vv.paused?1:0]);
        if(window.__TS_INST.length>20000) window.__TS_INST_STOP=1;
      }
    }catch(e){}
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:v?Math.round(v.currentTime):null,
    bundle:window.__TS_GAZE_BUNDLE__, cfg:d.cfg});})()""" % SEEK))

time.sleep(DWELL)

raw = t.eval("""(function(){
  window.__TS_INST_STOP=1;
  var d=window.__TS_GAZE_IDS||{};
  return JSON.stringify({
    frames: window.__TS_INST||[],
    refused: (d.gateRefused||[]),
    kept: (d.gateKept||[]),
    life: d.life, passes: d.passesTotal, verdicts: d.verdictsTotal,
    slots: (d.slots||[]).map(function(s){return s.n;})
  });})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
frames = d.get("frames", [])
ref = d.get("refused", [])
kept = d.get("kept", [])

# --- instrument 1: refusal runs -------------------------------------
# Rings cap at 60 each, so merge on ms and walk the timeline.
ev = sorted(
    [(e.get("ms"), "r", e) for e in ref if isinstance(e.get("ms"), int)] +
    [(e.get("ms"), "k", e) for e in kept if isinstance(e.get("ms"), int)],
    key=lambda x: (x[0], x[1]),
)
runs = []
cur = None
for ms, kind, e in ev:
    if kind == "r":
        if cur is None:
            cur = [ms, ms, 1]
        else:
            cur[1] = ms; cur[2] += 1
    else:
        if cur is not None:
            runs.append(cur); cur = None
if cur is not None:
    runs.append(cur)
durs = sorted(r[1] - r[0] for r in runs)


def pct(a, q):
    if not a:
        return None
    return a[min(len(a) - 1, round((len(a) - 1) * q))]


print("REFUSAL_RUNS", json.dumps({
    "window_ms": (ev[-1][0] - ev[0][0]) if ev else None,
    "refused": len(ref), "kept": len(kept), "runs": len(runs),
    "runDurP50": pct(durs, 0.5), "runDurP90": pct(durs, 0.9),
    "runDurMax": durs[-1] if durs else None,
    "runsOver1s": sum(1 for x in durs if x >= 1000),
    "runsOver2s": sum(1 for x in durs if x >= 2000),
    "longest": max(runs, key=lambda r: r[1] - r[0]) if runs else None,
}))

# --- instrument 2: uncovered gaps ------------------------------------
play = [f for f in frames if not f[3]]
gaps = []
run_start = None
for i, f in enumerate(play):
    if f[1] == 0:
        if run_start is None:
            run_start = f[0]
    else:
        if run_start is not None:
            gaps.append(f[0] - run_start); run_start = None
gaps_sorted = sorted(gaps)
covered = sum(1 for f in play if f[1] > 0)
print("FRAMES", json.dumps({
    "frames": len(frames), "playing": len(play),
    "coveredFrac": round(covered / len(play), 3) if play else None,
    "rafHz": round(len(frames) / ((frames[-1][0] - frames[0][0]) / 1000.0), 1) if len(frames) > 2 else None,
    "gaps": len(gaps), "gapP50": pct(gaps_sorted, 0.5), "gapP90": pct(gaps_sorted, 0.9),
    "gapMax": gaps_sorted[-1] if gaps_sorted else None,
    "gapsOver1s": sum(1 for g in gaps_sorted if g >= 1000),
    "tSpan": [play[0][2], play[-1][2]] if play else None,
}))
print("LIFE", json.dumps({"life": d.get("life"), "passes": d.get("passes"),
                          "verdicts": d.get("verdicts"), "slots": d.get("slots")}))
