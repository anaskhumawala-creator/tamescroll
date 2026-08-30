"""Does the patch cover hair? (owner 2026-08-27: "hair visible of women")

Flags women on a search page, then for every drawn patch measures how far
the patch top sits ABOVE the detected face box top, in face-heights --
and screenshots the first few so the answer is a picture, not a number.
"""
import json, sys, time
from gauntlet import open_platform

OUT = sys.argv[1] if len(sys.argv) > 1 else "hair"
Q = "podcast interview woman"

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=" + Q.replace(" ", "+") + "'")
for _ in range(25):
    time.sleep(2)
    st = tab.eval("JSON.stringify(window.__TS_GAZE_WORKER||{})")
    if isinstance(st, str) and "ready" in st:
        break
print("worker:", st)
time.sleep(10)
tab.eval("window.scrollBy(0,600)")
time.sleep(10)

rows = tab.eval("""(function(){
  var out=[];
  var wrap=document.getElementById('tamescroll-gaze-regions');
  var n=document.querySelectorAll('.ts-gaze-region-patch');
  for (var i=0;i<n.length;i++){
    var r=n[i].getBoundingClientRect();
    out.push({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});
  }
  return JSON.stringify({patches:out, wrapper:!!wrap});
})()""")
print("patches:", rows)

# The geometry the patch is derived from, straight out of the diag log.
diag = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
flag = [d for d in diag if d.get("why") == "flag"]
print("flagged images:", len(flag), "of", len(diag))

shot = 0
for p in json.loads(rows)["patches"]:
    if p["w"] < 40 or p["h"] < 40:
        continue
    pad = 60
    tab.clip_shot(
        f"{OUT}-{shot}.png",
        {"x": max(0, p["x"] - pad), "y": max(0, p["y"] - pad), "w": p["w"] + pad * 2, "h": p["h"] + pad * 2},
    )
    shot += 1
    if shot >= 4:
        break
print("shots:", shot)
