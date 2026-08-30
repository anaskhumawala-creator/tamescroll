"""Do feed thumbnails change picture WITHOUT a `src` attribute mutation?

retagImage only fires on attributeFilter ['src']. If m.youtube recycles a
thumbnail by swapping `srcset` (or by any other route), the old verdict's
patches stay drawn over a NEW picture -- which is what the owner is
looking at: blur rectangles sitting over an unrelated video while
scrolling the feed.
"""
import time, sys
from gauntlet import open_platform

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else "https://m.youtube.com/results?search_query=podcast+interview"

tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Page.enable")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source=r"""
window.__RECYCLE = {srcAttr:0, srcsetAttr:0, otherAttr:0, picChanged:0, silent:0, samples:[]};
(function(){
  var last = new WeakMap();
  var pend = new WeakMap();
  function note(img, how){ pend.set(img, how); }
  var mo = new MutationObserver(function(ms){
    for (var i=0;i<ms.length;i++){
      var m=ms[i];
      if (m.type!=='attributes' || !m.target.tagName || m.target.tagName!=='IMG') continue;
      if (m.attributeName==='src') { window.__RECYCLE.srcAttr++; note(m.target,'src'); }
      else if (m.attributeName==='srcset') { window.__RECYCLE.srcsetAttr++; note(m.target,'srcset'); }
      else { window.__RECYCLE.otherAttr++; note(m.target,m.attributeName); }
    }
  });
  mo.observe(document.documentElement,{attributes:true,subtree:true});
  setInterval(function(){
    var imgs=document.querySelectorAll('img');
    for (var i=0;i<imgs.length;i++){
      var im=imgs[i], cur=im.currentSrc||im.src||'';
      if (!cur) continue;
      var prev=last.get(im);
      last.set(im,cur);
      if (prev===undefined || prev===cur) continue;
      window.__RECYCLE.picChanged++;
      var how=pend.get(im);
      pend.delete(im);
      if (how!=='src') {
        window.__RECYCLE.silent++;
        if (window.__RECYCLE.samples.length<5)
          window.__RECYCLE.samples.push({how:how||'none', from:prev.slice(-28), to:cur.slice(-28),
            patches: im.parentElement?im.parentElement.querySelectorAll('.ts-gaze-region-patch').length:0});
      }
    }
  }, 300);
})();
""")
tab.eval("location.href='%s'" % URL)
time.sleep(16)
for i in range(14):
    tab.eval("window.scrollBy(0,700);")
    time.sleep(1.4)
time.sleep(3)
print(tab.eval("JSON.stringify(window.__RECYCLE)"))
