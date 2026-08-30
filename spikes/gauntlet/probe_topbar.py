import time, json
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(14)
for i in range(8):
    tab.eval("window.scrollBy(0,600);")
    time.sleep(0.35)
time.sleep(2)
print(tab.eval(r"""(function(){
  var bar = document.querySelector('ytm-mobile-topbar-renderer, .mobile-topbar-header, header, #header-bar');
  var br = bar ? bar.getBoundingClientRect() : null;
  var bs = bar ? getComputedStyle(bar) : null;
  var pat = [].slice.call(document.querySelectorAll('div[style*="backdrop-filter"]'));
  var over = pat.map(function(p){
    var r = p.getBoundingClientRect();
    if (!br || r.top >= br.bottom || r.bottom <= br.top) return null;
    // ancestor stacking chain
    var chain = [], n = p.parentElement, hops = 0;
    while (n && hops++ < 8) {
      var cs = getComputedStyle(n);
      if (cs.zIndex !== 'auto' || cs.position !== 'static' || cs.transform !== 'none')
        chain.push(n.tagName.toLowerCase()+'#'+(n.id||'')+'.'+String(n.className).slice(0,24)+' z='+cs.zIndex+' pos='+cs.position);
      n = n.parentElement;
    }
    return {top:Math.round(r.top), h:Math.round(r.height), chain:chain.slice(0,4)};
  }).filter(Boolean);
  return JSON.stringify({barRect: br?{top:Math.round(br.top),bottom:Math.round(br.bottom)}:null,
    barPos: bs?bs.position:null, barZ: bs?bs.zIndex:null, barTag: bar?bar.tagName.toLowerCase():null,
    patches: pat.length, overlapping: over}).slice(0,1400);
})()"""))
