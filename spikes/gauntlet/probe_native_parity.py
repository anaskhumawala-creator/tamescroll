"""Native inference, Task 3: device parity, both engines on the SAME frame.

    python probe_native_parity.py <cdpPort> [videoId] [t1,t2,...]

The page exposes both engines only under `window.__TS_NATIVE_PARITY`
(init-entry `exposeEnginesForParity`, flag-gated; nothing in the app sets
it). The flag is planted with Page.addScriptToEvaluateOnNewDocument BEFORE
the watch page is created, so it is there when the bundle boots.

Per timestamp: pause, seek, wait for the frame, then four ImageBitmaps of
the identical frame -> native.videoFrame / worker.videoFrame (MoveNet +
BlazeFace at 256) and native.cropFaces / worker.cropFaces at 256, and the
gender read on the SAME boxes through both (cropGender), so every
comparison is like for like. Descriptor cosine is computed in page and the
1024-d vectors are dropped before banking.

Reports per-frame: person count + matched IoU + score deltas, maxKp delta,
face count + matched IoU, gender label agreement, |raw| delta, age delta,
descriptor cosine, and each engine's wall time. Banks to
native-parity-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
TS = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else \
    [30, 60, 90, 120, 150, 180, 217, 240, 270, 300, 330, 360, 420, 480, 540, 600]

ONE_JS = r"""(function(){ return (async function(){
  var E = window.__TS_GAZE_ENGINES; if (!E) return {err: 'no engines hook'};
  var n = E.native(), w = E.worker();
  if (!n) return {err: 'no native client'};
  if (!w) return {err: 'no worker client'};
  if (n.dead()) return {err: 'native dead'};
  var v = document.querySelector('video'); if (!v) return {err: 'no video'};
  var aspect = v.videoWidth / (v.videoHeight || 1);
  var b = [];
  for (var i = 0; i < 4; i++) b.push(await createImageBitmap(v));
  function strip(reads) { return (reads || []).map(function (r) { var o = {}; for (var k in r) if (k !== 'desc') o[k] = r[k]; return o; }); }
  function cos(a, b2) { if (!a || !b2 || a.length !== b2.length) return null; var d = 0, na = 0, nb = 0; for (var i = 0; i < a.length; i++) { d += a[i] * b2[i]; na += a[i] * a[i]; nb += b2[i] * b2[i]; } return na && nb ? d / Math.sqrt(na * nb) : null; }
  var out = {t: v.currentTime, aspect: aspect, w: v.videoWidth, h: v.videoHeight};
  var t0 = performance.now();
  var rn = await n.videoFrame(b[0], aspect, null, true, true); out.nativeFrameMs = Math.round(performance.now() - t0);
  t0 = performance.now();
  var rw = await w.videoFrame(b[1], aspect, null, true, true); out.workerFrameMs = Math.round(performance.now() - t0);
  out.native = {persons: rn.persons, maxKp: rn.maxKp, noHumanShape: rn.noHumanShape, faces: rn.faces};
  out.worker = {persons: rw.persons, maxKp: rw.maxKp, noHumanShape: rw.noHumanShape, faces: rw.faces};
  var fn = await n.cropFaces(b[2]); var fw = await w.cropFaces(b[3]);
  out.cropFacesNative = fn.faces || []; out.cropFacesWorker = fw.faces || [];
  var boxes = (fw.faces && fw.faces.length) ? fw.faces : (fn.faces || []);
  out.boxesFrom = (fw.faces && fw.faces.length) ? 'worker' : 'native';
  var gn = {reads: []}, gw = {reads: []};
  if (boxes.length) {
    t0 = performance.now(); gn = await n.cropGender(fn.cid, boxes); out.nativeGenderMs = Math.round(performance.now() - t0);
    t0 = performance.now(); gw = await w.cropGender(fw.cid, boxes); out.workerGenderMs = Math.round(performance.now() - t0);
  }
  try { n.releaseCrop(fn.cid); } catch (e) {}
  try { w.releaseCrop(fw.cid); } catch (e) {}
  var rN = gn.reads || [], rW = gw.reads || [];
  out.descCos = [];
  for (var j = 0; j < Math.min(rN.length, rW.length); j++) out.descCos.push(cos(rN[j] && rN[j].desc, rW[j] && rW[j].desc));
  out.readsNative = strip(rN); out.readsWorker = strip(rW); out.boxes = boxes;
  return out;
})().then(function (r) { return JSON.stringify(r); }, function (e) { return JSON.stringify({err: String(e && e.message || e)}); }); })()"""


def iou(a, b):
    ix = max(0.0, min(a["x2"], b["x2"]) - max(a["x1"], b["x1"]))
    iy = max(0.0, min(a["y2"], b["y2"]) - max(a["y1"], b["y1"]))
    inter = ix * iy
    ua = (a["x2"] - a["x1"]) * (a["y2"] - a["y1"]) + (b["x2"] - b["x1"]) * (b["y2"] - b["y1"]) - inter
    return inter / ua if ua > 0 else 0.0


def box_of(o):
    if o is None:
        return None
    if "box" in o and isinstance(o["box"], dict):
        return o["box"]
    if all(k in o for k in ("x1", "y1", "x2", "y2")):
        return o
    return None


def match(a_list, b_list):
    """Greedy IoU match; returns list of (ia, ib, iou)."""
    pairs = []
    used = set()
    for i, a in enumerate(a_list):
        ba = box_of(a)
        best = (-1, 0.0)
        for j, b in enumerate(b_list):
            if j in used:
                continue
            bb = box_of(b)
            if ba is None or bb is None:
                continue
            v = iou(ba, bb)
            if v > best[1]:
                best = (j, v)
        if best[0] >= 0:
            used.add(best[0])
            pairs.append((i, best[0], best[1]))
    return pairs


def pct(xs, p):
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    k = int(round((len(xs) - 1) * p))
    return xs[k]


def wait_frame(t, target, timeout=8.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = t.eval("(function(){var v=document.querySelector('video'); return v ? JSON.stringify({s:v.seeking, rs:v.readyState, t:v.currentTime, p:v.paused}) : 'null';})()")
        try:
            s = json.loads(r)
        except Exception:
            s = None
        if s and not s["s"] and s["rs"] >= 2 and abs(s["t"] - target) < 1.5:
            return s
        time.sleep(0.25)
    return None


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_NATIVE_PARITY = 1;")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(6)
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_NATIVE_PARITY = 1;")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(24)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    st = t.eval("(function(){return JSON.stringify({flag: !!window.__TS_NATIVE_PARITY, hook: !!window.__TS_GAZE_ENGINES, native: window.__TS_GAZE_NATIVE||null, worker: (window.__TS_GAZE_WORKER||{}).backend||null, bundle: window.__TS_GAZE_BUNDLE__});})()")
    print("state", st)
    # THE BARS THE PLAYER PATH ACTUALLY DECIDES A PATCH AT, read off the
    # RUNNING bundle (ledger K11 + the R15 rule). This probe must never
    # re-type them: an instrument that re-derives a shipped rule is a
    # check that cannot fail (phase-G G1/G5/G9). If the hook is absent
    # the bar comparison is REFUSED rather than run against defaults --
    # a silently-skipped gate is what K11 is about.
    bars_raw = t.eval("(function(){var c=(window.__TS_GAZE_IDS||{}).cfg; return JSON.stringify(c||null);})()")
    try:
        BARS = json.loads(bars_raw) if isinstance(bars_raw, str) else bars_raw
    except Exception:
        BARS = None
    if isinstance(BARS, str):
        try:
            BARS = json.loads(BARS)
        except Exception:
            BARS = None
    print("bars", json.dumps(BARS))
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.pause();} return 1;})()")
    # Let the engine settle (ready) before the first frame.
    time.sleep(4)
    frames = []
    for target in TS:
        t.eval("(function(){var v=document.querySelector('video'); if(v){v.pause(); v.currentTime=%f;} return 1;})()" % target)
        s = wait_frame(t, target)
        if not s:
            frames.append({"t": target, "err": "seek did not settle"})
            print("t=%.0f seek did not settle" % target)
            continue
        time.sleep(0.6)
        r = t.cmd("Runtime.evaluate", expression=ONE_JS, awaitPromise=True, returnByValue=True, timeout=30000)
        val = ((r.get("result") or {}).get("result") or {}).get("value")
        try:
            fr = json.loads(val) if isinstance(val, str) else (val or {"err": "no value"})
        except Exception as e:
            fr = {"err": "bad json: %s" % e}
        fr["target"] = target
        frames.append(fr)
        if fr.get("err"):
            print("t=%.0f ERR %s" % (target, fr["err"]))
            continue
        pn, pw = fr["native"]["persons"] or [], fr["worker"]["persons"] or []
        pm = match(pn, pw)
        fn_, fw_ = fr["native"]["faces"] or [], fr["worker"]["faces"] or []
        fm = match(fn_, fw_)
        gl = [(a.get("gender"), b.get("gender")) for a, b in zip(fr["readsNative"], fr["readsWorker"])]
        print("t=%.0f persons %d/%d iou[%s] score d[%s] maxKp %s/%s | faces %d/%d iou[%s] | gender %s raw d[%s] cos[%s] | ms n%d/w%d g n%s/w%s" % (
            target, len(pn), len(pw),
            ",".join("%.2f" % p[2] for p in pm),
            ",".join("%.3f" % abs((pn[i].get("score") or 0) - (pw[j].get("score") or 0)) for i, j, _ in pm),
            fr["native"]["maxKp"], fr["worker"]["maxKp"],
            len(fn_), len(fw_), ",".join("%.2f" % p[2] for p in fm),
            "".join("=" if a == b else "X" for a, b in gl) or "-",
            ",".join("%.3f" % abs((a.get("raw") or 0) - (b.get("raw") or 0)) for a, b in zip(fr["readsNative"], fr["readsWorker"])),
            ",".join("%.4f" % c if c is not None else "?" for c in fr["descCos"]),
            fr.get("nativeFrameMs", -1), fr.get("workerFrameMs", -1), fr.get("nativeGenderMs"), fr.get("workerGenderMs")))
    # Summary
    ok = [f for f in frames if not f.get("err")]
    person_iou, score_d, kp_d, face_iou, raw_d, age_d, cosv = [], [], [], [], [], [], []
    labels_same = labels_total = 0
    count_mismatch_persons = count_mismatch_faces = 0
    for f in ok:
        pn, pw = f["native"]["persons"] or [], f["worker"]["persons"] or []
        if len(pn) != len(pw):
            count_mismatch_persons += 1
        for i, j, v in match(pn, pw):
            person_iou.append(v)
            score_d.append(abs((pn[i].get("score") or 0) - (pw[j].get("score") or 0)))
        if f["native"]["maxKp"] is not None and f["worker"]["maxKp"] is not None:
            kp_d.append(abs(f["native"]["maxKp"] - f["worker"]["maxKp"]))
        fn_, fw_ = f["native"]["faces"] or [], f["worker"]["faces"] or []
        if len(fn_) != len(fw_):
            count_mismatch_faces += 1
        for _, _, v in match(fn_, fw_):
            face_iou.append(v)
        for a, b in zip(f["readsNative"], f["readsWorker"]):
            labels_total += 1
            if a.get("gender") == b.get("gender"):
                labels_same += 1
            raw_d.append(abs((a.get("raw") or 0) - (b.get("raw") or 0)))
            if a.get("age") is not None and b.get("age") is not None:
                age_d.append(abs(a["age"] - b["age"]))
        cosv.extend(c for c in f["descCos"] if c is not None)
    # DECISION FLIPS AT EVERY SHIPPED BAR (ledger K11). The written gate
    # was "0 flips at GENDER_MIN_SCORE / GENDER_IMAGE_MIN_SCORE" -- both
    # FLAG bars. A player patch is REVEALED through clearBarFor
    # (GENDER_CLEAR_SCORE / _FEMALE) and held through the child gate and
    # the nm floor, and none of those was counted. `covering` is the
    # count of flips where NATIVE is the more protective of the two;
    # a flip in the exposing direction is the one that matters.
    flips = None
    if BARS and BARS.get("clearScore") is not None:
        def _clear(r):
            bar = BARS["clearScoreFemale"] if r.get("gender") == "female" else BARS["clearScore"]
            return (r.get("score") or 0) >= bar
        def _nm(r):
            return ((r.get("shape") or {}).get("norm") or 0) >= BARS["nmFloor"]
        # (name, predicate, True when a TRUE answer is the COVERING one)
        tests = [
            ("flagMin", lambda r: (r.get("score") or 0) >= BARS["genderMinScore"], True),
            ("clear", _clear, False),
            ("child", lambda r: (r.get("childP") or 0) >= BARS["childMass"], True),
            ("nmFloor", _nm, False),
            ("label", lambda r: r.get("gender"), None),
        ]
        flips = {}
        for name, fn, cov_true in tests:
            n = cov = 0
            for f in ok:
                for a, b in zip(f["readsNative"], f["readsWorker"]):
                    va, vb = fn(a), fn(b)
                    if va != vb:
                        n += 1
                        if cov_true is not None and va == cov_true:
                            cov += 1
            flips[name] = {"flips": n, "nativeMoreCovering": cov if cov_true is not None else None}
        flips["reads"] = labels_total
        flips["bars"] = BARS
    summary = {
        "frames": len(frames), "ok": len(ok),
        "personCountMismatchFrames": count_mismatch_persons, "faceCountMismatchFrames": count_mismatch_faces,
        "personIou": {"n": len(person_iou), "p50": pct(person_iou, 0.5), "min": min(person_iou) if person_iou else None},
        "personScoreAbsDiff": {"p50": pct(score_d, 0.5), "max": max(score_d) if score_d else None},
        "maxKpAbsDiff": {"p50": pct(kp_d, 0.5), "max": max(kp_d) if kp_d else None},
        "faceIou": {"n": len(face_iou), "p50": pct(face_iou, 0.5), "min": min(face_iou) if face_iou else None},
        "genderLabelAgree": "%d/%d" % (labels_same, labels_total),
        # K11: quote THIS, not genderLabelAgree, when claiming parity.
        "shippedBarFlips": flips if flips is not None else "REFUSED: no __TS_GAZE_IDS.cfg bars on the page",
        "genderRawAbsDiff": {"p50": pct(raw_d, 0.5), "max": max(raw_d) if raw_d else None},
        "ageAbsDiff": {"p50": pct(age_d, 0.5), "max": max(age_d) if age_d else None},
        "descCosine": {"n": len(cosv), "p50": pct(cosv, 0.5), "min": min(cosv) if cosv else None},
        "nativeFrameMs": {"p50": pct([f.get("nativeFrameMs") for f in ok], 0.5)},
        "workerFrameMs": {"p50": pct([f.get("workerFrameMs") for f in ok], 0.5)},
        "nativeGenderMs": {"p50": pct([f.get("nativeGenderMs") for f in ok], 0.5)},
        "workerGenderMs": {"p50": pct([f.get("workerGenderMs") for f in ok], 0.5)},
    }
    print("SUMMARY", json.dumps(summary))
    name = "native-parity-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump({"port": PORT, "video": VIDEO, "ts": TS, "state": st, "frames": frames, "summary": summary}, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
