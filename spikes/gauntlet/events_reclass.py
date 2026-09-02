"""Offline re-classification of an events-<label>.json banked by
probe_events.py, with the two joins the first classifier got wrong:

  1. A read lands in the reads ring BEFORE its own pass's track snapshot,
     so a read observed between snapshot k and k+1 belongs to pass k+1
     (probe_her2 had this right). The first classifier tagged it with
     snapshot k and then reported "the subject was already read one pass
     earlier" 13 times where it was the same pass.
  2. "Uncovered frames before a birth" counted the frames of the EMPTY
     shot before a cut. Exposure is measured from verdict ARRIVAL: the
     presented media time at the moment the birth snapshot lands, minus
     the birth's media time (positive = frames of the subject already
     shown sharp), and as an upper bound from the previous snapshot or
     the cut, whichever is later.

    python events_reclass.py events-<label>.json
"""
# A read with childP >= 0.25 (GENDER_CHILD_MASS) is NOT a clearable read:
# the child gate holds it covered by design, so it is excluded from the
# same-gender-certain population here (events-v1096d: 3 of 102 certain
# male reads, ages 21-23, all three counted as false cover before this).
import json, sys


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


def iou(a, b):
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def contains(p, box):
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    return p[0] - 0.01 <= cx <= p[2] + 0.01 and p[1] - 0.01 <= cy <= p[3] + 0.01


def covered_by(frame, box, iou_min=0.3):
    """Same join probe_events.py uses: a presented patch (frames[].p,
    display:none and sub-1px overlays already dropped by vis()) either
    overlaps the box at IoU >= 0.3 or contains its centre."""
    for p in frame.get("p", []):
        if iou(p, box) >= iou_min or contains(p, box):
            return True
    return False


