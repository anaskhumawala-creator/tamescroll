# CLEAN ROOM: fresh page, nothing touched by the probe. Does the logo
# settle after the documented 3 tries, and is it blurred from the start?
# (The try:3 / try:4 seen earlier were MY OWN src swaps re-tagging it.)
import json, time
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)
ASK = """(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  var errs=ring.filter(function(e){return e.why==='error';});
  return {logoPresent:!!im,
    pending:im?im.classList.contains('ts-gaze-pending'):null,
    filter:im?getComputedStyle(im).filter:null,
    src:im?(im.currentSrc||'').slice(0,42):null,
    imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    errorEntries:errs.length,
    errMsgs:errs.map(function(e){return e.msg+'/try'+(e.try||0);}).slice(0,8)};})()"""
for url in ("https://m.youtube.com/",
            "https://m.youtube.com/results?search_query=news"):
    t.cmd("Page.navigate", url=url); time.sleep(30)
    rows=[]
    for i in range(5):
        rows.append(t.eval(ASK)); time.sleep(16)
    print(url)
    for r in rows:
        print("  pending=%-5s filter=%-11s imgTotal=%-3d errors=%d %s"
              % (r["pending"], r["filter"], r["imgTotal"], r["errorEntries"], r["errMsgs"]))
