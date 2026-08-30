"""Can the PAGE load the bundle as a script url instead of a 22.7MB
eval'd string?

An eval'd string is never byte-cached by the WebView, so every single
page load pays the full parse: 76-83ms here, and this desktop is not the
phone. The worker already loads the same artifact from
`/__tamescroll/gaze-init.js` through our own request interceptor, so the
url exists and is same-origin -- the open questions are whether YouTube's
CSP lets the PAGE load it, and whether a second load is cheaper than the
first (which is what a code cache looks like from the outside).
"""
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

TRY = r"""(function(){
  window.__ts_csp = [];
  document.addEventListener('securitypolicyviolation', function(e){
    window.__ts_csp.push({directive: e.violatedDirective, blocked: String(e.blockedURI).slice(0,80)});
  });
  window.__ts_load = null;
  var t0 = performance.now();
  var u = location.origin + '/__tamescroll/gaze-init.js';
  try {
    if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
      u = trustedTypes.createPolicy('tamescroll-probe-' + Math.round(performance.now()), {
        createScriptURL: function(s){ return s; }
      }).createScriptURL(u);
    }
  } catch (e) { window.__ts_load = {policy: String(e).slice(0,80)}; }
  var s = document.createElement('script');
  s.onload = function(){ window.__ts_load = {ok: true, ms: Math.round(performance.now() - t0)}; };
  s.onerror = function(){ window.__ts_load = {ok: false, ms: Math.round(performance.now() - t0)}; };
  try { s.src = u; } catch (e) { window.__ts_load = {srcThrew: String(e).slice(0,90)}; return 'threw'; }
  (document.head || document.documentElement).appendChild(s);
  return 'appended';
})()"""

READ = "JSON.stringify({load: window.__ts_load, csp: window.__ts_csp})"

tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.cmd("Network.enable")
tab.eval("location.href='https://m.youtube.com/results?search_query=linus'")
time.sleep(20)

print("csp header:", tab.eval(
    "(function(){var m=document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]');"
    "return m ? m.content.slice(0,200) : 'no meta csp';})()"))
print("evalMs (the cost this would replace):", tab.eval("String(window.__TS_GAZE_EVALMS)"))

for i in (1, 2, 3):
    print("attempt %d:" % i, tab.eval(TRY))
    time.sleep(6)
    print("   ", tab.eval(READ))
