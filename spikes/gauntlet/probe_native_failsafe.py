"""Native inference, phase-j J10 part 2: kill the NATIVE CLIENT under a
playing video and prove the page keeps covering people.

    python probe_native_failsafe.py <cdpPort> [videoId] [seekTo] [secs]

Pushing NATIVE_INFER 0 is NOT this test -- that leaves a healthy worker
and a client that was never asked. This one takes a page whose player is
being carried by the native engine, terminates that client through the
flag-gated parity hook (`__TS_GAZE_ENGINES.native().terminate()`, which
is `die('terminated')` -- the same path three consecutive request
failures take), and reads, over `secs` before and after:
  - verdict passes (stage ring growth) and visible video patches,
  - `player.life.nativeDead` (must go 0 -> 1 exactly once),
  - `nativePasses` (must STOP rising) and `__TS_GAZE_WORKER` (must be
    webgl and alive -- the fallback that J10 found missing on 1 of 2
    earlier runs).
Banks native-failsafe-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[3]) if len(sys.argv) > 3 else 217.0
SECS = float(sys.argv[4]) if len(sys.argv) > 4 else 40.0

PLANT = "window.__TS_NATIVE_PARITY = 1;"

READ_JS = """(function(){
  var ids = window.__TS_GAZE_IDS || {};
  var life = ids.life || {};
  var w = window.__TS_GAZE_WORKER || {};
  var st = ids.stages || [];
  var fresh = 0;
  for (var i = 0; i < st.length; i++) { if (st[i] && !st[i].__seen) { st[i].__seen = 1; fresh++; } }
  var patches = 0, visible = 0;
  var nodes = document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for (var j = 0; j < nodes.length; j++) {
    patches++;
    var cs = getComputedStyle(nodes[j]); var r = nodes[j].getBoundingClientRect();
    if (cs.display !== 'none' && r.width > 1 && r.height > 1) visible++;
  }
  var eng = window.__TS_GAZE_ENGINES || null;
  var nat = eng && eng.native ? eng.native() : null;
  return JSON.stringify({
    freshPasses: fresh, patches: patches, visiblePatches: visible,
    nativePasses: life.nativePasses, nativeReplies: life.nativeReplies, nativeErrors: life.nativeErrors,
    nativeDead: life.nativeDead, nativeReady: life.nativeReady,
    nativeClientDead: nat ? nat.dead() : null,
    workerBackend: w.backend || null, workerDead: !!w.dead,
    video: (function(){ var v = document.querySelector('video'); return v ? {t: Math.round(v.currentTime), paused: v.paused} : null; })()
  });
})()"""


def read(t):
    r = t.eval(READ_JS)
    return json.loads(r) if isinstance(r, str) else (r or {})


def sample(t, secs, label):
    rows = []
    t0 = time.time()
    while time.time() - t0 < secs:
        rows.append(read(t))
        time.sleep(2.0)
    passes = sum(r.get("freshPasses", 0) for r in rows)
    vis = [r.get("visiblePatches", 0) for r in rows]
    covered = sum(1 for v in vis if v > 0)
    print("%s: samples %d passes %d samplesWithPatch %d/%d nativePasses %s->%s nativeDead %s->%s worker %s dead %s" % (
        label, len(rows), passes, covered, len(rows),
        rows[0].get("nativePasses"), rows[-1].get("nativePasses"),
        rows[0].get("nativeDead"), rows[-1].get("nativeDead"),
        rows[-1].get("workerBackend"), rows[-1].get("workerDead")))
    return {"rows": rows, "passes": passes, "samplesWithPatch": covered, "samples": len(rows)}


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source=PLANT)
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(22)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(8)
    pre = read(t)
    print("pre", json.dumps(pre))
    before = sample(t, SECS, "BEFORE (native carrying)")
    # Read the counters IMMEDIATELY before the kill (phase-k K5): the last
    # before-sample is up to 2s old, and at an 800ms gap that is two or
    # three passes started native and unobserved -- the first run's "+1
    # in-flight" reading was really "+1 to +5 unobserved". Against this
    # read the after-window may exceed by AT MOST ONE (the pass in flight).
    atKill = read(t)
    killed = t.eval("(function(){ try { var e = window.__TS_GAZE_ENGINES; var n = e && e.native && e.native(); if (!n) return 'no native client'; n.terminate(); return 'terminated'; } catch (x) { return 'ERR ' + x; } })()")
    print("kill:", killed)
    time.sleep(3)
    after = sample(t, SECS, "AFTER (native dead)")
    # The pass in flight at the kill was STARTED native and its counter
    # is bumped when it resolves, so the first after-sample may read one
    # higher than the last before-sample (measured +1 on the Redmi). The
    # claim is that nothing starts native after the kill: compare inside
    # the after-window, not across it.
    a0, a1 = after["rows"][0], after["rows"][-1]
    k0 = atKill.get("nativePasses") or 0
    out = {
        "port": PORT, "video": VIDEO, "seek": SEEK, "secs": SECS, "pre": pre, "kill": killed,
        "before": before, "atKill": atKill, "after": after,
    }
    verdict = (
        "NO NATIVE TO KILL" if killed != "terminated" else
        "nativeDead did not go 0 -> 1 (%s -> %s)" % (before["rows"][-1].get("nativeDead"), a1.get("nativeDead")) if (a1.get("nativeDead") or 0) != 1 or (before["rows"][-1].get("nativeDead") or 0) != 0 else
        "nativePasses kept rising after the kill (at kill %s, after %s -> %s)" % (k0, a0.get("nativePasses"), a1.get("nativePasses")) if (a1.get("nativePasses") or 0) != (a0.get("nativePasses") or 0) or (a0.get("nativePasses") or 0) > k0 + 1 else
        "WORKER NOT CARRYING: backend %s dead %s" % (a1.get("workerBackend"), a1.get("workerDead")) if a1.get("workerBackend") != "webgl" or a1.get("workerDead") else
        "NO VERDICTS AFTER THE KILL" if after["passes"] == 0 else
        "NOTHING COVERED AFTER THE KILL (before %d/%d, after %d/%d)" % (before["samplesWithPatch"], before["samples"], after["samplesWithPatch"], after["samples"]) if after["samplesWithPatch"] == 0 and before["samplesWithPatch"] > 0 else
        "FAIL-SAFE HOLDS: worker took over, passes %d -> %d, covered samples %d/%d -> %d/%d" % (before["passes"], after["passes"], before["samplesWithPatch"], before["samples"], after["samplesWithPatch"], after["samples"])
    )
    out["verdict"] = verdict
    print("VERDICT", verdict)
    name = "native-failsafe-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
