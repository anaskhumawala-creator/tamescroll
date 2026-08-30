# Does the miniplayer steal an ordinary page scroll?
#
# The module claims a gesture at |dy| >= 8 with no regard for SIGN, and
# then preventDefaults every touchmove for the rest of that gesture. On a
# watch page the sticky player is a 412x232 band across the top of the
# screen, so the flick that scrolls down to the comments STARTS on the
# player -- and in 'full' state an upward drag can never produce a
# verdict, so the page simply does not move.
#
# A touchmove whose defaultPrevented is true is a scroll the page will
# never perform. That is the measurement; it does not depend on the
# emulator's scroll physics at all.
import json, time, sys
from emu_cdp import page, Tab

WATCH = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"

def open_youtube(t):
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
        gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
      return 1;})()""")
    time.sleep(5)

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
open_youtube(t)
t.cmd("Page.navigate", url=WATCH)
time.sleep(18)

# Play it: a CUED player builds none of the watch chrome (CLAUDE.md).
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(6)

setup = t.eval("""(function(){
  window.__PV = [];
  document.addEventListener('touchmove', function(e){
    window.__PV.push(e.defaultPrevented ? 1 : 0);
  }, {passive:true});           // last in line: sees what the others did
  var pc = document.getElementById('player-container-id');
  var r = pc ? pc.getBoundingClientRect() : null;
  return {player: !!pc, rect: r ? [r.left|0, r.top|0, r.width|0, r.height|0] : null,
          path: location.pathname, scrollY: window.scrollY,
          state: window.__TS_MINI_STATE || 'full'};})()""")

if not setup.get("player"):
    print(json.dumps({"error": "no player container", "setup": setup})); sys.exit(1)

L, T, W, H = setup["rect"]
cx, cy = L + W // 2, T + H // 2

def gesture(name, dy, dx=0, steps=8):
    t.eval("window.__PV = []; window.__TSDRAG = 0;")
    t.cmd("Input.dispatchTouchEvent", type="touchStart",
          touchPoints=[{"x": cx, "y": cy}])
    for i in range(1, steps + 1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x": cx + dx * i // steps, "y": cy + dy * i // steps}])
    mid = t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      return {prevented: window.__PV.filter(function(v){return v}).length,
              moves: window.__PV.length,
              dragClass: document.documentElement.classList.contains('ts-mini-drag'),
              transform: (pc && pc.style.transform) || ''};})()""")
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(0.5)
    after = t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      return {state: window.__TS_MINI_STATE||'full',
              mini: document.documentElement.classList.contains('ts-mini'),
              transform: (pc && pc.style.transform)||''};})()""")
    return {"gesture": name, "dy": dy, "dx": dx, "during": mid, "after": after}

out = {"setup": setup, "runs": []}
# The scroll-to-comments flick: finger starts on the player, moves UP.
out["runs"].append(gesture("scroll down the page (finger up 120px)", -120))
# A short scroll flick, the length a real flick actually starts with.
out["runs"].append(gesture("short flick up 30px", -30))
# The gesture that IS ours: a deliberate downward drag.
out["runs"].append(gesture("deliberate drag down 120px", 120))
print(json.dumps(out, indent=1))
