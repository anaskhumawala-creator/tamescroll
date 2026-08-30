import time
from gauntlet import pick, targets
UA=("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36")
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau=pick("localhost:1420")
lau.eval("""(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');
 m.youtube=(m.youtube||[]).filter(function(x){return x!=='home'&&x!=='shorts';});
 localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()""")
print("shown:", lau.eval("localStorage.getItem('tamescroll.shown')"))
print("surfaces:", lau.eval("JSON.stringify((window.__TS_SURFACES||[]).map(function(s){return s.id;}))"))
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile')).filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(9)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/'")
time.sleep(20)
print("mobile default:", tab.eval(r"""(function(){
  var g=document.querySelector('ytm-browse ytm-rich-grid-renderer');
  var shorts=document.querySelectorAll('ytm-pivot-bar-item-renderer');
  var sh=null; shorts.forEach(function(e){ if(e.querySelector('.pivot-shorts')) sh=getComputedStyle(e).display; });
  return JSON.stringify({grid: g? getComputedStyle(g).display+' h='+Math.round(g.getBoundingClientRect().height):'absent',
    shortsTab: sh, pivotItems: shorts.length});})()"""))
