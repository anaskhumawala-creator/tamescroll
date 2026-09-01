# The A/B probe read "no player" after the restore tap -- that query hangs
# off the CLIP layer, which does not exist when there are no patches. Read
# the player itself.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable")
print(json.dumps(t.eval("""(function(){
  var pc=document.querySelector('#player-container-id');
  var v=document.querySelector('video');
  var r=pc?pc.getBoundingClientRect():null;
  return {path:location.pathname, mini:document.documentElement.classList.contains('ts-mini'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null,
    video:!!v, paused:v?v.paused:null,
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length,
    clip:document.querySelectorAll('.ts-gaze-vregion-clip').length,
    pill:document.querySelectorAll('.ts-gaze-pill').length,
    miniBtns:document.querySelectorAll('#ts-mini-btns').length,
    bundle:window.__TS_GAZE_BUNDLE__||null};})()"""), indent=1))
