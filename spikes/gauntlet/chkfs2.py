import json, time, emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
def tap(x,y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(2.0)
Q = """(function(){
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  var name=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,2).join('.'):'');};
  var pill=document.querySelector('.ts-gaze-pill');
  var q=pill?pill.getBoundingClientRect():null;
  var ctl=document.querySelector('#player-control-container');
  var cr=ctl?ctl.getBoundingClientRect():null;
  var mp=document.querySelector('#movie_player');
  return {fs:name(fe),
    fsContainsPill: !!(fe&&pill&&fe.contains(pill)),
    fsContainsControls: !!(fe&&ctl&&fe.contains(ctl)),
    fsIsMoviePlayer: !!(fe&&mp&&fe===mp),
    pillBox:q?[q.x|0,q.y|0,q.width|0,q.height|0]:null,
    pillVisible: q?(q.width>0&&q.height>0):false,
    ctlBox:cr?[cr.x|0,cr.y|0,cr.width|0,cr.height|0]:null,
    vp:[innerWidth,innerHeight]};})()"""
print("before:", json.dumps(t.eval(Q)))
tap(364, 227)   # fullscreen button centre
time.sleep(2)
print("fullscreen:", json.dumps(t.eval(Q)))
t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document);}catch(e){}; return 1})()")
time.sleep(2.5)
print("after exit:", json.dumps(t.eval(Q)))
