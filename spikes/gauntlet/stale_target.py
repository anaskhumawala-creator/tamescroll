"""How often the renderer's timeline target (`tm`, lastTarget.m) stands
still while the presented media time (`pm`) advances: a stale run is a
patch frozen on screen. Build 4 read 175,032 of 180,073ms stale because
the rAF loop had died on an uncaught exception (events-v1096c).

  python stale_target.py events-<label>.json [minRunMs=300]
"""
import json, sys

d = json.load(open(sys.argv[1]))["raw"]
minRun = int(sys.argv[2]) if len(sys.argv) > 2 else 300
fr = [f for f in d["frames"] if f.get("pm") is not None and f.get("tm") is not None]
tot = 0
runs = []
cur = None
for f in fr:
    if cur and f["tm"] == cur[0]:
        cur[2] = f["ms"]
    else:
        if cur and cur[2] - cur[1] >= minRun:
            runs.append(cur[2] - cur[1])
        cur = [f["tm"], f["ms"], f["ms"]]
if cur and cur[2] - cur[1] >= minRun:
    runs.append(cur[2] - cur[1])
span = fr[-1]["ms"] - fr[0]["ms"] if fr else 0
runs.sort()
print(json.dumps({"frames": len(fr), "spanMs": span, "staleRuns": len(runs), "staleMs": sum(runs),
                  "staleFrac": round(sum(runs) / span, 4) if span else None,
                  "longestMs": runs[-3:] if runs else []}))
