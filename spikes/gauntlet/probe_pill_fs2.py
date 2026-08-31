import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q = """(function(){
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  var pill=document.querySelector('.ts-gaze-pill');
  var q=pill?pill.getBoundingClientRect():null;
  var e=document.querySelector('.fullscreen-icon');
  var r=e?e.getBoundingClientRect():null;
  var hit=r?document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)):null;
  return {fs:nm(fe), fsContainsPill:!!(fe&&pill&&fe.contains(pill)),
    pillBox:q?[q.x|0,q.y|0,q.width|0,q.height|0]:null,
    pillDisplay:pill?getComputedStyle(pill).display:null,
    btn:r?[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]:null,
    btnHittable: !!(hit&&hit.closest&&hit.closest('.fullscreen-icon')),
    vp:[innerWidth,innerHeight]};})()"""
b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0]+b[2]//2,"y":b[1]+b[3]//2}])
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(0.35)
s=t.eval(Q); print("revealed:", json.dumps({k:s[k] for k in ("btn","btnHittable","pillBox")}))
if s["btnHittable"]:
    x,y=s["btn"]
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
    time.sleep(4)
    print("fullscreen:", json.dumps(t.eval(Q)))
    t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
    time.sleep(4); print("exited:", json.dumps(t.eval(Q)))
else:
    print("controls not hittable at click time -- not measured")
