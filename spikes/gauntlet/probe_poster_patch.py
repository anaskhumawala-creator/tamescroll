# THE PLAYER CONTAINER IS NOT THE PLAYER SUBTREE, AND AN IMAGE LIVES IN
# THE GAP.
#
# resolveHost refuses a host inside PLAYER_SUBTREE_SELECTOR =
# '#movie_player, .ytmVideoPreviewHost, ytm-video-preview'. But
# #player-thumbnail-overlay -- the video's own 480x360 poster, 412x231 on
# screen, covering the player exactly -- is a DIRECT CHILD of
# #player-container-id, which that selector does not name. So its host is
# accepted, the patch is appended to the fixed z-index-2 container AFTER
# #player, and it paints over the video by construction.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(30)

GAP = """(function(){
  var im=document.querySelector('#player-thumbnail-overlay');
  if(!im) return {err:'no poster'};
  var SEL='#movie_player, .ytmVideoPreviewHost, ytm-video-preview';
  var host=im.parentElement;
  return {hostId:host.id, refusedByCurrentSelector: !!host.closest(SEL),
          insideContainer: !!host.closest('#player-container-id')};})()"""
print("THE GAP:", json.dumps(t.eval(GAP)))

# keep the poster on screen: pause so YouTube shows it
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.pause();} return 1})()")
time.sleep(2)
Q = """(function(){
  var im=document.querySelector('#player-thumbnail-overlay');
  var pcid=document.querySelector('#player-container-id');
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var inC=pats.filter(function(p){return pcid.contains(p);});
  var v=document.querySelector('#movie_player video');
  return {posterVis: im?getComputedStyle(im).visibility:null,
    posterCls: im?im.className:null,
    patchesTotal:pats.length, patchesInContainer:inC.length,
    inCBoxes:inC.map(function(p){var r=p.getBoundingClientRect();return [r.x|0,r.y|0,r.width|0,r.height|0];}),
    containerIso: pcid?pcid.style.isolation||'':null,
    paused: v?v.paused:null};})()"""
for lbl,w in (("paused t+2",2),("paused t+8",6),("paused t+16",8)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.play();} return 1})()")
for lbl,w in (("playing t+4",4),("playing t+12",8)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
