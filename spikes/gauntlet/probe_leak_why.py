"""probe_leak says 0 desktop watch recommendations, probe_watchrecs3 says 20.

Same app, same page, same surface state. One of the two probes is wrong,
and until that is settled neither reading can be quoted. The difference
between them is the SCROLL, so this measures before and after it, and
prints the viewport with every reading so a stale override cannot hide.
"""
import time

from gauntlet import pick, targets

Q = r"""(function(){
  function visible(el){
    if (!el) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }
  function chainFail(el){
    var p = el;
    while (p && p !== document.documentElement) {
      if (!visible(p)) return p.tagName.toLowerCase() + (p.id ? '#' + p.id : '');
      p = p.parentElement;
    }
    return null;
  }
  var els = [].slice.call(document.querySelectorAll('yt-lockup-view-model, ytd-compact-video-renderer'));
  var fails = {};
  var ok = 0;
  els.forEach(function(e){
    var f = chainFail(e);
    if (f === null) ok++; else fails[f] = (fails[f] || 0) + 1;
  });
  return JSON.stringify({
    innerW: innerWidth, scrollY: Math.round(scrollY),
    n: els.length, chainVisible: ok, blockedBy: fails
  });
})()"""


for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau = pick("localhost:1420")
lau.eval(
    "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
    "m.youtube=['watch_recs'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
)
lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(9)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1, mobile=False)
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(22)
print("before scroll:", tab.eval(Q))
for i in range(3):
    tab.eval("window.scrollBy(0,1400)")
    time.sleep(3)
    print("after scroll %d:" % (i + 1), tab.eval(Q))
