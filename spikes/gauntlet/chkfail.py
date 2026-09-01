import json, time
from emu_cdp import page, Tab
t=Tab(page(port=9226)); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
 var ids=window.__TS_GAZE_IDS||{};
 var d=null; try{d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW(); if(typeof d==='string')d=JSON.parse(d);}catch(e){}
 var p=(d&&d.player)||{};
 return {lastFail:ids.lastFail||null, passFails:ids.passFails||0,
   passes:ids.passesTotal||0, verdicts:ids.verdictsTotal||0,
   workerDead:(d&&d.worker&&d.worker.dead)||null,
   stages:(ids.stages||[]).slice(-3),
   cost:(ids.cost&&{v:(ids.cost.verdict||[]).slice(-3),p:(ids.cost.pass||[]).slice(-3)})||null};})()"""), indent=1))
