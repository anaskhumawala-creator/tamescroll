"""How often does the CHILD gate cover a confidently-read adult?

With the crop fixed, gender certainty is usable again -- so the question
is what is left covering men. isAdultRead refuses any read with
childP >= 0.25, whatever the age it reports.
"""
import json, sys, time
from gauntlet import targets, Tab, pick

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
QUERIES = sys.argv[1:] or ["pc build guide", "jerryrigeverything", "cpu comparison", "linus tech tips"]

lau = pick("localhost:1420")
lau.eval("(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"smart\"]');b&&b.click();})()")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
         ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)
tab = None
for t in targets():
    if "youtube" in t.get("url", ""):
        tab = Tab(t)
if not tab:
    raise SystemExit("no youtube window")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

childBlocked = adults = 0
rows = []
for q in QUERIES:
    tab.eval("window.__TS_GAZE_IMGDIAG=[]")
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(16)
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3)
    d = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
    for r in d:
        for rd in r.get("reads", []):
            rows.append(rd)
            if rd.get("g") == "male" and (rd.get("s") or 0) >= 0.4:
                adults += 1
                if (rd.get("c") or 0) >= 0.25:
                    childBlocked += 1
print("confident male reads:", adults, "of which the child gate refuses:", childBlocked)
cs = sorted((r.get("c") or 0) for r in rows)
if cs:
    print("childP  p50 %.2f  p90 %.2f  max %.2f  n=%d" % (
        cs[len(cs)//2], cs[int(len(cs)*0.9)], cs[-1], len(cs)))
ages = sorted((r.get("a") or 0) for r in rows)
if ages:
    print("age     p50 %d  min %d  max %d" % (ages[len(ages)//2], ages[0], ages[-1]))
