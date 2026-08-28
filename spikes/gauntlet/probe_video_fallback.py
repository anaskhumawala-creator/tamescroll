"""The in-page player path must still work with the worker disabled.

Same video, same mode, same assertions as probe_video_worker -- the
only difference is __TS_NO_WORKER, so the two outputs are directly
comparable.
"""
import time
from gauntlet import open_platform

tab = open_platform("woman")
tab.cmd("Page.enable")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_NO_WORKER=1;")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(40)
print(tab.eval(r"""(function(){
  var v=document.querySelector('#movie_player video');
  var q=v&&v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():null;
  var d=window.__TS_GAZE_IDS||{};
  var st=(d.stages||[]);
  return JSON.stringify({
    inPageModels: window.__TS_GAZE_TIMING||{},
    worker: window.__TS_GAZE_WORKER||{},
    persons: window.__TS_GAZE_PERSONS,
    patches: document.querySelectorAll('.ts-gaze-vregion-host').length,
    passes: st.length, verdictPasses: st.filter(function(s){return s.v;}).length,
    passFails: d.passFails||0, lastFail: d.lastFail||null, timeouts: d.timeouts||0,
    dropped: q?q.droppedVideoFrames:null, total: q?q.totalVideoFrames:null,
    heapMB: performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null
  });
})()"""))
