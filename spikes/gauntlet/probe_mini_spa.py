"""Does the player element survive an SPA nav back to the feed?

That is the whole question. If it survives, a real miniplayer (keep
playing while you browse) is buildable. If it dies, the only honest
shim is a corner window on the watch page itself.
"""
import json, time
from gauntlet import pick
tab = pick("youtube.com")
print("before:", tab.eval(r"""(function(){
  var v=document.querySelector('video'); if(!v) return 'no video';
  v.__ts=1; window.__tsv=v;
  return JSON.stringify({t:+v.currentTime.toFixed(2), paused:v.paused, href:location.pathname});
})()"""))
tab.eval("history.back()")
time.sleep(3.5)
print("after :", tab.eval(r"""(function(){
  var v=document.querySelector('video');
  var kept = window.__tsv;
  return JSON.stringify({
    path: location.pathname,
    liveVideos: document.querySelectorAll('video').length,
    sameEl: !!(v && v.__ts),
    keptStillInDom: !!(kept && document.contains(kept)),
    keptPaused: kept ? kept.paused : null,
    keptTime: kept ? +kept.currentTime.toFixed(2) : null,
    container: !!document.getElementById('player-container-id')
  });
})()"""))
time.sleep(2.0)
print("after2:", tab.eval(r"""(function(){
  var kept=window.__tsv;
  return JSON.stringify({keptTime: kept?+kept.currentTime.toFixed(2):null, keptPaused: kept?kept.paused:null,
    inDom: !!(kept&&document.contains(kept))});
})()"""))
