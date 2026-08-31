# "z-index / stacking AFTER THE MINIPLAYER TRANSFORM" -- the last angle
# on his three-times-reported bug that has never been measured.
#
# While mini the player is position:fixed with a transform, which makes
# it a stacking context AND a containing block. It sits as a small box
# over the recommendations. A recommendation patch directly under it is
# z-index 2 inside an isolated host; the host takes part in the root at
# z-index auto, so the fixed player should win. Ask, do not assume.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

def minimise():
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.15)
    for dy in (14,30,50,72,95):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(0.1)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.6)

ASK = """(function(){
  var pl=document.querySelector('#player-container-id');
  if(!pl) return {err:'no player'};
  var cs=getComputedStyle(pl), pr=pl.getBoundingClientRect();
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var over=[];
  ps.forEach(function(p){
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
    over.push({ox:Math.round(ox),oy:Math.round(oy),iPatch:iP,iPlayer:iV,
      wins:(iP>=0&&iV>=0&&iP<iV)});
  });
  return {mini:document.documentElement.classList.contains('ts-mini'),
    playerPos:cs.position, playerZ:cs.zIndex,
    playerBox:[Math.round(pr.left),Math.round(pr.top),
               Math.round(pr.width),Math.round(pr.height)],
    patches:ps.length, overlapping:over.length,
    patchWins:over.filter(function(o){return o.wins;}).length, over:over.slice(0,5)};})()"""

out=[]
scroll(700); time.sleep(3)
out.append(dict(t.eval(ASK), phase="full player, scrolled"))
minimise()
out.append(dict(t.eval(ASK), phase="MINIMISED"))
for i in range(8):
    mv=scroll(300); time.sleep(4)
    out.append(dict(t.eval(ASK), phase="mini, scroll %d" % (i+1)))
tot=sum(o.get("overlapping",0) for o in out if o.get("mini"))
win=sum(o.get("patchWins",0) for o in out if o.get("mini"))
print(json.dumps({"whileMini_overlapping":tot,"whileMini_patchOverPlayer":win,
                  "steps":out}, indent=1))
