"""Every synthetic url now carries a query. That reaches five platforms,
not just YouTube -- confirm each still gets its worker and its models,
and that nothing started reporting a CSP violation.
"""
import time
from gauntlet import pick, targets

READ = r"""(function(){
  var w=window.__TS_GAZE_WORKER||{};
  return JSON.stringify({host:location.host,
    wrk:{dead:!!w.dead,ready:!!w.ready,backend:w.backend||null,up:w.up||null,
         ready_ms:w.ready||null},
    modelsInPage:!!window.__TS_GAZE_MODELS,
    total:window.__TS_GAZE_IMGTOTAL||0,
    csp:(window.__TS_CSP_VIOLATIONS||[]).length});
})()"""

SITES = [
    ("reddit", "https://www.reddit.com/r/pics/"),
    ("x", "https://x.com/explore"),
    ("instagram", "https://www.instagram.com/explore/"),
    ("facebook", "https://www.facebook.com/"),
    ("m.youtube", "https://m.youtube.com/results?search_query=podcast"),
]

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval("(function(){var i=window.__TAURI__.core.invoke;"
         "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:[]});return 1;})()")
time.sleep(10)
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break

for name, url in SITES:
    mob = name == "m.youtube" or name == "instagram"
    tab.cmd("Emulation.setUserAgentOverride",
            userAgent=("Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36") if mob else "")
    tab.cmd("Emulation.setDeviceMetricsOverride",
            width=412 if mob else 1426, height=915 if mob else 900,
            deviceScaleFactor=2.0 if mob else 1.0, mobile=mob)
    tab.eval("location.href='%s'" % url)
    time.sleep(22)
    print(name, tab.eval(READ))
