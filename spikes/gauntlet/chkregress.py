# Regression after moving the pill's host: the mini player must still
# drag, land, restore, and hide the pill while mini.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable"); t.cmd("Input.enable")
Q = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var pill=document.querySelector('.ts-gaze-pill');
  var pv=pill?getComputedStyle(pill).display:null;
  var btns=document.querySelector('#ts-mini-btns');
  var v=document.querySelector('#movie_player video');
  return {mini:document.documentElement.classList.contains('ts-mini'),
   drag:document.documentElement.classList.contains('ts-mini-drag'),
   pillDisplay:pv, btns:!!btns, paused:v?v.paused:null,
   box:r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""
def drag(x,y,dy,cancel=False,steps=6):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(dy*i/steps)}]); time.sleep(0.04)
    mid=t.eval(Q)
    t.cmd("Input.dispatchTouchEvent", type="touchCancel" if cancel else "touchEnd", touchPoints=[]); time.sleep(1.4)
    return mid, t.eval(Q)
def tap(x,y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.4)
    return t.eval(Q)
s=t.eval(Q); print("start        :", json.dumps(s))
b=s["box"]; cx=b[0]+b[2]//2; cy=b[1]+b[3]//2
mid,aft = drag(cx,cy,140); print("drag 140 down:", json.dumps({"mini":aft["mini"],"box":aft["box"],"pill":aft["pillDisplay"],"btns":aft["btns"]}))
if aft["mini"]:
    mb=aft["box"]
    r=tap(mb[0]+mb[2]//2, mb[1]+mb[3]//2); print("tap mini body:", json.dumps({"mini":r["mini"],"box":r["box"],"pill":r["pillDisplay"]}))
mid,aft = drag(cx,cy,140,cancel=True); print("cancel mid   :", json.dumps({"midDrag":mid["drag"],"mini":aft["mini"],"box":aft["box"],"drag":aft["drag"]}))
mid,aft = drag(cx,cy,10); print("10px tap-roll:", json.dumps({"midDrag":mid["drag"],"box":aft["box"]}))
