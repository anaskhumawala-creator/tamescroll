"""What the m.youtube watch page actually gives us to shrink.

Selectors come from the live DOM, never memory (CLAUDE.md). Under a
mobile UA + touch emulation, because the sticky player only exists there.
"""
import json, time
from gauntlet import open_platform

UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6, mobile=True)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(25)
print(tab.eval(r"""(function(){
  function box(el){ if(!el) return null; var r=el.getBoundingClientRect();
    var cs=getComputedStyle(el);
    return {tag:el.tagName.toLowerCase(), id:el.id||null, cls:(el.className||'').toString().slice(0,80),
      x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height),
      pos:cs.position, z:cs.zIndex, tf:cs.transform.slice(0,30)}; }
  var v=document.querySelector('video');
  var chain=[]; var el=v;
  for(var i=0;i<8 && el;i++){ chain.push(box(el)); el=el.parentElement; }
  var named={};
  ['#movie_player','#player','ytm-watch','.player-container','#player-container-id',
   'ytm-custom-control','#watch-below-the-player','ytm-app'].forEach(function(s){
     var e=document.querySelector(s); named[s]= e?box(e):null; });
  return JSON.stringify({chain:chain, named:named,
    scrollY:window.scrollY, vh:innerHeight}, null, 1);
})()"""))
