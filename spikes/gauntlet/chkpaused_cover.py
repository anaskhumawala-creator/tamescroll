# Does a PAUSED frame keep its cover? Play until a patch exists, pause,
# then watch for 20s. A patch that disappears while the picture cannot
# change is an exposure; passes going idle while paused is only safe if
# the verdict PERSISTS.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable")
S = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){}
  return {paused:v?v.paused:null, t:v?+v.currentTime.toFixed(1):null,
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length,
    clip:document.querySelectorAll('.ts-gaze-vregion-clip').length,
    filter:v?getComputedStyle(v).filter:null,
    passes:d&&d.player?d.player.passes:null};})()"""
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=60; v.play();} return 1;})()")
rows=[]
got=False
for i in range(40):
    s=t.eval(S)
    if s.get("patches"):
        got=True; break
    time.sleep(2)
rows.append({"phase":"playing-with-patch","s":t.eval(S)})
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
for i in range(10):
    time.sleep(2)
    rows.append({"phase":"paused+%ds"%((i+1)*2),"s":t.eval(S)})
print(json.dumps({"reachedPatch":got,"rows":rows}, indent=1))
