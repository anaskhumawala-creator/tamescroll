# HOW OFTEN DOES THE GHOST GATE ACTUALLY REFUSE A FACE ON HIS PHONE?
# It only consults when the person pass admitted NOBODY -- which on his
# hardware is EVERY pass. 1068's person-skip leaves 2 of 3 passes with
# no person evidence at all, so the gate cannot fire on them: if the
# refusals are frequent, the skip trades his "random blur marks here and
# there" for the speed.
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9225
SECS=float(sys.argv[2]) if len(sys.argv)>2 else 150.0
t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55;v.play();} return 1;})()")
time.sleep(12)
L="""(function(){var i=window.__TS_GAZE_IDS||{}; var l=i.life||{};
 return {faceNoShape:l.faceNoShape||0, bodyFromSlot:l.bodyFromSlot||0,
   passes:i.passesTotal||null, verdicts:i.verdictsTotal||null,
   ring:(i.stages||[]).length,
   bundle:window.__TS_GAZE_BUNDLE__||null};})()"""
a=t.eval(L); time.sleep(SECS); b=t.eval(L)
out={"secs":SECS,"before":a,"after":b,
 "faceNoShapeDelta":(b.get("faceNoShape") or 0)-(a.get("faceNoShape") or 0),
 "bodyFromSlotDelta":(b.get("bodyFromSlot") or 0)-(a.get("bodyFromSlot") or 0)}
print(json.dumps(out, indent=1))
