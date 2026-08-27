import time
from gauntlet import open_platform
tab = open_platform("man")
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
for i in range(30):
    time.sleep(1)
    t = tab.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})")
    if isinstance(t,str) and 'nsfw' in t: break
print("eval0", tab.eval("window.__TS_GAZE_EVAL0"))
print("timing", t)
print("readyStateAtLoad", tab.eval("JSON.stringify(performance.getEntriesByType('navigation').map(function(n){return {load:Math.round(n.loadEventEnd),dcl:Math.round(n.domContentLoadedEventEnd)};}))"))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
