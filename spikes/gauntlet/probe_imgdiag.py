import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
# scroll a bit so a couple of screens' worth queue and drain
for i in range(6):
    tab.eval("window.scrollBy(0,700)")
    time.sleep(2.5)
time.sleep(6)
d = tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")
try:
    rows = json.loads(d)
except Exception:
    print("no diag", repr(d)[:200]); raise SystemExit
print("entries", len(rows))
from collections import Counter
print(Counter([r["why"] for r in rows]))
for r in rows:
    if r["why"] == "face":
        print(r["faces"], r["flagged"], r["reads"])
