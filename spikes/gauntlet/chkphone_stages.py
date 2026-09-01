# WHERE DO THE 750ms GO? passP50 is the person (MoveNet) pass; verdict is
# the whole cycle including per-person crops + gender. The difference is
# the gender stage, which is the only part that scales with how many
# people are on screen.
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9225
t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
D = """(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){ return {err:String(e).slice(0,60)};}
  if(!d) return {err:'no diag'};
  var p=d.player||{}, r=d.render||{};
  var slots=(p.slots||[]);
  var n=slots.map(function(s){return s.n;});
  return {passes:p.passes, passP50:p.passP50, verdictP50:p.verdictP50,
    verdictP95:p.verdictP95, passFails:p.passFails, timeouts:p.timeouts,
    attached:p.attached, personsPerSlot:n,
    readsPx:(p.reads||[]).map(function(x){return x.px;}),
    readsG:(p.reads||[]).map(function(x){return x.g;}),
    render:{raf:r.raf, overlayFrames:r.overlayFrames, maskWrites:r.maskWrites,
            tfWrites:r.tfWrites, sizeWrites:r.sizeWrites},
    image:d.image||null, worker:d.worker||null,
    longTasks:d.longTasks||null, spendMs:d.spendMs||null,
    t:(document.querySelector('video')||{}).currentTime};})()"""
a=t.eval(D); time.sleep(45); b=t.eval(D)
print(json.dumps({"after45s":b,"before":a}, indent=1))
