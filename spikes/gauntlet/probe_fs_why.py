# WHY does the region layer vanish on entering fullscreen? Stamp the
# video and player elements before, and see what survives.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
STAMP = """(function(){
  var v=document.querySelector('#movie_player video');
  var mp=document.querySelector('#movie_player');
  if(v) v.__tsMark='V1';
  if(mp) mp.__tsMark='P1';
  var ev=[];
  window.__TS_FSLOG=ev;
  ['loadstart','emptied','seeked','seeking','resize','play','pause','ratechange','loadedmetadata'].forEach(function(n){
    v && v.addEventListener(n, function(){ ev.push(n+'@'+Math.round(performance.now())); }, true);
  });
  document.addEventListener('fullscreenchange', function(){ ev.push('fschange@'+Math.round(performance.now())); }, true);
  document.addEventListener('webkitfullscreenchange', function(){ ev.push('wkfschange@'+Math.round(performance.now())); }, true);
  return {marked: !!v, mp: !!mp};})()"""
Q = """(function(){
  var v=document.querySelector('#movie_player video');
  var mp=document.querySelector('#movie_player');
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  return {videoSame: v? v.__tsMark==='V1' : null,
    playerSame: mp? mp.__tsMark==='P1' : null,
    videoConnected: v?v.isConnected:null,
    clip: !!clip, hosts: document.querySelectorAll('.ts-gaze-vregion-host').length,
    events: (window.__TS_FSLOG||[]).slice(-12),
    vp:[innerWidth,innerHeight],
    fs: !!(document.fullscreenElement||document.webkitFullscreenElement)};})()"""
print("stamp:", json.dumps(t.eval(STAMP)))
# wait for patches
for i in range(12):
    time.sleep(6)
    s=t.eval(Q)
    if s["hosts"]>0: break
print("before:", json.dumps(s))
def reveal_btn(tries=6):
    for _ in range(tries):
        b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
        t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0]+b[2]//2,"y":b[1]+40}])
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.3)
        r=t.eval("""(function(){var e=document.querySelector('.fullscreen-icon'); if(!e) return null;
          var q=e.getBoundingClientRect(); var x=Math.round(q.left+q.width/2), y=Math.round(q.top+q.height/2);
          var h=document.elementFromPoint(x,y);
          return {x:x,y:y,hittable:!!(h&&h.closest&&h.closest('.fullscreen-icon'))};})()""")
        if r and r["hittable"]: return r
        time.sleep(1.0)
    return None
btn=reveal_btn()
if not btn: print("no button"); raise SystemExit
t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=btn["x"], y=btn["y"], button="left", clickCount=1)
t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=btn["x"], y=btn["y"], button="left", clickCount=1)
for lbl,w in (("fs+0.6",0.6),("fs+2",1.4),("fs+6",4),("fs+14",8)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
time.sleep(3); print("exit:", json.dumps(t.eval(Q)))
