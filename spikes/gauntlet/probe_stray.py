"""Is any drawn patch outside the picture it describes?

For every image patch: how much of it lies within its owning <img>, and
which OTHER media element it overlaps. A patch that is mostly outside its
own image is the owner's report -- blur rectangles sitting over an
unrelated video while the feed scrolls.
"""
import sys, time
from gauntlet import pick

JS = r"""(function(){
  function R(e){var r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};}
  function frac(a,b){var w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
    var h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
    if(!(w>0&&h>0))return 0;return (w*h)/(b.w*b.h);}
  var media=[].slice.call(document.querySelectorAll('img,video')).filter(function(m){
    var r=m.getBoundingClientRect();return r.width>80&&r.height>60;});
  var out={patches:0,stray:[],ok:0};
  [].slice.call(document.querySelectorAll('.ts-gaze-region-patch')).forEach(function(p){
    var pr=R(p);
    if(!(pr.w>0&&pr.h>0))return;
    out.patches++;
    var own=p.parentElement?[].slice.call(p.parentElement.querySelectorAll('img,video')):[];
    var inOwn=0;
    own.forEach(function(m){inOwn=Math.max(inOwn,frac(R(m),pr));});
    if(inOwn>=0.9){out.ok++;return;}
    var hit=null,best=0;
    media.forEach(function(m){
      if(own.indexOf(m)!==-1)return;
      var f=frac(R(m),pr);
      if(f>best){best=f;hit=m;}
    });
    out.stray.push({inOwn:+inOwn.toFixed(2), overOther:+best.toFixed(2),
      other:hit?hit.tagName.toLowerCase()+(hit.tagName==='VIDEO'?(hit.paused?':paused':':PLAYING'):''):null,
      patch:{x:Math.round(pr.x),y:Math.round(pr.y),w:Math.round(pr.w),h:Math.round(pr.h)}});
  });
  return JSON.stringify(out);
})()"""

tab = pick("youtube.com")
if len(sys.argv) > 1:
    tab.eval("location.href='%s'" % sys.argv[1])
    time.sleep(16)
for i in range(10):
    tab.eval("window.scrollBy(0,650);")
    time.sleep(1.6)
    print(i, tab.eval(JS)[:600])
