import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(14)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)

OBS = """(function(){
  window.__tsLT=0; window.__tsLTms=0; window.__tsLTmax=0;
  if (window.__tsObs) { try{window.__tsObs.disconnect();}catch(e){} }
  window.__tsObs = new PerformanceObserver(function(l){
    l.getEntries().forEach(function(e){
      window.__tsLT++; window.__tsLTms+=e.duration;
      if(e.duration>window.__tsLTmax) window.__tsLTmax=e.duration;
    });
  });
  window.__tsObs.observe({entryTypes:['longtask']});
  return 1;
})()"""
READ = """(function(){
  var v=document.querySelector('video');
  return JSON.stringify({lt:window.__tsLT,ms:Math.round(window.__tsLTms),max:Math.round(window.__tsLTmax),
    patches:(document.querySelectorAll('#movie_player div[style*=backdrop-filter]')||[]).length,
    dropped:(function(){try{var q=v.getVideoPlaybackQuality();return q.droppedVideoFrames;}catch(e){return null;}})(),
    total:(function(){try{return v.getVideoPlaybackQuality().totalVideoFrames;}catch(e){return null;}})()});
})()"""

def pill(state):
    return tab.eval("""(function(){
      var p=[].slice.call(document.querySelectorAll('#movie_player *')).filter(function(e){
        return /Blur (on|off)/.test(e.textContent||'') && e.children.length<4;});
      if(!p.length) return 'nopill';
      var t=p[p.length-1];
      var want='%s';
      if(new RegExp('Blur '+want).test(t.textContent)) return 'already '+t.textContent.trim();
      t.click(); return 'clicked -> '+t.textContent.trim();
    })()""" % state)

for label, want in (("BLUR ON", "on"), ("BLUR OFF", "off")):
    print(label, pill(want))
    time.sleep(2)
    tab.eval(OBS)
    time.sleep(30)
    print(label, tab.eval(READ))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
