# BELOW WHAT SIZE IS AN IMAGE FACE UNREADABLE?
#
# The VIDEO path already abstains under FACE_MIN_NATIVE_PX (64) without
# running the model -- his two phone reports show every read at or below
# 63px coming back `unknown` and every read at 71px and up producing a
# gender, so that gate is doing its job for free. The IMAGE path has no
# such floor: classifyFaceGenders runs on EVERY detected box, and one of
# his thumbnails carried EIGHT faces for 1,206ms.
#
# Before copying the floor across: on images, does a face under 64 source
# pixels ever produce a CONFIDENT read? If it does, a floor would newly
# cover men who are sharp today, which is the owner's oldest complaint.
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
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:[]});
  return 1;})()""")
time.sleep(5)
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=interview")
for _ in range(22):
    time.sleep(3)
    try:
        if (t.eval("window.__TS_GAZE_IMGTOTAL||0") or 0) >= 18: break
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
for _ in range(5):
    try: t.eval("window.scrollBy(0,1400);1")
    except Exception: break
    time.sleep(3)
print(json.dumps(t.eval("""(function(){
  var reads=[];
  (window.__TS_GAZE_IMGDIAG||[]).forEach(function(e){
    (e.reads||[]).forEach(function(r){
      if(typeof r.p==='number') reads.push({p:r.p,g:r.g,s:r.s});});});
  function band(lo,hi){
    var v=reads.filter(function(r){return r.p>=lo&&r.p<hi;});
    var conf=v.filter(function(r){return r.s>=0.4;});
    var cleared=v.filter(function(r){return r.g==='male'&&r.s>=0.4;});
    return {n:v.length, confident:conf.length, wouldClearAMan:cleared.length,
            maxScore:v.length?Math.max.apply(null,v.map(function(r){return r.s||0;})):null};
  }
  return {total:reads.length,
          under48:band(0,48), px48_64:band(48,64), px64_90:band(64,90), over90:band(90,1e9),
          sample:reads.filter(function(r){return r.p<64;}).slice(0,10)};})()"""), indent=1))
