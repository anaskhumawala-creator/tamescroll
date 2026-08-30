"""Drive the drag on the live app and photograph both states."""
import time, base64, json
from gauntlet import open_platform

UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(24)

def shot(name):
    d = tab.cmd("Page.captureScreenshot", format="png")
    open(name, "wb").write(base64.b64decode(d["data"]))
    print("wrote", name)

def touch(kind, x, y):
    pts = [] if kind == "touchEnd" else [{"x": x, "y": y, "radiusX": 5, "radiusY": 5}]
    tab.cmd("Input.dispatchTouchEvent", type=kind, touchPoints=pts)

print("boot:", tab.eval("JSON.stringify({mini: !!window.__TS_MINI__, bundle: window.__TS_GAZE_BUNDLE__, "
                        "pc: !!document.getElementById('player-container-id'), "
                        "ph: !!document.querySelector('.player-placeholder')})"))
# scroll into the comments first: the real gesture happens while reading
tab.eval("window.scrollTo(0,600)")
time.sleep(0.6)
before = tab.eval(r"""(function(){var r=document.getElementById('player-container-id').getBoundingClientRect();
 var v=document.querySelector('video');
 return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
  scrollY:window.scrollY, paused:v.paused, t:+v.currentTime.toFixed(1),
  state: window.__TS_MINI_STATE||'full'});})()""")
print("before:", before)
shot("mini-before.png")

# drag down from the middle of the player
x, y = 200, 120
touch("touchStart", x, y)
for step in range(1, 9):
    touch("touchMove", x, y + step * 15)
    time.sleep(0.02)
touch("touchEnd", x, y + 120)
time.sleep(1.0)

after = tab.eval(r"""(function(){var pc=document.getElementById('player-container-id');
 var r=pc.getBoundingClientRect(); var v=document.querySelector('video');
 var ph=document.querySelector('.player-placeholder');
 return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
  right:Math.round(r.right), bottom:Math.round(r.bottom), vw:innerWidth, vh:innerHeight,
  transform: pc.style.transform, phH: ph?Math.round(ph.getBoundingClientRect().height):null,
  scrollY:window.scrollY, paused:v.paused, t:+v.currentTime.toFixed(1),
  cover: !!document.getElementById('ts-mini-cover'), state: window.__TS_MINI_STATE});})()""")
print("after :", after)
shot("mini-after.png")

# tap it to restore
touch("touchStart", 320, 800); touch("touchEnd", 320, 800)
tab.eval("var c=document.getElementById('ts-mini-cover'); if(c) c.click();")
time.sleep(0.8)
back = tab.eval(r"""(function(){var pc=document.getElementById('player-container-id');
 var r=pc.getBoundingClientRect(); var v=document.querySelector('video');
 var ph=document.querySelector('.player-placeholder');
 return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
  transform: pc.style.transform||'(none)', phH: ph?Math.round(ph.getBoundingClientRect().height):null,
  scrollY:window.scrollY, paused:v.paused, t:+v.currentTime.toFixed(1),
  cover: !!document.getElementById('ts-mini-cover'), state: window.__TS_MINI_STATE});})()""")
print("back  :", back)
shot("mini-back.png")
