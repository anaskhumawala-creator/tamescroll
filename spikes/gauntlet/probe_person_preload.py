# DOES THE PLAYER'S MODEL GET ASKED FOR EARLY NOW, AND DOES THE LONG-TASK
# ATTRIBUTION POPULATE?
#
# His phone reported `loaded:person` at 78,807ms on a watch page -- the
# player had no person pass for the first minute and a half. MoveNet was
# only ever requested by the first video frame that reached the worker,
# which put a 4.94MB load behind the whole thumbnail drain. The page now
# asks for it when it attaches a real watch player, and the report
# carries `asked:person` so the two causes can never be confused again.
import json, time, sys
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
WATCH = sys.argv[1] if len(sys.argv) > 1 else "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"

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
t.cmd("Page.navigate", url=WATCH)

last = None
for _ in range(60):
    time.sleep(3)
    try:
        last = t.eval("""(function(){
          var w=window.__TS_GAZE_WORKER||{};
          return {asked:w['asked:person']||null, loaded:w['loaded:person']||null,
                  ready:w.ready||null, up:w.up||null,
                  videos:document.querySelectorAll('video').length,
                  imgs:window.__TS_GAZE_IMGTOTAL||0,
                  now:Math.round(performance.now())};})()""")
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
        continue
    if last and last.get("loaded"):
        break
print(json.dumps(last, indent=1))
