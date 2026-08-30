"""Does the page still scroll while the main thread is busy?

That is the whole difference a non-passive touch listener makes. With
one, the browser must wait for our JS before it may scroll, so a busy
thread holds the finger, paints the press state, and the scroll starts
late -- the owner's report. With passive listeners the compositor
scrolls on its own thread and does not care what the main thread is
doing.

So: block the main thread for ~600ms at the moment the finger moves, and
watch whether the page moves anyway.
"""
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep=getattr(time, 'sleep')
time.sleep(24)

print("listeners:", tab.eval("JSON.stringify({mini: !!window.__TS_MINI__})"))
tab.eval("window.scrollTo(0, 400)")
time.sleep(1)
before = tab.eval("String(Math.round(scrollY))")

# Block the main thread for 600ms, starting now.
tab.eval("setTimeout(function(){var e=performance.now()+600;while(performance.now()<e){}},0)")
tab.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": 200, "y": 700}])
for dy in range(40, 400, 40):
    tab.cmd("Input.dispatchTouchEvent", type="touchMove",
            touchPoints=[{"x": 200, "y": 700 - dy}])
# Read the scroll position from the COMPOSITOR's point of view while the
# main thread is still inside the busy loop: a layout metric, not JS.
metrics = tab.cmd("Page.getLayoutMetrics")
during = round(metrics["visualViewport"]["pageY"])
tab.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(2)
after = tab.eval("String(Math.round(scrollY))")
print("scrollY before=%s  during the block=%s  after=%s" % (before, during, after))
print("scrolled while the thread was busy:", during - int(before))
