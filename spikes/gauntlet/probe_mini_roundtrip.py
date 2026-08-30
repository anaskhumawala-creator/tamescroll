# The full gesture round trip after the claim gate changed: minimise,
# restore by dragging up, and throw away sideways. The gate is now
# directional, so every one of these had to be re-checked.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(20)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(6)

READ = """(function(){var pc=document.getElementById('player-container-id');
  var b=pc.getBoundingClientRect(); var v=document.querySelector('video');
  return {state:window.__TS_MINI_STATE||'full',
    rect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
    inline:pc.style.transform||'', cover:!!document.getElementById('ts-mini-cover'),
    btns:!!document.getElementById('ts-mini-btns'),
    placeholder:(function(){var p=document.querySelector('.player-placeholder');
      return p?Math.round(p.getBoundingClientRect().height):null})(),
    paused:v?v.paused:null};})()"""

def drag(dx, dy, steps=8):
    r = t.eval("""(function(){var pc=document.getElementById('player-container-id');
      var b=pc.getBoundingClientRect();
      return [Math.round(b.left+b.width/2), Math.round(b.top+b.height/2)];})()""")
    cx, cy = r
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1, steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":cx+dx*i//steps, "y":cy+dy*i//steps}])
    t.cmd("Input.dispatchTouchEvent", type="touchEnd",
          touchPoints=[{"x":cx+dx, "y":cy+dy}])
    time.sleep(1.2)
    return t.eval(READ)

out = {"start": t.eval(READ)}
out["after down 120"] = drag(0, 120)
out["after up 90"]    = drag(0, -90)
out["down again"]     = drag(0, 120)
out["fling right 220"]= drag(220, 0)
time.sleep(1.0)
out["after fling settles"] = t.eval(READ)
print(json.dumps(out, indent=1))
