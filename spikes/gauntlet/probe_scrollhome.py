"""Owner, 2026-08-28: "scroll is fast in recommendation and slow in home
page", and thumbnails show a press impression while he is only scrolling.

Both are what a BLOCKED MAIN THREAD looks like on a touch surface, and
the home feed differs from the watch page in exactly one way that
matters: how many images our pipeline is working on. So this measures the
same scroll on both surfaces -- frame intervals, long tasks, forced
layout, overlay count -- instead of assuming which of the two is at
fault.
"""
import json
import sys
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

ARM = r"""(function(){
  window.__ts_long = [];
  window.__ts_frames = [];
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
  var over = f.filter(function(x){ return x > 32; }).length;
  var regions = document.getElementById('tamescroll-gaze-regions');
  return JSON.stringify({
    frames: f.length,
    p50: pct(0.5), p95: pct(0.95), max: f.length ? f[f.length-1] : null,
    slowFrames: over,
    longTasks: window.__ts_long.length,
    longMs: window.__ts_long.reduce(function(a,b){return a+b;},0),
    overlays: regions ? regions.children.length : 0,
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    imgs: document.querySelectorAll('img').length
  });
})()"""

for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau = pick("localhost:1420")
# HOME SHOWN -- the state the owner is in; the default hides it and the
# whole complaint is about the surface he turned back on.
lau.eval(
    "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
    "m.youtube=['home','watch_recs'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
)
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
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

for name, url in [("home", "https://m.youtube.com/"),
                  ("watch", "https://m.youtube.com/watch?v=NWoT1ZVd1Lo")]:
    tab.eval("location.href=%r" % url)
    time.sleep(24)
    tab.eval(ARM)
    # Six flicks, the way a person scrolls a feed.
    for _ in range(6):
        tab.cmd("Input.dispatchTouchEvent", type="touchStart",
                touchPoints=[{"x": 200, "y": 700}])
        for dy in range(40, 480, 40):
            tab.cmd("Input.dispatchTouchEvent", type="touchMove",
                    touchPoints=[{"x": 200, "y": 700 - dy}])
        tab.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.7)
    print(name, tab.eval(READ))
