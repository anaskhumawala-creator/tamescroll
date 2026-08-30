import time, json, collections
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=podcast+interview'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.cmd("Profiler.enable")
tab.cmd("Profiler.setSamplingInterval", interval=200)
tab.cmd("Profiler.start")
for i in range(10):
    tab.eval("window.scrollBy(0,700);")
    time.sleep(1.0)
r = tab.cmd("Profiler.stop")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
prof = r["profile"]
nodes = {n["id"]: n for n in prof["nodes"]}
self_hits = collections.Counter()
for nid in prof.get("samples", []):
    self_hits[nid] += 1
total = sum(self_hits.values()) or 1
rows = []
for nid, c in self_hits.most_common(25):
    f = nodes[nid]["callFrame"]
    url = f.get("url") or ""
    tag = "OURS" if ("tauri.localhost" in url or url == "" and f.get("functionName","").startswith("ts") ) else ""
    rows.append((round(100.0*c/total,1), f.get("functionName") or "(anon)", url.split('/')[-1][:38], nodes[nid].get("hitCount",c)))
for r_ in rows[:22]:
    print(r_)
