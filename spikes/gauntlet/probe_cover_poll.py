# Minimal ground truth for CLAIM A: direct sequential eval polling (no
# rAF ring, no MutationObserver) of the live canvas.ts-gaze-delay filter
# plus video state, every ~300ms, across a fresh watch-page load and
# then across a forward seek. Exists because two prior instruments
# disagreed (rAF-ring poll showed the cover clearing at ~3-5s cold /
# never on a seek; a MutationObserver showed ZERO clears in 14s cold
# then a 3ms blip on the seek) -- this is the tie-breaker, reading the
# DOM directly, on the wall clock, no page-side machinery to distrust.
import json, os, subprocess, sys, time
from emu_cdp import page, Tab

ADB = os.environ.get("ANDROID_HOME", "") + "/platform-tools/adb.exe"
DEV = "1ec2c48e0621"
PORT = 9242
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

DELAY_OVERRIDE = sys.argv[1] if len(sys.argv) > 1 else None

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
if DELAY_OVERRIDE is not None:
    override = {"DELAY_MS": int(DELAY_OVERRIDE)}
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source="""(function(){
  var override=%s, cur=JSON.stringify(override);
  Object.defineProperty(window,'__TS_GAZE_TUNING__',{
    configurable:true,
    get:function(){return cur;},
    set:function(v){
      var base={};
      try{ base=typeof v==='string'?JSON.parse(v):(v||{}); }catch(e){}
      for(var k in override) base[k]=override[k];
      cur=JSON.stringify(base);
    }});
})();""" % json.dumps(override))
    print("DELAY_MS override armed:", override)
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(3)

READ = """(function(){
  var el = document.querySelector('canvas.ts-gaze-delay');
  var v = document.querySelector('#movie_player video') || document.querySelector('video');
  return JSON.stringify({ex: !!el, f: el?(el.style.filter||''):null,
    ct: v?Math.round(v.currentTime*1000):null, p: v?(v.paused?1:0):null, rs: v?v.readyState:null});
})()"""

t0 = time.time()
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VID)
print("=== COLD LOAD ===")
last_f = None
for i in range(60):
    time.sleep(0.3)
    try:
        r = json.loads(t.eval(READ))
    except Exception as e:
        print("  %5dms  eval failed: %s" % (round((time.time()-t0)*1000), e)); continue
    ms = round((time.time() - t0) * 1000)
    covered = bool(r.get("ex")) and "blur" in (r.get("f") or "")
    if r.get("f") != last_f:
        print("  %5dms  ex=%s f=%r ct=%s p=%s rs=%s  COVERED=%s  <-- CHANGE"
              % (ms, r.get("ex"), r.get("f"), r.get("ct"), r.get("p"), r.get("rs"), covered))
        last_f = r.get("f")
    if i % 5 == 0:
        print("  %5dms  ex=%s f=%r ct=%s p=%s rs=%s  COVERED=%s"
              % (ms, r.get("ex"), r.get("f"), r.get("ct"), r.get("p"), r.get("rs"), covered))

print("=== SEEK (+45s) ===")
t.eval("""(function(){var v=document.querySelector('#movie_player video')||document.querySelector('video');
  if(v) v.currentTime = v.currentTime + 45; return 1;})()""")
t1 = time.time()
last_f = None
for i in range(40):
    time.sleep(0.3)
    try:
        r = json.loads(t.eval(READ))
    except Exception as e:
        print("  %5dms  eval failed: %s" % (round((time.time()-t1)*1000), e)); continue
    ms = round((time.time() - t1) * 1000)
    covered = bool(r.get("ex")) and "blur" in (r.get("f") or "")
    if r.get("f") != last_f:
        print("  %5dms  ex=%s f=%r ct=%s p=%s rs=%s  COVERED=%s  <-- CHANGE"
              % (ms, r.get("ex"), r.get("f"), r.get("ct"), r.get("p"), r.get("rs"), covered))
        last_f = r.get("f")
    if i % 5 == 0:
        print("  %5dms  ex=%s f=%r ct=%s p=%s rs=%s  COVERED=%s"
              % (ms, r.get("ex"), r.get("f"), r.get("ct"), r.get("p"), r.get("rs"), covered))
print("DONE")
