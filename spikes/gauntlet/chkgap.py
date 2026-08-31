import json
from emu_cdp import page, Tab
t = Tab(page())
js = """(async()=>{
  const r=await fetch('/__tamescroll/gaze-page.js?v=1'); const s=await r.text();
  const lit='#movie_player, #player-container-id, .ytmVideoPreviewHost, ytm-video-preview';
  const old='#movie_player, .ytmVideoPreviewHost, ytm-video-preview';
  const im=document.querySelector('#player-thumbnail-overlay');
  const host=im?im.parentElement:null;
  return {bundleHasNewSelector: s.indexOf(lit)>=0,
          bundleStillHasOld: s.indexOf(old)>=0,
          hostId: host?host.id:null,
          refusedNow: host? !!host.closest(lit) : null,
          marker: window.__TS_GAZE_BUNDLE__};
})()"""
print(json.dumps(t.eval(js), indent=1))
