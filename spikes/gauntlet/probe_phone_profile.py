# THE FIRST REAL-HARDWARE PROFILE OF THE PLAYER PIPELINE. Every timing
# number in this repo is an emulator number (swiftshader, 10.5Hz rAF,
# ~13 passes a session). This is a Snapdragon 662, 60Hz display, WebView
# 151 -- the same WebView major as his daily phone, on slower silicon,
# so treat what it says as a FLOOR.
#
# Collected in page, because a CDP round trip is far slower than the
# thing being measured.
import json, sys, time
from emu_cdp import page, Tab
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t0=time.time()
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(22)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(10)

COLLECT = """(function(){
  if (window.__TS_PROF) return 'already';
  var frames=[], stop=false, last=performance.now();
  function tick(){
    if(stop) return;
    var now=performance.now();
    frames.push(now-last); last=now;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__TS_PROF=function(){ stop=true; return frames; };
  return 'started';})()"""
DIAG = """(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){ return {err:String(e).slice(0,60)}; }
  if(!d) return {err:'no diag'};
  return {player:d.player, worker:d.worker, image:d.image, engine:d.engine,
    longTasks:d.longTasks, spends:d.spends, mode:d.mode};})()"""
print(json.dumps({"collector": t.eval(COLLECT)}))
a = t.eval(DIAG); ta = time.time()
time.sleep(60)
b = t.eval(DIAG); tb = time.time()
raw = t.eval("(function(){var f=window.__TS_PROF?window.__TS_PROF():[]; return JSON.stringify(f.slice(0,6000));})()")
gaps = json.loads(raw) if isinstance(raw, str) else []
gaps = [g for g in gaps if g > 0]
gaps_sorted = sorted(gaps)
def pct(p):
    return round(gaps_sorted[int(len(gaps_sorted)*p)], 1) if gaps_sorted else None
out = {"device":"M2010J19SI (bengal / SD662), Android 12, WebView 151",
       "windowSecs": round(tb-ta,1),
       "rafFrames": len(gaps),
       "rafHz": round(len(gaps)/ (sum(gaps)/1000.0), 1) if gaps else None,
       "frameGapMs_p50": pct(0.5), "frameGapMs_p95": pct(0.95), "frameGapMs_max": round(max(gaps),1) if gaps else None,
       "diagBefore": a, "diagAfter": b}
print(json.dumps(out, indent=1))
