import time
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(14)
for i in range(10):
    tab.eval("window.scrollBy(0,500);")
    time.sleep(0.25)
time.sleep(1.5)
tab.clip_shot("runs/topbar1.png", {"x":0,"y":0,"w":412,"h":260})
for i in range(6):
    tab.eval("window.scrollBy(0,700);")
    time.sleep(0.15)
tab.clip_shot("runs/topbar2.png", {"x":0,"y":0,"w":412,"h":260})
print("shots written")
