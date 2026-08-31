# WHAT THE WORKER'S 800ms OF "up" IS ACTUALLY MADE OF.
#
# His phone reports worker `up` at ~800ms with `evalMs` 120 -- and the
# other ~680ms has been attributed to nothing across three sessions. A
# dedicated worker's timeOrigin is set when the worker is CREATED, before
# its script is fetched, so the EVAL_CLOCK the build stamps as the
# artifact's first statement measures exactly the fetch-and-compile of
# that file. `fetchMs` posts it.
#
# Emulator ABSOLUTE numbers are meaningless (docs/speed-findings: one
# BlazeFace pass costs ~10s here against 20-60ms on a desktop). The
# RATIO inside one run is what this is for.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
RUNS = int(sys.argv[2]) if len(sys.argv) > 2 else 3
out = []
for r in range(RUNS):
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(4)
    t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=news")
    time.sleep(70)
    b = t.eval("""(function(){
      var d=window.__TS_DIAG_NOW?window.__TS_DIAG_NOW():null;
      if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){}}
      var w=(d&&d.worker)||{};
      return JSON.stringify({worker:w, bundle:window.__TS_GAZE_BUNDLE__,
        pageEval:window.__TS_GAZE_EVALMS, pageEvalAt:window.__TS_GAZE_EVALAT,
        imgTotal:window.__TS_GAZE_IMGTOTAL||0});})()""")
    out.append(json.loads(b) if isinstance(b, str) else b)
    print(json.dumps(out[-1]))
    if r + 1 < RUNS:
        import subprocess, os
        adb = os.environ["ANDROID_HOME"] + "/platform-tools/adb.exe"
        subprocess.run([adb, "-s", "emulator-5554", "shell", "am", "force-stop",
                        "app.tamescroll.client"], capture_output=True)
        time.sleep(2)
        subprocess.run([adb, "-s", "emulator-5554", "shell", "am", "start", "-n",
                        "app.tamescroll.client/.MainActivity"], capture_output=True)
        time.sleep(12)
