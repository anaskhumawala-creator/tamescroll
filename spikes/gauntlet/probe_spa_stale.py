# STALE GEOMETRY ACROSS AN SPA NAV -- the untested angle for his
# three-times-reported bug.
#
# The whole browse loop is ONE document (measured loop 7). So the patches
# minted over search results do not die with a page load: they are
# removed only when the 500ms sweep notices their element left the
# document. In that window the watch page's sticky player renders at the
# top of the same viewport, and any stale patch sitting up there paints
# into it. If YouTube KEEPS the old results section in the DOM rather
# than removing it, the entry never gets dropped at all.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(40)
# WAIT FOR PATCHES. A run with 0 patches measures nothing about stale
# geometry -- that is a probe failure, not a clean result. Scroll to pull
# more thumbnails in, and give the drain time, before tapping anything.
waited=[]
for i in range(14):
    st=t.eval("""(function(){return {
      imgTotal:window.__TS_GAZE_IMGTOTAL||0,
      patches:document.querySelectorAll('.ts-gaze-region-patch').length,
      flagged:document.querySelectorAll('.ts-gaze-flagged').length,
      pending:document.querySelectorAll('.ts-gaze-pending').length};})()""")
    waited.append(st)
    if st["patches"]>0: break
    t.eval("window.scrollBy(0,420);1")
    time.sleep(9)


LOOK = """(function(){
  var pl=document.querySelector('#player-container-id');
  var pr=pl?pl.getBoundingClientRect():null;
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var over=[], orphan=0, hidden=0;
  ps.forEach(function(p){
    var host=p.parentElement;
    if(!host||!host.isConnected) orphan++;
    else if(host.offsetParent===null && getComputedStyle(host).position!=='fixed') hidden++;
    if(!pr) return;
    var r=p.getBoundingClientRect();
    if(r.width<2||r.height<2) return;
    var ox=Math.min(r.right,pr.right)-Math.max(r.left,pr.left);
    var oy=Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top);
    if(ox<=1||oy<=1) return;
    var cx=Math.max(r.left,pr.left)+ox/2, cy=Math.max(r.top,pr.top)+oy/2;
    var prev=p.style.pointerEvents; p.style.pointerEvents='auto';
    var hits=document.elementsFromPoint(cx,cy);
    p.style.pointerEvents=prev;
    var iP=hits.indexOf(p), iV=-1;
    for(var k=0;k<hits.length;k++){if(hits[k]===pl||pl.contains(hits[k])){iV=k;break;}}
    over.push({ox:Math.round(ox),oy:Math.round(oy),top:Math.round(r.top),
      iPatch:iP,iPlayer:iV,wins:(iP>=0&&iV>=0&&iP<iV),
      hostTag:(p.parentElement||{}).tagName,
      hostConnected:!!(p.parentElement&&p.parentElement.isConnected)});
  });
  return {path:location.pathname, patches:ps.length,
    orphanHost:orphan, hiddenHost:hidden,
    playerTop:pr?Math.round(pr.top):null, playerH:pr?Math.round(pr.height):null,
    overlapping:over.length, patchWins:over.filter(function(o){return o.wins;}).length,
    over:over.slice(0,6)};})()"""

out={}
out["0 search, before the tap"]=t.eval(LOOK)
out["0b wait trace"]=waited
t.eval("""(function(){var a=document.querySelector('a[href*="/watch?v="]');
  if(a) a.click(); return 1;})()""")

# the dangerous window is the first few hundred ms after the SPA push
fast=[]
t0=time.time()
for i in range(22):
    r=t.eval(LOOK); r["ms"]=int((time.time()-t0)*1000)
    fast.append(r)
    time.sleep(0.25)
out["1 first 5s after the tap"]=fast
time.sleep(8);  out["2 at ~13s"]=t.eval(LOOK)
time.sleep(15); out["3 at ~28s"]=t.eval(LOOK)
print(json.dumps(out, indent=1))
