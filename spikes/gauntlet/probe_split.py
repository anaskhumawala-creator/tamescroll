"""The page no longer carries the models. Prove both halves.

A. Worker alive (the normal path): the page must evaluate a small
   artifact, never load a model on this thread, and still get verdicts.
B. Worker refused (__TS_NO_WORKER): the in-page fallback is the only
   thing standing between an unchecked image and the screen, and it now
   has to FETCH the model bytes from the same url the worker uses. If
   that path is broken, images stay covered (fail-safe) but nothing ever
   clears -- so this checks it actually classifies.

Usage: probe_split.py [worker|noworker]
"""
import json
import sys
import time

from gauntlet import pick, targets

MODE = sys.argv[1] if len(sys.argv) > 1 else "worker"
UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

READ = r"""(function(){
  var d = window.__TS_GAZE_DIAG || {};
  var imgs = window.__TS_GAZE_IMGDIAG || [];
  return JSON.stringify({
    evalMs: window.__TS_GAZE_EVALMS,
    bundle: window.__TS_GAZE_BUNDLE__,
    // The tell: the full artifact publishes the blobs on window when it
    // runs in a page. With the worker alive this must never appear.
    modelsInPage: !!window.__TS_GAZE_MODELS,
    workerBackend: (window.__TS_GAZE_WORKER && window.__TS_GAZE_WORKER.backend) || d.workerBackend || null,
    processed: imgs.length,
    where: imgs.length ? imgs[imgs.length - 1].where || 'page' : null,
    verdicts: imgs.filter(function(e){ return e.why === 'clear' || e.why === 'face' || e.why === 'nsfw'; }).length,
    pending: document.querySelectorAll('.ts-gaze-pending').length
  });
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
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
if MODE == "noworker":
    tab.cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        source="window.__TS_NO_WORKER = 1;",
    )
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(34)
for _ in range(3):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(8)
print(MODE, tab.eval(READ))
