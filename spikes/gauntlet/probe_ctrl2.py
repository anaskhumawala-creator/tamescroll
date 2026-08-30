import time
from gauntlet import Tab, pick

def open_with_mode(mode):
    lau = pick("localhost:1420")
    ok = lau.eval("""(function(){var b=document.querySelector('.toggle-opt[data-value="%s"]');
      if(!b)return 'nobtn'; b.click(); return localStorage.getItem('tamescroll.blur');})()""" % mode)
    if ok != mode:
        raise SystemExit("mode did not take: %r" % ok)
    time.sleep(0.8)
    lau.eval("""(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))
      .filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()""")
    time.sleep(8)
    return pick("youtube.com")

for mode in ("off", "smart"):
    tab = open_with_mode(mode)
    tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview'")
    time.sleep(12)
    tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
    tab.eval("""(function(){window.__t0=performance.now();window.__tsLT=0;window.__tsLTms=0;window.__tsLTmax=0;
     if(window.__tsObs){try{window.__tsObs.disconnect();}catch(e){}}
     window.__tsObs=new PerformanceObserver(function(l){l.getEntries().forEach(function(e){
       window.__tsLT++;window.__tsLTms+=e.duration;if(e.duration>window.__tsLTmax)window.__tsLTmax=e.duration;});});
     window.__tsObs.observe({entryTypes:['longtask']});return 1;})()""")
    for i in range(10):
        tab.eval("window.scrollBy(0,700);"); time.sleep(1.0)
    print(mode, tab.eval("""JSON.stringify({wallMs:Math.round(performance.now()-window.__t0),
      lt:window.__tsLT, blockedMs:Math.round(window.__tsLTms), max:Math.round(window.__tsLTmax),
      items:document.querySelectorAll('ytd-video-renderer, yt-lockup-view-model').length})"""))
    tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
