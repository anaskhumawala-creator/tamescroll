# A NEW PRIORITY-1 ANGLE, opened by loop 15's stacking work.
#
# resolveHost refuses a host that is IN the player and keeps whole blur.
# But what does "in the player" mean? #player-container-id holds more
# than #movie_player: YouTube's whole control overlay is a sibling of
# #player inside it, and anything painted there is DOM-AFTER the video.
# An image judged there would get a patch that paints over the video by
# construction -- no stacking trick required.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1;})()")
time.sleep(6)
def tap(x,y,w=1.0):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(w)
Q = """(function(){
  var pcid=document.querySelector('#player-container-id');
  var mp=document.querySelector('#movie_player');
  if(!pcid) return {err:'no container'};
  var imgs=[].slice.call(pcid.querySelectorAll('img,[style*="background-image"]'));
  var out=imgs.map(function(im){
    var r=im.getBoundingClientRect();
    var cl=(im.className&&im.className.baseVal!==undefined?im.className.baseVal:im.className)||'';
    return {tag:im.tagName, cls:String(cl).slice(0,40),
            w:r.width|0, h:r.height|0,
            nat: im.naturalWidth||0,
            inMoviePlayer: mp?mp.contains(im):null,
            tagged: im.classList.contains('ts-gaze-pending')||im.classList.contains('ts-gaze-flagged'),
            src:(im.currentSrc||im.src||'').slice(0,60)};});
  var patches=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var inCont=patches.filter(function(p){return pcid.contains(p);});
  return {nImgs:out.length, imgs:out.slice(0,12),
          patchesTotal:patches.length, patchesInsideContainer:inCont.length};})()"""
print("playing, controls hidden:", json.dumps(t.eval(Q)))
b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0]})()")
tap(b[0]+b[2]//2, b[1]+b[3]//2, 0.8)
print("controls shown         :", json.dumps(t.eval(Q)))
# and paused, where YouTube draws the cued/end-screen chrome
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.pause(); return 1})()")
time.sleep(2.5)
print("paused                 :", json.dumps(t.eval(Q)))
