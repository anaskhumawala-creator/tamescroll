"""How fast do patches stand down when a covering video starts playing?

500ms heartbeat alone leaves half a second of patches drawn across a
video that already owns the pixels. Measures the flip time from the
play/pause event.
"""
import time
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(26)
setup = r"""(function(){
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var im=null;
  for(var i=0;i<ps.length;i++){var par=ps[i].parentElement,c=par&&par.querySelector('img');
    if(c&&c.getBoundingClientRect().width>150){im=c;break;}}
  if(!im) return 'no patched thumbnail';
  window.__TSPROBE={img:im};
  var mp=document.querySelector('#movie_player'), v=mp.querySelector('video');
  var ir=im.getBoundingClientRect(), mr=mp.getBoundingClientRect();
  mp.style.transformOrigin='top left';
  mp.style.transform='translate('+(ir.left-mr.left)+'px,'+(ir.top-mr.top)+'px) scale('
    +(ir.width/mr.width)+','+(ir.height/mr.height)+')';
  v.play();
  return 'ok';
})()"""
print("setup:", tab.eval(setup))
time.sleep(2)
flip = r"""(function(){return new Promise(function(res){
  var im=window.__TSPROBE.img, v=document.querySelector('#movie_player video');
  var o=im.parentElement.querySelector('.ts-gaze-region-patch');
  v.pause();
  // wait until the patch is back, then time the hide from play()
  var t=setInterval(function(){
    if((o.style.display||'')!=='none'){
      clearInterval(t);
      var t0=performance.now();
      v.play();
      var t2=setInterval(function(){
        if(o.style.display==='none'){clearInterval(t2);res(Math.round(performance.now()-t0));}
        if(performance.now()-t0>3000){clearInterval(t2);res(-1);}
      },10);
    }
  },10);
})})()"""
for i in range(3):
    print("hide after play (ms):", tab.eval(flip))
    time.sleep(1)
