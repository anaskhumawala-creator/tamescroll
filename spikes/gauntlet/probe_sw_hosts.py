"""Does the page get models on a host whose service worker eats our urls?

www.youtube.com registers a service worker; every same-origin request
from a controlled page is proxied by it, and the ones it answers itself
never reach WebView2's WebResourceRequested -- so /__tamescroll/... comes
back as YouTube's own 404. m.youtube.com registers none.

The page/worker split therefore cannot be unconditional: on the desktop
host a model-free page has no worker AND no fetch, which is a pipeline
with no models at all. This checks both halves -- that the SW host still
has models in page, and that the mobile host still gets the small bundle
and a working worker.
"""
import json
import time

from gauntlet import pick, targets

MOBILE_UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

READ = r"""(async function(){
  var out = {
    host: location.host,
    sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    models: !!window.__TS_GAZE_MODELS,
    worker: window.__TS_GAZE_WORKER || null,
    images: (window.__TS_GAZE_IMGDIAG || []).length,
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    flagged: document.querySelectorAll('.ts-gaze-flagged').length
  };
  try {
    var r = await fetch(location.origin + '/__tamescroll/gaze-page.js');
    out.synthetic = r.status;
  } catch (e) { out.synthetic = String(e).slice(0, 40); }
  return JSON.stringify(out);
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval(
    "(function(){var i=window.__TAURI__.core.invoke;"
    "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs']});"
    "return 1;})()"
)
time.sleep(12)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break

def run(label, url, mobile):
    if mobile:
        tab.cmd("Emulation.setUserAgentOverride", userAgent=MOBILE_UA)
        tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
                deviceScaleFactor=2.0, mobile=True)
    else:
        tab.cmd("Emulation.setUserAgentOverride", userAgent="")
        tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
                deviceScaleFactor=1.0, mobile=False)
    tab.eval("location.href=%r" % url)
    time.sleep(28)
    print(label, tab.eval(READ))

run("desktop-1:", "https://www.youtube.com/results?search_query=podcast+interview", False)
run("desktop-2:", "https://www.youtube.com/results?search_query=linus+tech+tips", False)
run("mobile-1: ", "https://m.youtube.com/results?search_query=podcast+interview", True)
run("mobile-2: ", "https://m.youtube.com/results?search_query=linus+tech+tips", True)
