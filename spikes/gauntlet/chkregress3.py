import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var pill=document.querySelector('.ts-gaze-pill');
  var btns=document.querySelector('#ts-mini-btns');
  var bs=btns?btns.querySelectorAll('button'):[];
  var v=document.querySelector('#movie_player video');
  var out=[];
  for(var i=0;i<bs.length;i++){var q=bs[i].getBoundingClientRect();
    out.push({label:(bs[i].getAttribute('aria-label')||'').slice(0,24),
              cx:Math.round(q.left+q.width/2), cy:Math.round(q.top+q.height/2)});}
  return {mini:document.documentElement.classList.contains('ts-mini'),
   drag:document.documentElement.classList.contains('ts-mini-drag'),
   pill:pill?getComputedStyle(pill).display:null, paused:v?v.paused:null, btns:out,
   box:r?[r.x|0,r.y|0,r.width|0,r.height|0]:null};})()"""
def settle(n=3):
    for _ in range(n):
        time.sleep(1.2)
    return t.eval(Q)
def drag(x,y,dy,steps=6):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+int(dy*i/steps)}]); time.sleep(0.04)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); return settle()
def tap(x,y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); return settle()
s=settle()
if s["mini"]: s=tap(s["box"][0]+s["box"][2]//2, s["box"][1]+s["box"][3]//2)
print("full        :", json.dumps({k:s[k] for k in ("mini","box","pill")}))
b=s["box"]
# start the drag off the buttons: 40px in from the left edge, mid height
m=drag(b[0]+40, b[1]+b[3]//2, 140)
print("drag (edge) :", json.dumps({"mini":m["mini"],"box":m["box"],"pill":m["pill"],"nbtns":len(m["btns"])}))
pp=[x for x in m["btns"] if "ause" in x["label"] or "lay" in x["label"]]
if pp:
    r=tap(pp[0]["cx"], pp[0]["cy"])
    print("play/pause  : paused", m["paused"], "->", r["paused"], "| mini", r["mini"], r["box"]); m=r
r=tap(m["box"][0]+m["box"][2]//2, m["box"][1]+m["box"][3]//2)
print("tap body    :", json.dumps({"mini":r["mini"],"box":r["box"],"pill":r["pill"]}))
