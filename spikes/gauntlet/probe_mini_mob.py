import time, json
from gauntlet import open_platform

MOB_UA = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB_UA, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6,
        mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(14)
print("url:", tab.eval("location.href"))
def state():
    return tab.eval(r"""(function(){
      var p = document.querySelector('#player-container-id, ytm-custom-control, #movie_player');
      var app = document.querySelector('ytm-app');
      var r = p ? p.getBoundingClientRect() : null;
      return JSON.stringify({
        player: !!p,
        rect: r ? {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)} : null,
        appAttrs: app ? [].map.call(app.attributes,function(a){return a.name;}) : null,
        miniAttr: app ? app.hasAttribute('miniplayer-active') : null,
        playerCls: p ? p.className : null,
        watchCls: (document.querySelector('ytm-watch')||{}).className || null,
        paused: (function(){var v=document.querySelector('video');return v?v.paused:null;})()
      });
    })()""")
print("before:", state())
# start playback
tab.eval("(function(){var v=document.querySelector('video');if(v){v.muted=true;v.play();}})()")
time.sleep(4)
# drag the player DOWN with a touch gesture
def touch(t, x, y):
    pts = [] if t == "touchEnd" else [{"x": x, "y": y, "radiusX": 10, "radiusY": 10, "force": 1}]
    tab.cmd("Input.dispatchTouchEvent", type=t, touchPoints=pts)
touch("touchStart", 206, 150)
for y in range(160, 700, 30):
    touch("touchMove", 206, y)
    time.sleep(0.03)
touch("touchEnd", 206, 700)
time.sleep(3)
print("after:", state())
