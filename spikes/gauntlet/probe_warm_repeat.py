# Time-to-first-reveal, three runs, composition included. This is not an
# fps measurement -- warmMs/ready/first come from the pipeline's own
# clocks and their COMPOSITION (warmParts) is deterministic, so it is not
# subject to the 28% frame-rate wobble.
import json, statistics, subprocess, sys, time
from emu_cdp import page, Tab

ADB = ["adb", "-s", "emulator-5554"]
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 3

def sh(*a):
    return subprocess.run(ADB + list(a), capture_output=True, text=True).stdout.strip()

def restart():
    sh("shell", "am", "force-stop", "app.tamescroll.client")
    time.sleep(2)
    sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
    time.sleep(9)
    pid = sh("shell", "pidof", "app.tamescroll.client")
    subprocess.run(ADB + ["forward", "tcp:9224",
                          "localabstract:webview_devtools_remote_" + pid],
                   capture_output=True)
    time.sleep(1)
    t = Tab(page()); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
        gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
      return 1;})()""")
    time.sleep(5)

def once():
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    for _ in range(60):
        time.sleep(1)
        r = t.eval("""(function(){var w=window.__TS_GAZE_WORKER||{};
          var d=window.__TS_GAZE_IMGDIAG||[];
          return {up:w.up||null, ready:w.ready||null, warmMs:w.warmMs||null,
            warmParts:w.warmParts||null, backend:w.backend||null,
            judged:window.__TS_GAZE_IMGTOTAL||0,
            first:d.length?Math.round(d[0].t||0):null,
            onPending:[].slice.call(document.querySelectorAll('img.ts-gaze-pending'))
              .filter(function(i){var b=i.getBoundingClientRect();
                return b.bottom>0&&b.top<innerHeight&&b.width>=120;}).length};})()""")
        if r.get("judged", 0) > 0 and r.get("first"):
            return r
    return r

runs = []
for _ in range(N):
    restart()
    runs.append(once())
firsts = [r["first"] for r in runs if r.get("first")]
warms = [r["warmMs"] for r in runs if r.get("warmMs")]
print(json.dumps({"runs": runs,
  "first_median": statistics.median(firsts) if firsts else None,
  "first_min": min(firsts) if firsts else None, "first_max": max(firsts) if firsts else None,
  "warm_median": statistics.median(warms) if warms else None}, indent=1))
