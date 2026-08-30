import json, time
from gauntlet import pick, targets
def ptab():
    for t in targets():
        u=t.get("url","")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u: continue
        if u.startswith("http"): return pick(u)
    raise SystemExit("no platform window")
tab=ptab()
for url in ["https://www.reddit.com/r/pics/", "https://www.youtube.com/", "https://www.reddit.com/r/all/"]:
    tab.eval("location.href=%r" % url)
    time.sleep(14)
    print(url, tab.eval("JSON.stringify(window.__TS_DIAG_APP)"))
