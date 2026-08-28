"""A/B the scroll-time budget: throughput against scroll smoothness.

Each phase gets a FRESH page: a search page gets heavier the further it
is scrolled, so measuring three fractions down one continuous page
compares them against three different pages. Interleaved repeats.
"""
import sys, time, json
from collections import defaultdict
from gauntlet import open_platform

FRACS = [float(x) for x in (sys.argv[1:] or ["0.02", "0.15", "0.35"])]
REPEATS = 2
tab = open_platform("man")
# HIS SURFACE, NOT A DESKTOP ONE. The phone is what the budget is for,
# and a stale metrics override from an earlier probe (412px with a
# desktop UA) silently produced a page that processed no images at all.
UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)

def phase(frac):
    tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview&t=%d'" % int(frac * 1000))
    time.sleep(22)
    tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
    tab.eval("""(function(){
      window.__F=[]; window.__LT=[];
      var last=performance.now();
      (function loop(){ var n=performance.now(); window.__F.push(n-last); last=n; requestAnimationFrame(loop); })();
      try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ window.__LT.push(Math.round(e.duration)); }); })
           .observe({entryTypes:['longtask']}); }catch(e){}
    })()""")
    tab.eval("window.__TS_IMG_BUDGET=%s; window.__TS_GAZE_IMGDIAG=[]; window.__F=[]; window.__LT=[]" % frac)
    t0 = tab.eval("performance.now()")
    for i in range(8):
        tab.cmd("Input.synthesizeScrollGesture", x=200, y=600, yDistance=-700, speed=2000)
        time.sleep(0.9)
    t1 = tab.eval("performance.now()")
    f = [x for x in json.loads(tab.eval("JSON.stringify(window.__F||[])")) if x < 5000]
    lt = json.loads(tab.eval("JSON.stringify(window.__LT||[])"))
    rows = [r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")) if r.get("t") and t0 <= r["t"] <= t1]
    tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
    span = (t1 - t0) / 1000
    return (len(rows) / span, 100 * len([x for x in f if x > 32]) / max(1, len(f)), sum(lt), max(lt or [0]))

res = defaultdict(list)
for r in range(REPEATS):
    for frac in FRACS:
        res[frac].append(phase(frac))
        print(f"  run{r} frac {frac}: {res[frac][-1][0]:.2f} img/s, dropped {res[frac][-1][1]:.0f}%, lt {res[frac][-1][2]}ms")
print()
for frac in FRACS:
    v = res[frac]
    n = len(v)
    print(f"frac {frac:<5} {sum(x[0] for x in v)/n:4.2f} img/s | dropped {sum(x[1] for x in v)/n:3.0f}% "
          f"| longtask total {sum(x[2] for x in v)//n:6d}ms worst {max(x[3] for x in v):5d}ms")
tab.eval("delete window.__TS_IMG_BUDGET")
