"""Per-stage cost of one thumbnail, and the ceiling it implies.

imgdiag records load (CORS clone) and face (BlazeFace + faceres); the
remainder of ms is nsfwjs. Runs a still page so nothing else competes.
"""
import sys, time, json
from gauntlet import open_platform

rate = int(sys.argv[1]) if len(sys.argv) > 1 else 1
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=rate)
tab.eval("window.__TS_GAZE_IMGDIAG=[]")
# queue a screenful, then leave the page alone
for i in range(4):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(0.6)
t0 = tab.eval("performance.now()")
time.sleep(20)
t1 = tab.eval("performance.now()")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)

rows = [r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
        if r.get("t") and t0 <= r["t"] <= t1 and isinstance(r.get("ms"), (int, float))]
print(f"throttle {rate}x: {len(rows)} images in {(t1-t0)/1000:.1f}s = {len(rows)/((t1-t0)/1000):.2f} img/s")
def p(name, vals):
    v = sorted(vals)
    if not v: return
    print(f"  {name:6s} p50={v[len(v)//2]:6.0f} p90={v[int(len(v)*0.9)]:6.0f}")
p("load", [r["load"] for r in rows])
p("face", [r["face"] for r in rows])
p("nsfw", [max(0, r["ms"] - r["load"] - r["face"]) for r in rows])
p("total", [r["ms"] for r in rows])
p("w", [r.get("w") or 0 for r in rows])
