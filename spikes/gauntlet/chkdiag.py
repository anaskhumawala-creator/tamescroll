import json
from emu_cdp import page, Tab
t = Tab(page())
print(json.dumps(t.eval("""(function(){
  var d=(window.__TS_GAZE_IMGDIAG||[]).slice(-6).map(function(e){
    return {why:e.why, msg:(e.msg||'').slice(0,90), where:e.where, ms:e.ms, w:e.w, faces:e.faces};});
  var b=window.__TS_GAZE_BOOT||{};
  return {ring:d, total:window.__TS_GAZE_IMGTOTAL||0,
    worker: window.__TS_GAZE_WORKER||null,
    boot:{up:b.up,ready:b.ready,warm:b.warm,backend:b.backend},
    mode:window.__TS_GAZE_MODE, marker:window.__TS_GAZE_BUNDLE__};})()"""), indent=1))
