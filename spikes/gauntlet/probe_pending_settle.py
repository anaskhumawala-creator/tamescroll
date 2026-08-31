# HIS OLDEST COMPLAINT, COUNTED: "it processes some, then it halts",
# "thumbnails that never resolve". After a page settles, how many
# ON-SCREEN images are still wearing the blur-first cover?
import json, time, sys
from emu_cdp import page, Tab

URL = sys.argv[1] if len(sys.argv)>1 else "https://m.youtube.com/results?search_query=podcast+interview"
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url=URL)

AUDIT = """(function(){
  var vh=window.innerHeight||0;
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  function onScreen(i){var r=i.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<vh;}
  var vis=imgs.filter(onScreen);
  var pend=vis.filter(function(i){return i.classList.contains('ts-gaze-pending');});
  var ring=window.__TS_GAZE_IMGDIAG||[];
  var why={}, where={};
  ring.forEach(function(e){ why[e.why||'?']=(why[e.why||'?']||0)+1;
                            where[e.where||'?']=(where[e.where||'?']||0)+1; });
  var errs=ring.filter(function(e){return e.why==='error';})
               .map(function(e){return (e.msg||'').slice(0,60);});
  return {url:location.pathname+location.search.slice(0,30),
    total:window.__TS_GAZE_IMGTOTAL||0, ringLen:ring.length,
    imgsBig:imgs.length, onScreen:vis.length, pendingOnScreen:pend.length,
    pendingSrc:pend.slice(0,4).map(function(i){
      var r=i.getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),
              side:Math.min(i.naturalWidth,i.naturalHeight),
              s:(i.currentSrc||'').slice(-40)};}),
    why:why, where:where, errors:errs,
    boot:window.__TS_GAZE_BOOT||{},
    workerBackend:(window.__TS_GAZE_WORKER&&window.__TS_GAZE_WORKER.backend)||null};})()"""

out=[]
for w in (35,25,25,25):
    time.sleep(w)
    out.append(t.eval(AUDIT))
print(json.dumps(out, indent=1))
