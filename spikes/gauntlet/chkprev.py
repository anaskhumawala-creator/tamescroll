import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q="""(function(){var pc=document.querySelector('#player-container-id');var r=pc.getBoundingClientRect();
 return {mini:document.documentElement.classList.contains('ts-mini'),
  drag:document.documentElement.classList.contains('ts-mini-drag'),box:[r.x|0,r.y|0,r.width|0,r.height|0]};})()"""
def tap(x,y,w=0.7):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)
s=t.eval(Q)
if s["mini"]:
    b=s["box"]; tap(b[0]+b[2]//2,b[1]+b[3]//2,1.6); s=t.eval(Q)
b=s["box"]; tap(b[0]+b[2]//2,b[1]+b[3]//2,0.6)
info=t.eval("""(function(){
  var ov=document.querySelector('#player-control-overlay');
  var btn=null; ov.querySelectorAll('button').forEach(function(e){
    if((e.getAttribute('aria-label')||'').indexOf('Previous')===0) btn=e;});
  if(!btn) return {err:'no prev button'};
  var r=btn.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  var e=document.elementFromPoint(cx,cy);
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+'.'+String(c).split(' ')[0];};
  return {cx:cx,cy:cy,w:r.width|0,h:r.height|0,vis:getComputedStyle(btn).visibility,
          op:getComputedStyle(btn).opacity, disabled:btn.disabled,
          hit:nm(e), hitIsBtn: !!(e&&e.closest&&e.closest('button'))};})()""")
print("prev button:", json.dumps(info))
if not info.get("err"):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":info["cx"],"y":info["cy"]}]); time.sleep(0.05)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":info["cx"]+1,"y":info["cy"]+int(25*i/3)}]); time.sleep(0.05)
    mid=t.eval(Q); t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.4)
    print("press+25:", json.dumps({"midDrag":mid["drag"],"midBox":mid["box"],"after":t.eval(Q)["box"]}))
