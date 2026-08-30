# Does the long-task attribution populate, and does the report still pass
# its own invariant check with the new fields?
import json, time
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
  return 1;})()""")
time.sleep(5)
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=interview")
for _ in range(20):
    time.sleep(3)
    try:
        if (t.eval("window.__TS_GAZE_IMGTOTAL||0") or 0) >= 15:
            break
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
for _ in range(4):
    try:
        t.eval("window.scrollBy(0,1400);1")
    except Exception:
        break
    time.sleep(3)
print(json.dumps(t.eval("""(function(){
  if (typeof window.__TS_DIAG_NOW !== 'function') return {no:'no diag hook'};
  var r = window.__TS_DIAG_NOW();
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { return {bad:'not json'}; } }
  return {main:r.main||null,
          worker:{askedPerson:r.worker&&r.worker.askedPerson,
                  loadedPerson:r.worker&&r.worker.loadedPerson},
          n:(r.images&&r.images.n)||0};})()"""), indent=1))
