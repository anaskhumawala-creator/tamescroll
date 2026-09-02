"""Per false-cover row (cover_source output): the snapshot chain of the
subject's own track(s) around the pass, cuts between, and which timeline
entry covered his face on the covered frames -- so a row can be told
apart as 'his own track presented blurred' vs 'a neighbour's patch'.

  python trace_cover.py events-<label>.json cs-<label>.txt
"""
import json, sys

d = json.load(open(sys.argv[1]))["raw"]
rows = [json.loads(l) for l in open(sys.argv[2]) if l.startswith("{")]
sn = [s for s in d["tracks"] if s.get("lm") is not None]
frames = [f for f in d["frames"] if f.get("pm") is not None]
cuts = [c["vt"] for c in d["cuts"] if c.get("vt") is not None]


def inside(p, b):
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return p[0] - 0.01 <= cx <= p[2] + 0.01 and p[1] - 0.01 <= cy <= p[3] + 0.01


for r in rows:
    m = r["m"]
    i = next((k for k, s in enumerate(sn) if s["lm"] == m), None)
    if i is None:
        continue
    own = [o["id"] for o in r["own"]]
    chain = {}
    for oid in own:
        chain[oid] = []
        for k in range(max(0, i - 1), min(len(sn), i + 3)):
            t = next((x for x in sn[k]["tr"] if x["id"] == oid), None)
            chain[oid].append({"lm": sn[k]["lm"], "st": t and t["st"], "lv": t and t.get("lv"), "cs": t and t.get("cs"), "f": t and t.get("f"), "mm": t and t.get("mm")} if t else {"lm": sn[k]["lm"], "st": None})
    lo = sn[i - 1]["lm"] if i > 0 else m - 2
    hi = sn[min(len(sn) - 1, i + 2)]["lm"]
    cb = [round(c, 3) for c in cuts if lo < c <= hi]
    cov = [f for f in frames if abs(f["pm"] - m) <= 0.25 and any(inside(p, r["face"]) for p in f["p"])]
    by = {}
    ownStates = {}
    for f in cov:
        for e in f.get("te") or []:
            if e.get("b") and inside(e["b"], r["face"]):
                key = "%s:%s" % (e["id"], e["st"])
                by[key] = by.get(key, 0) + 1
            if e["id"] in own:
                ownStates[e["st"]] = ownStates.get(e["st"], 0) + 1
    side = {"before": sum(1 for f in cov if f["pm"] < m), "after": sum(1 for f in cov if f["pm"] >= m)}
    print(json.dumps({"m": m, "why": r["why"], "s": r["s"], "px": r["px"], "cov": len(cov), "side": side, "own": own,
                      "ownPresented": ownStates, "coveredBy": by, "cuts": cb, "chain": chain}))
