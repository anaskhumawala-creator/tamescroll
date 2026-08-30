# AFTER THE RE-HOST GUARD: ARE PATCHES STILL BEING PLACED, AND ON THE
# IMAGE THEY BELONG TO?  A page with zero patches also reports zero
# stray ones, so the count has to be checked alongside the placement.
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
for _ in range(30):
    time.sleep(3)
    try:
        if (t.eval("window.__TS_GAZE_IMGTOTAL||0") or 0) >= 12:
            break
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
time.sleep(6)
print(json.dumps(t.eval("""(function(){
  // Our overlays are the only absolutely-positioned children our code
  // adds; find them by the class the module stamps on them.
  var ov=[].slice.call(document.querySelectorAll('[class*="ts-gaze"][style*="position: absolute"]'));
  var all=[].slice.call(document.querySelectorAll('div')).filter(function(d){
    return /ts-gaze/.test(d.className||'') && getComputedStyle(d).position==='absolute';});
  var imgs=[].slice.call(document.images);
  var stray=0, placed=0;
  all.forEach(function(o){
    var r=o.getBoundingClientRect();
    if(r.width<1||r.height<1) return;
    var on=imgs.some(function(i){
      var ir=i.getBoundingClientRect();
      return r.left>=ir.left-2 && r.right<=ir.right+2 && r.top>=ir.top-2 && r.bottom<=ir.bottom+2;});
    if(on) placed++; else stray++;
  });
  return {overlays:all.length, placedOnAnImage:placed, strayOverlays:stray,
          judged:window.__TS_GAZE_IMGTOTAL||0,
          classes:all.slice(0,2).map(function(d){return (d.className||'')+'';})};
})()"""), indent=1))
