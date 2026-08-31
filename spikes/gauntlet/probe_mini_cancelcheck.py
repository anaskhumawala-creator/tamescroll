# Did the touchcancel reach us, and did our handler let go?
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9224
t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(25)
t.eval("""(function(){window.__TS_CE=[];
 ['touchcancel','touchend'].forEach(function(k){
  document.addEventListener(k,function(e){
   window.__TS_CE.push({t:k,n:e.touches?e.touches.length:-1,
     ch:[].map.call(e.changedTouches||[],function(p){return p.identifier;})});
  },{capture:true,passive:true});});return 1;})()""")
def st():
    return t.eval("""(function(){var pc=document.getElementById('player-container-id');
      var r=pc.getBoundingClientRect();
      return {box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        mini:document.documentElement.classList.contains('ts-mini'),
        drag:document.documentElement.classList.contains('ts-mini-drag'),
        tf:(pc.style.transform||'').slice(0,50),
        ev:window.__TS_CE};})()""")
out={"start":st()}
b=out["start"]["box"]; x=b[0]+b[2]//2; y=b[1]+b[3]//2
# with an explicit id
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y,"id":7}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(140*i/8),"id":7}])
    time.sleep(0.03)
out["mid"]=st()
t.cmd("Input.dispatchTouchEvent", type="touchCancel", touchPoints=[])
time.sleep(1.6)
out["after_cancel_empty"]=st()

# --- same again with NO id on the touch points, which is what
# probe_mini_sweep67 sends ---
t.eval("window.__TS_CE=[]")
t.eval("""(function(){var c=document.getElementById('ts-mini-cover');
  if(c) c.click(); return 1;})()""")
time.sleep(1.4)
b=st()["box"]; x=b[0]+b[2]//2; y=b[1]+b[3]//2
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(140*i/8)}])
    time.sleep(0.03)
out["noid_mid"]=st()
t.cmd("Input.dispatchTouchEvent", type="touchCancel", touchPoints=[])
time.sleep(1.6)
out["noid_after_cancel"]=st()
print(json.dumps(out, indent=1))
