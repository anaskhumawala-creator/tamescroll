# THE MINI PLAYER ACROSS A ROTATION.
#
# ts-mini parks the player with a TRANSFORM computed from the viewport
# at the moment of the drag: translate(169px, 649px) on a 412x839 screen.
# Rotating changes the viewport under it. `place()` is bound to resize
# and orientationchange, so it should re-park -- but a mini player left
# at x=169 on a 412-wide layout is at x=169 on an 892-wide one too, which
# would sit it in the middle of the screen instead of the corner. Never
# measured. "Doesn't function as it's supposed to" covers this exactly.
import json, time, subprocess
from emu_cdp import page, Tab

def rot(v):
    subprocess.run(["adb","-s","emulator-5554","shell","settings","put",
                    "system","accelerometer_rotation","0"],capture_output=True)
    subprocess.run(["adb","-s","emulator-5554","shell","settings","put",
                    "system","user_rotation",str(v)],capture_output=True)

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
rot(0)
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

BOX = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  return {mini:document.documentElement.classList.contains('ts-mini'),
    vw:window.innerWidth, vh:window.innerHeight,
    left:r?Math.round(r.left):null, top:r?Math.round(r.top):null,
    w:r?Math.round(r.width):null, h:r?Math.round(r.height):null,
    rightGap:r?Math.round(window.innerWidth-r.right):null,
    bottomGap:r?Math.round(window.innerHeight-r.bottom):null,
    onScreen:r?(r.right>0&&r.left<window.innerWidth&&
                r.bottom>0&&r.top<window.innerHeight):null,
    transform:pc?pc.style.transform:null};})()"""

def minimise():
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.15)
    for dy in (14,30,50,72,95):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(0.1)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.6)

out=[]
out.append(dict(t.eval(BOX), phase="portrait, full"))
minimise()
out.append(dict(t.eval(BOX), phase="portrait, MINI"))
rot(1); time.sleep(9)
out.append(dict(t.eval(BOX), phase="LANDSCAPE, still mini"))
time.sleep(6)
out.append(dict(t.eval(BOX), phase="landscape settled"))
rot(0); time.sleep(9)
out.append(dict(t.eval(BOX), phase="back to PORTRAIT"))
rot(0)
print(json.dumps(out, indent=1))
