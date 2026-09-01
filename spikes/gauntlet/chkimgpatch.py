# The image path shares the changed arithmetic. At scale 1 toLocalRect
# returns the same object, so nothing should move -- prove it on a real
# feed: every patch must land inside its own image.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(30)
for i in range(6):
    t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,700); return 1;})()")
    time.sleep(3)
time.sleep(12)
print(json.dumps(t.eval("""(function(){
  var pats=[].slice.call(document.querySelectorAll('#tamescroll-gaze-regions, .ts-gaze-region, [data-ts-region]'));
  // patches are siblings of the image inside its host; find them by class used in region-blur
  var all=[].slice.call(document.querySelectorAll('div')).filter(function(d){
    return d.style && d.style.backdropFilter && d.style.position==='absolute';});
  var inside=0, stray=0, samples=[];
  all.forEach(function(p){
    var host=p.parentElement; if(!host) return;
    var img=host.querySelector('img'); if(!img){stray++; return;}
    var pr=p.getBoundingClientRect(), ir=img.getBoundingClientRect();
    var ok = pr.left>=ir.left-2 && pr.top>=ir.top-2 && pr.right<=ir.right+2 && pr.bottom<=ir.bottom+2;
    if(ok) inside++; else stray++;
    if(samples.length<4) samples.push({ok:ok,
      p:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
      i:[Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)]});});
  return {patches:all.length, inside:inside, stray:stray, samples:samples,
    imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    pending:document.querySelectorAll('.ts-gaze-pending').length};})()"""), indent=1))
