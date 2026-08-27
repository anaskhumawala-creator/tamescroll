"""A/B the number of images in flight: throughput, worst image, jank."""
import sys, time, json
from collections import defaultdict
from gauntlet import open_platform

LANES = [int(x) for x in (sys.argv[1:] or ["1", "2", "3"])]
TRIALS = 2
tab = open_platform("man")

def phase(lanes, tag):
    tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips&l=%s'" % tag)
    time.sleep(13)
    tab.eval("window.__TS_IMG_LANES=%d; window.__TS_GAZE_IMGDIAG=[]; window.__F=[]; window.__LT=[]" % lanes)
    tab.eval("""(function(){
      var last=performance.now();
      (function loop(){ var n=performance.now(); window.__F.push(n-last); last=n; requestAnimationFrame(loop); })();
      try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ window.__LT.push(Math.round(e.duration)); }); })
           .observe({entryTypes:['longtask']}); }catch(e){}
    })()""")
    tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
    t0 = tab.eval("performance.now()")
    for i in range(6):
        tab.cmd("Input.synthesizeScrollGesture", x=700, y=400, yDistance=-700, speed=2000)
        time.sleep(1.0)
    time.sleep(8)
    t1 = tab.eval("performance.now()")
    tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
    rows = [r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")) if r.get("t")]
    f = [x for x in json.loads(tab.eval("JSON.stringify(window.__F||[])")) if x < 5000]
    lt = json.loads(tab.eval("JSON.stringify(window.__LT||[])"))
    span = (t1 - t0) / 1000
    cost = sorted(r["ms"] for r in rows if isinstance(r.get("ms"), (int, float)))
    return (len(rows) / span,
            cost[len(cost)//2] if cost else 0,
            cost[-1] if cost else 0,
            100 * len([x for x in f if x > 32]) / max(1, len(f)),
            max(lt or [0]))

res = defaultdict(list)
for t in range(TRIALS):
    for l in LANES:
        r = phase(l, f"{l}_{t}")
        res[l].append(r)
        print(f"  trial{t} lanes {l}: {r[0]:.2f} img/s  cost p50 {r[1]:.0f}ms  worst {r[2]:.0f}ms  dropped {r[3]:.0f}%  longtask {r[4]}ms")
print()
for l in LANES:
    v = res[l]
    n = len(v)
    print(f"lanes {l}: {sum(x[0] for x in v)/n:4.2f} img/s | cost p50 {sum(x[1] for x in v)/n:5.0f}ms "
          f"| worst {max(x[2] for x in v):6.0f}ms | dropped {sum(x[3] for x in v)/n:3.0f}% | longtask worst {max(x[4] for x in v)}ms")
