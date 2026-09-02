"""Which capability API does m.youtube consult for AV1, and when relative to
our bundle boot? Plants plant-av1rec.js (accessor hooks that survive the
NO_AV1 re-assignment) plus an optional tuning plant. ONE process per plant.
    python probe_av1_caps.py <port> <label> [plantFile]
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402
PORT = int(sys.argv[1]); LABEL = sys.argv[2]; PF = sys.argv[3] if len(sys.argv) > 3 else None
HERE = os.path.dirname(os.path.abspath(__file__))
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.addScriptToEvaluateOnNewDocument", source=open(os.path.join(HERE, "plant-av1rec.js"), encoding="utf-8").read())
if PF: t.cmd("Page.addScriptToEvaluateOnNewDocument", source=open(os.path.join(HERE, PF), encoding="utf-8").read())
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(30)
t.eval("(function(){var v=document.querySelector('#movie_player video');if(v){v.muted=true;v.play();}return 1;})()")
time.sleep(10)
raw = t.eval("JSON.stringify({log:window.__TS_AV1P||null, tuning:window.__TS_GAZE_TUNING__||null, vw:(document.querySelector('#movie_player video')||{}).videoWidth, diag:(function(){try{var r=window.__TS_DIAG_NOW();r=typeof r==='string'?JSON.parse(r):r;return r.codec;}catch(e){return String(e)}})()})")
d = json.loads(raw)
json.dump(d, open(os.path.join(HERE, "av1caps-%s.json" % LABEL), "w"), indent=1)
print("LABEL", LABEL, "codec", d.get("diag"), "vw", d.get("vw"), "tuning", d.get("tuning"))
for e in (d.get("log") or []): print(" ", json.dumps(e))
