# Same question, coordinates re-read before EVERY gesture -- the first
# run reused the full-player centre after the player had already gone
# mini, so one trial's touches landed on the page and YouTube's own
# swipe took the app to landscape fullscreen. Stale coordinates after a
# state change is the recurring probe defect here.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  return {mini:document.documentElement.classList.contains('ts-mini'),
   drag:document.documentElement.classList.contains('ts-mini-drag'),
   vp:[innerWidth,innerHeight],
   box:r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""
def gest(dy, steps=6, gap=0.04, edge=True):
    s=t.eval(Q); b=s["box"]
    x = b[0]+40 if (edge and b[2]>200) else b[0]+b[2]//2
    y = b[1]+b[3]//2
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.04)
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(dy*i/steps)}]); time.sleep(gap)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
def settle(n=3.0):
    time.sleep(n); return t.eval(Q)
def toFull():
    s=t.eval(Q)
    if s["mini"]: gest(-2, steps=2); s=settle()
    return s
print("full      :", json.dumps(toFull()))
for delay in (0.12, 0.18, 0.24, 0.40):
    toFull()
    gest(140)                    # minimise
    time.sleep(delay)
    mid=t.eval(Q)
    gest(140)                    # interrupt with a second downward drag
    after=settle()
    print("interrupt @%.2f" % delay, json.dumps({"mid":mid["box"],"midDrag":mid["drag"],
       "mini":after["mini"],"box":after["box"],"drag":after["drag"],"vp":after["vp"]}))
