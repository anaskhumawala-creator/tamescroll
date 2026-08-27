import time, json
from collections import Counter
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
for i in range(4):
    tab.eval("window.scrollBy(0,900)"); time.sleep(3)
time.sleep(6)
# SPA nav to home and back, then scroll again
tab.eval("(function(){var a=document.querySelector('a#logo, ytd-topbar-logo-renderer a'); if(a)a.click();})()")
time.sleep(8)
for i in range(3):
    tab.eval("window.scrollBy(0,900)"); time.sleep(3)
time.sleep(6)
rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
print("entries", len(rows))
ms=[r.get("ms",0) for r in rows]
ms.sort()
if ms:
    print("ms p50=%d p90=%d max=%d  mean=%d" % (ms[len(ms)//2], ms[int(len(ms)*0.9)], ms[-1], sum(ms)/len(ms)))
print("load p50=%d" % sorted(r.get("load",0) for r in rows)[len(rows)//2])
print("face p50=%d" % sorted(r.get("face",0) for r in rows)[len(rows)//2])
srcs=[r.get("src","") for r in rows]
c=Counter(srcs)
dup=sum(v-1 for v in c.values() if v>1)
print("unique srcs", len(c), "repeat inferences", dup)
print(Counter(r["why"] for r in rows))
# cost split: clear-with-no-face (face+nsfw) vs face path
noface=[r for r in rows if r.get("faces",0)==0 and r["why"]=="clear"]
print("no-face images", len(noface), "their ms p50", sorted(x.get("ms",0) for x in noface)[len(noface)//2] if noface else None)
