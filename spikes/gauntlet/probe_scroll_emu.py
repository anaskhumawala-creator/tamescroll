# Scroll smoothness + image throughput on the HEADLESS emulator.
# JSON only -- nothing from the feed is rendered on the owner's screen.
import json, time, sys
from emu_cdp import page, Tab

Q = sys.argv[1] if len(sys.argv) > 1 else "linus tech tips"
URL = "https://m.youtube.com/results?search_query=" + Q.replace(" ", "+")

t = Tab(page())
t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=(
  "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
  "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36"))
t.cmd("Page.navigate", url=URL)
time.sleep(12)

boot = t.eval("""(function(){
  return {mode: window.__TS_GAZE_MODE, worker: !!window.__TS_GAZE_WORKER_UP,
          backend: window.__TS_GAZE_BACKEND || null,
          total0: window.__TS_GAZE_IMGTOTAL || 0,
          h: document.documentElement.scrollHeight};
})()""")

t.eval("""(function(){
  window.__F=[]; window.__LT=[]; var last=performance.now();
  (function loop(){var n=performance.now(); window.__F.push(n-last); last=n;
    requestAnimationFrame(loop);})();
  try{ new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
        window.__LT.push(Math.round(e.duration));});})
      .observe({entryTypes:['longtask']}); }catch(e){}
  window.__T0=window.__TS_GAZE_IMGTOTAL||0;
  window.__Y0=(document.scrollingElement||document.documentElement).scrollTop;
})()""")

t0 = t.eval("performance.now()")
# Drive the scroller directly: synthesizeScrollGesture moves m.youtube 0px
# under a mobile UA (measured 2026-08-29).
for i in range(10):
    t.eval("(document.scrollingElement||document.documentElement).scrollBy(0,700)")
    time.sleep(0.75)
time.sleep(1.5)
t1 = t.eval("performance.now()")

out = t.eval("""(function(){
  var f=window.__F||[], lt=window.__LT||[];
  var drop=f.filter(function(d){return d>32;}).length;
  var se=document.scrollingElement||document.documentElement;
  return {frames: f.length, dropped: drop,
          dropped_pct: f.length? Math.round(drop*1000/f.length)/10 : null,
          longtasks: lt.length, lt_total: lt.reduce(function(a,b){return a+b;},0),
          lt_worst: lt.length?Math.max.apply(null,lt):0,
          imgs: (window.__TS_GAZE_IMGTOTAL||0)-(window.__T0||0),
          pending: document.querySelectorAll('.ts-gaze-pending').length,
          scrolled: se.scrollTop-(window.__Y0||0)};
})()""")
out["boot"] = boot
out["secs"] = round((t1 - t0) / 1000, 2)
if out["secs"] > 0:
    out["img_per_s"] = round(out["imgs"] / out["secs"], 2)
print(json.dumps(out, indent=1))
