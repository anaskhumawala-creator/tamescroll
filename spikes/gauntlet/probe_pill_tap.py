# THE SAME DEFECT CLASS, IN THE SIBLING CONTROL.
#
# 1061 fixed the mini player's buttons: they live inside the player, so
# inPlayer(target) armed the drag on a button press. The blur pill is
# appended to #movie_player too -- same situation, and it is HIS blur
# switch. Does a tap on it toggle, and does a tap with thumb roll move
# the player?
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
time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(10)

STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var pill=document.querySelector('.ts-gaze-pill');
  var r=pc?pc.getBoundingClientRect():null;
  var q=pill?pill.getBoundingClientRect():null;
  return {pill:!!pill,
    label:pill?(pill.textContent||'').trim():null,
    pillBox:q?[Math.round(q.left+q.width/2),Math.round(q.top+q.height/2),
               Math.round(q.width),Math.round(q.height)]:null,
    mini:document.documentElement.classList.contains('ts-mini'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null};})()"""

def tap(x, y, roll):
    before=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x+1, "y":y+int(roll*i/3)}])
        time.sleep(0.05)
    mid=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.3)
    after=t.eval(STATE)
    return {"roll":roll, "labelBefore":before["label"], "labelAfter":after["label"],
            "toggled":before["label"]!=after["label"],
            "midDrag":mid["drag"], "midBox":mid["box"],
            "afterBox":after["box"], "afterMini":after["mini"]}

st=t.eval(STATE)
out={"pillPresent":st["pill"], "pillBox":st["pillBox"], "label":st["label"],
     "playerBox":st["box"]}
if not st["pill"]:
    print(json.dumps(out, indent=1)); raise SystemExit
px,py,_,_=st["pillBox"]
rows=[]
for roll in (0, 10, 20, 30, 60, 110):
    rows.append(tap(px,py,roll)); time.sleep(1.0)
out["taps"]=rows
print(json.dumps(out, indent=1))
