# PRIORITY 1, RE-ASKED ON 1057 WITH THE INSTRUMENT THAT FINALLY WORKED.
#
# elementsFromPoint SKIPS pointer-events:none, and every patch we draw is
# pointer-events:none -- that is what made three sessions report "cannot
# reproduce". Enable hit testing on our own overlay first, then ask.
#
# gender is set to 'woman' so the signed-out recommendation population
# (mostly men) actually produces patches through the REAL pipeline.
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
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(35)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(10)

SCROLL = """(function(px){
  var best=document.scrollingElement, room=0;
  [document.scrollingElement, document.body, document.documentElement]
    .forEach(function(n){ if(!n) return;
      var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;} });
  var b0=best.scrollTop; best.scrollTop=b0+px; return best.scrollTop-b0;})"""

# THE HIT TEST. Every patch is pointer-events:none by design, so it must
# be made hit-testable for the duration of the sample and put back.
ASK = """(function(){
  var pl=document.querySelector('#player-container-id');
  if(!pl) return {err:'no player'};
  // Image patches are hosted IN the thumbnail's parent, not in a layer.
  var patches=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var pr=pl.getBoundingClientRect();
  var samples=[];
  patches.forEach(function(p){
    var r=p.getBoundingClientRect();
    if(r.width<2||r.height<2) return;
    // only patches that genuinely OVERLAP the player's box
    var ox=Math.min(r.right,pr.right)-Math.max(r.left,pr.left);
    var oy=Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top);
    if(ox<=1||oy<=1) return;
    var cx=Math.max(r.left,pr.left)+ox/2, cy=Math.max(r.top,pr.top)+oy/2;
    var prev=p.style.pointerEvents;
    p.style.pointerEvents='auto';
    var hits=document.elementsFromPoint(cx,cy);
    p.style.pointerEvents=prev;
    var iPatch=hits.indexOf(p);
    var iPlayer=-1;
    for(var k=0;k<hits.length;k++){
      if(hits[k]===pl||pl.contains(hits[k])){iPlayer=k;break;}}
    samples.push({ox:Math.round(ox),oy:Math.round(oy),
      iPatch:iPatch, iPlayer:iPlayer,
      patchWins:(iPatch>=0 && iPlayer>=0 && iPatch<iPlayer),
      hostIso:(function(){var h=p.parentElement; // patch lives in the layer
        return null;})(),
      top:Math.round(r.top)});
  });
  return {patches:patches.length, overlapping:samples.length,
    patchWins:samples.filter(function(s){return s.patchWins;}).length,
    playerZ:getComputedStyle(pl).zIndex,
    samples:samples.slice(0,8)};})()"""

out=[]
for i in range(9):
    moved=t.eval("(%s)(320)" % SCROLL)
    time.sleep(5)
    r=t.eval(ASK); r["step"]=i+1; r["moved"]=moved
    out.append(r)
tot=sum(s.get("overlapping",0) for s in out)
win=sum(s.get("patchWins",0) for s in out)
print(json.dumps({"overlappingSamples":tot,"patchOverPlayer":win,
                  "steps":out}, indent=1))
