# IS TAPPING A VIDEO A HARD NAVIGATION?
#
# If it is, every video tap pays the whole cold start again: a new
# worker, the models fetched and parsed again, every WebGL program
# compiled again. Warm-up is 85-90% of time-to-first-thumbnail on
# Android, so this single fact decides where the remaining speed work
# belongs. Counted, not timed -- window identity survives or it does not.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)

SNAP = """(function(){
  var w=window.__TS_GAZE_WORKER||{};
  return {href:location.pathname,
    mark:window.__TS_NAVMARK||null,
    boot:window.__TS_GAZE_BOOT||{},
    eval0:Math.round(window.__TS_GAZE_EVAL0||0),
    imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    ringLen:(window.__TS_GAZE_IMGDIAG||[]).length,
    perfNav:(performance.getEntriesByType('navigation')||[]).length,
    navType:((performance.getEntriesByType('navigation')||[])[0]||{}).type,
    workerBackend:w.backend||null, workerUp:w.up||null, workerReady:w.ready||null,
    // every fetch of one of our own synthetic urls = a model (re)loaded
    ourFetches:(performance.getEntriesByType('resource')||[])
      .filter(function(r){return r.name.indexOf('__tamescroll')>=0;})
      .map(function(r){return {n:r.name.split('/').pop().split('?')[0],
                               ms:Math.round(r.duration)};}),
    since:Math.round(performance.now())};})()"""

out={}
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(45)
t.eval("window.__TS_NAVMARK='SEARCH-PAGE-MARK';1")
out["search (mark set)"]=t.eval(SNAP)

# tap a real result the way he does
clicked = t.eval("""(function(){
  var a=document.querySelector('a[href*="/watch?v="]');
  if(!a) return 'no link';
  var h=a.getAttribute('href');
  a.click();
  return h;})()""")
out["clicked"]=clicked
time.sleep(40)
out["watch (after tap)"]=t.eval(SNAP)
time.sleep(25)
out["watch settled"]=t.eval(SNAP)
print(json.dumps(out, indent=1))
