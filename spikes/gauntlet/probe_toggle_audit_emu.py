# A DEAD TOGGLE IS THIS REPO'S RECURRING FAILURE: a rule that works
# perfectly and a switch that cannot reach it (Home feed 2026-08-28,
# watch recommendations 2026-08-19). probe_surface_audit.py answers it,
# but only against the DESKTOP dev app -- which would put a feed on the
# owner's monitor. This asks the same question on the headless emulator.
#
# For every surface, on every page we can reach: how many elements do its
# mobile selectors match, and does flipping the switch change how many
# are visible?
import json, re, sys, time
from pathlib import Path
from emu_cdp import page, Tab

ROOT = Path(__file__).resolve().parents[2]
TEXT = (ROOT / "rules" / "youtube.txt").read_text(encoding="utf-8")

surfaces, cur = {}, None
for line in TEXT.splitlines():
    m = re.match(r"^!surface:\s*(\S+)\s+(.*)$", line)
    if m:
        cur = m.group(1); surfaces[cur] = {"label": m.group(2).strip(), "sel": []}
        continue
    if line.startswith("!") or not line.strip() or cur is None:
        continue
    if "##" in line:
        dom, sel = line.split("##", 1)
        if dom.strip() == "m.youtube.com":
            surfaces[cur]["sel"].append(sel.strip())

TOGGLEABLE = [k for k, v in surfaces.items() if v["sel"]]
PAGES = [("home", "https://m.youtube.com/"),
         ("search", "https://m.youtube.com/results?search_query=interview"),
         ("watch", "https://m.youtube.com/watch?v=NWoT1ZVd1Lo")]

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

def open_with(shown):
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',shown:%s});
      return 1;})()""" % json.dumps(shown))
    time.sleep(4)

COUNT = """(function(sels){
  var out={};
  sels.forEach(function(s){
    var n=0, vis=0;
    try{
      var els=document.querySelectorAll(s);
      n=els.length;
      for(var i=0;i<els.length;i++){
        var e=els[i];
        if(getComputedStyle(e).display!=='none' && e.getBoundingClientRect().height>0) vis++;
      }
    }catch(err){ out[s]={err:String(err).slice(0,40)}; return; }
    out[s]={n:n, vis:vis};
  });
  return out;})(%s)"""

result = {}
for state in ("shown", "hidden"):
    shown = TOGGLEABLE if state == "shown" else []
    open_with(shown)
    for pname, url in PAGES:
        t.cmd("Page.navigate", url=url)
        time.sleep(26 if pname != "watch" else 22)
        for sid in TOGGLEABLE:
            got = t.eval(COUNT % json.dumps(surfaces[sid]["sel"]))
            for sel, v in got.items():
                key = (sid, pname, sel)
                result.setdefault(str(key), {})[state] = v

# A selector is DEAD on a page if it matches elements and flipping the
# switch changes nothing about how many are visible.
dead, live, never = [], [], []
for k, v in result.items():
    s = v.get("shown", {}); h = v.get("hidden", {})
    if s.get("err") or h.get("err"):
        dead.append({"k": k, "err": s.get("err") or h.get("err")}); continue
    if not s.get("n"):
        never.append(k); continue
    if s.get("vis", 0) > 0 and h.get("vis", 0) == 0:
        live.append({"k": k, "shownVis": s["vis"], "hiddenVis": h["vis"]})
    elif s.get("vis", 0) == h.get("vis", 0):
        dead.append({"k": k, "shownVis": s.get("vis"), "hiddenVis": h.get("vis"), "n": s.get("n")})
    else:
        live.append({"k": k, "shownVis": s.get("vis"), "hiddenVis": h.get("vis")})
print(json.dumps({"surfaces": TOGGLEABLE,
                  "LIVE_TOGGLES": live,
                  "DEAD_TOGGLES": dead,
                  "matched_nothing_anywhere": len(never)}, indent=1))
