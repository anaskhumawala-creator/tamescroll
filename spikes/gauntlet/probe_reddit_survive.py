# The emulator died twice while our pipeline ran on reddit after a
# youtube page. Is that ours, or the harness? Same page, same gesture,
# gaze OFF then SMART -- and the script reports what it reached before
# the connection dropped, so a death is data rather than a traceback.
import json, subprocess, sys, time
from emu_cdp import page, Tab

ADB = ["adb", "-s", "emulator-5554"]
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = sys.argv[2] if len(sys.argv) > 2 else "https://www.reddit.com/r/pics/"
MODE = sys.argv[1] if len(sys.argv) > 1 else "off"

def sh(*a):
    return subprocess.run(ADB + list(a), capture_output=True, text=True,
                          timeout=60).stdout.strip()

def forward():
    pid = sh("shell", "pidof", "app.tamescroll.client")
    subprocess.run(ADB + ["forward", "tcp:9224",
                          "localabstract:webview_devtools_remote_" + pid],
                   capture_output=True, timeout=60)
    return pid

sh("shell", "am", "force-stop", "app.tamescroll.client")
time.sleep(2)
sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
time.sleep(10)
pid0 = forward(); time.sleep(1)

t = Tab(page()); t.cmd("Runtime.enable")
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'reddit',mode:'%s',strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',shown:[]});
  return 1;})()""" % MODE)
time.sleep(5)

out = {"mode": MODE, "url": URL, "pid_before": pid0, "samples": [], "died": False}
try:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=URL)
    for i in range(14):
        time.sleep(3)
        out["samples"].append(t.eval("""(function(){
          var d=window.__TS_GAZE_IMGDIAG||[];
          var w=window.__TS_GAZE_WORKER||{};
          return {t:Math.round(performance.now()), entries:d.length,
            total:window.__TS_GAZE_IMGTOTAL||0,
            imgs:document.querySelectorAll('img').length,
            heap: (performance.memory? Math.round(performance.memory.usedJSHeapSize/1048576):null),
            ready:w.ready||null, backend:w.backend||null};})()"""))
except Exception as e:
    out["died"] = True
    out["death"] = str(e)[:120]

try:
    out["pid_after"] = sh("shell", "pidof", "app.tamescroll.client")
    out["device_alive"] = True
except Exception:
    out["device_alive"] = False
print(json.dumps(out, indent=1))
