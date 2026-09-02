import sys, time, json
from emu_cdp import page, Tab
t = Tab(page(int(sys.argv[1])))
js = "(function(){var r=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null;var v=document.querySelector('#movie_player video');return JSON.stringify({r:r,vt:v?v.currentTime:null,paused:v?v.paused:null,clips:document.querySelectorAll('.ts-gaze-vregion-clip > *').length});})()"
a = t.eval(js); time.sleep(4); b = t.eval(js)
print(a); print(b)
