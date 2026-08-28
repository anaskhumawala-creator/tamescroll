"""How much does a NAVIGATION cost in model loading?

m.youtube navigations are hard: new page, new worker, and the worker
loads four models from scratch. If that is seconds, then every tap on a
video pays it again, and no amount of per-image tuning matters next to
it. This measures the time from page load to a worker that can answer,
across three navigations, plus the per-model load times the pipeline
already records.
"""
import json
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

READ = r"""(function(){
  var d = window.__TS_GAZE_DIAG || {};
  var imgs = window.__TS_GAZE_IMGDIAG || [];
  return JSON.stringify({
    now: Math.round(performance.now()),
    evalMs: window.__TS_GAZE_EVALMS,
    evalAt: window.__TS_GAZE_EVALAT,
    ready0: window.__TS_GAZE_READY0,
    prestartRan: window.__TS_PRESTART_RAN || 0,
    // First image to complete: nothing can resolve before the models do,
    // so this is the user-visible "when does a thumbnail un-blur".
    firstImageAt: imgs.length ? Math.round(imgs[0].t) : null,
    images: imgs.length,
    boot: window.__TS_GAZE_BOOT || null,
    first: imgs.slice(0,5).map(function(e){
      return {t: Math.round(e.t), ms: e.ms, face: e.face, main: e.main};
    }),
    diag: d,
    worker: window.__TS_GAZE_WORKER || null
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

URLS = [
    "https://m.youtube.com/results?search_query=podcast+interview",
    "https://m.youtube.com/watch?v=NWoT1ZVd1Lo",
    "https://m.youtube.com/results?search_query=linus+tech+tips",
]
for i, url in enumerate(URLS):
    tab.eval("location.href=%r" % url)
    time.sleep(30)
    r = json.loads(tab.eval(READ))
    print("nav %d: eval=%sms firstImage=%sms images=%s" % (
        i, r["evalMs"], r["firstImageAt"], r["images"]))
    print("      worker:", json.dumps(r.get("worker"))[:300])
    print("      boot:  ", json.dumps(r.get("boot")), "evalAt", r.get("evalAt"), r.get("ready0"), "prestartRan", r.get("prestartRan"))
    print("      first: ", json.dumps(r.get("first")))
