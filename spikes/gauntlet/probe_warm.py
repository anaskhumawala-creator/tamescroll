import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
for i in range(30):
    time.sleep(1)
    t = tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})")
    if isinstance(t,str) and 'nsfw' in t: break
print("timing", t)
print("evalms", tab.eval("window.__TS_GAZE_EVALMS"))
print("firstVerdictAt", tab.eval("(window.__TS_GAZE_IMGDIAG||[]).length"))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
