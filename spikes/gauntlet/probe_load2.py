import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
for i in range(40):
    time.sleep(1.5)
    r = tab.eval("""(function(){
      var e=performance.getEntriesByType('navigation')[0];
      return JSON.stringify({t:window.__TS_GAZE_TIMING||null,
        dcl:e?Math.round(e.domContentLoadedEventEnd):null,
        load:e?Math.round(e.loadEventEnd):null,
        now:Math.round(performance.now()),
        patches:document.querySelectorAll('#movie_player div[style*=backdrop-filter]').length});
    })()""")
    if isinstance(r, dict): continue
    d=json.loads(r)
    if d['t'] and d['t'].get('nsfw'): print("FINAL", d); break
    if i%6==0: print(i, d)
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