def main(path):
    doc = json.load(open(path))
    d = doc["raw"]
    gender = d.get("gender") or "man"
    same = "male" if gender == "man" else "female"
    frames = sorted([f for f in d["frames"] if f.get("pm") is not None and f.get("vt") is not None], key=lambda f: f["ms"])
    sn = [s for s in d["tracks"] if s.get("lm") is not None and s.get("vt") is not None]
    cuts = [c["vt"] for c in d["cuts"] if c.get("vt") is not None]
    delay = (d.get("delayMs") or 1000) / 1000.0 + 0.04  # measured presented lag 1039ms at DELAY_MS 1000
    reads = d["reads"]
    # THE FIRST COLLECTOR TICK DUMPS THE RING BACKLOG. Every entry is
    # stamped with the tick's own wall time, so the ~20 pre-seek passes
    # (lm 25.0, before the seek to 55) and their ~44 reads all carry one
    # `ms` and cannot be joined to anything. Dropped as a batch.
    if sn:
        first_tick = min(s["ms"] for s in sn)
        sn = [s for s in sn if s["ms"] > first_tick]
        reads = [r for r in reads if r["ms"] > first_tick]
    # A read that landed BEFORE the collector's first snapshot belongs to
    # a pass this file never saw; charging it to the first snapshot put
    # ~44 pre-seek reads on one pass in run 3 (all at lm 25.0, the media
    # time before the seek to 55). Excluded, not guessed.
    first_ms = sn[0]["ms"] if sn else None
    for r in reads:
        nxt = next((s for s in sn if s["ms"] >= r["ms"]), None)
        r["pass"] = nxt["lm"] if (nxt and first_ms is not None and r["ms"] >= first_ms) else None
    by_pass = {}
    for r in reads:
        by_pass.setdefault(r["pass"], []).append(r)

    # ---------------- EXPOSURE ----------------
    seen = set()
    rows = []
    for i, s in enumerate(sn):
        arrival_pm = s["vt"] - delay
        prev = sn[i - 1]["lm"] if i > 0 else None
        for t in s["tr"]:
            if t["id"] in seen:
                continue
            if t["st"] != "blurred":
                continue
            m0 = s["lm"]
            lower = max(0.0, arrival_pm - m0)
            # earliest the subject could have entered: previous snapshot,
            # or a cut just before this capture (the luma sampler records
            # a cut up to ~0.15s AFTER the frame that carried it)
            floor = prev if prev is not None else m0
            for c in cuts:
                if floor < c - 0.15 <= m0:
                    floor = c - 0.15
            upper = max(0.0, arrival_pm - floor)
            rd = [r for r in by_pass.get(m0, []) if r.get("b") and contains(t["b"], r["b"])]
            # PHASE-M M1: the presented picture. Frames of the subject's
            # window (from the floor to the birth) with no patch on the
            # box -- what the arithmetic above bounds, read off the DOM.
            before = [f for f in frames if floor < f["pm"] < m0]
            unc_before = sum(1 for f in before if not covered_by(f, t["b"]))
            rows.append({"id": t["id"], "m0": round(m0, 3), "arrivalLagMs": round((s["vt"] - m0) * 1000),
                         "exposureLowerMs": round(lower * 1000), "exposureUpperMs": round(upper * 1000),
                         "framesBefore": len(before), "uncoveredBefore": unc_before,
                         "gapMs": round((m0 - prev) * 1000) if prev is not None else None,
                         "f": t.get("f"), "lv": t.get("lv"),
                         "read": ({"g": rd[0].get("g"), "s": rd[0].get("s"), "ab": rd[0].get("ab"), "px": rd[0].get("px")} if rd else None)})
        seen |= set(t["id"] for t in s["tr"])
    # PHASE-M M1: THE EXPOSURE METRIC MUST SEE THE PRESENTED PICTURE.
    # The arithmetic above is verdict-ARRIVAL timing only; it printed
    # nPositive 0 / max 0 on events-v1096c, a run whose renderer drew a
    # stale target for 90.7% of the wall clock. So, per blurred entry in
    # every snapshot: the presented frames of its own interval [m0, next)
    # that show NO patch on its box (probe_events' covered_by join). A
    # frozen, mispositioned or dead patch lands here; a subject the
    # tracker never had does not (no box to score against), and that
    # class stays with the false-cover/never-tracked reads.
    ent_frames = 0
    ent_unc = 0
    unc_by_id = {}
    for i, s in enumerate(sn):
        m0 = s["lm"]
        m1 = sn[i + 1]["lm"] if i + 1 < len(sn) else None
        if m1 is None or m1 <= m0:
            continue
        span = [f for f in frames if m0 <= f["pm"] < m1 and not any(m0 < c <= f["pm"] for c in cuts)]
        for t in s["tr"]:
            if t["st"] != "blurred" or not t.get("b"):
                continue
            unc = [f for f in span if not covered_by(f, t["b"])]
            ent_frames += len(span)
            ent_unc += len(unc)
            if unc:
                unc_by_id[t["id"]] = unc_by_id.get(t["id"], 0) + len(unc)
    presented = {"blurredEntryFrames": ent_frames, "uncovered": ent_unc,
                 "uncoveredFrac": round(ent_unc / ent_frames, 4) if ent_frames else None,
                 "worstIds": sorted(unc_by_id.items(), key=lambda kv: -kv[1])[:8]}
    # a birth from a certain SAME-gender read is not an exposure of the
    # opposite gender; keep them apart
    opp_rows = [r for r in rows if not (r["read"] and r["read"]["g"] == same and not r["read"]["ab"])]
    lows = [r["exposureLowerMs"] for r in opp_rows]
    ups = [r["exposureUpperMs"] for r in opp_rows]
    arr = [round((s["vt"] - delay - s["lm"]) * 1000) for s in sn]
    arr = [a for a in arr if abs(a) < 10000]
    exposure = {
        "birthsBlurred": len(rows), "birthsNotFromCertainSameRead": len(opp_rows),
        "exposureLowerMs": {"nPositive": sum(1 for x in lows if x > 0), "values": sorted(x for x in lows if x > 0)},
        "exposureUpperMs": {"p50": pct(ups, .5), "p90": pct(ups, .9), "max": max(ups) if ups else None, "nOver300": sum(1 for x in ups if x > 300)},
        "verdictArrivalMinusPresented": {"p50": pct(arr, .5), "p90": pct(arr, .9), "p95": pct(arr, .95), "max": max(arr) if arr else None,
                                         "nLate": sum(1 for a in arr if a > 0), "n": len(arr)},
        "lateFramesFrac": round(sum(1 for f in frames if f.get("lm") is not None and f["pm"] > f["lm"]) / max(1, len(frames)), 3),
        "uncoveredBeforeBirth": {"births": sum(1 for r in opp_rows if r["uncoveredBefore"] > 0), "frames": sum(r["uncoveredBefore"] for r in opp_rows)},
        "presented": presented,
        "rows": sorted(opp_rows, key=lambda r: (-r["uncoveredBefore"], -r["exposureUpperMs"]))[:12],
    }

    # ---------------- FALSE COVER ----------------
    # per pass: certain same-gender reads whose face centre is under a
    # presented patch near that pass's media time
    fc_rows = []
    for m, rs in by_pass.items():
        if m is None:
            continue
        snap = next((s for s in sn if s["lm"] == m), None)
        idx = sn.index(snap) if snap else None
        for r in rs:
            if r.get("g") != same or r.get("ab") or (r.get("s") or 0) < 0.45 or (r.get("pc") or 0) >= 0.25 or not r.get("b"):
                continue
            near = [f for f in frames if abs(f["pm"] - m) <= 0.25 and not any(min(f["pm"], m) < c <= max(f["pm"], m) for c in cuts)]
            cov = [f for f in near if any(contains(p, r["b"]) for p in f["p"])]
            if not near or not cov:
                continue
            own = [t for t in (snap["tr"] if snap else []) if t.get("b") and contains(t["b"], r["b"])]
            bl = [t for t in own if t["st"] == "blurred"]
            why, info = "unknown", None
            cl = [t for t in own if t["st"] == "cleared"]
            if bl and cl:
                # HIS OWN TRACK IS CLEARED; the patch over his face is a
                # NEIGHBOUR'S box (a measured body, a synthetic body, or a
                # stale coasting box), which is the solid-patch cost.
                t = bl[0]
                info = {"id": t["id"], "f": t["f"], "mm": t.get("mm"), "w": round(t["b"][2] - t["b"][0], 3), "lv": t["lv"]}
                why = ("neighbourCoasting" if (t.get("mm") or 0) > 0 else ("neighbourSynthetic" if t["f"] == 1 else "neighbourMeasured"))
            elif bl:
                t = bl[0]
                info = {"id": t["id"], "cs": t["cs"], "fs": t["fs"], "cm": t["cm"], "lv": t["lv"], "f": t["f"]}
                prev_has = idx is not None and idx > 0 and any(x["id"] == t["id"] for x in sn[idx - 1]["tr"])
                cut_near = any(abs(c - m) < 1.2 for c in cuts)
                if t["fs"] and t["fs"] > 0:
                    why = "revokedByOppositeRead"
                elif not prev_has:
                    why = "bornBlurredAtCut" if cut_near else "bornBlurredFresh"
                elif cut_near and (t["cm"] or 0) == 0:
                    why = "demotedAtCut"
                elif (t["cs"] or 0) < 2 and (t["cm"] or 0) < 1500:
                    why = "pendingClearLadder"
                else:
                    why = "blurredDespiteClear"
            elif own:
                why = "clearedButTimelineBlurred"  # rule 3: blurred on either side wins
                info = {"id": own[0]["id"], "st": own[0]["st"]}
            else:
                # the covering patch belongs to a track whose box does not
                # contain his face at this pass: another subject's body
                why = "otherSubjectsPatch"
            fc_rows.append({"m": round(m, 3), "s": r["s"], "px": r.get("px"), "covered": len(cov), "near": len(near), "why": why, "track": info})
    same_reads = [r for r in reads if r.get("g") == same and not r.get("ab") and (r.get("s") or 0) >= 0.45 and (r.get("pc") or 0) < 0.25]
    why_counts = {}
    for r in fc_rows:
        why_counts[r["why"]] = why_counts.get(r["why"], 0) + 1
    falsecover = {"sameGenderCertainReads": len(same_reads), "coveredReads": len(fc_rows), "why": why_counts,
                  "rows": fc_rows[:60]}

    # ---------------- PHANTOM ----------------
    coast = []
    blurred_passes = 0
    synth_born_unread = 0
    synth_born_unread_ids = set()
    for i, s in enumerate(sn):
        prev_ids = set(t["id"] for t in sn[i - 1]["tr"]) if i > 0 else set()
        rs = by_pass.get(s["lm"], [])
        for t in s["tr"]:
            if t["st"] != "blurred":
                continue
            blurred_passes += 1
            if (t.get("mm") or 0) > 0:
                coast.append(t["mm"])
            if t["id"] not in prev_ids and t.get("f") == 1:
                rd = [r for r in rs if r.get("b") and contains(t["b"], r["b"])]
                if rd and all(r.get("g") == "unknown" or r.get("ab") for r in rd):
                    synth_born_unread += 1
                    synth_born_unread_ids.add(t["id"])
    # lifetime of those unread synthetic tracks in passes
    life = {}
    for s in sn:
        for t in s["tr"]:
            if t["id"] in synth_born_unread_ids:
                life[t["id"]] = life.get(t["id"], 0) + 1
    unread_reads = [r for r in reads if r.get("g") == "unknown"]
    phantom = {"blurredTrackPasses": blurred_passes, "coastingPasses": len(coast),
               "coastMs": {"p50": pct(coast, .5), "p95": pct(coast, .95), "max": max(coast) if coast else None},
               "syntheticBornFromUnreadFace": synth_born_unread, "theirPassesAlive": sorted(life.values()),
               "unreadReads": len(unread_reads), "unreadPx": sorted(r.get("px") for r in unread_reads if r.get("px")),
               "unreadFc": sorted(r.get("fc") for r in unread_reads if r.get("fc") is not None)}

    out = {"exposure": exposure, "falseCover": falsecover, "phantom": phantom, "lifeDelta": d.get("lifeDelta")}
    e = dict(exposure); rows_e = e.pop("rows")
    print("EXPOSURE", json.dumps(e))
    for r in rows_e:
        print("  X", json.dumps(r))
    f = dict(falsecover); rows_f = f.pop("rows")
    print("FALSECOVER", json.dumps(f))
    for r in rows_f:
        print("  F", json.dumps(r))
    print("PHANTOM", json.dumps(phantom))
    print("LIFE", json.dumps(d.get("lifeDelta")))
    doc["reclass"] = out
    json.dump(doc, open(path, "w"))


if __name__ == "__main__":
    main(sys.argv[1])
