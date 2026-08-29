"""www.youtube's service worker answers our urls itself, so the worker
has never run there. Does it pass ANY path shape through to the network,
where our interceptor is waiting? Ask the page, one fetch per shape.
"""
import time
from gauntlet import pick, targets

PATHS = [
    "/__tamescroll/gaze-page.js",
    "/__tamescroll/gaze-page.js?ts=1",
    "/s/__tamescroll/gaze-page.js",
    "/s/player/__tamescroll/gaze-page.js",
    "/youtubei/__tamescroll/gaze-page.js",
    "/api/__tamescroll/gaze-page.js",
    "/generate_204/__tamescroll/gaze-page.js",
    "/yts/__tamescroll/gaze-page.js",
    "/sw.js_scope/__tamescroll/gaze-page.js",
]

JS = r"""(async function(){
  var out={controller: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
           scope: (navigator.serviceWorker&&navigator.serviceWorker.controller)?
                   navigator.serviceWorker.controller.scriptURL:null, r:[]};
  var paths=%s;
  for (var i=0;i<paths.length;i++){
    var p=paths[i];
    try{
      var t0=performance.now();
      var res=await fetch(p,{cache:'no-store'});
      var txt=await res.text();
      out.r.push({p:p,s:res.status,len:txt.length,
                  head:txt.slice(0,24).replace(/\s+/g,' '),
                  ms:Math.round(performance.now()-t0)});
    }catch(e){ out.r.push({p:p,err:String(e).slice(0,60)}); }
  }
  return JSON.stringify(out);
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()")
time.sleep(10)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1.0, mobile=False)
tab.eval("location.href='https://www.youtube.com/'")
time.sleep(12)
import json as _j
print(tab.eval(JS % _j.dumps(PATHS)))
