# DOES THE PILL SURVIVE FULLSCREEN NOW THAT IT HOSTS ON THE CONTAINER?
# 1065 moved it from #movie_player to #player-container-id. The argument
# was structural (YouTube's own controls live outside #movie_player and
# are visible in fullscreen). Measure it: synthetic touches never
# granted activation for requestFullscreen, so drive a real mouse click
# on YouTube's own fullscreen button.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q = """(function(){
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  var pill=document.querySelector('.ts-gaze-pill');
  var q=pill?pill.getBoundingClientRect():null;
  var vis=pill?getComputedStyle(pill).display:null;
  return {fs:nm(fe), fsContainsPill: !!(fe&&pill&&fe.contains(pill)),
    pillBox:q?[q.x|0,q.y|0,q.width|0,q.height|0]:null, pillDisplay:vis,
    vp:[innerWidth,innerHeight]};})()"""
def mouse(x,y):
    for ty in ("mousePressed","mouseReleased"):
        t.cmd("Input.dispatchMouseEvent", type=ty, x=x, y=y, button="left", clickCount=1)
        time.sleep(0.06)
def tap(x,y,w=0.8):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)
b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
tap(b[0]+b[2]//2, b[1]+b[3]//2, 0.5)     # reveal controls
btn=t.eval("""(function(){var e=document.querySelector('.fullscreen-icon');
  if(!e) return null; var r=e.getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
print("before:", json.dumps(t.eval(Q)), "fsBtn", btn)
if btn:
    mouse(btn[0], btn[1]); time.sleep(3.5)
    print("fullscreen:", json.dumps(t.eval(Q)))
    t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
    time.sleep(3.5)
    print("exited    :", json.dumps(t.eval(Q)))
