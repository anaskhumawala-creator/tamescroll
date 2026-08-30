"""Does a PLAYING #movie_player make a covered still's patches stand down?

m.youtube's feed preview IS the shared #movie_player, so this is the real
host, driven the only way it can be driven on a signed-out machine: put a
patched thumbnail under the watch player's rect and watch the patches.
Page-local, resets on reload.
"""
import time
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(25)

setup = r"""(function(){
  var p=document.querySelectorAll('.ts-gaze-region-patch');
  if(!p.length) return 'no patches yet';
  var img=null;
  for (var i=0;i<p.length;i++){
    var par=p[i].parentElement, im=par&&par.querySelector('img');
    if(im&&im.getBoundingClientRect().width>100){img=im;break;}
  }
  if(!img) return 'no patched image';
  var mp=document.querySelector('#movie_player');
  var mr=mp.getBoundingClientRect();
  window.__TSPROBE={img:img, before:[].slice.call(img.parentElement.querySelectorAll('.ts-gaze-region-patch'))
    .map(function(o){return o.style.display||'shown';})};
  // Park the thumbnail exactly under the playing player.
  img.parentElement.style.position='fixed';
  img.parentElement.style.left=mr.left+'px';
  img.parentElement.style.top=mr.top+'px';
  img.parentElement.style.width=mr.width+'px';
  img.parentElement.style.height=mr.height+'px';
  img.style.width='100%'; img.style.height='100%';
  var v=mp.querySelector('video');
  return JSON.stringify({playing:!!(v&&!v.paused), before:window.__TSPROBE.before, player:{w:Math.round(mr.width),h:Math.round(mr.height)}});
})()"""
print("setup:", tab.eval(setup))
time.sleep(2.0)
read = r"""(function(){
  var im=window.__TSPROBE&&window.__TSPROBE.img;
  if(!im) return 'no probe';
  var o=[].slice.call(im.parentElement.querySelectorAll('.ts-gaze-region-patch'));
  return JSON.stringify({n:o.length, display:o.map(function(x){return x.style.display||'shown';})});
})()"""
print("covered:", tab.eval(read))
# Pause the player: a parked host shows the still through it, so the
# patches MUST come back.
tab.eval("(function(){var v=document.querySelector('#movie_player video');v&&v.pause();})()")
time.sleep(2.0)
print("paused: ", tab.eval(read))
