import time, base64
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(15)
def shot(p):
    r = tab.cmd("Page.captureScreenshot", format="png", captureBeyondViewport=False)
    open(p,"wb").write(base64.b64decode(r["data"]))
for i in range(10):
    tab.eval("window.scrollBy(0,500);"); time.sleep(0.25)
time.sleep(1.0); shot("runs/tb-a.png")
for i in range(8):
    tab.eval("window.scrollBy(0,650);"); time.sleep(0.12)
shot("runs/tb-b.png")
print("ok", tab.eval("JSON.stringify({y:Math.round(scrollY),patches:document.querySelectorAll('div[style*=\"backdrop-filter\"]').length})"))
