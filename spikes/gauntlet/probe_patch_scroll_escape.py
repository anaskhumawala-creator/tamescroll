# THE OCCLUDER CLAMP IS NEVER RE-EVALUATED DURING A SCROLL.
#
# initRegionBlur's 500ms sweep calls positionEntry -- the only place the
# clamp lives -- ONLY when the element's PARENT-RELATIVE rect changed:
#
#   var rel = {left: r.left-pr.left, top: r.top-pr.top, ...}
#   if (!lastRel || !sameRect(rel, lastRel)) positionEntry(entry);
#
# A scroll moves a recommendation together with its parent, so `rel` is
# identical and positionEntry never runs again. But the clamp's own gate
# is VIEWPORT-relative (`elRect.top < vh*0.6`), so a patch minted while
# its thumbnail sat low on the page carries occ = 0 for the life of the
# page -- and then scrolls up under the sticky player still wearing it.
#
# The measurement is the outcome, not the call: after a scroll, does any
# patch rectangle overlap the player's box, and does it WIN the hit test.
import json, time
from emu_cdp import page, Tab

WATCH = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
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
t.cmd("Page.navigate", url=WATCH)
time.sleep(20)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(30)          # let the drain judge the recommendations

REPORT = """(function(){
  var pc=document.getElementById('player-container-id');
  var p=pc?pc.getBoundingClientRect():null;
  var fixed = p && getComputedStyle(pc).position;
  var out={scrollY:Math.round(window.scrollY),
           player:p?[Math.round(p.left),Math.round(p.top),Math.round(p.width),Math.round(p.height)]:null,
           playerPos:fixed, patches:0, onScreen:0, overPlayer:[], hitWins:[]};
  if(!p) return out;
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  out.patches=ps.length;
  ps.forEach(function(o,i){
    var b=o.getBoundingClientRect();
    if(b.width<1||b.height<1) return;
    if(b.bottom<=0||b.top>=innerHeight) return;
    out.onScreen++;
    var ov = b.top < p.bottom && b.bottom > p.top && b.left < p.right && b.right > p.left;
    if(!ov) return;
    // How far the patch reaches ABOVE the player's bottom edge -- the
    // pixels it is standing on top of the video with.
    var overlap = Math.min(b.bottom, p.bottom) - Math.max(b.top, p.top);
    var x = Math.round(Math.max(b.left, p.left) + 2);
    var y = Math.round(Math.max(b.top, p.top) + Math.min(4, overlap/2));
    var hits=document.elementsFromPoint(x,y)||[];
    var iPatch=hits.indexOf(o);
    var iPlayer=-1;
    for(var k=0;k<hits.length;k++){ if(pc.contains(hits[k])){iPlayer=k;break;} }
    out.overPlayer.push({overlapPx:Math.round(overlap),
      patch:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
      display:o.style.display||'', at:[x,y], iPatch:iPatch, iPlayer:iPlayer,
      patchWins: iPatch>=0 && (iPlayer<0 || iPatch<iPlayer)});
  });
  out.hitWins = out.overPlayer.filter(function(e){return e.patchWins}).length;
  return out;})()"""

runs=[]
runs.append({"phase":"settled at top", "r":t.eval(REPORT)})
for step in range(1, 9):
    t.eval("window.scrollBy(0, 260);")
    time.sleep(0.9)
    runs.append({"phase":"scroll step %d" % step, "r":t.eval(REPORT)})
# and let the 500ms sweep have several goes at it
time.sleep(3)
runs.append({"phase":"3s after the last scroll", "r":t.eval(REPORT)})
print(json.dumps(runs, indent=1))
