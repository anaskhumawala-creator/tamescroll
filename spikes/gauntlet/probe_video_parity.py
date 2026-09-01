# THE PARITY GATE ON THE OFFLINE VIDEO CORPUS.
#
# The corpus is read by tfjs-backend-cpu in Node. His phone reads WebGL.
# So every threshold Section 2 derives offline would be applied on a
# backend that never produced it -- the same shape of mistake as
# calibrating video thresholds on thumbnails, which is the root cause
# the handoff names. Measured, not assumed.
#
# Byte-identical inputs BY CONSTRUCTION: both arms build their tensor
# from the same raw rgb24 buffer, so no image decoder sits between them.
# The whole chain runs on both sides -- detect, crop, read -- because a
# box that moves changes the crop, and comparing faceres alone would
# hide that.
#
# Nothing is rendered: the page holds no visible element.
#
# Host side:  python -m http.server 8899   in Z:/tamescroll-corpus/parity
#             adb reverse tcp:8899 tcp:8899
#             adb forward tcp:<PORT> localabstract:webview_devtools_remote_<pid>
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
OUT = "Z:/tamescroll-corpus/parity/webgl-arm.json"

names = json.load(open("Z:/tamescroll-corpus/parity/frames.json"))
print("frames to run:", len(names))

t = Tab(page(port=PORT))
t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://localhost:8912/bench.html")

ready = 0
for _ in range(60):
    time.sleep(1)
    if t.eval("(function(){return window.__READY?1:0;})()") == 1:
        ready = 1; break
if not ready:
    print("BENCH NEVER READY -- page did not load or bundle threw."); sys.exit(1)
print("bench ready")

# One call, awaited. The page reports its own backend so a silent
# fallback to CPU inside the WebView cannot be mistaken for a WebGL run
# -- that would make the whole comparison vacuous.
res = t.eval("window.__RUN(%s)" % json.dumps(names))
if not isinstance(res, str):
    print("RUN returned non-string:", str(res)[:400]); sys.exit(1)
data = json.loads(res)
print("device backend:", data.get("backend"))
if data.get("backend") != "webgl":
    print("NOT WEBGL -- this arm proves nothing. Aborting."); sys.exit(1)
open(OUT, "w").write(json.dumps(data))
print("wrote", OUT, "frames", len(data["frames"]))
