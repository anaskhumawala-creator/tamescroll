"""R29 — price the "bound a synthetic body with a rejected MoveNet slot" rule.

For every synthetic body ever recorded in the corpus (`obs` entries with
f:1), reverse personFromFace's own arithmetic to recover the face it was
minted from, then ask whether any MoveNet slot in the SAME pass has a raw
box containing that face. Report how much smaller that box is, and how
tall it is measured in face-heights — which is the number that decides
whether swapping it in can leave a body sharp.
"""
import collections
import glob
import json
import os
import sys


def parse_slot(s):
    p = s.split("/")

    def f(x):
        try:
            return float(x)
        except Exception:
            return None

    box = [f(v) for v in p[8].split(",")] if len(p) > 8 and p[8] else None
    return dict(score=f(p[0]), conf=f(p[1]), maxKp=f(p[2]), nKp15=f(p[3]), box=box)


def admitted(s):
    """person-gate.mjs's ordinary + strong + weak tiers, no hysteresis."""
    sc, cf, nk, mk = s["score"], s["conf"], s["nKp15"], s["maxKp"]
    if sc is None:
        return False
    if sc >= 0.35:
        return True
    if sc >= 0.12 and (cf or 0) >= 7:
        return True
    if (nk or 0) >= 8 and (mk or 0) >= 0.25:
        return True
    return False


def q(a, p):
    a = sorted(a)
    return round(a[min(len(a) - 1, int(len(a) * p))], 3)


def main():
    tot = unclamped = hit = 0
    ratios, areas, rows = [], [], []
    for mf in sorted(glob.glob(os.path.join("runs", "*", "meta.json"))):
        run = os.path.basename(os.path.dirname(mf))
        try:
            m = json.load(open(mf))
        except Exception:
            continue
        for fr in m.get("frames", []):
            slots = fr.get("slots") or []
            obss = fr.get("obs") or []
            for i in range(min(len(slots), len(obss))):
                raws = [parse_slot(x) for x in (slots[i].get("raw") or [])]
                for o in obss[i]:
                    if o.get("f") != 1:
                        continue
                    b = o.get("b")
                    if not b or len(b) != 4:
                        continue
                    x1, y1, x2, y2 = b
                    tot += 1
                    # A clamped body cannot be inverted: personFromFace
                    # clips to [0,1], so its extents no longer carry h.
                    if x1 <= 0.0005 or y1 <= 0.0005 or x2 >= 0.9995 or y2 >= 0.9995:
                        continue
                    unclamped += 1
                    h = (y2 - y1) / 7.4
                    if h <= 0:
                        continue
                    cy, cx = y1 + 1.4 * h, (x1 + x2) / 2
                    best = None
                    for s in raws:
                        bx = s["box"]
                        if not bx or len(bx) != 4 or None in bx:
                            continue
                        if bx[2] <= bx[0] or bx[3] <= bx[1]:
                            continue
                        # ADMITTED slots are not candidates: the face
                        # would then belong to a person the tracker
                        # already has, and handing them the same box is
                        # a merge, not a bound. Mirrors person-gate's
                        # own three tiers (hold excluded — it needs the
                        # previous pass, which the artifact does not
                        # carry).
                        if admitted(s):
                            continue
                        if not (bx[0] <= cx <= bx[2] and bx[1] <= cy <= bx[3]):
                            continue
                        a = (bx[2] - bx[0]) * (bx[3] - bx[1])
                        if best is None or a < best[0]:
                            best = (a, s)
                    if not best:
                        continue
                    hit += 1
                    s, bx = best[1], best[1]["box"]
                    rh = (bx[3] - bx[1]) / h
                    ra = best[0] / ((x2 - x1) * (y2 - y1))
                    ratios.append(rh)
                    areas.append(ra)
                    rows.append((run, round(h, 3), s["score"], s["conf"], s["nKp15"], round(rh, 2), round(ra, 3)))

    print("synthetic bodies", tot, "invertible", unclamped, "with a containing slot box", hit)
    if not ratios:
        return
    print(
        "slotBoxH/faceH  p05 %s p25 %s p50 %s p75 %s p95 %s max %s"
        % (q(ratios, 0.05), q(ratios, 0.25), q(ratios, 0.5), q(ratios, 0.75), q(ratios, 0.95), round(max(ratios), 2))
    )
    print(
        "slotArea/synth  p05 %s p25 %s p50 %s p75 %s p95 %s"
        % (q(areas, 0.05), q(areas, 0.25), q(areas, 0.5), q(areas, 0.75), q(areas, 0.95))
    )
    print("fraction smaller than the synthetic:", round(sum(1 for a in areas if a < 1) / len(areas), 3))
    for lo in (2.0, 3.0, 4.0, 5.0, 6.0):
        keep = [r for r in rows if r[5] >= lo and r[6] < 1]
        print("  gate slotBoxH >= %.1f faceH AND smaller: %d of %d fire" % (lo, len(keep), hit))
    print("top runs:", collections.Counter(r[0] for r in rows).most_common(10))
    if len(sys.argv) > 1 and sys.argv[1] == "-v":
        for r in rows:
            print(r)


main()
