"""Join every banked gender read at a pass to the track that consumed
it: by the read's person box (`pb`, 1096e+) against the snapshot's track
boxes, or -- on runs without pb -- by the read's face box against each
track's head/face box (`hf`). Then for each false-cover row from
cover_source: which track got the certain read, and what that track did.

  python read_join.py events-<label>.json cs-<label>.txt
"""
import json, sys


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0


d = json.load(open(sys.argv[1]))["raw"]
rows = [json.loads(l) for l in open(sys.argv[2]) if l.startswith("{")]
sn = [s for s in d["tracks"] if s.get("lm") is not None]
reads = d["reads"]


def readsOfPass(i):
    """Reads that arrived between the previous snapshot and this one."""
    lo = sn[i - 1]["ms"] if i > 0 else -1
    return [r for r in reads if lo < r["ms"] <= sn[i]["ms"]]


def consumer(r, tracks):
    best, bestV, how = None, 0, None
    if r.get("pb"):
        for t in tracks:
            if t.get("b"):
                v = iou(r["pb"], t["b"])
                if v > bestV:
                    best, bestV, how = t, v, "pb"
    else:
        for t in tracks:
            if t.get("hf") and r.get("b"):
                v = iou(r["b"], t["hf"])
                if v > bestV:
                    best, bestV, how = t, v, "hf"
    return best, round(bestV, 2), how


seen = set()
for row in rows:
    m = row["m"]
    if m in seen:
        continue
    seen.add(m)
    i = next((k for k, s in enumerate(sn) if s["lm"] == m), None)
    if i is None:
        continue
    print("PASS", m, row["why"])
    for r in readsOfPass(i):
        t, v, how = consumer(r, sn[i]["tr"])
        print("   read", {"g": r.get("g"), "s": r.get("s"), "ab": r.get("ab"), "px": r.get("px"), "b": r.get("b"), "pb": r.get("pb")},
              "->", None if not t else {"id": t["id"], "st": t["st"], "lv": t.get("lv"), "f": t.get("f"), "b": t.get("b"), "hf": t.get("hf")}, how, v)
