# What does OUR pipeline cost a scroll? Same page, same gesture, gaze
# smart vs off, back to back on the headless emulator. The emulated GPU
# makes absolute numbers useless, so this only ever reports the DELTA.
import json, time, sys
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"

def open_youtube(mode):
    t = Tab(page()); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
      await inv('open_platform',{id:'youtube',mode:'%s',strength:24,
        gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
      return 1;})()""" % mode)
    time.sleep(5)

def run(mode, settle):
    open_youtube(mode)
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    time.sleep(settle)
    t.eval("""(function(){
      window.__F=[]; window.__LT=[]; var last=performance.now();
      (function loop(){var n=performance.now(); window.__F.push(n-last); last=n;
        requestAnimationFrame(loop);})();
      try{ new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
            window.__LT.push(Math.round(e.duration));});})
          .observe({entryTypes:['longtask']});}catch(e){}
      window.__T0=window.__TS_GAZE_IMGTOTAL||0; window.__Y0=window.scrollY;})()""")
    t0 = t.eval("performance.now()")
    for _ in range(8):
        t.eval("window.scrollBy(0,700)")
        time.sleep(0.75)
    time.sleep(1.0)
    t1 = t.eval("performance.now()")
    r = t.eval("""(function(){
      var f=window.__F||[], lt=window.__LT||[];
      var w=window.__TS_GAZE_WORKER||{};
      return {frames:f.length, dropped:f.filter(function(d){return d>32;}).length,
        longtasks:lt.length, lt_total:lt.reduce(function(a,b){return a+b;},0),
        lt_worst:lt.length?Math.max.apply(null,lt):0,
        imgs:(window.__TS_GAZE_IMGTOTAL||0)-(window.__T0||0),
        scrolled:Math.round(window.scrollY-(window.__Y0||0)),
        ready:w.ready||null, backend:w.backend||null};})()""")
    r["mode"] = mode
    r["secs"] = round((t1 - t0) / 1000, 2)
    r["fps"] = round(r["frames"] / r["secs"], 1) if r["secs"] else None
    return r

settle = int(sys.argv[1]) if len(sys.argv) > 1 else 30
out = {"smart": run("smart", settle), "off": run("off", settle)}
d = {}
for k in ("frames", "dropped", "longtasks", "lt_total", "lt_worst"):
    d[k] = out["smart"][k] - out["off"][k]
out["delta_smart_minus_off"] = d
print(json.dumps(out, indent=1))
