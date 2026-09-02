"""Per-row detail for the reclass's clearedButTimelineBlurred class: the
presented frames that covered a certain same-gender read whose own track
was CLEARED at that pass. For each, which side of the pass the covered
frames sit on (pm - m), the state of his id at the previous and next
snapshot, and any cut between them.

  python why_timeline_blurred.py events-<label>.json
"""
import json, sys


def contains(p, b):
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return p[0] - 0.01 <= cx <= p[2] + 0.01 and p[1] - 0.01 <= cy <= p[3] + 0.01


d = json.load(open(sys.argv[1]))["raw"]
same = "male" if (d.get("gender") or "man") == "man" else "female"
first = min(s["ms"] for s in d["tracks"]) if d["tracks"] else 0
sn = [s for s in d["tracks"] if s.get("lm") is not None and s["ms"] > first]
frames = [f for f in d["frames"] if f.get("pm") is not None]
cuts = [c["vt"] for c in d["cuts"] if c.get("vt") is not None]
reads = [r for r in d["reads"] if r["ms"] > first]
for r in reads:
    nxt = next((s for s in sn if s["ms"] >= r["ms"]), None) if sn and r["ms"] >= sn[0]["ms"] else None
    r["pass"] = nxt["lm"] if nxt else None

rows = 0
for i, s in enumerate(sn):
    m = s["lm"]
    for r in reads:
        if r["pass"] != m or r.get("g") != same or r.get("ab") or (r.get("s") or 0) < 0.45 or not r.get("b"):
            continue
        own = [t for t in s["tr"] if t.get("b") and contains(t["b"], r["b"])]
        if not own or any(t["st"] == "blurred" for t in own):
            continue
        near = [f for f in frames if abs(f["pm"] - m) <= 0.25]
        cov = [f for f in near if any(contains(p, r["b"]) for p in f["p"])]
        if not cov:
            continue
        rows += 1
        tid = own[0]["id"]
        def st(j):
            if j < 0 or j >= len(sn):
                return None
            t = next((x for x in sn[j]["tr"] if x["id"] == tid), None)
            return None if not t else {"lm": sn[j]["lm"], "st": t["st"], "lv": t.get("lv"), "fs": t.get("fs"), "mm": t.get("mm"), "cs": t.get("cs")}
        prev, nxt = st(i - 1), st(i + 1)
        lo = sn[i - 1]["lm"] if i > 0 else m - 1
        hi = sn[i + 1]["lm"] if i + 1 < len(sn) else m + 1
        cut = [c for c in cuts if lo < c <= hi]
        before = sum(1 for f in cov if f["pm"] < m)
        after = len(cov) - before
        # the covering patch's width on the last covered frame, and whether a
        # blurred track at this snapshot overlaps his face box at all
        pw = [round(p[2] - p[0], 3) for f in cov[-1:] for p in f["p"] if contains(p, r["b"])]
        nb = [(t["id"], round(t["b"][2] - t["b"][0], 3), t.get("mm")) for t in s["tr"] if t["st"] == "blurred" and t.get("b")]
        print(json.dumps({"m": m, "id": tid, "s": r["s"], "covBefore": before, "covAfter": after, "near": len(near),
                          "prev": prev, "next": nxt, "cutBetween": cut, "patchW": pw, "blurredHere": nb, "face": r["b"]}))
print("rows", rows)
