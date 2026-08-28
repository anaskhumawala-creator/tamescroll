"""Scroll feel on the surface the owner actually uses.

probe_scrollfeel points at www.youtube.com, which since 2026-08-29 is
known to have no inference worker at all (its service worker eats our
urls), so it measures the in-page path on a desktop layout. This one
measures m.youtube under a mobile UA, throttled 6x, which is the closest
this machine gets to his phone: frames, long tasks, and how many
thumbnails actually resolve while a finger is moving.
"""
import json
import time

from gauntlet import pick, targets

UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")

WATCH = r"""(function(){
  window.__P = {frames: [], long: [], last: performance.now()};
  function tick(){
    var n = performance.now();
    window.__P.frames.push(n - window.__P.last);
    window.__P.last = n;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver(function(l){
      l.getEntries().forEach(function(e){ window.__P.long.push(Math.round(e.duration)); });
    }).observe({entryTypes: ['longtask']});
  } catch (e) {}
  return 1;
})()"""

READ = r"""(function(){
  var p = window.__P || {frames: [], long: []};
  var f = p.frames.slice(1);
  var dropped = f.filter(function(d){ return d > 32; });
  return JSON.stringify({
    frames: f.length,
    dropped: dropped.length,
    worst: Math.round(Math.max.apply(null, f.concat([0]))),
    longN: p.long.length,
    longMs: p.long.reduce(function(a,b){return a+b;}, 0),
    longWorst: Math.max.apply(null, p.long.concat([0])),
    imgs: window.__TS_GAZE_IMGTOTAL || 0,
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    y: Math.round(window.scrollY),
    thumbs: document.querySelectorAll('img').length
  });
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs']});return 1;})()")
time.sleep(12)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)

# One navigation to prove the host, then the measured one.
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast'")
time.sleep(18)
tab.eval("location.href='https://m.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(14)

tab.eval(WATCH)
before = json.loads(tab.eval(READ))
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
# Input.synthesizeScrollGesture moved this page 0px (measured
# 2026-08-29, scrollY 0 -> 0 over eight gestures), which made an earlier
# run report "0 images while scrolling" for a pipeline that was working
# perfectly. Drive the scroller directly and PROVE it moved.
t0 = time.time()
for i in range(8):
    tab.eval("window.scrollBy(0, 700)")
    time.sleep(0.9)
scrolled = time.time() - t0
during = json.loads(tab.eval(READ))
time.sleep(10)
after = json.loads(tab.eval(READ))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)

print("frames %d  dropped>32ms %d (%d%%)  worst %dms" % (
    during["frames"] - before["frames"],
    during["dropped"] - before["dropped"],
    100 * (during["dropped"] - before["dropped"]) / max(1, during["frames"] - before["frames"]),
    during["worst"]))
print("long tasks %d totalling %dms, worst %dms" % (
    during["longN"] - before["longN"], during["longMs"] - before["longMs"], during["longWorst"]))
print("while scrolling %d imgs in %.1fs = %.2f img/s" % (
    during["imgs"] - before["imgs"], scrolled,
    (during["imgs"] - before["imgs"]) / max(0.1, scrolled)))
print("after          %d imgs, %d still pending" % (
    after["imgs"] - during["imgs"], after["pending"]))
print("scrollY %d -> %d -> %d   imgs on page %d -> %d -> %d" % (
    before["y"], during["y"], after["y"],
    before["thumbs"], during["thumbs"], after["thumbs"]))
