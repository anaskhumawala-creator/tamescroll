# The owner's frame: a recommendation's blur standing on the sticky
# player. Signed out, a Linus watch page recommends mostly men, so with
# gender 'man' almost nothing is flagged and there are no patches to
# escape -- which is why three previous rounds came back clean. Run it
# as 'woman' and the same recommendations flag instead. Identical code
# path, and now it has something to measure.
import json, time
from emu_cdp import page, Tab

WATCH = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:'woman',shown:[]});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url=WATCH)
time.sleep(22)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(35)

REPORT = """(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return {err:'no player'};
  var cs=getComputedStyle(pc);
  var p=pc.getBoundingClientRect();
  var out={scrollY:Math.round(window.scrollY), judged:window.__TS_GAZE_IMGTOTAL||0,
    playerPos:cs.position, playerZ:cs.zIndex,
    player:[Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)],
    patches:0, onScreen:0, over:[]};
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  out.patches=ps.length;
  ps.forEach(function(o){
    if(o.style.display==='none') return;
    var b=o.getBoundingClientRect();
    if(b.width<1||b.height<1||b.bottom<=0||b.top>=innerHeight) return;
    out.onScreen++;
    if(!(b.top<p.bottom && b.bottom>p.top && b.left<p.right && b.right>p.left)) return;
    var ovl=Math.round(Math.min(b.bottom,p.bottom)-Math.max(b.top,p.top));
    if(ovl<=0) return;
    var x=Math.round(Math.max(b.left,p.left)+3);
    var y=Math.round(Math.max(b.top,p.top)+Math.max(1,Math.min(4,ovl/2)));
    var hits=document.elementsFromPoint(x,y)||[];
    var iP=hits.indexOf(o), iPl=-1;
    for(var k=0;k<hits.length;k++){ if(pc.contains(hits[k])){iPl=k;break;} }
    out.over.push({overlapPx:ovl, at:[x,y], iPatch:iP, iPlayer:iPl,
      patch:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
      PATCH_ON_TOP: iP>=0 && (iPl<0 || iP<iPl)});
  });
  return out;})()"""

SCROLL = """(function(){
  // m.youtube's watch page scrolls <body>, not the document: MEASURED
  // 2026-08-31, documentElement.scrollHeight == innerHeight == 839 with
  // 188 recommendations in the DOM and body overflow-y auto. A probe
  // that drives window.scrollBy reads a healthy page as a dead one.
  var cands=[document.body, document.scrollingElement, document.documentElement]
    .concat([].slice.call(document.querySelectorAll('ytm-app,#app,ytm-watch')));
  var best=null, bestH=0;
  cands.forEach(function(c){ if(c && c.scrollHeight-c.clientHeight>bestH){bestH=c.scrollHeight-c.clientHeight; best=c;} });
  if(!best) return {moved:0, who:null};
  var b0=best.scrollTop; best.scrollTop=b0+200;
  return {moved:best.scrollTop-b0, who:best.tagName.toLowerCase(), top:best.scrollTop, room:bestH};})()"""

runs=[{"phase":"settled","r":t.eval(REPORT)}]
for s in range(1,13):
    t.eval(SCROLL)
    time.sleep(0.7)
    runs.append({"phase":"scroll %d"%s,"r":t.eval(REPORT)})
time.sleep(3)
runs.append({"phase":"+3s","r":t.eval(REPORT)})
print(json.dumps(runs))
