import time
from gauntlet import pick, targets
UA=("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36")
# Close the platform window first: on desktop open_platform focuses an
# existing window and returns, so Rust's SHOWN_STATE would never see the
# new prefs and the test would measure a stale payload, not the bug.
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau=pick("localhost:1420")
print("shown:", lau.eval("localStorage.getItem('tamescroll.shown')"))
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile')).filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(9)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
if not tab: raise SystemExit("window did not open")
print("--- desktop www.youtube ---")
tab.eval("location.href='https://www.youtube.com/'")
time.sleep(18)
print(tab.eval(r"""(function(){
  var sheet=document.getElementById('tamescroll-rules'); var css=sheet?sheet.textContent:'';
  var g=document.querySelector('ytd-browse[page-subtype="home"] ytd-rich-grid-renderer');
  return JSON.stringify({grid: g? getComputedStyle(g).display : 'absent',
    cssHasDesktopGrid: css.indexOf('ytd-rich-grid-renderer')>=0,
    cssHasMobileGrid: css.indexOf('ytm-rich-grid-renderer')>=0, cssBytes: css.length});})()"""))
print("--- mobile m.youtube ---")
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/'")
time.sleep=getattr(time,'sleep'); time.sleep(20)
print(tab.eval(r"""(function(){
  var sheet=document.getElementById('tamescroll-rules'); var css=sheet?sheet.textContent:'';
  var g=document.querySelector('ytm-browse ytm-rich-grid-renderer');
  return JSON.stringify({grid: g? getComputedStyle(g).display+' h='+Math.round(g.getBoundingClientRect().height) : 'absent',
    sections: document.querySelectorAll('ytm-rich-section-renderer').length,
    tiles: document.querySelectorAll('ytm-video-with-context-renderer').length,
    cssHasMobileGrid: css.indexOf('ytm-rich-grid-renderer')>=0, cssBytes: css.length});})()"""))
