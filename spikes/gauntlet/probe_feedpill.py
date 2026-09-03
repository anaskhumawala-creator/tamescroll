import json, sys, time
from emu_cdp import Tab, page
t = Tab(page(port=int(sys.argv[1]) if len(sys.argv)>1 else 9227))
t.cmd("Page.enable"); t.cmd("Runtime.enable")
print(t.eval("""(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; }
  var pill=document.querySelector('.ts-gaze-pill'), gear=document.querySelector('.ts-gaze-gear');
  var pc=document.getElementById('player-container-id'), mp=document.getElementById('movie_player');
  var v=document.querySelector('#movie_player video');
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  return JSON.stringify({
    path: location.pathname,
    pill: box(pill), pillText: pill?pill.textContent.trim():null,
    gear: box(gear),
    pcBox: box(pc), pcParent: pc?(pc.parentElement&&pc.parentElement.tagName):null,
    inFeedItem: pc? !!(pc.closest && pc.closest('ytm-rich-item-renderer,ytm-video-with-context-renderer')) : null,
    video: v? {box:box(v), paused:v.paused, t:Math.round(v.currentTime*10)/10, rs:v.readyState} : null,
    patches: clip? clip.children.length : 0,
    vtracks: (window.__TS_GAZE_VTRACKS? (window.__TS_GAZE_VTRACKS().length||0) : null)
  }, null, 1);})()"""))
