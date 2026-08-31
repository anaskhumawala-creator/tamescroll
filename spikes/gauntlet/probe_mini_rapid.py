# THE IMPATIENT THUMB: a second gesture that starts DURING the landing
# transition. An earlier session saw the player stuck mid-drag at scale
# 0.906 on a second minimise and could not reproduce it; 1057 blamed
# touchcancel. This asks the other question -- what happens when a new
# touchstart arrives before the previous verdict has finished animating.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1})()")
time.sleep(6)
Q = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var cs=pc?getComputedStyle(pc):null;
  return {mini:document.documentElement.classList.contains('ts-mini'),
   drag:document.documentElement.classList.contains('ts-mini-drag'),
   tf:cs?cs.transform:null,
   box:r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""
def gesture(x,y,dy,steps=6,gap=0.04):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.04)
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(dy*i/steps)}]); time.sleep(gap)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
def settle():
    time.sleep(3.0); return t.eval(Q)
s=settle()
if s["mini"]:
    b=s["box"]; gesture(b[0]+b[2]//2,b[1]+b[3]//2,-2,2); s=settle()
print("full         :", json.dumps({k:s[k] for k in ("mini","box")}))
b=s["box"]; X=b[0]+40; Y=b[1]+b[3]//2
for delay in (0.10, 0.18, 0.30):
    # minimise, then interrupt the landing after `delay`
    gesture(X,Y,140)
    time.sleep(delay)
    mid=t.eval(Q)
    gesture(X,Y,140)
    after=settle()
    print("interrupt @%.2fs" % delay, json.dumps({"midBox":mid["box"],"midDrag":mid["drag"],
          "afterMini":after["mini"],"afterBox":after["box"],"afterDrag":after["drag"]}))
    # restore for the next round
    cur=t.eval(Q)
    if cur["mini"]:
        cb=cur["box"]; gesture(cb[0]+cb[2]//2,cb[1]+cb[3]//2,-2,2); print("   restored ->", json.dumps(settle()["box"]))
