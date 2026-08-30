"""Does the Android side serve the worker, and does it run there?

Desktop proved the idea; this proves the platform that matters. Drives
the app on a device/emulator over its WebView's CDP endpoint (forwarded
by adb), taps YouTube, and reads the worker's own lifecycle marks.

Usage: python probe_android_worker.py [port]
"""
import json
import sys
import time
import urllib.request

import websocket

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226


def targets():
    with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
        return [t for t in json.load(r) if t.get("type") == "page"]


class Tab:
    def __init__(self, t):
        self.ws = websocket.create_connection(
            t["webSocketDebuggerUrl"], suppress_origin=True, timeout=180
        )
        self.mid = 0

    def cmd(self, method, **params):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.mid:
                return m.get("result", m)

    def eval(self, expr):
        r = self.cmd("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            return {"error": r["exceptionDetails"].get("exception", {}).get("description", "?")}
        return r.get("result", {}).get("value")


def pick(sub):
    for _ in range(30):
        for t in targets():
            if sub in t.get("url", ""):
                return Tab(t)
        time.sleep(1)
    raise SystemExit(f"no target matching {sub}")


tab = pick("tauri.localhost")
tab.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(10)
yt = pick("youtube.com")
print("page:", yt.eval("location.href"))
for i in range(40):
    time.sleep(3)
    ev = yt.eval("JSON.stringify(window.__TS_GAZE_WORKER||{})")
    if isinstance(ev, str) and ("ready" in ev or "dead" in ev):
        break
print("worker events:", ev)
print("bundle:", yt.eval("window.__TS_GAZE_BUNDLE__"))
print(
    "worker script fetched:",
    yt.eval(
        "JSON.stringify(performance.getEntriesByType('resource')"
        ".filter(function(r){return /__tamescroll/.test(r.name);})"
        ".map(function(r){return {n:r.name.slice(-30), ms:Math.round(r.duration), size:r.transferSize};}))"
    ),
)
time.sleep(20)
rows = json.loads(yt.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
where = {}
for r in rows:
    k = r.get("where", "page")
    where[k] = where.get(k, 0) + 1
print("verdicts:", len(rows), "where:", where)
print("in-page models:", yt.eval("JSON.stringify(window.__TS_GAZE_TIMING||{})"))
