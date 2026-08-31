# THE ONE HOLE LEFT IN PRIORITY 1: a feed preview actually PLAYING.
#
# m.youtube plays feed previews into the SHARED #movie_player, so a
# previewing thumbnail's <img> sits inside the player subtree. Every
# earlier sweep read 0 previews playing, so that path has never been
# exercised. Get one playing first; only then are the counts worth
# anything.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','previews','watch_recs','search_inserts']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(40)

STATE = """(function(){
  var mp=document.querySelector('#movie_player');
  var pc=document.querySelector('#player-container-id');
  var vids=[].slice.call(document.querySelectorAll('video'));
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var inPlayer=ps.filter(function(p){return mp&&mp.contains(p);}).length;
  var mpr=mp?mp.getBoundingClientRect():null;
  // patches that overlap the shared player's box while it is playing
  var over=0, wins=0;
  if(mpr && mpr.width>2){
    ps.forEach(function(p){
      var r=p.getBoundingClientRect();
      if(r.width<2||r.height<2) return;
      var ox=Math.min(r.right,mpr.right)-Math.max(r.left,mpr.left);
      var oy=Math.min(r.bottom,mpr.bottom)-Math.max(r.top,mpr.top);
      if(ox<=1||oy<=1) return;
      over++;
      var cx=Math.max(r.left,mpr.left)+ox/2, cy=Math.max(r.top,mpr.top)+oy/2;
      var prev=p.style.pointerEvents; p.style.pointerEvents='auto';
      var hits=document.elementsFromPoint(cx,cy);
      p.style.pointerEvents=prev;
      var iP=hits.indexOf(p), iV=-1;
      for(var k=0;k<hits.length;k++){if(hits[k]===mp||mp.contains(hits[k])){iV=k;break;}}
      if(iP>=0&&iV>=0&&iP<iV) wins++;});
  }
  return {
    vids:vids.length,
    playing:vids.filter(function(v){return !v.paused&&v.readyState>2;}).length,
    mpPlaying:!!(mp&&mp.querySelector('video')&&!mp.querySelector('video').paused
                 &&mp.querySelector('video').readyState>2),
    mpBox:mpr?[Math.round(mpr.left),Math.round(mpr.top),
               Math.round(mpr.width),Math.round(mpr.height)]:null,
    mpInFeed: !!(mp && !document.location.pathname.startsWith('/watch')),
    vCovered: vids.filter(function(v){
      return v.classList.contains('ts-gaze-pending')||
             v.classList.contains('ts-gaze-flagged');}).length,
    patches:ps.length, hostInPlayer:inPlayer,
    overlapMp:over, patchOverMp:wins,
    vregions:document.querySelectorAll('.ts-gaze-vregion-clip *').length,
    scroll:Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

out=[]
# dwell: previews start when an item settles in view, so scroll a little
# and then WAIT, repeatedly, instead of scrolling continuously.
for i in range(14):
    scroll(300)
    time.sleep(6)
    r=t.eval(STATE); r["step"]=i+1
    out.append(r)
played=[r for r in out if r["mpPlaying"]]
print(json.dumps({"stepsWithPreviewPlaying":len(played),
                  "totalPatchSamples":sum(r["patches"] for r in out),
                  "hostInPlayer":sum(r["hostInPlayer"] for r in out),
                  "overlapMp":sum(r["overlapMp"] for r in out),
                  "patchOverMp":sum(r["patchOverMp"] for r in out),
                  "steps":out}, indent=1))
