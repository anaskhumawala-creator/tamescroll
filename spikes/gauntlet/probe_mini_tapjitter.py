# DOES A TAP MOVE THE PLAYER? -- the other reading of "annoying".
#
# onDown arms on ANY touch starting in the player and claimAxis claims at
# CLAIM_PX = 8 of downward travel. A thumb tap on a phone routinely rolls
# 5-15px. Claiming kills the transition (ts-mini-drag) and starts
# interpolating the shrink, so a tap that drifts would make the player
# twitch smaller and snap back. Measure the drift a real tap needs.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(6)

PEEK = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc.getBoundingClientRect();
  return {drag:document.documentElement.classList.contains('ts-mini-drag'),
    mini:document.documentElement.classList.contains('ts-mini'),
    t:pc.style.transform||'', w:Math.round(r.width), h:Math.round(r.height)};})()"""

def tap(drift, steps=3, hold=0.05):
    """A tap that drifts `drift` px downward before lifting."""
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(hold)
    mid=None
    for i in range(1, steps+1):
        dy=int(drift*i/steps)
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(hold)
        if i==steps: mid=t.eval(PEEK)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.2)
    after=t.eval(PEEK)
    return {"drift":drift, "duringDrag":mid["drag"], "duringW":mid["w"],
            "duringH":mid["h"], "duringT":mid["t"][:38],
            "afterMini":after["mini"], "afterW":after["w"], "afterT":after["t"][:24]}

out=[]
for d in (0, 5, 8, 10, 14, 20, 30, 45):
    out.append(tap(d))
    time.sleep(1.0)
print(json.dumps(out, indent=1))
