import time, json
from gauntlet import open_platform

tab = open_platform("man")
# Approximate a Helio G88 against this desktop. 6x is the conventional
# "low-end mobile" factor; it throttles the MAIN THREAD only, which is
# exactly the resource the pipeline and YouTube's lazy callbacks fight over.
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("""(function(){
  window.__tsLT = 0; window.__tsLTms = 0;
  try {
    new PerformanceObserver(function(l){
      l.getEntries().forEach(function(e){ window.__tsLT++; window.__tsLTms += e.duration; });
    }).observe({entryTypes:['longtask']});
  } catch(e){}
})()""")
t0 = time.time()
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
seen = {}
for i in range(50):
    time.sleep(1)
    r = tab.eval("""(function(){
      var e = performance.getEntriesByType('navigation')[0];
      return JSON.stringify({
        bundle: !!window.__TS_GAZE_BUNDLE__,
        persons: !!window.__TS_GAZE_PERSONS,
        dcl: e?Math.round(e.domContentLoadedEventEnd):null,
        load: e?Math.round(e.loadEventEnd):null,
        lt: window.__tsLT||0, ltms: Math.round(window.__tsLTms||0),
        vid: (function(){var v=document.querySelector('video');return v?Math.round(v.currentTime*10)/10:null;})(),
        cmt: document.querySelectorAll('#comments ytd-comment-thread-renderer').length,
        rel: document.querySelectorAll('#related ytd-compact-video-renderer, #related yt-lockup-view-model').length
      });
    })()""")
    if isinstance(r, dict):
        continue
    d = json.loads(r)
    for k in ('bundle','persons'):
        if d[k] and k not in seen: seen[k] = round(time.time()-t0,1)
    if i in (5, 12, 20, 30, 45):
        print(i, d)
print("first-seen:", seen)
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
