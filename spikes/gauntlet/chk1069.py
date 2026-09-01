# 1069 sanity on the emulator: the pipeline still judges, the budget
# change did not stop passes, and the new monotonic counters climb.
import json, sys, time
from emu_cdp import page, Tab
PORT=9226
t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(40)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55;v.play();} return 1;})()")
D="""(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){return {err:String(e).slice(0,60)};}
  var p=(d&&d.player)||{}; var ids=window.__TS_GAZE_IDS||{};
  return {bundle:window.__TS_GAZE_BUNDLE__||null,
   backend:(d&&d.worker&&d.worker.backend)||null,
   attached:p.attached, passes:p.passes, verdicts:p.verdicts, passesRing:p.passesRing,
   waitMs: (function(){try{return Math.round(window.__TS_GAZE_WAIT||0);}catch(e){return null;}})(),
   passFails:p.passFails, timeouts:p.timeouts,
   imgTotal:window.__TS_GAZE_IMGTOTAL||0,
   hosts:document.querySelectorAll('.ts-gaze-vregion-host').length,
   paused:(function(){var v=document.querySelector('video');return v?v.paused:null;})()};})()"""
a=t.eval(D); time.sleep(60); b=t.eval(D)
print(json.dumps({"t0":a,"t60":b}, indent=1))
