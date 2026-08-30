import time, json
from gauntlet import pick, targets
UA=("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36")
lau=pick("localhost:1420")
# Set the shown state directly the way the pane's setShown does, then
# reopen the tile so the page-load payload is rebuilt with it.
print("before:", lau.eval("localStorage.getItem('tamescroll.shown')"))
lau.eval(r"""(function(){
  var m = JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');
  var cur = m.youtube || [];
  if (cur.indexOf('home') < 0) cur.push('home');
  if (cur.indexOf('mobile') >= 0) cur.splice(cur.indexOf('mobile'),1);
  m.youtube = cur; localStorage.setItem('tamescroll.shown', JSON.stringify(m));
  return 1;
})()""")
print("after :", lau.eval("localStorage.getItem('tamescroll.shown')"))
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile')).filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/'")
time.sleep(20)
print(tab.eval(r"""(function(){
  var sheet=document.getElementById('tamescroll-rules'); var css=sheet?sheet.textContent:'';
  var g=document.querySelector('ytm-browse ytm-rich-grid-renderer');
  return JSON.stringify({
    grid: g? getComputedStyle(g).display+' h='+Math.round(g.getBoundingClientRect().height) : 'absent',
    sections: document.querySelectorAll('ytm-rich-section-renderer').length,
    tiles: document.querySelectorAll('ytm-video-with-context-renderer').length,
    cssHasMobileGrid: css.indexOf('ytm-rich-grid-renderer')>=0,
    cssHasDesktopGrid: css.indexOf('ytd-rich-grid-renderer')>=0,
    cssBytes: css.length});})()"""))
