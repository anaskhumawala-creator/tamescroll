import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
def diag():
    return t.eval("(function(){try{return window.__TS_DIAG_APP||null}catch(e){return null}})()")
for u,w in (("https://m.youtube.com/", 22),
            ("https://m.youtube.com/results?search_query=news", 22),
            ("https://m.youtube.com/watch?v=NWoT1ZVd1Lo", 26)):
    t.cmd("Page.navigate", url=u); time.sleep(w)
    d=diag() or {}
    print(u.split('/')[-1][:28] or 'home',
          json.dumps({k:d.get(k) for k in ("seen","blocked","rulesGen","otaLast","cssBytes","versionCode")}))
