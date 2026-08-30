import time
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
# A stale device-metrics override from an earlier session sticks to the
# target and survives clearDeviceMetricsOverride; setting a desktop size
# explicitly is what actually takes.
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900, deviceScaleFactor=1, mobile=False)
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(25); tab.eval("window.scrollBy(0,400)"); time.sleep(4)
print(tab.eval(r"""(function(){
  function vis(el){ if(!el) return false; var p=el;
    while(p&&p!==document.documentElement){var cs=getComputedStyle(p);
      if(cs.display==='none'||cs.visibility==='hidden') return false; p=p.parentElement;} return true; }
  var lock=document.querySelectorAll('yt-lockup-view-model'), n=0;
  lock.forEach(function(e){ if(vis(e)) n++; });
  var sec=document.querySelector('#secondary');
  var shorts=0; document.querySelectorAll('a[href*="/shorts/"]').forEach(function(a){ if(vis(a)) shorts++; });
  return JSON.stringify({innerW:innerWidth, secondary: sec?getComputedStyle(sec).display:'absent',
    lockups: lock.length, visibleLockups: n, visibleShortsLinks: shorts});})()"""))
