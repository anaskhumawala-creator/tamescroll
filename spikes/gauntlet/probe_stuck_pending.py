# Anything still ts-gaze-pending after the page has fully settled is an
# image the user will never see. Deterministic: no scrolling, no timing
# claims -- wait until the judged counter stops moving, then classify
# whatever is still covered. JSON only, headless emulator.
import json, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = "https://m.youtube.com/results?search_query=linus+tech+tips"

def open_youtube():
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

open_youtube()
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)

# Settle by the counter, not by the clock.
last, stable = -1, 0
for _ in range(80):
    time.sleep(2)
    n = t.eval("window.__TS_GAZE_IMGTOTAL||0")
    if n == last and n > 0:
        stable += 1
        if stable >= 4:
            break
    else:
        stable = 0
    last = n

print(json.dumps(t.eval("""(function(){
  var vh=innerHeight;
  var p=[].slice.call(document.querySelectorAll('.ts-gaze-pending'));
  var rows=p.map(function(el){
    var r=el.getBoundingClientRect();
    return {tag:el.tagName, w:Math.round(r.width), h:Math.round(r.height),
      nw:el.naturalWidth||0, nh:el.naturalHeight||0,
      top:Math.round(r.top), onscreen: r.bottom>0 && r.top<vh,
      hasSrc: !!(el.currentSrc||el.src), complete: el.complete===true,
      cors: el.crossOrigin||null,
      // how far outside the viewport, in viewport heights
      away: Math.round((r.top<0 ? -r.bottom : r.top-vh)/vh*10)/10};});
  var buckets={};
  rows.forEach(function(o){
    var k=[o.tag.toLowerCase(),
           o.nw===0?'noNatural':'natural',
           o.hasSrc?'src':'nosrc',
           o.w===0?'zeroBox':(o.w<48?'under48':'sized'),
           o.onscreen?'onscreen':'offscreen'].join('/');
    buckets[k]=(buckets[k]||0)+1;});
  return {judged:window.__TS_GAZE_IMGTOTAL||0,
    pending:p.length, onscreenPending:rows.filter(function(o){return o.onscreen;}).length,
    buckets:buckets,
    worstOnscreen: rows.filter(function(o){return o.onscreen;}).slice(0,6),
    totalImgs:document.querySelectorAll('img').length};})()"""), indent=1))
