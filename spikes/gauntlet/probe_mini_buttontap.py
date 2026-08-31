# TAPPING THE MINI PLAYER, WITH A REAL THUMB'S ROLL.
#
# While mini, claimAxis also claims SIDEWAYS at CLAIM_PX -- and sideways
# means the throw-away: opacity fades and a big enough travel stops the
# video and dismisses it. The mini box is only 231px wide and carries
# play/pause and close buttons, so a tap on a button that rolls a little
# is an ordinary thing to do. Does it fade? Does the button still fire?
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

def minimise():
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.15)
    for dy in (20,40,65,90,110):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(0.1)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.8)

STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var v=document.querySelector('video');
  var r=pc?pc.getBoundingClientRect():null;
  var btns=[].slice.call(document.querySelectorAll('.ts-mini-btn,[class*="ts-mini-btn"]'));
  return {mini:document.documentElement.classList.contains('ts-mini'),
    gone:document.documentElement.classList.contains('ts-mini-gone'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    opacity:pc?getComputedStyle(pc).opacity:null,
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    paused:v?v.paused:null, t:v?Math.round(v.currentTime):null,
    buttons:btns.length,
    btnBoxes:btns.map(function(b){var q=b.getBoundingClientRect();
      return [Math.round(q.left+q.width/2),Math.round(q.top+q.height/2)];})};})()"""

minimise()
base=t.eval(STATE)
out={"after minimise":base}
if not base["mini"]:
    print(json.dumps({"err":"did not minimise","state":base}, indent=1)); raise SystemExit

def tap_at(x, y, rollx, label):
    before=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x+int(rollx*i/3), "y":y+2}])
        time.sleep(0.05)
    mid=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.4)
    after=t.eval(STATE)
    return {"label":label, "rollPx":rollx,
            "pausedBefore":before["paused"], "pausedAfter":after["paused"],
            "midOpacity":mid["opacity"], "afterOpacity":after["opacity"],
            "midDrag":mid["drag"], "afterMini":after["mini"],
            "afterGone":after["gone"], "afterBox":after["box"]}

# centre of the mini box, and each button, with 0 / 10 / 20 / 30px of roll
bx,by,bw,bh = base["box"]
cx,cy = bx+bw//2, by+bh//2
taps=[]
for roll in (0, 10, 20, 30):
    taps.append(tap_at(cx, cy, roll, "mini centre"))
    time.sleep(0.8)
for i,(px,py) in enumerate(base["btnBoxes"][:2]):
    for roll in (0, 20):
        taps.append(tap_at(px, py, roll, "button %d" % i))
        time.sleep(0.8)
out["taps"]=taps
out["final"]=t.eval(STATE)
print(json.dumps(out, indent=1))
