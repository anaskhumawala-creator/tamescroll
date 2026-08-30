# Where does the player ACTUALLY land after the drag commits? The steal
# probe read an identity transform 500ms after a drag that had been
# correctly showing translate(169,649) scale(0.56) one frame earlier.
# Either the landing is wrong or the read was.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
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
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(18)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(6)

r0 = t.eval("""(function(){var pc=document.getElementById('player-container-id');
  var b=pc.getBoundingClientRect();
  return {rect:[b.left|0,b.top|0,b.width|0,b.height|0], vw:innerWidth, vh:innerHeight};})()""")
L,T,W,H = r0["rect"]
cx, cy = L + W//2, T + H//2

t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":cy+120*i//8}])
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx,"y":cy+120}])

snaps = []
READ = """(function(){var pc=document.getElementById('player-container-id');
  var b=pc.getBoundingClientRect();
  return {t:Math.round(performance.now()),
          inline:pc.style.transform||'',
          rect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)],
          state:window.__TS_MINI_STATE||'full',
          mini:document.documentElement.classList.contains('ts-mini'),
          drag:document.documentElement.classList.contains('ts-mini-drag'),
          cover:!!document.getElementById('ts-mini-cover'),
          k:pc.style.getPropertyValue('--ts-mini-k')};})()"""
for ms in (0, 0.12, 0.35, 0.8, 2.0):
    time.sleep(ms if ms else 0.02)
    snaps.append(t.eval(READ))

# And back out: tap the cover.
t.eval("(function(){var c=document.getElementById('ts-mini-cover');if(c)c.click();return 1})()")
time.sleep(1.0)
snaps.append(t.eval(READ))
print(json.dumps({"start": r0, "snaps": snaps}, indent=1))
