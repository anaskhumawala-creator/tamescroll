# THE OTHER HALF: does a second finger MOVE the drag origin?
#
# The old touchstart handler called onDown with `touches[0]` -- the first
# finger's CURRENT position -- so a thumb landing part-way through a drag
# reset `start` to wherever the dragging finger had got to. The travel
# already made was erased, and the commit test then measured only what
# came after.
#
# Discriminator: drag 60px (claimed, but under DRAG_ENTER_PX 70), land a
# second finger, drag 60px more, lift the FIRST finger. Cumulative travel
# is 120px, so a gesture whose origin survived commits to mini; one whose
# origin was reset measures 60 and springs back.
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
      return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),
              h:Math.round(r.height),
              mini:document.documentElement.classList.contains('ts-mini'),
              drag:document.documentElement.classList.contains('ts-mini-drag')};})()""")

def touch(kind, pts):
    t.cmd("Input.dispatchTouchEvent", type=kind,
          touchPoints=[{"x": p[0], "y": p[1], "id": p[2]} for p in pts])

def restore():
    t.eval("""(function(){var c=document.getElementById('ts-mini-cover');
      if(c) c.click(); return 1;})()""")
    time.sleep(1.3)

out = {}
b = box(); out["start"] = b
cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2

# --- A drags 60, B lands, A drags 60 more, A lifts ---
touch("touchStart", [(cx - 40, cy, 1)]); time.sleep(0.05)
for d in (20, 40, 60):
    touch("touchMove", [(cx - 40, cy + d, 1)]); time.sleep(0.05)
out["a_after_60"] = box()
touch("touchStart", [(cx - 40, cy + 60, 1), (cx + 60, cy, 2)]); time.sleep(0.05)
for d in (80, 100, 120):
    touch("touchMove", [(cx - 40, cy + d, 1), (cx + 60, cy, 2)]); time.sleep(0.05)
out["a_after_120"] = box()
touch("touchEnd", [(cx + 60, cy, 2)]); time.sleep(0.05)   # finger A lifts
time.sleep(1.3)
out["after_A_lifts"] = box()
touch("touchEnd", []); time.sleep(0.6)
out["after_B_lifts"] = box()

# --- control: same cumulative 120px, one finger, no interruption ---
restore()
b = box(); cx = b["x"] + b["w"] // 2; cy = b["y"] + b["h"] // 2
out["control_start"] = b
touch("touchStart", [(cx - 40, cy, 1)]); time.sleep(0.05)
for d in (20, 40, 60, 80, 100, 120):
    touch("touchMove", [(cx - 40, cy + d, 1)]); time.sleep(0.05)
touch("touchEnd", []); time.sleep(1.3)
out["control_after"] = box()
print(json.dumps(out, indent=1))
