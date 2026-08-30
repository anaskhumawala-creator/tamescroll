"""A labelled corpus of image verdicts, on the owner's own kind of feed.

For every read: detector confidence (k), face size in native px (p),
gender + certainty, and a CROP of the face the read came from, saved to
disk so the picture can be checked against the number. Covered thumbnails
also get a full shot.
"""
import base64, json, os, sys, time
from gauntlet import open_platform

OUT = sys.argv[1] if len(sys.argv) > 1 else "runs/imgcorpus"
QUERIES = ["jerryrigeverything", "linus tech tips", "mrwhosetheboss", "gta 6 leaks", "pc build"]
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
os.makedirs(OUT, exist_ok=True)

tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

rows = []
for q in QUERIES:
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(17)
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3)
    got = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
    for g in got:
        g["q"] = q
    rows += got
    print(q, len(got))

json.dump(rows, open(os.path.join(OUT, "diag.json"), "w"), indent=1)
face = [r for r in rows if r.get("faces")]
cov = [r for r in rows if r.get("why") in ("face", "nsfw")]
print("images", len(rows), "with faces", len(face), "covered", len(cov))
for r in face:
    for rd in r.get("reads", []):
        print("  k=%s p=%s g=%s s=%s a=%s c=%s why=%s src=%s" % (
            rd.get("k"), rd.get("p"), rd.get("g"), rd.get("s"), rd.get("a"), rd.get("c"),
            r.get("why"), (r.get("src") or "")[-26:]))
