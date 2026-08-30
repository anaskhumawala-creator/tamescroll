"""What does an image cost THIS thread, broken down?

Our main-thread share during a scroll is 489ms over 11 images. Before
moving anything else off-thread, find out which part that is: the load
(dom.loadDetectable -- possibly a CORS clone and a decode), or the
bitmap, or applying the verdict. imgdiag already records `load`, `main`
and `ms` per image.
"""
import json
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

lau = pick("localhost:1420")
lau.eval("localStorage.setItem('tamescroll.blur','smart')")
lau.eval(
    "(function(){var i=window.__TAURI__.core.invoke;"
    "i('open_platform',{id:'youtube',mode:'smart',strength:16,gender:'man',shown:['watch_recs']});"
    "return 1;})()"
)
time.sleep(12)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(26)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
for _ in range(4):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(7)
raw = tab.eval(
    "JSON.stringify((window.__TS_GAZE_IMGDIAG||[]).map(function(e){"
    "return {w:e.w, ms:e.ms, load:e.load, face:e.face, main:e.main, where:e.where};}))"
)
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
d = [e for e in json.loads(raw) if e.get("ms")]


def stats(key):
    vals = sorted(e[key] for e in d if isinstance(e.get(key), (int, float)))
    if not vals:
        return "n/a"
    return "n=%d p50=%d p95=%d max=%d sum=%d" % (
        len(vals), vals[len(vals) // 2], vals[min(len(vals) - 1, int(len(vals) * 0.95))],
        vals[-1], sum(vals))


print("images:", len(d), "| worker:", sum(1 for e in d if e.get("where") == "worker"))
for k in ("ms", "load", "face", "main"):
    print("  %-5s %s" % (k, stats(k)))
big = [e for e in d if (e.get("main") or 0) > 60]
print("worst main-thread images:", json.dumps(big[:5]))
