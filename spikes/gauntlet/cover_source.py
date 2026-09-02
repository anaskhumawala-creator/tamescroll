"""For every presented frame that covered a certain same-gender read whose
own track was CLEARED at that pass: did the timeline's own merged TARGET
(tgt, 1096+) cover the face, or only the drawn rect (p)? A target cover is
a presentation defect (timeline/clamp); a drawn-only cover is the render
layer (damper, adoption glide). For target covers, print the entries that
overlap the face with the clamp's inputs (core, head, face, headW).

  python cover_source.py events-<label>.json
"""
# A read with childP >= 0.25 (GENDER_CHILD_MASS) is NOT a clearable read:
# the child gate holds it covered by design, so it is excluded from the
# same-gender-certain population here (events-v1096d: 3 of 102 certain
# male reads, ages 21-23, all three counted as false cover before this).
import json, sys


def contains(p, b):
    cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return p[0] - 0.01 <= cx <= p[2] + 0.01 and p[1] - 0.01 <= cy <= p[3] + 0.01


def overlap(a, b):
    w = min(a[2], b[2]) - max(a[0], b[0])
    h = min(a[3], b[3]) - max(a[1], b[1])
    return w * h if w > 0 and h > 0 else 0.0


d = json.load(open(sys.argv[1]))["raw"]
same = "male" if (d.get("gender") or "man") == "man" else "female"
first = min(s["ms"] for s in d["tracks"]) if d["tracks"] else 0
sn = [s for s in d["tracks"] if s.get("lm") is not None and s["ms"] > first]
frames = [f for f in d["frames"] if f.get("pm") is not None]
reads = [r for r in d["reads"] if r["ms"] > first]
for r in reads:
    nxt = next((s for s in sn if s["ms"] >= r["ms"]), None) if sn and r["ms"] >= sn[0]["ms"] else None
    r["pass"] = nxt["lm"] if nxt else None

# frame-level: how often does the drawn rect differ from the target?
withT = [f for f in frames if f.get("tgt") is not None]
diff = 0
for f in withT:
    if len(f["p"]) != len(f["tgt"]):
        diff += 1
        continue
    for p, t in zip(sorted(f["p"]), sorted(f["tgt"])):
        if max(abs(p[i] - t[i]) for i in range(4)) > 0.01:
            diff += 1
            break
print("frames", len(frames), "withTarget", len(withT), "drawnDiffersFromTarget", diff)

rows = tgtCov = drawnOnly = 0
cuts = [c["vt"] for c in d["cuts"] if c.get("vt") is not None]
byWhy = {}
for i, s in enumerate(sn):
    m = s["lm"]
    for r in reads:
        if r["pass"] != m or r.get("g") != same or r.get("ab") or (r.get("s") or 0) < 0.45 or (r.get("pc") or 0) >= 0.25 or not r.get("b"):
            continue
        near = [f for f in frames if abs(f["pm"] - m) <= 0.25 and not any(min(f["pm"], m) < c <= max(f["pm"], m) for c in cuts)]
        cov = [f for f in near if any(contains(p, r["b"]) for p in f["p"])]
        if not cov:
            continue
        own = [t for t in s["tr"] if t.get("b") and contains(t["b"], r["b"])]
        bl = [t for t in own if t["st"] == "blurred"]
        cl = [t for t in own if t["st"] == "cleared"]
        if bl and cl:
            t = bl[0]
            why = "neighbourCoasting" if (t.get("mm") or 0) > 0 else ("neighbourSynthetic" if t["f"] == 1 else "neighbourMeasured")
        elif bl:
            t = bl[0]
            prev_has = i > 0 and any(x["id"] == t["id"] for x in sn[i - 1]["tr"])
            cut_near = any(abs(c - m) < 1.2 for c in cuts)
            if t["fs"] and t["fs"] > 0: why = "revokedByOppositeRead"
            elif not prev_has: why = "bornBlurredAtCut" if cut_near else "bornBlurredFresh"
            elif cut_near and (t["cm"] or 0) == 0: why = "demotedAtCut"
            elif (t["cs"] or 0) < 2 and (t["cm"] or 0) < 1500: why = "pendingClearLadder"
            else: why = "blurredDespiteClear"
        elif own:
            why = "clearedButTimelineBlurred"
        else:
            why = "otherSubjectsPatch"
        rows += 1
        tc = [f for f in cov if f.get("tgt") is not None and any(contains(t, r["b"]) for t in f["tgt"])]
        do = [f for f in cov if f.get("tgt") is not None and not any(contains(t, r["b"]) for t in f["tgt"])]
        nt = [f for f in cov if f.get("tgt") is None]
        kind = "target" if tc else ("drawnOnly" if do else "noTarget")
        byWhy.setdefault(why, {}).setdefault(kind, 0)
        byWhy[why][kind] += 1
        f = (tc or do or cov)[-1]
        ents = [e for e in (f.get("te") or []) if e.get("b") and overlap(e["b"], r["b"]) > 0]
        trk = [{"id": t["id"], "st": t["st"], "lv": t.get("lv"), "f": t.get("f"), "mm": t.get("mm"), "b": t["b"]} for t in own]
        print(json.dumps({"m": m, "why": why, "kind": kind, "s": r["s"], "px": r.get("px"), "face": r["b"], "cov": len(cov), "tgtCov": len(tc), "drawnOnly": len(do), "noTgt": len(nt),
                          "pm": f["pm"], "tm": f.get("tm"), "p": f["p"], "tgt": f.get("tgt"), "own": trk, "ents": ents}))
print("rows", rows, json.dumps(byWhy))
