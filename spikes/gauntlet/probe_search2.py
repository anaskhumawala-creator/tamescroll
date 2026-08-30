import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("""(function(){window.__tsLT=0;window.__tsLTms=0;window.__tsLTmax=0;
 if(window.__tsObs){try{window.__tsObs.disconnect();}catch(e){}}
 window.__tsObs=new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
   window.__tsLT++;window.__tsLTms+=e.duration;if(e.duration>window.__tsLTmax)window.__tsLTmax=e.duration;});});
 window.__tsObs.observe({entryTypes:['longtask']});return 1;})()""")
t0=time.time()
for i in range(12):
    tab.eval("window.scrollBy(0,700);")
    time.sleep(1.0)
print("search scroll 12s:", tab.eval("""JSON.stringify({lt:window.__tsLT,ms:Math.round(window.__tsLTms),max:Math.round(window.__tsLTmax),
  items:document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model').length,
  patches:document.querySelectorAll('div[style*="backdrop-filter"]').length,
  blurred:document.querySelectorAll('.ts-gaze-flagged, .ts-gaze-pending').length})"""))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
