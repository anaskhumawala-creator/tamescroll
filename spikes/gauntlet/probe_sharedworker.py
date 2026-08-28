"""Can a SharedWorker survive a navigation, and can it do WebGL?

The whole start-up cost -- worker script eval, four model loads, and
~500ms of WebGL program compilation -- is paid again on EVERY m.youtube
navigation, because a dedicated Worker dies with its page. A SharedWorker
does not: it is per-ORIGIN, and the next page connects to the one that is
already warm.

Two things have to be true for that to be worth building:
  1. SharedWorker exists here and can be created from our synthetic url
     (Trusted Types allows a same-origin script url -- measured).
  2. It can get a webgl2 context from an OffscreenCanvas. A CPU backend
     would be slower than the main thread it is meant to relieve, which
     is the same veto the dedicated worker already has.
"""
import json
import time

from gauntlet import pick, targets

UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")

TRY = r"""(function(){
  return new Promise(function(resolve){
    var out = {has: typeof SharedWorker};
    if (typeof SharedWorker !== 'function') return resolve(JSON.stringify(out));
    var src = "onconnect=function(e){var p=e.ports[0];var o={};"
      + "try{var c=new OffscreenCanvas(8,8);var g=c.getContext('webgl2');"
      + "o.webgl2=!!g;o.vendor=g?String(g.getParameter(g.VERSION)).slice(0,40):null;"
      + "o.parallel=!!(g&&g.getExtension('KHR_parallel_shader_compile'));}"
      + "catch(err){o.err=String(err).slice(0,80);}"
      + "o.n=(self.__n=(self.__n||0)+1);p.postMessage(o);};";
    // Same-origin only: a blob: url is what Trusted Types refuses.
    // Our interceptor answers /__tamescroll/*, so ask it for a script we
    // control the body of -- there is none for this, so use the real one
    // and just check construction, then a blob for the capability half.
    var u = location.origin + '/__tamescroll/gaze-page.js';
    try {
      var w = new SharedWorker(u);
      out.constructed = true;
      w.port.start();
      w.onerror = function(e){ out.error = String(e && e.message).slice(0,80); resolve(JSON.stringify(out)); };
    } catch (e) {
      out.constructThrew = String(e).slice(0, 90);
    }
    try {
      var b = new Blob([src], {type: 'text/javascript'});
      var bw = new SharedWorker(URL.createObjectURL(b));
      bw.port.onmessage = function(ev){ out.blobWorker = ev.data; resolve(JSON.stringify(out)); };
      bw.port.start();
      bw.port.postMessage('go');
    } catch (e) {
      out.blobThrew = String(e).slice(0, 90);
      resolve(JSON.stringify(out));
    }
    setTimeout(function(){ resolve(JSON.stringify(out)); }, 6000);
  });
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs']});"
         "return 1;})()")
time.sleep(12)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
for i, url in enumerate(["https://m.youtube.com/results?search_query=podcast",
                         "https://m.youtube.com/results?search_query=linus"]):
    tab.eval("location.href=%r" % url)
    time.sleep(18)
    print("nav", i, tab.eval(TRY))
