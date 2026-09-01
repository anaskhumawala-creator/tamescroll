# DOES THE WHOLE-FRAME PATH'S 16:9 -> SQUARE SQUASH CHANGE WHO GETS
# COVERED?
#
# init-entry.js:4342 stretches the video into a 256x256 square with a
# four-argument drawImage. On YouTube that path is transient (the
# person-primary path takes over once MoveNet lands); on Reddit, X,
# Instagram and Facebook it is the ONLY path, because `isPlayer` is
# `closest('#movie_player')` -- see docs/engine-findings.md section 16.
#
# The bench (app/gaze/bench/stretch-arm.js) runs the SHIPPING
# detectFaceBoxes / classifyFaceGenders / faceMeta over 15 native 640x360
# frames already banked under spikes/faceres-parity/vframes, twice:
# stretched as shipped, and letterboxed with the aspect preserved.
#
# Nothing renders. The bench page holds no visible element and every
# canvas is detached.
#
# Host: python -m http.server 8899 in spikes/faceres-parity, plus
# `adb -s <dev> reverse tcp:8899 tcp:8899`.
import json, os, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VF = os.path.join(os.path.dirname(__file__), "..", "faceres-parity", "vframes")
NAMES = sorted(f for f in os.listdir(VF) if f.endswith(".png"))

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://localhost:8899/stretch.html")
ready = 0
for _ in range(60):
    time.sleep(1)
    if t.eval("(function(){return window.__READY?1:0;})()") == 1:
        ready = 1; break
print("bench ready", ready, " frames", len(NAMES))
if not ready:
    print("BENCH NEVER CAME UP -- is the host server running and adb reverse set?")
    sys.exit(1)

t.eval("(function(){window.__OUT=null;window.__ERR=null;"
       "window.__RUN(%s).then(function(r){window.__OUT=r;})"
       ".catch(function(e){window.__ERR=String(e&&e.stack||e);});return 1;})()"
       % json.dumps(NAMES))

d = None
for _ in range(300):
    time.sleep(2)
    err = t.eval("(function(){return window.__ERR;})()")
    if err:
        print("ERROR", err); sys.exit(2)
    out = t.eval("(function(){return window.__OUT;})()")
    if out:
        d = json.loads(out); break
if d is None:
    print("TIMED OUT"); sys.exit(3)

open("stretch-arms.json", "w").write(json.dumps(d, indent=1))
F = d["frames"]

# RECALL -- a face arm B finds and arm A does not is a face the shipped
# path never covers.
nA = sum(f["nA"] for f in F)
nB = sum(f["nB"] for f in F)
onlyA = sum(len(f["onlyA"]) for f in F)
onlyB = sum(len(f["onlyB"]) for f in F)
pairs = [p for f in F for p in f["pairs"]]

print("\nframes %d   detections: stretched %d   letterboxed %d" % (len(F), nA, nB))
print("  matched pairs %d   only-in-STRETCHED %d   only-in-LETTERBOX %d"
      % (len(pairs), onlyA, onlyB))
print("  (only-in-LETTERBOX = a face the shipped path never sees)")

# VERDICT -- among faces both arms found, does the read move?
if pairs:
    flip = [p for p in pairs if p["A"]["gender"] != p["B"]["gender"]]
    dr = sorted(abs(p["A"]["raw"] - p["B"]["raw"]) for p in pairs)
    nullflip = [p for p in pairs if p["A"]["nullRead"] != p["B"]["nullRead"]]
    def pct(a, q):
        return a[min(len(a) - 1, int(q * len(a)))]
    print("\nmatched faces %d" % len(pairs))
    print("  gender raw |diff|  p50 %.4f  p95 %.4f  max %.4f"
          % (pct(dr, .5), pct(dr, .95), dr[-1]))
    print("  GENDER LABEL FLIPS      %d of %d" % (len(flip), len(pairs)))
    print("  null-band membership flips %d of %d" % (len(nullflip), len(pairs)))
    for p in flip[:12]:
        print("    stretched %s %.3f -> letterboxed %s %.3f"
              % (p["A"]["gender"], p["A"]["raw"], p["B"]["gender"], p["B"]["raw"]))

# FRAME -- the only column the user can see.
for g in ("man", "woman"):
    ka, kb = "flag%sA" % g.capitalize(), "flag%sB" % g.capitalize()
    diff = [f for f in F if f[ka] != f[kb]]
    print("\ngender=%s  frames flagged: stretched %d   letterboxed %d   DIFFER %d of %d"
          % (g, sum(f[ka] for f in F), sum(f[kb] for f in F), len(diff), len(F)))
    for f in diff:
        print("    %-28s stretched %d  letterboxed %d" % (f["name"], f[ka], f[kb]))
print("\nbanked stretch-arms.json")
