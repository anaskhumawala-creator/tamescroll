# WHAT THE PAGE ACTUALLY RECEIVES, rather than what CDP was asked to send.
#
# probe_mini_multitouch found the player committing to mini on a
# two-finger gesture with ZERO touchcancel, which contradicts
# miniplayer.mjs's own comment ("Android WebView fires touchcancel ...
# a second finger landing"). Before believing either, log the real event
# stream: type, touches.length, changedTouches ids, and the point
# touchXY() would have picked (touches[0] || changedTouches[0]).
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(25)

t.eval("""(function(){
  window.__TS_LOG=[];
  ['touchstart','touchmove','touchend','touchcancel'].forEach(function(k){
    document.addEventListener(k,function(e){
      var pick=(e.touches&&e.touches[0])||(e.changedTouches&&e.changedTouches[0]);
      window.__TS_LOG.push({t:k,n:e.touches?e.touches.length:-1,
        ch:[].map.call(e.changedTouches||[],function(p){return p.identifier;}),
        ids:[].map.call(e.touches||[],function(p){return p.identifier;}),
        px:pick?Math.round(pick.clientX):null, py:pick?Math.round(pick.clientY):null,
        pid:pick?pick.identifier:null});
    },{capture:true,passive:true});
  });
  return 1;})()""")

def box():
    return t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      if(!pc) return null; var r=pc.getBoundingClientRect();
      return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),
              h:Math.round(r.height),
              mini:document.documentElement.classList.contains('ts-mini')};})()""")

def touch(kind, pts):
    t.cmd("Input.dispatchTouchEvent", type=kind,
          touchPoints=[{"x": p[0], "y": p[1], "id": p[2]} for p in pts])

out = {}
b = box(); out["start"] = b
cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2
t.eval("window.__TS_LOG=[]")

touch("touchStart", [(cx - 40, cy, 1)]); time.sleep(0.06)
touch("touchStart", [(cx - 40, cy, 1), (cx + 60, cy, 2)]); time.sleep(0.06)
for d in (20, 50, 90, 130):
    touch("touchMove", [(cx - 40, cy + d, 1), (cx + 60, cy, 2)]); time.sleep(0.06)
out["mid"] = box()
touch("touchEnd", [(cx + 60, cy, 2)]); time.sleep(0.3)
out["after_A_up"] = box()
touch("touchEnd", []); time.sleep(1.2)
out["after_both_up"] = box()
out["log"] = t.eval("(function(){return JSON.stringify(window.__TS_LOG);})()")
print(json.dumps(out, indent=1))
