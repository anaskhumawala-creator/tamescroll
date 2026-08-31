import json
from emu_cdp import page, Tab
t = Tab(page())
r = t.eval("(function(){try{return window.__TS_DIAG_NOW?window.__TS_DIAG_NOW():null}catch(e){return {err:String(e)}}})()")
if isinstance(r, dict):
    keep = {k: r.get(k) for k in ("player","video","gaze","timing","worker") if k in r}
    print(json.dumps(keep if keep else list(r.keys()), indent=1)[:1800])
else:
    print(r)
print("PERSONS:", t.eval("(function(){return window.__TS_GAZE_PERSONS})()"))
print("TIMING:", json.dumps(t.eval("(function(){return window.__TS_GAZE_TIMING||null})()"))[:600])
