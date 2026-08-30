import time, json
from gauntlet import open_platform
tab = open_platform("man")
for rate in (1, 6):
    tab.cmd("Emulation.setCPUThrottlingRate", rate=rate)
    for url in ("https://www.youtube.com/watch?v=NWoT1ZVd1Lo",
                "https://www.youtube.com/results?search_query=linus"):
        tab.eval("location.href='%s'" % url)
        time.sleep(9 if rate == 1 else 16)
        print(rate, url.split('/')[-1][:18], tab.eval("""(function(){
          var e=performance.getEntriesByType('navigation')[0];
          return JSON.stringify({evalMs:window.__TS_GAZE_EVALMS||null,
            eval0:Math.round(window.__TS_GAZE_EVAL0||0),
            dcl:e?Math.round(e.domContentLoadedEventEnd):null,
            load:e?Math.round(e.loadEventEnd):null,
            resp:e?Math.round(e.responseEnd):null});
        })()"""))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
