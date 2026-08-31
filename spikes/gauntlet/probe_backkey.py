# THE REAL BACK, THE ONE HIS THUMB PRESSES.
#
# history.back() from a pushState nav is SPA by construction. The Android
# BACK KEY goes through MainActivity, and the repo's miniplayer scope
# decision rests on "back out of /watch is a HARD navigation" -- measured
# 2026-08-28. Re-ask it with the key itself.
import json, time, subprocess
from emu_cdp import page, Tab

def key_back():
    subprocess.run(["adb","-s","emulator-5554","shell","input","keyevent","4"],
                   capture_output=True)

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)

SNAP = """(function(){
  return {href:location.pathname, mark:window.__TS_NAVMARK||null,
    eval0:Math.round(window.__TS_GAZE_EVAL0||0),
    since:Math.round(performance.now()),
    histLen:history.length,
    videos:document.querySelectorAll('video').length,
    player:!!document.querySelector('#player-container-id'),
    mini:document.documentElement.classList.contains('ts-mini')};})()"""

out={}
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(38)
t.eval("window.__TS_NAVMARK='B-SEARCH';1")
out["1 search"]=t.eval(SNAP)

t.eval("""(function(){var a=document.querySelector('a[href*="/watch?v="]');
  if(a) a.click(); return 1;})()""")
time.sleep(32)
out["2 watch"]=t.eval(SNAP)

key_back()
time.sleep(20)
# the tab may have been replaced by a hard nav -- reconnect
try:
    out["3 after BACK KEY"]=t.eval(SNAP)
except Exception as e:
    t=Tab(page()); t.cmd("Runtime.enable")
    out["3 after BACK KEY"]=t.eval(SNAP)
    out["3 note"]="had to reconnect the CDP tab"
print(json.dumps(out, indent=1))
