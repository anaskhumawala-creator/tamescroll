"""Fraction of the video frame that carries a patch, per run.

FALSE COVER is scored per FRAME, so a slab over four men and a slab over
one score identically. On composite footage that hides the whole effect
of a geometry fix, so this reports the union AREA of every overlay,
clipped to the frame.
"""
import json
import os
import sys


def union_area(boxes, step=200):
    """Rasterised union — exact enough at 1/200 of a frame, and immune to
    the overlap bookkeeping an analytic version needs."""
    grid = [[False] * step for _ in range(step)]
    for b in boxes:
        x1 = max(0, min(step, int(b["x1"] * step)))
        x2 = max(0, min(step, int(round(b["x2"] * step))))
        y1 = max(0, min(step, int(b["y1"] * step)))
        y2 = max(0, min(step, int(round(b["y2"] * step))))
        for y in range(y1, y2):
            row = grid[y]
            for x in range(x1, x2):
                row[x] = True
    return sum(sum(1 for c in r if c) for r in grid) / float(step * step)


for run in sys.argv[1:]:
    m = json.load(open(os.path.join("runs", run, "meta.json")))
    a = [union_area(f["patches"]) for f in m["frames"]]
    print(
        "%-18s n=%d  mean %.3f  min %.3f  max %.3f  per-frame %s"
        % (run, len(a), sum(a) / len(a), min(a), max(a), " ".join("%.2f" % v for v in a))
    )
