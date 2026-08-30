# The sideways throw, after claimAxis changed which drags are ours.
# Three cases: below the threshold (must snap back, not leave the player
# sitting off-centre), above it (must throw away, pause the video and put
# the page back), and a sideways drag while FULL (never ours).
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(24)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(8)

READ = """(function(){var pc=document.getElementById('player-container-id');
  var v=document.querySelector('video');
  var ph=document.querySelector('.player-placeholder');
  var b=pc?pc.getBoundingClientRect():null;
  return {state:window.__TS_MINI_STATE||'full',
    rect:b?[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]:null,
    inline:pc?pc.style.transform||'':'', opacity:pc?pc.style.opacity||'':'',
    gone:document.documentElement.classList.contains('ts-mini-gone'),
    paused:v?v.paused:null,
    ph:ph?Math.round(ph.getBoundingClientRect().height):null,
    btns:!!document.getElementById('ts-mini-btns')};})()"""

def drag(dx, dy, steps=8, settle=1.5):
    c=t.eval("""(function(){var b=document.getElementById('player-container-id').getBoundingClientRect();
      return [Math.round(b.left+b.width/2),Math.round(b.top+b.height/2)];})()""")
    cx,cy=c
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":cx+dx*i//steps,"y":cy+dy*i//steps}])
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx+dx,"y":cy+dy}])
    time.sleep(settle)
    return t.eval(READ)

out={"vw": t.eval("innerWidth"), "threshold_px": t.eval("Math.max(48, innerWidth*0.25)|0")}
out["sideways 80 while FULL (never ours)"] = drag(80, 0)
out["minimise"] = drag(0, 120)
out["sideways 60 while mini (below threshold)"] = drag(60, 0)
out["sideways 220 while mini (throw away)"] = drag(220, 0, settle=2.0)
time.sleep(1.5)
out["settled after throw"] = t.eval(READ)
print(json.dumps(out, indent=1))
