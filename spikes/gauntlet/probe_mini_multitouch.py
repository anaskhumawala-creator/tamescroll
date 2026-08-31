# DOES A SECOND FINGER MOVE THE PLAYER?
#
# miniplayer.mjs reads every touch event through touchXY(), which returns
# `ev.touches[0]` -- the FIRST touch in the list, not the one the event is
# about. Two consequences, neither of them measured before:
#   * a second finger's `touchstart` re-arms `start` at the FIRST
#     finger's current position (with the second finger's target), and
#   * when the first finger lifts while the second is still down,
#     `touches` is non-empty, so `onUp` is handed the SECOND finger's
#     coordinates and computes dx/dy from a point the user never dragged
#     from. A large enough bogus delta commits 'mini' or a dismiss fling.
#
# The module's own comment asserts Android WebView fires `touchcancel`
# when a second finger lands, which would make all of that unreachable.
# That is an assertion, so this measures it. MainActivity's pinch-zoom
# detector runs at dispatchTouchEvent and never consumes, so the WebView
# does see both fingers.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(25)

def box():
    return t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      if(!pc) return null; var r=pc.getBoundingClientRect();
      return {x:Math.round(r.left),y:Math.round(r.top),
              w:Math.round(r.width),h:Math.round(r.height),
              mini:document.documentElement.classList.contains('ts-mini'),
              drag:document.documentElement.classList.contains('ts-mini-drag'),
              tf:(pc.style.transform||'').slice(0,60),
              op:pc.style.opacity||''};})()""")

def counters():
    return t.eval("""(function(){return {cancels:window.__TS_TC||0};})()""")

# count touchcancel ourselves -- the module's claim is exactly this
t.eval("""(function(){window.__TS_TC=0;
  document.addEventListener('touchcancel',function(){window.__TS_TC++;},
    {capture:true,passive:true}); return 1;})()""")

def touch(kind, pts):
    t.cmd("Input.dispatchTouchEvent", type=kind,
          touchPoints=[{"x": p[0], "y": p[1], "id": p[2]} for p in pts])

out = {"boot": box()}
b = out["boot"]
cx = b["x"] + b["w"] // 2
cy = b["y"] + b["h"] // 2

# ---- trial 1: control, a plain one-finger drag down that commits ----
touch("touchStart", [(cx, cy, 1)])
for d in (20, 50, 90, 130):
    touch("touchMove", [(cx, cy + d, 1)]); time.sleep(0.05)
out["t1_mid"] = box()
touch("touchEnd", [])
time.sleep(1.2)
out["t1_after_onefinger_drag"] = box()
out["t1_cancels"] = counters()

# back to full
# THE COVER IS AN ID, NOT A CLASS. The first run queried
# `.ts-mini-cover`, restored nothing, and ran the pinch trial from the
# MINI state -- where the claim axis is sideways, so it proved nothing.
# Re-establish the state before every trial (loop 13's lesson, again).
t.eval("""(function(){var c=document.getElementById('ts-mini-cover');
  if(c) c.click(); return 1;})()""")
time.sleep(1.2)
out["t1_restored"] = box()

# ---- trial 2: PINCH. finger A parked, finger B lands and moves away ----
t.eval("window.__TS_TC=0")
b = box(); cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2
touch("touchStart", [(cx - 40, cy, 1)])
time.sleep(0.05)
touch("touchStart", [(cx - 40, cy, 1), (cx + 40, cy, 2)])   # second finger
time.sleep(0.05)
out["t2_after_2nd_down"] = box()
# spread: A goes up-left, B goes down-right -- a real pinch
for i in range(1, 6):
    touch("touchMove", [(cx - 40 - 8 * i, cy - 6 * i, 1), (cx + 40 + 8 * i, cy + 6 * i, 2)])
    time.sleep(0.05)
out["t2_mid_pinch"] = box()
# first finger lifts, second stays down
touch("touchEnd", [(cx + 80, cy + 30, 2)])
time.sleep(0.4)
out["t2_after_A_lifts"] = box()
touch("touchEnd", [])
time.sleep(1.2)
out["t2_after_both_up"] = box()
out["t2_cancels"] = counters()


# ---- trial 3: THE ORDER QUESTION. If touchcancel fires BEFORE the
# second finger's touchstart, that touchstart RE-ARMS `start` at the
# first finger's position (touchXY reads touches[0], not changedTouches)
# and the gesture is live again with a stale origin. So: second finger
# lands, then the FIRST finger drags DOWN far enough to commit.
t.eval("""(function(){var c=document.getElementById('ts-mini-cover');
  if(c) c.click(); return 1;})()""")
time.sleep(1.2)
t.eval("window.__TS_TC=0")
b = box(); cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2
out["t3_start"] = b
touch("touchStart", [(cx - 40, cy, 1)])
time.sleep(0.05)
touch("touchStart", [(cx - 40, cy, 1), (cx + 60, cy, 2)])
time.sleep(0.05)
for d in (20, 50, 90, 130):
    touch("touchMove", [(cx - 40, cy + d, 1), (cx + 60, cy, 2)])
    time.sleep(0.05)
out["t3_mid"] = box()
touch("touchEnd", [(cx + 60, cy, 2)])
time.sleep(0.3)
touch("touchEnd", [])
time.sleep(1.2)
out["t3_after"] = box()
out["t3_cancels"] = counters()

# ---- trial 4: the control for trial 3 -- the SAME drag with one finger.
t.eval("""(function(){var c=document.getElementById('ts-mini-cover');
  if(c) c.click(); return 1;})()""")
time.sleep(1.2)
b = box(); cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2
touch("touchStart", [(cx - 40, cy, 1)])
for d in (20, 50, 90, 130):
    touch("touchMove", [(cx - 40, cy + d, 1)]); time.sleep(0.05)
touch("touchEnd", [])
time.sleep(1.2)
out["t4_control_same_drag_one_finger"] = box()

print(json.dumps(out, indent=1))
