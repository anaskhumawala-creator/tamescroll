import json
from emu_cdp import page, Tab
t=Tab(page(port=9226)); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
 var r=(window.__TS_GAZE_IMGDIAG||[]).slice(-14).map(function(e){
   return {why:e.why,msg:(e.msg||'').slice(0,40),ms:e.ms,w:e.w,where:e.where,faces:e.faces};});
 var w=null; try{var d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW(); if(typeof d==='string')d=JSON.parse(d); w=d&&d.worker;}catch(e){}
 return {ring:r, worker:w};})()"""), indent=1))
