"""Desktop YouTube has no worker. Does the in-page path still finish?

www.youtube.com's service worker means no inference worker and no
fetched models: the page runs the old in-page pipeline with the models
injected alongside it. probe_sw_hosts left 1-3 images still carrying the
pending class after 28s, which is either "still working" or "stuck", and
those are different bugs. Sample over time.
"""
import json, time
from gauntlet import pick, targets

READ = r"""(function(){
  return JSON.stringify({
    t: Math.round(performance.now()),
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    flagged: document.querySelectorAll('.ts-gaze-flagged').length,
    imgs: (window.__TS_GAZE_IMGDIAG||[]).length,
    worker: (window.__TS_GAZE_WORKER||{}).dead ? 'dead' : 'alive',
    models: !!window.__TS_GAZE_MODELS
  });
})()"""

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs']});return 1;})()")
time.sleep(12)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1.0, mobile=False)
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview'")
for i in range(9):
    time.sleep(6)
    print(tab.eval(READ))
