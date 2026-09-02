"""Native inference, Task 4/5 pre-check on a real arm64 device.

    python probe_native_port.py <cdpPort> [videoId] [seekTo] [secs]

Drives the app through its REAL path (launcher -> open_platform man/smart
-> watch page) and answers, in order, the questions a wrong guard or a
dead engine would each fail on:

  1. did Kotlin's `ts-native-port` WebMessage reach the document-start
     stash at all (`__TS_NATIVE_PORT_SEEN` counts arrivals BEFORE the
     source/origin guard -- so 0 = never delivered, >0 with no
     `__TS_NATIVE_PORT` = delivered and REFUSED by the guard);
  2. did init-entry adopt it and did the engine answer `native-ready`
     (`__TS_GAZE_NATIVE.adopted/ready/backend/initMs`, or `.why`);
  3. is the player path actually USING it (`player.life.nativePasses`
     rising against verdict passes over `secs`), with `nativeDead` 0.

Reads `__TS_GAZE_WORKER.backend` beside it so a run where the worker
carries the player is not mistaken for a native run. Banks to
native-port-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[3]) if len(sys.argv) > 3 else 217.0
SECS = float(sys.argv[4]) if len(sys.argv) > 4 else 60.0

READ_JS = """(function(){
  var ids = window.__TS_GAZE_IDS || {};
  var life = ids.life || {};
  var w = window.__TS_GAZE_WORKER || {};
  var st = ids.stages || [];
  var verdicts = 0;
  for (var i = 0; i < st.length; i++) if (st[i] && typeof st[i].tracks === 'number') verdicts++;
  return JSON.stringify({
    seen: window.__TS_NATIVE_PORT_SEEN || 0,
    stashed: !!window.__TS_NATIVE_PORT,
    native: window.__TS_GAZE_NATIVE || null,
    life: {
      nativeReady: life.nativeReady, nativeFailed: life.nativeFailed,
      nativeDead: life.nativeDead, nativePasses: life.nativePasses,
      passDropped: life.passDropped, personPassSkipped: life.personPassSkipped
    },
    workerBackend: w.backend || null, workerDead: !!w.dead,
    stagesRing: st.length, verdictsInRing: verdicts,
    bundle: window.__TS_GAZE_BUNDLE__, mode: window.__TS_GAZE_MODE,
    video: (function(){ var v = document.querySelector('video'); return v ? {t: v.currentTime, paused: v.paused, w: v.videoWidth, h: v.videoHeight} : null; })()
  });
})()"""


def read(t):
    r = t.eval(READ_JS)
    return json.loads(r) if isinstance(r, str) else (r or {})


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(6)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(20)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    early = read(t)
    print("at +20s", json.dumps(early))
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(10)
    a = read(t)
    print("t0", json.dumps(a))
    time.sleep(SECS)
    b = read(t)
    print("t1", json.dumps(b))
    la, lb = a.get("life", {}), b.get("life", {})
    delta = {k: (lb.get(k) or 0) - (la.get(k) or 0) for k in ("nativePasses", "nativeDead", "nativeFailed", "passDropped", "personPassSkipped")}
    out = {
        "port": PORT, "video": VIDEO, "seek": SEEK, "secs": SECS,
        "early": early, "t0": a, "t1": b, "delta": delta,
    }
    verdict = (
        "NO MESSAGE (stash never saw ts-native-port)" if not b.get("seen") else
        "REFUSED BY GUARD (seen %d, nothing stashed)" % b["seen"] if not b.get("stashed") else
        "NOT ADOPTED (stashed, no __TS_GAZE_NATIVE.adopted)" if not (b.get("native") or {}).get("adopted") else
        "NOT READY: %s" % (b.get("native") or {}).get("why") if not (b.get("native") or {}).get("ready") else
        "DEAD at %s" % (b.get("native") or {}).get("dead") if (b.get("native") or {}).get("dead") else
        "NATIVE LIVE backend=%s initMs=%s nativePasses +%d over %ds" % (
            (b.get("native") or {}).get("backend"), (b.get("native") or {}).get("initMs"), delta["nativePasses"], int(SECS))
    )
    out["verdict"] = verdict
    print("VERDICT", verdict)
    name = "native-port-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
