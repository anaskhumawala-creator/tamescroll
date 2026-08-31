# IS MoveNet BROKEN ON HIS DEVICE, OR IS IT THE FOOTAGE?
#
# MEASURED on the same video at the same seek point, 2026-09-01:
#   his phone (1073, 234 passes):  all twelve slots n:0, faceNoShape 127
#   emulator  (1075,  98 passes):  slots 2-3 per pass, faceNoShape 1
# BlazeFace finds faces on BOTH -- his phone produced 41 gender reads at
# 53-131px in that window -- so the frames are not black and the subject
# is there. MoveNet alone comes back empty on his device, and on his
# device it is the ONLY thing deciding whether a detected face becomes a
# patch (frameHasNoHumanShape).
#
# There is a precedent pointing at the model: movenet-multipose.bin is
# OUR OWN hybrid uint8 requant of Google's f16 build (2026-08-24), and
# the full-uint8 attempt produced DEAD OUTPUT on the depthwise convs.
# Tonight's faceres run showed that class of damage is invisible to a
# smoke test.
#
# So: the SAME TWENTY THUMBNAILS through the shipping detectPersons on
# both machines. If his phone reads near-zero where the emulator reads
# 0.8, the footage is not the variable and the model is.
#
# EMULATOR BASELINE, banked in movenet-baseline-emu.json:
#   backend webgl, float32 render ENABLED, 20 images, 25 persons
#   admitted, maxKp p50 0.816 / max 0.858, noShapeFrames 0.
#
# Host side: python -m http.server 8899 in spikes/faceres-parity, plus
# `adb reverse tcp:8899 tcp:8899`. Nothing renders -- the page holds no
# visible element and the crops go to a detached canvas.
import json, os, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
HERE = os.path.dirname(os.path.abspath(__file__))
IDS = json.load(open(os.path.join(HERE, 'movenet-baseline-emu.json')))['ids']

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://localhost:8899/movenet.html")
for _ in range(40):
    time.sleep(1)
    if t.eval("(function(){return window.__READY?1:0;})()") == 1:
        break
print("bench ready", t.eval("(function(){return !!window.__RUN;})()"))

t.eval("(function(){window.__OUT=null;window.__ERR=null;"
       "window.__RUN(%s).then(function(r){window.__OUT=r;})"
       ".catch(function(e){window.__ERR=String(e&&e.stack||e);});return 1;})()"
       % json.dumps(IDS))

for _ in range(180):
    time.sleep(2)
    err = t.eval("(function(){return window.__ERR;})()")
    if err:
        print("ERROR", err); sys.exit(2)
    out = t.eval("(function(){return window.__OUT;})()")
    # CDP hands back {'type':'undefined'} for a null, which is TRUTHY in
    # python and reads exactly like a finished run.
    if isinstance(out, dict) and out.get('type') == 'undefined':
        out = None
    if out:
        d = json.loads(out) if isinstance(out, str) else out
        rows = d.pop('rows')
        print(json.dumps(d, indent=1))
        base = json.load(open(os.path.join(HERE, 'movenet-baseline-emu.json')))
        by = {r['id']: r for r in base['rows']}
        print("\n%-14s %8s %8s   %8s %8s" % ("id", "emuKp", "thisKp", "emuN", "thisN"))
        for r in rows:
            b = by.get(r['id'], {})
            print("%-14s %8s %8s   %8s %8s" % (
                r['id'], b.get('maxKp'), r['maxKp'], b.get('admitted'), r['admitted']))
        sys.exit(0)
print("TIMED OUT")
