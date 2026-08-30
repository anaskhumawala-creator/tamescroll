"""How much of a feed scroll is OURS?

Owner: "scroll is fast in recommendation and slow in home page", plus a
press impression on thumbnails while only scrolling. Both are what a
blocked main thread looks like on a touch surface. His home feed cannot
be reproduced here (signed out, m.youtube renders "Start watching videos
to help us build a feed"), so this uses the heaviest feed that DOES
render signed out, under a 6x CPU throttle to stand in for the G88.

A/B on the one variable that is ours: gaze smart vs gaze off.

Usage: probe_scrollfeed.py [smart|off] [throttle]
"""
import sys
import time

from gauntlet import pick, targets

MODE = sys.argv[1] if len(sys.argv) > 1 else "smart"
THROTTLE = float(sys.argv[2]) if len(sys.argv) > 2 else 6.0
UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)
URL = "https://m.youtube.com/results?search_query=podcast+interview"

ARM = r"""(function(){
  window.__ts_long = []; window.__ts_frames = [];
  try {
    if (window.__ts_po) window.__ts_po.disconnect();
    window.__ts_po = new PerformanceObserver(function(l){
      l.getEntries().forEach(function(e){ window.__ts_long.push(Math.round(e.duration)); });
    });
    window.__ts_po.observe({entryTypes:['longtask']});
  } catch(e) {}
  var last = performance.now();
  window.__ts_raf = true;
  (function tick(){
    if (!window.__ts_raf) return;
    var now = performance.now();
    window.__ts_frames.push(Math.round(now - last));
    last = now;
    requestAnimationFrame(tick);
  })();
  return 1;
})()"""

READ = r"""(function(){
  window.__ts_raf = false;
  var f = window.__ts_frames.slice(2).sort(function(a,b){return a-b;});
  function pct(p){ return f.length ? f[Math.min(f.length-1, Math.floor(f.length*p))] : null; }
  var regions = document.getElementById('tamescroll-gaze-regions');
  var d = window.__TS_GAZE_IMGDIAG || [];
  var t0 = window.__ts_t0 || 0;
  var during = d.filter(function(e){ return e.t >= t0; });
  var cost = during.reduce(function(a,e){ return a + (e.ms || 0); }, 0);
  return JSON.stringify({
    frames: f.length, p50: pct(0.5), p95: pct(0.95), max: f.length ? f[f.length-1] : null,
    slowFrames: f.filter(function(x){return x > 32;}).length,
    longTasks: window.__ts_long.length,
    longMs: window.__ts_long.reduce(function(a,b){return a+b;},0),
    worstLong: window.__ts_long.length ? Math.max.apply(null, window.__ts_long) : 0,
    overlays: regions ? regions.children.length : 0,
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    imgs: document.querySelectorAll('img').length,
    processed: d.length,
    // OURS, inside the scroll window: how many images the pipeline
    // finished while he was scrolling, and what they cost the thread.
    duringScroll: during.length,
    ourMs: Math.round(cost),
    worstOurs: during.reduce(function(a,e){ return Math.max(a, e.ms || 0); }, 0),
    // OUR MAIN-THREAD SHARE. Everything above is wall clock; this is
    // the part that competes with the scroll.
    ourMainMs: Math.round(during.reduce(function(a,e){ return a + (e.main || 0); }, 0)),
    worstMain: during.reduce(function(a,e){ return Math.max(a, e.main || 0); }, 0),
    where: during.length ? (during[during.length-1].where || 'page') : null
  });
})()"""

for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur',%r)" % MODE)
lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(11)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href=%r" % URL)
time.sleep(26)
tab.cmd("Emulation.setCPUThrottlingRate", rate=THROTTLE)
tab.eval('window.__ts_t0 = performance.now()')
tab.eval(ARM)
for _ in range(6):
    tab.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": 200, "y": 700}])
    for dy in range(40, 480, 40):
        tab.cmd("Input.dispatchTouchEvent", type="touchMove",
                touchPoints=[{"x": 200, "y": 700 - dy}])
    tab.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(0.8)
print("%s @%gx:" % (MODE, THROTTLE), tab.eval(READ))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
