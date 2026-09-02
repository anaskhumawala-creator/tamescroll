"""Read the perf-batch fields off the live page over CDP after a probe arm:
player.codec / codecChanges, native (backend, npu, per-model backends), perf
(slowed/restored), presenter stats (gl, lost, blurLevel), and the
presenterGl* / rafSkipped life counters.

    python diag_read.py <port>
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1])
t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
raw = t.eval("(function(){try{var r=window.__TS_DIAG_NOW?window.__TS_DIAG_NOW():null;return typeof r==='string'?r:JSON.stringify(r);}catch(e){return JSON.stringify({err:String(e)})}})()")
d = json.loads(raw) if isinstance(raw, str) else (raw or {})
pl = d.get("player") or {}
life = pl.get("life") or {}
out = {
    "bundle": t.eval("window.__TS_GAZE_BUNDLE__"),
    "versionCode": (d.get("app") or {}).get("versionCode"),
    "codec": d.get("codec"),
    "native": d.get("native"),
    "perf": d.get("perf"),
    "tuningApplied": (d.get("tuning") or {}).get("applied"),
    "life": {k: life.get(k) for k in ("presenterGlLost", "presenterGlRefused", "cutLocated", "cutUnlocated", "delayVerdictLate", "nativePasses", "nativeErrors")},
    "render": {k: (pl.get("render") or {}).get(k) for k in ("raf", "rafSkipped", "repositionErrors")},
}
ds = t.eval("(function(){try{var s=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;return s?JSON.stringify(s.stats):null;}catch(e){return null}})()")
out["presenter"] = json.loads(ds) if isinstance(ds, str) else ds
print(json.dumps(out, indent=1))
