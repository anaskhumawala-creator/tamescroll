import json, sys, time
from emu_cdp import Tab, page
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("""(function(){
  window.__FL=[]; var t0=performance.now();
  function f(){
    var best=null;
    var n=document.querySelectorAll('yt-touch-feedback-shape[class*="ThumbnailSize"] .ytSpecTouchFeedbackShapeFill');
    for (var i=0;i<n.length;i++){
      var o=parseFloat(getComputedStyle(n[i]).opacity)||0;
      if (!best || o>best.o) best={o:o, d:getComputedStyle(n[i]).display};
    }
    if (window.__FL.length<400) window.__FL.push({t:Math.round(performance.now()-t0), o:best?best.o:0, n:n.length});
    requestAnimationFrame(f);
  } requestAnimationFrame(f); return 1;})()""")
it = t.eval("""(function(){var i=document.querySelectorAll('ytm-rich-item-renderer')[1]||document.querySelector('ytm-rich-item-renderer');
  var r=i.getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
cx, cy = it
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": cx, "y": cy}])
time.sleep(0.06)
for i in range(1, 16):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x": cx, "y": cy - i*14}])
    time.sleep(0.03)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(1.2)
r = t.eval("""(function(){var f=window.__FL||[]; var on=f.filter(function(x){return x.o>0.001;});
  return JSON.stringify({frames:f.length, shapes:f.length?f[0].n:0, litFrames:on.length,
    peak: on.length?Math.max.apply(null,on.map(function(x){return x.o;})):0,
    firstLit: on.length?on[0].t:null, lastLit: on.length?on[on.length-1].t:null,
    series: on.slice(0,25)});})()""")
print(r)
