"""Does the model fetch work on the OTHER platforms?

gen-embed.js says Reddit sends no connect-src/worker-src and falls back
to default-src 'none', which killed a runtime fetch outright in the
2026-08-18 spike. If that is still true, then tonight's page/full split
took the models away from a page that cannot go and get them -- a gaze
regression on reddit, introduced while optimising youtube.

So: on each platform, try BOTH deliveries -- fetch() and a <script src>
-- against our own synthetic url, and report what the CSP says.
"""
import json
import time

from gauntlet import pick, targets

TRY = r"""(async function(){
  var out = {url: location.href, csp: []};
  document.addEventListener('securitypolicyviolation', function(e){
    if (out.csp.length < 4) out.csp.push(e.violatedDirective + ' <- ' + String(e.blockedURI).slice(0,60));
  });
  var u = location.origin + '/__tamescroll/gaze-init.js';
  var t0 = performance.now();
  try {
    var r = await fetch(u);
    var b = await r.arrayBuffer();
    out.fetch = {ok: r.ok, bytes: b.byteLength, ms: Math.round(performance.now() - t0)};
  } catch (e) {
    out.fetch = {error: String(e).slice(0, 90)};
  }
  out.scriptLoad = await new Promise(function(resolve){
    var t1 = performance.now();
    var su = u;
    try {
      if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
        su = trustedTypes.createPolicy('ts-csp-probe-' + Math.round(t1), {
          createScriptURL: function(s){ return s; }
        }).createScriptURL(u);
      }
    } catch (e) { resolve({policy: String(e).slice(0,80)}); return; }
    var s = document.createElement('script');
    s.onload = function(){ resolve({ok: true, ms: Math.round(performance.now() - t1),
                                    published: !!window.__TS_GAZE_MODELS}); };
    s.onerror = function(){ resolve({ok: false, ms: Math.round(performance.now() - t1)}); };
    try { s.src = su; } catch (e) { resolve({srcThrew: String(e).slice(0,80)}); return; }
    (document.head || document.documentElement).appendChild(s);
    setTimeout(function(){ resolve({timeout: true}); }, 15000);
  });
  return JSON.stringify(out);
})()"""

lau = pick("localhost:1420")
for plat, url in [("reddit", "https://www.reddit.com/r/pics/"),
                  ("x", "https://x.com/explore"),
                  ("youtube", "https://m.youtube.com/results?search_query=linus")]:
    lau.eval(
        "(function(){var i=window.__TAURI__.core.invoke;"
        "i('open_platform',{id:%r,mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()" % plat
    )
    time.sleep(11)
    tab = None
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u:
            tab = pick(u)
            break
    if not tab:
        print(plat, "NO WINDOW")
        continue
    tab.eval("location.href=%r" % url)
    time.sleep(20)
    print("===", plat)
    print("   ", tab.eval(TRY))
    print("    modelsInPage:", tab.eval("String(!!window.__TS_GAZE_MODELS)"),
          "bundle:", tab.eval("String(window.__TS_GAZE_BUNDLE__)"))
