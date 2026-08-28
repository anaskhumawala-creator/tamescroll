"""What does a WATCH page cost now that images live in the worker?

The video path still runs in page, so a watch page loads two copies of
the face + gender models and does its inference on the thread that draws
the player. Measures both halves before deciding whether to move it.
"""
import json, time
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(30)
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
  return JSON.stringify({
    inPageModels: window.__TS_GAZE_TIMING||{},
    worker: window.__TS_GAZE_WORKER||{},
    longTasks: lt.length, longTaskMs: lt.reduce(function(a,b){return a+b;},0),
    longTaskMax: lt[lt.length-1]||0,
    slowFrames: window.__DF,
    dropped: q?q.droppedVideoFrames:null, total: q?q.totalVideoFrames:null,
    heapMB: performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,
    patches: document.querySelectorAll('.ts-gaze-vregion-host div').length
  });
})()"""))
