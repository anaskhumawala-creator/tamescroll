"""Both directions after the square-crop change: men must clear, women
must still be covered. Same page set, same mode (man)."""
import json, sys, time
from gauntlet import open_platform

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
QUERIES = sys.argv[1:] or ["pc build guide", "makeup tutorial", "yoga for beginners", "jerryrigeverything"]
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
for q in QUERIES:
    tab.eval("window.__TS_GAZE_IMGDIAG=[]")
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(17)
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3.2)
    d = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
    withf = [r for r in d if r.get("faces")]
    cov = [r for r in d if r.get("why") in ("face", "nsfw")]
    male = [rd for r in withf for rd in r["reads"] if rd.get("g") == "male"]
    fem = [rd for r in withf for rd in r["reads"] if rd.get("g") == "female"]
    def med(v):
        v = sorted(v)
        return v[len(v) // 2] if v else None
    print("%-22s imgs %3d  faces %3d  covered %2d | male %2d s_med %s | female %2d s_med %s"
          % (q, len(d), len(withf), len(cov), len(male), med([x["s"] for x in male]),
             len(fem), med([x["s"] for x in fem])))
