# CLAIM B, THE PART THE CADENCE MATH CANNOT ANSWER: is the main JS
# thread actually BUSY (unable to paint/scroll) during a verdict pass,
# or just "wall time elapsed while awaiting a native/GPU call" (in which
# case the thread is free even though the render loop's own bookkeeping
# looks slow)? PerformanceObserver({entryTypes:['longtask']}) answers
# that directly: a long task is >=50ms of BLOCKING main-thread work,
# the same signal Chrome's own responsiveness tooling uses.
#
# Measures on the real device (old Redmi, 1ec2c48e0621):
#   (a) steady watch-page playback
#   (b) a feed scroll (thumbnails, a different code path from the video
#       verdict cadence -- CLAUDE.md's own image-path bugs happened here)
import json, os, subprocess, sys, time
from emu_cdp import page, Tab

ADB = os.environ.get("ANDROID_HOME", "") + "/platform-tools/adb.exe"
DEV = "1ec2c48e0621"
PORT = 9243
VID = "NWoT1ZVd1Lo"


def sh(*a):
    e = dict(os.environ); e["MSYS2_ARG_CONV_EXCL"] = "*"
    return subprocess.run([ADB, "-s", DEV] + list(a), capture_output=True, text=True, env=e).stdout.strip()


def forward():
    pid = sh("shell", "pidof", "app.tamescroll.client")
    sh("forward", "--remove", "tcp:%d" % PORT)
    sh("forward", "tcp:%d" % PORT, "localabstract:webview_devtools_remote_%s" % pid)


sh("shell", "am", "force-stop", "app.tamescroll.client")
time.sleep(3)
sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
time.sleep(7)
forward()

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(3)

ARM = """(function(){
  if (window.__TS_LT) { window.__TS_LT.rows = []; return 1; }
  window.__TS_LT = {rows: [], supported: false};
  try {
    var po = new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){
        window.__TS_LT.rows.push({start: Math.round(e.startTime), dur: Math.round(e.duration)});
      });
    });
    po.observe({entryTypes: ['longtask']});
    window.__TS_LT.supported = true;
  } catch (e) { window.__TS_LT.err = String(e); }
  return 1;
})()"""

READ_LT = "JSON.stringify(window.__TS_LT || {rows:[], supported:false})"


def diag():
    r = t.eval("""(function(){
      var d = window.__TS_DIAG_NOW && window.__TS_DIAG_NOW();
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch(e) { return null; } }
      var w = (d && d.worker) || {}; var nat = (d && d.native) || {};
      return JSON.stringify({workerBackend: w.backend, nativeModels: nat.models});
    })()""")
    return r


def run_window(label, secs):
    t.eval(ARM)
    t0 = time.time()
    time.sleep(secs)
    raw = t.eval(READ_LT)
    dur = time.time() - t0
    try:
        d = json.loads(raw)
    except Exception:
        d = {"rows": [], "supported": False}
    rows = d.get("rows", [])
    total_blocked = sum(r["dur"] for r in rows)
    print("--- %s: window %.1fs, longtask supported=%s ---" % (label, dur, d.get("supported")))
    print("  long tasks: %d   total blocked %d ms   duty %.1f%%" % (len(rows), total_blocked, 100.0 * total_blocked / (dur * 1000)))
    if rows:
        durs = sorted(r["dur"] for r in rows)
        print("  dur p50 %d  p90 %d  max %d ms" % (durs[len(durs)//2], durs[int(len(durs)*0.9)], durs[-1]))
    print("  diag: %s" % diag())
    return {"label": label, "windowSec": round(dur, 1), "count": len(rows), "totalBlockedMs": total_blocked,
            "dutyPct": round(100.0 * total_blocked / (dur * 1000), 1)}


results = {}

t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VID)
time.sleep(18)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("(function(){var v=document.querySelector('#movie_player video')||document.querySelector('video');"
       "if(v){v.currentTime=40; v.muted=true; v.play();} return 1;})()")
time.sleep(2)
results["watch_steady"] = run_window("STEADY WATCH PLAYBACK", 20)

# Feed scroll: SPA back to home, then drive a real scroll (touch-like via
# window.scrollBy repeated, since this WebView has no synthetic touch
# input over CDP wired here -- scrollBy still exercises the thumbnail
# image path and layout/paint work the claim is about).
t.eval("history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate'));")
time.sleep(3)
t.eval(ARM)
t0 = time.time()
end = t0 + 20
i = 0
while time.time() < end:
    t.eval("window.scrollBy(0, 400)")
    time.sleep(0.4)
    i += 1
raw = t.eval(READ_LT)
dur = time.time() - t0
try:
    d = json.loads(raw)
except Exception:
    d = {"rows": [], "supported": False}
rows = d.get("rows", [])
total_blocked = sum(r["dur"] for r in rows)
print("--- FEED SCROLL: window %.1fs, %d scrollBy calls, longtask supported=%s ---" % (dur, i, d.get("supported")))
print("  long tasks: %d   total blocked %d ms   duty %.1f%%" % (len(rows), total_blocked, 100.0 * total_blocked / (dur * 1000)))
if rows:
    durs = sorted(r["dur"] for r in rows)
    print("  dur p50 %d  p90 %d  max %d ms" % (durs[len(durs)//2], durs[int(len(durs)*0.9)], durs[-1]))
print("  diag: %s" % diag())
results["feed_scroll"] = {"label": "feed_scroll", "windowSec": round(dur, 1), "count": len(rows),
                          "totalBlockedMs": total_blocked, "dutyPct": round(100.0 * total_blocked / (dur * 1000), 1)}

json.dump(results, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "mainthread-duty.json"), "w"))
print("DONE", json.dumps(results))
