# Minimise, restore, minimise again -- the second one stopped at 15px of
# a 120px drag and left the player stuck mid-transform. Dispatch the
# moves ONE AT A TIME and read after each, so the frame it stops on is
# visible instead of inferred.
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
  return {state:window.__TS_MINI_STATE||'full', inline:pc.style.transform||'',
          drag:document.documentElement.classList.contains('ts-mini-drag'),
          mini:document.documentElement.classList.contains('ts-mini'),
          cover:!!document.getElementById('ts-mini-cover')};})()"""

def stepwise(label, dy, n=8):
    c = t.eval("""(function(){var b=document.getElementById('player-container-id').getBoundingClientRect();
      return [Math.round(b.left+b.width/2), Math.round(b.top+b.height/2)];})()""")
    cx, cy = c
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    frames=[]
    for i in range(1, n+1):
        yy = cy + dy*i//n
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":yy}])
        r = t.eval(READ); r["dy"] = dy*i//n
        frames.append(r)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx,"y":cy+dy}])
    time.sleep(1.0)
    return {"label":label, "from":[cx,cy], "frames":frames, "after":t.eval(READ)}

out=[]
out.append(stepwise("1st minimise", 120))
out.append(stepwise("restore", -90))
out.append(stepwise("2nd minimise", 120))
print(json.dumps(out, indent=1))
