import time
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab=pick(u); break
print("before clear:", tab.eval("innerWidth+'x'+innerHeight+' outer='+outerWidth"))
tab.cmd("Emulation.clearDeviceMetricsOverride")
time.sleep(1)
print("after clear :", tab.eval("innerWidth+'x'+innerHeight+' outer='+outerWidth"))
