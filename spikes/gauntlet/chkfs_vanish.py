# The patches disappeared after a fullscreen click while PAUSED. Is the
# player subtree rebuilt (so our entry is torn down), and does anything
# re-cover the frame while the video is not playing?
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable"); t.cmd("Input.enable")

STAMP = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var mp=document.querySelector('#movie_player');
  if(v&&!v.__tsStamp) v.__tsStamp='v'+Math.floor(performance.now());
  if(mp&&!mp.__tsStamp) mp.__tsStamp='m'+Math.floor(performance.now());
  return {v:v?v.__tsStamp:null, mp:mp?mp.__tsStamp:null,
    vConn:v?v.isConnected:null, mpConn:mp?mp.isConnected:null,
    paused:v?v.paused:null, t:v?+v.currentTime.toFixed(1):null,
    clip:document.querySelectorAll('.ts-gaze-vregion-clip').length,
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length,
    pending:document.querySelectorAll('.ts-gaze-pending').length,
    wholeBlur:(function(){var mp2=document.querySelector('#movie_player video');
      return mp2?getComputedStyle(mp2).filter:null;})(),
    diag:(function(){try{var d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
      if(typeof d==='string') d=JSON.parse(d);
      return d&&d.player?{passes:d.player.passes,fails:d.player.fails,
        slots:(d.player.slots||[]).length}:null;}catch(e){return String(e).slice(0,60);}})()};})()"""
print(json.dumps({"now": t.eval(STAMP)}, indent=1))
