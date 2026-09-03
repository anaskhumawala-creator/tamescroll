"""1102: the pill and gear must live on /watch only."""
import json, sys, time
from emu_cdp import Tab, page
PORT = int(sys.argv[1]) if len(sys.argv)>1 else 9227
READ = """(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; }
  var pill=document.querySelector('.ts-gaze-pill'), gear=document.querySelector('.ts-gaze-gear');
  var pc=document.getElementById('player-container-id');
  function vis(e){ return e? (getComputedStyle(e).display!=='none') : null; }
  return JSON.stringify({path:location.pathname,
    pillExists:!!pill, pillVisible:vis(pill), pillBox:pill?box(pill):null,
    gearExists:!!gear, gearVisible:vis(gear),
    panelOpen: !!document.querySelector('.ts-gaze-tune'),
    pcBox: box(pc)});})()"""
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});return 1;})()""")
time.sleep(12)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
print("HOME (cold)   ", t.eval(READ))
# go to a watch page the way he does: a real in-page navigation
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(14)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
print("WATCH         ", t.eval(READ))
# open the panel, then SPA back to the feed -- the panel must not ride it
t.eval("""(function(){var g=document.querySelector('.ts-gaze-gear'); if(g) g.click(); return 1;})()""")
time.sleep(1)
print("WATCH + panel ", t.eval(READ))
t.eval("history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate'));")
time.sleep(2)
print("SPA -> HOME   ", t.eval(READ))
t.eval("history.pushState({}, '', '/watch?v=NWoT1ZVd1Lo'); dispatchEvent(new PopStateEvent('popstate'));")
time.sleep(2)
print("SPA -> WATCH  ", t.eval(READ))
