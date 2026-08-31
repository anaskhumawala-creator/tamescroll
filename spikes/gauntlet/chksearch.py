import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(30)
for i in range(4):
    t.eval("(function(){window.scrollBy(0,900);return 1})()"); time.sleep(6)
print(json.dumps(t.eval("""(function(){
  var imgs=[].slice.call(document.querySelectorAll('img'));
  var onscreen=imgs.filter(function(im){var r=im.getBoundingClientRect();
    return r.bottom>0&&r.top<innerHeight&&r.width>=48;});
  var pending=onscreen.filter(function(im){return im.classList.contains('ts-gaze-pending');});
  var d=window.__TS_GAZE_IMGDIAG||[];
  var why={}; d.forEach(function(e){why[e.why]=(why[e.why]||0)+1;});
  return {imgTotal: window.__TS_GAZE_IMGTOTAL||0, onscreen:onscreen.length,
          pendingOnScreen: pending.length, ringWhy: why,
          patches: document.querySelectorAll('.ts-gaze-region-patch').length};})()""")))
