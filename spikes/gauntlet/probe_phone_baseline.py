# THE CONTROL ARM, BANKED ON REAL HARDWARE, so the moment 1068 is
# installed the comparison is one probe away. Also answers his accuracy
# complaint ("it blurs males") with the reads the pipeline actually made,
# and measures coverage duty -- what fraction of the time a patch is up.
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9225
LABEL=sys.argv[2] if len(sys.argv)>2 else "1067-control"
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(12)
# in-page duty collector: is a patch up, sampled every rAF
t.eval("""(function(){
  if(window.__TS_DUTY) return 'already';
  var on=0,off=0,stop=false;
  function tick(){ if(stop) return;
    (document.querySelectorAll('.ts-gaze-vregion-host').length? on++ : off++);
    requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
  window.__TS_DUTY=function(){stop=true; return [on,off];};
  return 'started';})()""")
D = """(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){return {err:String(e).slice(0,50)};}
  if(!d) return {err:'no diag'};
  var p=d.player||{};
  return {passes:p.passes, passP50:p.passP50, verdictP50:p.verdictP50, verdictP95:p.verdictP95,
    slotsN:(p.slots||[]).map(function(s){return s.n;}),
    reads:(p.reads||[]).map(function(r){return [r.g, r.s, r.px];}),
    worker:d.worker||null, bundle:window.__TS_GAZE_BUNDLE__||null};})()"""
a=t.eval(D); t0=time.time()
time.sleep(150)
b=t.eval(D); t1=time.time()
duty=t.eval("(function(){var d=window.__TS_DUTY?window.__TS_DUTY():[0,0]; return d;})()")
dt=t1-t0
reads=b.get("reads") or []
from collections import Counter
g=Counter(r[0] for r in reads)
px=[r[2] for r in reads if r[2]]
px.sort()
out={"label":LABEL,"windowSecs":round(dt,1),
  "passesInWindow":(b.get("passes") or 0)-(a.get("passes") or 0),
  "passesPerMin":round(((b.get("passes") or 0)-(a.get("passes") or 0))*60.0/dt,1),
  "secsPerVerdict":round(dt/max(1,((b.get("passes") or 0)-(a.get("passes") or 0))),2),
  "passP50":b.get("passP50"), "verdictP50":b.get("verdictP50"), "verdictP95":b.get("verdictP95"),
  "slotsN":b.get("slotsN"), "worker":b.get("worker"), "bundle":b.get("bundle"),
  "readsN":len(reads), "genderCounts":dict(g),
  "facePx_p50": px[len(px)//2] if px else None, "facePx_min": px[0] if px else None,
  "facePx_max": px[-1] if px else None,
  "coverageDuty": round(duty[0]/max(1,(duty[0]+duty[1])),3) if isinstance(duty,list) else None,
  "dutyFrames": duty}
print(json.dumps(out, indent=1))
