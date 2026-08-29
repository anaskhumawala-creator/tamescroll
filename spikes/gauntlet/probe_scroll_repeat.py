# HOW MUCH DOES THIS HARNESS WOBBLE?
#
# A/B runs on the emulator were being read as findings while the same
# condition, repeated, moved as much as the effect. This runs ONE
# condition N times and reports the spread, so a future round can ask
# "is my delta bigger than this?" before believing it.
import json, statistics, sys, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"
MODE = sys.argv[1] if len(sys.argv) > 1 else "smart"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5
SETTLE = int(sys.argv[3]) if len(sys.argv) > 3 else 35

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

def once():
    open_youtube(MODE)
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    time.sleep(SETTLE)
    t.eval("""(function(){window.__F=[];var last=performance.now();
      (function loop(){var n=performance.now();window.__F.push(n-last);last=n;
        requestAnimationFrame(loop);})();window.__Y0=window.scrollY;})()""")
    t0 = t.eval("performance.now()")
    for _ in range(8):
        t.eval("window.scrollBy(0,700)"); time.sleep(0.75)
    time.sleep(1.0)
    t1 = t.eval("performance.now()")
    r = t.eval("""(function(){var f=window.__F||[];
      return {frames:f.length, dropped:f.filter(function(d){return d>32;}).length,
        blurred:document.querySelectorAll('img.ts-gaze-pending,img.ts-gaze-flagged').length,
        scrolled:Math.round(window.scrollY-(window.__Y0||0))};})()""")
    secs = (t1 - t0) / 1000
    r["fps"] = round(r["frames"] / secs, 1) if secs else None
    r["secs"] = round(secs, 2)
    return r

runs = [once() for _ in range(N)]
fps = [r["fps"] for r in runs if r["fps"]]
out = {"mode": MODE, "runs": runs, "fps": fps,
       "fps_min": min(fps), "fps_max": max(fps),
       "fps_median": statistics.median(fps),
       "fps_spread_pct": round((max(fps) - min(fps)) * 100 / statistics.median(fps), 1)}
print(json.dumps(out, indent=1))
