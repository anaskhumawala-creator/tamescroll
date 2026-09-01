# TIMINGS WOBBLE 28% ON THIS HARNESS; COUNTS DO NOT. __TS_GAZE_RENDER
# counts what the render loop actually does. A patch that is not moving
# -- paused video, parked player, a settled scene -- should cost almost
# nothing. Anything it still writes 60x/s is phone battery and jank we
# can measure honestly here.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")

R = """(function(){
  var r=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null;
  var v=document.querySelector('video');
  return {r:r, now:performance.now(),
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length,
    paused:v?v.paused:null,
    mini:document.documentElement.classList.contains('ts-mini')};})()"""

def window_rate(label, seconds):
    a = t.eval(R); time.sleep(seconds); b = t.eval(R)
    if not a.get("r") or not b.get("r"): return {"phase":label, "err":"no counters"}
    dt = (b["now"]-a["now"])/1000.0
    out = {"phase":label, "secs":round(dt,1), "patches":b["patches"],
           "paused":b["paused"], "mini":b["mini"]}
    for k in a["r"]:
        out[k] = round((b["r"][k]-a["r"][k])/dt, 1)
    return out

rows=[]
for i in range(30):
    s=t.eval(R)
    if s.get("patches"): break
    time.sleep(2)
rows.append(window_rate("playing, patch on screen", 8))
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(2)
rows.append(window_rate("PAUSED, patch frozen", 8))
# park it
b=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0],"y":b[1]}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":b[0],"y":b[1]+int(160*i/8)}])
    time.sleep(0.03)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(3)
rows.append(window_rate("PARKED mini, paused", 8))
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(2)
rows.append(window_rate("PARKED mini, playing", 8))
# and with nothing covered at all
t.eval("(function(){var v=document.querySelector('video'); if(v){v.pause(); v.currentTime=5;} return 1;})()")
time.sleep(6)
rows.append(window_rate("paused, no patch", 8))
print(json.dumps(rows, indent=1))
