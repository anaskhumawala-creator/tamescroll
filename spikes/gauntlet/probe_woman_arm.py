# In the gender='woman' arm nothing was covered for 30 samples. Is that
# because no MAN is on screen, or because a man was read and not
# covered? Read the player's own verdict ring.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video');"
       "if(v){v.muted=true;v.currentTime=87;v.play();} return 1})()")
time.sleep(25)
cov=0
for i in range(30):
    time.sleep(2)
    if t.eval("(function(){return document.querySelectorAll('.ts-gaze-vregion-host').length})()")>0: cov+=1
d=t.eval("(function(){try{return window.__TS_DIAG_NOW?JSON.stringify(window.__TS_DIAG_NOW()):null}catch(e){return null}})()")
import json as _j
d=_j.loads(d) if isinstance(d,str) and d.startswith("{") else (d if isinstance(d,dict) else None)
p=(d or {}).get("player") or {}
print(json.dumps({"gender":"woman","covered":cov,
  "passes":p.get("passes"), "passFails":p.get("passFails"), "timeouts":p.get("timeouts"),
  "verdictP50":p.get("verdictP50"),
  "slotsNonZero": sum(1 for s in (p.get("slots") or []) if s.get("n")),
  "reads": p.get("reads")}, indent=1))
