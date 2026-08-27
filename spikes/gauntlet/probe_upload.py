"""One upload per thumbnail: per-image cost + tensor leak check.

Loads a search page under a 6x throttle, scrolls it, then reports the
face-stage ms distribution from __TS_GAZE_IMGDIAG and the tfjs tensor
count before/after the drain (the shared frame is owned by detectImage,
so a leak would show as monotonic growth).
"""
import time, json, statistics
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
mem0 = tab.eval("JSON.stringify(window.__TS_GAZE_MEM ? window.__TS_GAZE_MEM() : null)")
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
for i in range(8):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(2.5)
time.sleep(8)
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
time.sleep(2)
mem1 = tab.eval("JSON.stringify(window.__TS_GAZE_MEM ? window.__TS_GAZE_MEM() : null)")
rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))

print("mem before", mem0)
print("mem after ", mem1)
print("entries", len(rows))
timed = [r for r in rows if isinstance(r.get("ms"), (int, float))]
for key in ("ms", "load", "face"):
    v = sorted(r[key] for r in timed if isinstance(r.get(key), (int, float)))
    if not v:
        continue
    print(f"{key:5s} n={len(v):3d} p50={v[len(v)//2]:5.0f} p90={v[int(len(v)*0.9)]:5.0f} max={v[-1]:5.0f}")
from collections import Counter
print(Counter([r.get("why") for r in rows]))
