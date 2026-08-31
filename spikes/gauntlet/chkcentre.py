import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q="""(function(){var pc=document.querySelector('#player-container-id');var r=pc.getBoundingClientRect();
 var e=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
 var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
   return n.tagName+'.'+String(c).split(' ')[0];};
 return {mini:document.documentElement.classList.contains('ts-mini'),
  hitCentre:nm(e), centreIsBtn:!!(e&&e.closest&&e.closest('button')),
  box:[r.x|0,r.y|0,r.width|0,r.height|0]};})()"""
def tap(x,y,w=0.7):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)
def drag(x,y,dy,steps=6):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(dy*i/steps)}]); time.sleep(0.04)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(2.6)
    return t.eval(Q)
s=t.eval(Q)
if s["mini"]:
    tap(s["box"][0]+s["box"][2]//2, s["box"][1]+s["box"][3]//2, 2.6); s=t.eval(Q)
print("controls hidden:", json.dumps(s))
b=s["box"]; r=drag(b[0]+b[2]//2, b[1]+b[3]//2, 140)
print("  drag centre  -> mini", r["mini"], r["box"])
if r["mini"]: tap(r["box"][0]+r["box"][2]//2, r["box"][1]+r["box"][3]//2, 2.6)
s=t.eval(Q); b=s["box"]
tap(b[0]+30, b[1]+20, 0.6)   # reveal, off-button corner
s=t.eval(Q); print("controls shown :", json.dumps(s))
r=drag(s["box"][0]+s["box"][2]//2, s["box"][1]+s["box"][3]//2, 140)
print("  drag centre  -> mini", r["mini"], r["box"])
