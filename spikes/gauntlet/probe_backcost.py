# WHAT DOES GOING BACK COST?
#
# A video tap is an SPA nav (mark survives, proven). The repo records
# that back out of /watch is a HARD navigation. If that is right, then
# his real loop -- watch, back, tap the next one -- pays a full cold
# start every time round, and that is the biggest remaining speed lever.
# Counted: does the window die, and are the models fetched again.
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
  var res=(performance.getEntriesByType('resource')||[])
    .filter(function(r){return r.name.indexOf('__tamescroll')>=0;});
  return {href:location.pathname, mark:window.__TS_NAVMARK||null,
    boot:window.__TS_GAZE_BOOT||{}, eval0:Math.round(window.__TS_GAZE_EVAL0||0),
    imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    workerBackend:w.backend||null, workerUp:w.up||null, workerReady:w.ready||null,
    ourFetchCount:res.length,
    ourFetchBytes:res.reduce(function(a,r){return a+(r.transferSize||0);},0),
    ourFetchMs:Math.round(res.reduce(function(a,r){return a+r.duration;},0)),
    fromCache:res.filter(function(r){return (r.transferSize||0)===0;}).length,
    since:Math.round(performance.now())};})()"""

out={}
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(45)
t.eval("window.__TS_NAVMARK='A-SEARCH';1")
out["1 search"]=t.eval(SNAP)

t.eval("""(function(){var a=document.querySelector('a[href*="/watch?v="]');
  if(a) a.click(); return 1;})()""")
time.sleep(40)
out["2 watch (tapped)"]=t.eval(SNAP)

# back the way he does it
t.eval("history.back();1")
time.sleep(40)
out["3 back"]=t.eval(SNAP)

t.eval("""(function(){var a=document.querySelectorAll('a[href*="/watch?v="]')[2];
  if(a) a.click(); return 1;})()""")
time.sleep(40)
out["4 second video"]=t.eval(SNAP)
print(json.dumps(out, indent=1))
