"""Is the image path actually running off the main thread?

Reports the worker's own lifecycle marks, where each verdict was
produced, and whether the in-page models were loaded at all (on a page
with no video they should not be).
"""
import time, json
from collections import Counter
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
st = ""
for i in range(20):
    time.sleep(2)
    st = tab.eval("JSON.stringify(window.__TS_GAZE_WORKER||{})")
    if isinstance(st, str) and "ready" in st:
        break
print("worker events:", st)
time.sleep(5)
tab.eval("window.scrollBy(0,900)")
time.sleep(7)
rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
print("verdicts:", dict(Counter(r.get("why") for r in rows)),
      "where:", dict(Counter(r.get("where", "page") for r in rows)))
ms = sorted(r["ms"] for r in rows if isinstance(r.get("ms"), (int, float)))
if ms:
    print(f"per image p50 {ms[len(ms)//2]}ms  p90 {ms[int(len(ms)*0.9)]}ms  n={len(ms)}")
inf = sorted(r["face"] for r in rows if isinstance(r.get("face"), (int, float)) and r.get("where") == "worker")
if inf:
    print(f"worker inference p50 {inf[len(inf)//2]}ms  p90 {inf[int(len(inf)*0.9)]}ms")
print("in-page model loads:", tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})"))
