# CALIBRATE NULL_MINT_NM_FLOOR AGAINST GROUND TRUTH.
#
# `nm` -- faceres' descriptor magnitude before L2-normalisation -- is the
# only signal in this pipeline that is about the CROP rather than about
# the answer, and it now gates whether a null read may create a patch.
# Every number behind that choice so far is a DISTRIBUTION (his phone,
# the video corpus): none of them can say whether a given read was a
# person. The two control arms can, because their labels come from a
# full-resolution read of a face BlazeFace actually found, or from a
# corner crop where it found nothing.
#
# Deliberately NOT a fresh search: it re-uses the exact ids banked in
# small-face-2026-09-01, so the new series is directly comparable to the
# one already on disk rather than to a different population.
#
# Nothing renders. The bench page holds no visible element and every crop
# goes to a detached canvas.
#
# Host: python -m http.server 8899 in spikes/faceres-parity, plus
# `adb -s <dev> reverse tcp:8899 tcp:8899`.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
ARM  = sys.argv[2] if len(sys.argv) > 2 else "face"      # face | nonface
IDS  = json.load(open("smallface-ids.json"))[ARM]

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://localhost:8899/small.html")
ready = 0
for _ in range(60):
    time.sleep(1)
    if t.eval("(function(){return window.__READY?1:0;})()") == 1:
        ready = 1; break
print("bench ready", ready, " ids", len(IDS))
if not ready:
    print("BENCH NEVER CAME UP -- is the host server running and adb reverse set?")
    sys.exit(1)

t.eval("(function(){window.__OUT=null;window.__ERR=null;"
       "window.__RUN(%s).then(function(r){window.__OUT=r;})"
       ".catch(function(e){window.__ERR=String(e&&e.stack||e);});return 1;})()"
       % json.dumps(IDS))
for _ in range(300):
    time.sleep(2)
    err = t.eval("(function(){return window.__ERR;})()")
    if err:
        print("ERROR", err); sys.exit(2)
    out = t.eval("(function(){return window.__OUT;})()")
    if out:
        d = json.loads(out)
        open("nmtruth-%s.json" % ARM, "w").write(json.dumps(d))
        print("banked nmtruth-%s.json" % ARM)
        print(json.dumps({k: d[k] for k in ('faces','detected','bigEnough','refGenders','nulls')
                          if k in d}, indent=1))
        sys.exit(0)
print("TIMED OUT")
