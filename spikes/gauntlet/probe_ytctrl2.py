# THE THIRD INSTANCE OF THE CLASS: YOUTUBE'S OWN PLAYER CONTROLS.
#
# inPlayer(target) is `#player-container-id`.contains(target), and every
# control YouTube draws -- play/pause, seek, fullscreen, settings --
# lives under #player-control-container, a child of that same container.
# So our drag arms on top of THEIR controls too, and inOurControls
# cannot save them.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")

Q = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var v=document.querySelector('#movie_player video');
  return {mini:document.documentElement.classList.contains('ts-mini'),
   drag:document.documentElement.classList.contains('ts-mini-drag'),
   paused:v?v.paused:null, t:v?Math.round(v.currentTime*10)/10:null,
   box:r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""
BTNS = """(function(){
  var ov=document.querySelector('#player-control-overlay');
  if(!ov) return [];
  var out=[];
  ov.querySelectorAll('button').forEach(function(el){
    var r=el.getBoundingClientRect();
    if(r.width<24||r.height<24) return;
    out.push({label:(el.getAttribute('aria-label')||'').slice(0,26),
              cx:Math.round(r.left+r.width/2), cy:Math.round(r.top+r.height/2)});
  });
  return out;})()"""

def tap(x,y,w=1.0):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)

def reveal():
    s=t.eval(Q)
    if s["mini"]:
        b=s["box"]; tap(b[0]+b[2]//2, b[1]+b[3]//2, 1.6); s=t.eval(Q)
    b=s["box"]; tap(b[0]+b[2]//2, b[1]+b[3]//2, 0.7)
    return t.eval(BTNS)

def press_roll(x,y,d):
    before=t.eval(Q)
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x+1,"y":y+int(d*i/3)}]); time.sleep(0.05)
    mid=t.eval(Q)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.5)
    aft=t.eval(Q)
    return {"roll":d, "midDrag":mid["drag"], "midBox":mid["box"],
            "after":aft["box"], "mini":aft["mini"],
            "paused":[before["paused"], aft["paused"]]}

btns = reveal()
print("controls found:", json.dumps([b["label"] for b in btns]))
rows=[]
for b in btns:
    if not b["label"]: continue
    fresh = reveal()
    m = [x for x in fresh if x["label"]==b["label"]]
    if not m: continue
    c=m[0]
    r0 = press_roll(c["cx"], c["cy"], 0)
    reveal()
    r25 = press_roll(c["cx"], c["cy"], 25)
    rows.append({"ctrl":b["label"], "roll0":r0, "roll25":r25})
print(json.dumps(rows, indent=1))
