import time
from gauntlet import pick
t = pick("youtube.com")
setup = r"""(function(){
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var im=null;
  for(var i=0;i<ps.length;i++){
    var par=ps[i].parentElement, c=par&&par.querySelector('img');
    if(c&&c.getBoundingClientRect().width>150){im=c;break;}
  }
  if(!im) return 'no patched thumbnail';
  window.__TSPROBE={img:im};
  var mp=document.querySelector('#movie_player'), v=mp.querySelector('video');
  v.play();
  var ir=im.getBoundingClientRect(), mr=mp.getBoundingClientRect();
  // Move the PLAYER onto the thumbnail: transform moves the rect we read,
  // and unlike position:fixed it cannot be re-anchored by an ancestor.
  var sx=ir.width/mr.width, sy=ir.height/mr.height;
  mp.style.transformOrigin='top left';
  mp.style.transform='translate('+(ir.left-mr.left)+'px,'+(ir.top-mr.top)+'px) scale('+sx+','+sy+')';
  return JSON.stringify({img:{x:Math.round(ir.left),y:Math.round(ir.top),w:Math.round(ir.width)},
    patches:im.parentElement.querySelectorAll('.ts-gaze-region-patch').length});
})()"""
print("setup:", t.eval(setup))
read = r"""(function(){
  var im=window.__TSPROBE.img, mp=document.querySelector('#movie_player');
  var v=mp.querySelector('video');
  var o=[].slice.call(im.parentElement.querySelectorAll('.ts-gaze-region-patch'));
  var ir=im.getBoundingClientRect(), hr=mp.getBoundingClientRect();
  var w=Math.min(hr.right,ir.right)-Math.max(hr.left,ir.left);
  var h=Math.min(hr.bottom,ir.bottom)-Math.max(hr.top,ir.top);
  return JSON.stringify({playing:!v.paused, frac:+(((w>0&&h>0)?w*h:0)/(ir.width*ir.height)).toFixed(2),
    display:o.map(function(x){return x.style.display||'shown';})});
})()"""
time.sleep(2.5); print("playing:", t.eval(read))
t.eval("document.querySelector('#movie_player video').pause()"); time.sleep(2.0)
print("paused: ", t.eval(read))
t.eval("document.querySelector('#movie_player video').play()"); time.sleep(2.0)
print("resumed:", t.eval(read))
