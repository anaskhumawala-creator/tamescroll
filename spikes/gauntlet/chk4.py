import time
from gauntlet import pick
t = pick("youtube.com")
print(t.eval(r"""(function(){
  var im=window.__TSPROBE&&window.__TSPROBE.img;
  if(!im) return 'no probe img';
  var mp=document.querySelector('#movie_player'), v=mp.querySelector('video');
  v.play();
  var mr=mp.getBoundingClientRect();
  im.style.position='fixed'; im.style.left=mr.left+'px'; im.style.top=mr.top+'px';
  im.style.width=mr.width+'px'; im.style.height=mr.height+'px'; im.style.zIndex='9999';
  var ir=im.getBoundingClientRect();
  return JSON.stringify({img:{x:ir.left,y:ir.top,w:ir.width,h:ir.height},player:{x:mr.left,y:mr.top}});
})()"""))
time.sleep(2.5)
read = r"""(function(){
  var im=window.__TSPROBE.img, mp=document.querySelector('#movie_player');
  var v=mp.querySelector('video');
  var o=[].slice.call(im.parentElement.querySelectorAll('.ts-gaze-region-patch'));
  var ir=im.getBoundingClientRect(), hr=mp.getBoundingClientRect();
  var w=Math.min(hr.right,ir.right)-Math.max(hr.left,ir.left);
  var h=Math.min(hr.bottom,ir.bottom)-Math.max(hr.top,ir.top);
  return JSON.stringify({playing:!v.paused, frac:+((w*h)/(ir.width*ir.height)).toFixed(2),
    n:o.length, display:o.map(function(x){return x.style.display||'shown';})});
})()"""
print("playing:", t.eval(read))
t.eval("document.querySelector('#movie_player video').pause()")
time.sleep(2.0)
print("paused: ", t.eval(read))
t.eval("document.querySelector('#movie_player video').play()")
time.sleep(2.0)
print("resumed:", t.eval(read))
