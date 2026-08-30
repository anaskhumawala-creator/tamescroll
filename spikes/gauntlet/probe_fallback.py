"""With the worker disabled, does the in-page pipeline still work?

The worker path is new; the old one has to remain a true fallback, which
means it has to be exercised, not assumed.
"""
import time, json
from collections import Counter
from gauntlet import open_platform

tab = open_platform("man")
tab.cmd("Page.enable")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_NO_WORKER=1;")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(16)
tab.eval("window.scrollBy(0,900)")
time.sleep(8)
rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
print("worker events:", tab.eval("JSON.stringify(window.__TS_GAZE_WORKER||{})"))
print("verdicts:", dict(Counter(r.get("why") for r in rows)),
      "where:", dict(Counter(r.get("where", "page") for r in rows)))
print("in-page model loads:", tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})"))
