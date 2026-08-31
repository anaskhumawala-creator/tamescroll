import json, time, emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
def tap(x,y,w=1.8):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)
Q = """(function(){
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  var name=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ').slice(0,2).join('.'):'');};
  var pill=document.querySelector('.ts-gaze-pill');
  var ctl=document.querySelector('#player-control-container');
  var pcid=document.querySelector('#player-container-id');
  var mp=document.querySelector('#movie_player');
  var fsBtn=document.querySelector('.fullscreen-icon');
  var fr=fsBtn?fsBtn.getBoundingClientRect():null;
  var cr=ctl?ctl.getBoundingClientRect():null;
  return {fs:name(fe), fsIsMoviePlayer:!!(fe&&mp&&fe===mp),
    fsIsContainer:!!(fe&&pcid&&fe===pcid),
    fsContainsPill:!!(fe&&pill&&fe.contains(pill)),
    fsContainsControls:!!(fe&&ctl&&fe.contains(ctl)),
    ctlH: cr?cr.height|0:null,
    fsBtn: fr?[Math.round(fr.left+fr.width/2),Math.round(fr.top+fr.height/2)]:null,
    playerCls:(mp?mp.className:'').indexOf('ytp-autohide')>=0?'autohide':'shown',
    vp:[innerWidth,innerHeight]};})()"""
box=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})()")
tap(box[0]+box[2]//2, box[1]+box[3]//2)   # reveal
s=t.eval(Q); print("revealed:", json.dumps(s))
if s["fsBtn"]:
    tap(s["fsBtn"][0], s["fsBtn"][1], 3.0)
    print("fullscreen:", json.dumps(t.eval(Q)))
    t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
    time.sleep(3)
    print("exited:", json.dumps(t.eval(Q)))
