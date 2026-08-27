"""How often does a thumbnail we already judged come back?

Walks a realistic path -- search, a watch page, back, another watch page
-- and counts cached verdicts against fresh inferences.
"""
import time, json
from collections import Counter
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(14)
tab.eval("window.scrollBy(0,1200)"); time.sleep(6)

def counts(label):
    rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
    c = Counter(r.get("why") for r in rows)
    print(f"{label:22s} {dict(c)}")
    return c

counts("after search")
tab.eval("(function(){var a=document.querySelector('a#video-title, a#thumbnail');if(a)a.click();})()")
time.sleep(12); counts("after watch nav")
tab.eval("history.back()"); time.sleep(10); counts("after back")
tab.eval("(function(){var l=document.querySelectorAll('a#video-title, a#thumbnail'); if(l[3])l[3].click();})()")
time.sleep(12); c = counts("after second watch")
tot = sum(c.values()); cached = c.get("cached", 0)
print(f"cache served {cached}/{tot} = {100*cached/max(1,tot):.0f}% of image verdicts")
