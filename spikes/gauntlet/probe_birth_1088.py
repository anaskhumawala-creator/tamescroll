# DOES THE BIRTH RUNG ACTUALLY FIRE ON A PHONE?
#
# The corpus prices it at -38.0s of false cover in his regime, but that
# is an UPPER BOUND: the replay cannot know how often `instant` is
# reached on real hardware. birthCleared/birthBlurred are counted at the
# birth site itself, so the ratio is the whole answer, and it is read off
# the LIVE ring rather than from a report I built.
import json, sys, time
from emu_cdp import page, Tab
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9231
VID  = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 120.0
SEEK = float(sys.argv[4]) if len(sys.argv) > 4 else 55.0

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VID); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video');"
       "if(v){v.currentTime=%f; v.muted=true; v.play();} return 1;})()" % SEEK)
time.sleep(10)

def life():
    r = t.eval("JSON.stringify((window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{})")
    try: return json.loads(r) if isinstance(r, str) else {}
    except Exception: return {}

# A ZERO AFTER A CONTEXT RESET IS A FRESH COUNTER, NOT A CLEAN RUN.
# The WebView has been killed mid-probe before, and the counters came
# back at 0 looking exactly like a quiet window. Baseline first, and
# report the DELTA plus a liveness check that the pipeline ran at all.
a = life(); t0 = time.time()
time.sleep(SECS)
b = life()

KEYS = ["birthCleared","birthBlurred","birthFresh","birthNearMiss","birthContended",
        "coastExpired","cutDetected","passDropped","readClearCertain","readAbstain",
        "readUncertain","emptyFrame","wipeErasedBlurred","faceNoShape","nullDropped"]
d = {k: (b.get(k,0) - a.get(k,0)) for k in KEYS}
alive = t.eval("(function(){var v=document.querySelector('video');"
               "return v? (v.currentTime|0) : -1;})()")
print("video t=%s  window %.0fs" % (alive, time.time()-t0))
if all(b.get(k,0) <= a.get(k,0) for k in KEYS if a.get(k,0)):
    print("WARNING: no counter advanced -- context reset or nothing ran")
births = d["birthCleared"] + d["birthBlurred"]
print("BIRTHS %d   cleared %d   blurred %d" % (births, d["birthCleared"], d["birthBlurred"]))
if births: print("  -> %.1f%% of births take the instant rung" % (100.0*d["birthCleared"]/births))
for k in KEYS: print("  %-20s %d" % (k, d[k]))
