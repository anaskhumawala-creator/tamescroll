"""Does the PLAYER run in the worker, and does it still cover people?

Two claims at once, because either alone is worthless: the page must
hold no models, and the patches must still be there. Woman mode on a
video of a man, so every person on screen is a patch that has to exist.
"""
import json, sys, time
from gauntlet import open_platform

tab = open_platform(sys.argv[1] if len(sys.argv)>1 else "woman")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(35)
tab.eval(r"""(function(){
  window.__LT=[]; window.__DF=0;
  try{ new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
    window.__LT.push(Math.round(e.duration));});}).observe({entryTypes:['longtask']}); }catch(e){}
  var last=performance.now(), frames=0, slow=0;
  (function tick(){ var n=performance.now(); frames++; if(n-last>32) slow++; last=n;
    if(frames<3600) requestAnimationFrame(tick); else window.__DF=slow; })();
})()""")
time.sleep(45)
print(tab.eval(r"""(function(){
  var lt=window.__LT||[]; lt.sort(function(a,b){return a-b;});
  var v=document.querySelector('#movie_player video');
  var q=v&&v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():null;
  var d=window.__TS_GAZE_IDS||{};
  var st=(d.stages||[]);
  var verd=st.filter(function(s){return s.v;});
  function p50(a,k){var x=a.map(function(s){return s[k]||0;}).sort(function(m,n){return m-n;});
    return x.length?x[Math.floor(x.length/2)]:null;}
  return JSON.stringify({
    inPageModels: window.__TS_GAZE_TIMING||{},
    worker: window.__TS_GAZE_WORKER||{},
    persons: window.__TS_GAZE_PERSONS,
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length,
    passes: st.length, verdictPasses: verd.length,
    verdictP50: p50(verd,'end'), positionP50: p50(st.filter(function(s){return !s.v;}),'end'),
    passFails: d.passFails||0, lastFail: d.lastFail||null, timeouts: d.timeouts||0,
    longTasks: lt.length, longTaskMs: lt.reduce(function(a,b){return a+b;},0),
    slowFrames: window.__DF,
    dropped: q?q.droppedVideoFrames:null, total: q?q.totalVideoFrames:null,
    heapMB: performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null
  });
})()"""))
