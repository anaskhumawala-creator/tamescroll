# REGRESSION CHECK ON THE SHIPPED 1075: the face size floor moved from
# 64 to 40, which changes which PLAYER faces get asked instead of
# abstaining. The image path has its own floors and must be untouched,
# and the constant itself must be EMITTED (R15: it once shipped as
# `var IY;` and every comparison was `px < undefined`).
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9226

t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(8)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(8)

t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(50)
for _ in range(6):
    t.eval("(function(){var e=document.scrollingElement||document.body;"
           "var b=document.body;var s=(b.scrollHeight>e.scrollHeight)?b:e;"
           "s.scrollBy(0,900);return 1;})()")
    time.sleep(6)
time.sleep(25)

print("SEARCH", t.eval("""(function(){
  var imgs=document.querySelectorAll('img');
  var onscreenPending=0;
  for(var i=0;i<imgs.length;i++){
    var r=imgs[i].getBoundingClientRect();
    if(r.bottom<0||r.top>innerHeight||r.width<48) continue;
    if(imgs[i].classList.contains('ts-gaze-pending')) onscreenPending++;
  }
  var d=window.__TS_GAZE_IMGDIAG||[];
  var why={};
  for(var k=0;k<d.length;k++) why[d[k].why]=(why[d[k].why]||0)+1;
  var patches=document.querySelectorAll('.ts-gaze-region-patch');
  var inside=0;
  for(var p=0;p<patches.length;p++){
    var pr=patches[p].getBoundingClientRect();
    var host=patches[p].parentElement;
    var im=host?host.querySelector('img'):null;
    if(!im) continue;
    var ir=im.getBoundingClientRect();
    if(pr.left>=ir.left-2&&pr.right<=ir.right+2&&pr.top>=ir.top-2&&pr.bottom<=ir.bottom+2) inside++;
  }
  return JSON.stringify({
    faceMinPx:(window.__TS_GAZE_CFG||{}).faceMinPx,
    bundle:window.__TS_GAZE_BUNDLE__,
    imgTotal:window.__TS_GAZE_IMGTOTAL, onscreenPending:onscreenPending,
    why:why, patches:patches.length, patchesInsideImage:inside,
    errors:(d.filter(function(x){return x.why==='error';})||[]).length
  });})()"""))
