# First navigation of an app run pays for INLINED models; every later one
# fetches them. How much is that worth on real Android? JSON only.
import json, subprocess, time
from emu_cdp import page, Tab

ADB = ["adb", "-s", "emulator-5554"]
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"

def sh(*a):
    return subprocess.run(ADB + list(a), capture_output=True, text=True).stdout.strip()

def forward():
    pid = sh("shell", "pidof", "app.tamescroll.client")
    subprocess.run(ADB + ["forward", "tcp:9224",
                          "localabstract:webview_devtools_remote_" + pid],
                   capture_output=True)

def open_youtube():
    t = Tab(page()); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
        gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
      return 1;})()""")

def measure(label):
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    row = {"nav": label}
    for _ in range(30):
        time.sleep(1)
        r = t.eval("""(function(){
          var w=window.__TS_GAZE_WORKER||{};
          var d=window.__TS_GAZE_IMGDIAG||[];
          return {up:w.up||null, ready:w.ready||null, backend:w.backend||null,
                  warmMs:w.warmMs||null, evalMs:window.__TS_GAZE_EVALMS||null,
                  inlineModels: !!window.__TS_GAZE_MODELS_INLINE,
                  bundleLen: (window.__TS_GAZE_BUNDLE_LEN||null),
                  judged: window.__TS_GAZE_IMGTOTAL||0,
                  first: d.length? Math.round(d[0].t||0):null};})()""")
        if r.get("judged", 0) > 0:
            row.update(r); return row
    row.update(r or {}); return row

sh("shell", "am", "force-stop", "app.tamescroll.client")
time.sleep(2)
sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
time.sleep(9); forward(); time.sleep(1)
open_youtube(); time.sleep(5)

out = {"cold_first": measure("first-of-run")}
time.sleep(2)
out["second"] = measure("second")
time.sleep(2)
out["third"] = measure("third")
print(json.dumps(out, indent=1))
