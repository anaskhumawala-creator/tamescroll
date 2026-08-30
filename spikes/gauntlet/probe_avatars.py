"""Owner: "profile pics do not get blurred".

Sub-120px images were cleared unchecked -- a size rule standing in for
"UI chrome", which is also where every profile picture lives. They are
now asked the face question (IMAGE_MIN_FACE_SIZE). This reads the
pipeline's own diagnostics for what it actually processed, by source
width, so "small images are being checked now" is a count and not a
claim.
"""
import json
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(30)
for _ in range(4):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(6)

raw = tab.eval(
    "JSON.stringify((window.__TS_GAZE_IMGDIAG||[]).map(function(e){"
    "return {w:e.w, why:e.why, faces:e.faces, flagged:e.flagged, where:e.where};}))"
)
d = json.loads(raw)
small = [e for e in d if e.get("w") and 48 <= e["w"] < 120]
big = [e for e in d if e.get("w") and e["w"] >= 120]
print("processed: %d  (small 48-119px: %d, >=120px: %d)" % (len(d), len(small), len(big)))
print("small, by verdict:", {v: sum(1 for e in small if e["why"] == v) for v in set(e["why"] for e in small)} if small else {})
print("small with a face found:", sum(1 for e in small if e.get("faces")))
print("small flagged (covered):", sum(1 for e in small if e.get("flagged")))
print("sample:", small[:6])
# What is on the page but still uncheckable, for honesty about the floor.
print(tab.eval(
    "JSON.stringify((function(){var u=0,s=0,b=0;"
    "document.querySelectorAll('img').forEach(function(i){var w=Math.min(i.naturalWidth,i.naturalHeight);"
    "if(!w) return; if(w<48) u++; else if(w<120) s++; else b++;});"
    "return {under48:u, small:s, big:b};})())"
))
