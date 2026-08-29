"""www.youtube has never run the inference worker: its service worker
answered our own urls. With a query on every synthetic url, does the
worker actually start and do the models arrive as bytes?
"""
import time
from gauntlet import pick, targets

READ = r"""(function(){
  var w=window.__TS_GAZE_WORKER||{};
  var imgs=[].slice.call(document.images).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>60&&r.height>40&&i.currentSrc;});
  var pend=0,flag=0,clear=0;
  imgs.forEach(function(i){
    if(i.classList.contains('ts-gaze-pending'))pend++;
    else if(i.classList.contains('ts-gaze-flagged'))flag++; else clear++;});
  return JSON.stringify({t:Math.round(performance.now()),
    n:imgs.length,pend:pend,flag:flag,clear:clear,
    total:window.__TS_GAZE_IMGTOTAL||0,
    wrk:{dead:!!w.dead,ready:!!w.ready,backend:w.backend||null,ms:w.ms||null,
         up:w.up||null,warmMs:w.warmMs||null,evalMs:w.evalMs||null},
    modelsInPage:!!window.__TS_GAZE_MODELS,
    boot:window.__TS_GAZE_BOOT||null});
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()")
time.sleep(10)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1.0, mobile=False)
for nav in range(2):
    tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview'")
    print("nav", nav)
    for i in range(5):
        time.sleep(6)
        print("  ", tab.eval(READ))
