from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
print(tab.eval("JSON.stringify((window.__TS_GAZE_IMGDIAG||[]).slice(-6))"))
