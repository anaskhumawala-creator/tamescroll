"""What visibly CHANGES on a feed item while the finger scrolls past it."""
import json, sys, time
from emu_cdp import Tab, page
t = Tab(page(port=int(sys.argv[1]) if len(sys.argv)>1 else 9227))
t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("""(function(){
  window.__W={s:[],t0:performance.now()};
  function snap(){
    var items=document.querySelectorAll('ytm-rich-item-renderer');
    var rows=[];
    for (var i=0;i<items.length && i<6;i++){
      var it=items[i];
      var img=it.querySelector('img');
      var vid=it.querySelector('video');
      var cs=img?getComputedStyle(img):null;
      rows.push({
        i:i,
        filt: cs?cs.filter:null,
        pend: img? img.classList.contains('ts-gaze-pending'):null,
        flag: img? img.classList.contains('ts-gaze-flagged'):null,
        rm: it.classList.contains('ts-gaze-removed'),
        patches: it.querySelectorAll('.ts-gaze-region-patch').length,
        vid: vid? (vid.paused?'paused':'playing') : null,
        vfilt: vid? getComputedStyle(vid).filter : null
      });
    }
    if (window.__W.s.length<150) window.__W.s.push({t:Math.round(performance.now()-window.__W.t0), r:rows});
    requestAnimationFrame(snap);
  } requestAnimationFrame(snap); return 1;})()""")
c = t.eval("""(function(){var i=document.querySelector('ytm-rich-item-renderer');var r=i.getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
cx, cy = c
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": cx, "y": cy}])
for i in range(1, 30):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x": cx, "y": max(60, cy - i*10)}])
    time.sleep(0.04)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(2.0)
print(t.eval("""(function(){
  var s=window.__W.s, out=[], prev=null;
  for (var i=0;i<s.length;i++){
    var k=JSON.stringify(s[i].r);
    if (k!==prev){ out.push(s[i]); prev=k; }
  }
  return JSON.stringify({samples:s.length, changes:out.length, first: out.slice(0,10)}, null, 1);})()"""))
