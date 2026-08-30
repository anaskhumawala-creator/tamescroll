"""The fallback's new dependency, tested directly.

With the models out of the page artifact, the in-page pipeline gets them
by loading the FULL artifact from the url our own interceptor answers --
the same one the worker uses. If that fetch does not publish the blobs,
the fallback has no models at all, and every image stays covered forever
(fail-safe, but useless). The worker cannot be turned off from outside
the page (the flag is read during boot, before CDP's document script
runs), so this exercises the mechanism the fallback depends on rather
than the fallback itself.
"""
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

LOAD = r"""(function(){
  window.__ts_fb = {started: true};
  var t0 = performance.now();
  var u = location.origin + '/__tamescroll/gaze-init.js';
  try {
    if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
      u = trustedTypes.createPolicy('tamescroll-fb-' + Math.round(t0), {
        createScriptURL: function(s){ return s; }
      }).createScriptURL(u);
    }
  } catch (e) { window.__ts_fb.policy = String(e).slice(0,60); }
  var s = document.createElement('script');
  s.onload = function(){
    var m = window.__TS_GAZE_MODELS;
    window.__ts_fb.done = {
      ms: Math.round(performance.now() - t0),
      published: !!m,
      names: m ? Object.keys(m) : [],
      shapes: m ? Object.keys(m).map(function(k){
        var b = m[k];
        return k + ':' + (b && b[0] ? 'json' : 'NOJSON') + '/' +
               (b && typeof b[1] === 'string' ? b[1].length : 'NOB64');
      }) : []
    };
  };
  s.onerror = function(){ window.__ts_fb.done = {error: true}; };
  s.src = u;
  (document.head || document.documentElement).appendChild(s);
  return 'appended';
})()"""

tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=linus'")
time.sleep(22)
print("page artifact:", tab.eval(
    "JSON.stringify({evalMs: window.__TS_GAZE_EVALMS, modelsInPage: !!window.__TS_GAZE_MODELS})"))
print(tab.eval(LOAD))
time.sleep(12)
print("fallback source:", tab.eval("JSON.stringify(window.__ts_fb)"))
