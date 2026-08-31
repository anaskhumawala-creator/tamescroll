# Fixed: buttons live under #ts-mini-btns (the first version guessed a
# class and found none), and a tap on the mini player RESTORES it -- so
# every tap has to be preceded by a fresh minimise or the run measures
# a full player.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(6)

STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var v=document.querySelector('video');
  var r=pc?pc.getBoundingClientRect():null;
  var bar=document.getElementById('ts-mini-btns');
  var btns=bar?[].slice.call(bar.querySelectorAll('button')):[];
  return {mini:document.documentElement.classList.contains('ts-mini'),
    gone:document.documentElement.classList.contains('ts-mini-gone'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    opacity:pc?getComputedStyle(pc).opacity:null,
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    paused:v?v.paused:null,
    buttons:btns.length,
    btnBoxes:btns.map(function(b){var q=b.getBoundingClientRect();
      return [Math.round(q.left+q.width/2),Math.round(q.top+q.height/2),
              Math.round(q.width),Math.round(q.height)];}),
    btnLabels:btns.map(function(b){return b.getAttribute('aria-label');})};})()"""

def minimise():
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.15)
    for dy in (20,40,65,90,110):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(0.1)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.8)
    return t.eval(STATE)

def tap(x, y, rollx, label, st):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x+int(rollx*i/3), "y":y+2}])
        time.sleep(0.05)
    mid=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.5)
    after=t.eval(STATE)
    return {"label":label, "roll":rollx,
            "pausedBefore":st["paused"], "pausedAfter":after["paused"],
            "midOpacity":mid["opacity"], "midDrag":mid["drag"],
            "afterMini":after["mini"], "afterGone":after["gone"],
            "afterOpacity":after["opacity"], "afterBox":after["box"]}

out={}
first=minimise()
out["minimised"]={"mini":first["mini"],"box":first["box"],
                  "buttons":first["buttons"],"labels":first["btnLabels"],
                  "btnBoxes":first["btnBoxes"]}
rows=[]
for roll in (0, 10, 20, 30, 60):
    st=t.eval(STATE)
    if not st["mini"]: st=minimise()
    bx,by,bw,bh=st["box"]
    rows.append(tap(bx+bw//2, by+bh//2, roll, "mini centre", st))
for bi,lab in enumerate(first["btnLabels"] or []):
    for roll in (0, 20):
        st=t.eval(STATE)
        if not st["mini"]: st=minimise()
        if not st["buttons"]: break
        px,py,_,_=st["btnBoxes"][bi]
        rows.append(tap(px, py, roll, (lab or "btn%d"%bi)[:18], st))
out["taps"]=rows
print(json.dumps(out, indent=1))
