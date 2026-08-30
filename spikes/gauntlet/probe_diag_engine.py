"""Does the report's engine block carry real numbers now?

Every field in it was in the shape and none was populated: rulesGen,
otaLast, otaAgeH, cssBytes, blocked all read from `__TS_DIAG_APP`, which
carried only versionCode and blurPx. So the block that exists to answer
"which rules was the phone running when the ad got through" answered
nothing.
"""
import json
import time

from gauntlet import open_platform

tab = open_platform("man")
time.sleep(8)
tab.eval("location.href='https://www.youtube.com/results?search_query=linus'")
time.sleep(18)

print("__TS_DIAG_APP:", tab.eval("JSON.stringify(window.__TS_DIAG_APP)"))
raw = tab.eval("(function(){var r=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();return typeof r==='string'?r:JSON.stringify(r);})()")
if not raw or raw == "null":
    raise SystemExit("no report")
d = json.loads(raw)
print("bytes:", len(raw))
print("engine:", json.dumps(d.get("engine"), indent=1))
print("violations:", d.get("violations", "(not in report)"))
