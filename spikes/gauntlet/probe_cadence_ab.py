# THE A/B THAT DECIDES WHETHER THIS SHIPS: passes per minute and verdict
# cost, same machine, same video, same window length. Run once before the
# new build is installed and once after.
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9224
LABEL=sys.argv[2] if len(sys.argv)>2 else "arm"
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(30)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(12)
D = """(function(){
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){return {err:String(e).slice(0,50)};}
  if(!d) return {err:'no diag'};
  var p=d.player||{};
  return {passes:p.passes, passP50:p.passP50, verdictP50:p.verdictP50,
    verdictP95:p.verdictP95, attached:p.attached,
    slotsN:(p.slots||[]).map(function(s){return s.n;}),
    bundle:window.__TS_GAZE_BUNDLE__||null,
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length};})()"""
a=t.eval(D); t0=time.time()
time.sleep(120)
b=t.eval(D); t1=time.time()
dt=t1-t0
out={"label":LABEL,"windowSecs":round(dt,1),"before":a,"after":b}
if isinstance(a,dict) and isinstance(b,dict) and a.get("passes") is not None:
    out["passesInWindow"]=b["passes"]-a["passes"]
    out["passesPerMin"]=round((b["passes"]-a["passes"])*60.0/dt,1)
    out["secsPerVerdict"]=round(dt/max(1,(b["passes"]-a["passes"])),2)
print(json.dumps(out, indent=1))
