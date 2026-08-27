"""Where does the image queue actually spend its time?

The owner's report is about GAPS ("it processes some, then it halts, then
it takes time to process the next"), so this measures the interval
between consecutive image completions -- separately for a page being
scrolled and a page left still -- next to the cost of each image.
"""
import time, json
from gauntlet import open_platform

THROTTLE = 6
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=THROTTLE)
tab.eval("window.__TS_GAZE_IMGDIAG=[]")

# PHASE 1: scrolling the way a person does -- a flick every 700ms.
t0 = tab.eval("performance.now()")
for i in range(14):
    tab.eval("window.scrollBy(0,650)")
    time.sleep(0.7)
t1 = tab.eval("performance.now()")
# PHASE 2: still.
time.sleep(14)
t2 = tab.eval("performance.now()")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)

rows = [r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")) if r.get("t")]
rows.sort(key=lambda r: r["t"])

def report(name, sel, span):
    v = [r for r in rows if sel(r["t"])]
    print(f"\n{name}: {len(v)} images in {span/1000:.1f}s = {len(v)/(span/1000):.2f} img/s")
    if len(v) < 2:
        return
    gaps = sorted(v[i]["t"] - v[i-1]["t"] for i in range(1, len(v)))
    cost = sorted(r["ms"] for r in v)
    print(f"  gap  p50={gaps[len(gaps)//2]:5.0f} p90={gaps[int(len(gaps)*0.9)]:5.0f} max={gaps[-1]:5.0f}")
    print(f"  cost p50={cost[len(cost)//2]:5.0f} p90={cost[int(len(cost)*0.9)]:5.0f} max={cost[-1]:5.0f}")

report("scrolling", lambda t: t0 <= t <= t1, t1 - t0)
report("still", lambda t: t1 < t <= t2, t2 - t1)
print("\ntotal entries", len(rows))
