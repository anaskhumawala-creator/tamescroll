# INSTAGRAM HAS NEVER BEEN AUDITED ON THE EMULATOR. Same question as the
# YouTube toggle audit: for every surface, do its selectors match
# anything on a page we can reach, and does the switch actually change
# what is visible? A rule that works with a switch that cannot reach it
# is this repo's recurring failure.
#
# Instagram /explore/ renders signed out under a mobile UA (verified
# 2026-08-28), so this is reachable without a login.
import json, re, time
from pathlib import Path
from emu_cdp import page, Tab
ROOT = Path(__file__).resolve().parents[2]
TEXT = (ROOT / "rules" / "instagram.txt").read_text(encoding="utf-8")
surfaces, cur = {}, None
for line in TEXT.splitlines():
    m = re.match(r"^!surface:\s*(\S+)\s+(.*)$", line)
    if m:
        cur = m.group(1); surfaces[cur] = {"label": m.group(2).strip(), "sel": []}
        continue
    if line.startswith("!") or not line.strip() or cur is None: continue
    if "##" in line:
        dom, sel = line.split("##", 1)
        surfaces[cur]["sel"].append(sel.strip())
TOGGLEABLE = [k for k,v in surfaces.items() if v["sel"]]

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
def open_with(shown):
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'instagram',mode:'smart',strength:24,gender:'man',
                                 shown:%s}); return 1;})()""" % json.dumps(shown))
    time.sleep(5)

COUNT = """(function(sels){
  var out={};
  sels.forEach(function(s){
    var n=0, vis=0;
    try{ var els=document.querySelectorAll(s); n=els.length;
      for(var i=0;i<els.length;i++){ var r=els[i].getBoundingClientRect();
        if(r.width>0&&r.height>0&&getComputedStyle(els[i]).display!=='none') vis++; }
    }catch(e){ out[s]={err:String(e).slice(0,40)}; return; }
    out[s]={n:n, visible:vis};});
  return {counts:out, imgs:document.images.length,
    articles:document.querySelectorAll('article').length,
    sheet:(function(){var s=document.getElementById('tamescroll-rules');
      return s?s.textContent.length:0;})(),
    path:location.pathname};})"""

PAGES=[("explore","https://www.instagram.com/explore/")]
res={}
for shown_label, shown in (("hidden", []), ("shown", TOGGLEABLE)):
    open_with(shown)
    for name,url in PAGES:
        t.cmd("Page.navigate", url=url); time.sleep(24)
        for sid in TOGGLEABLE:
            r=t.eval("(%s)(%s)" % (COUNT, json.dumps(surfaces[sid]["sel"])))
            res.setdefault(sid, {}).setdefault(name, {})[shown_label]=r
print(json.dumps({"surfaces":{k:surfaces[k]["label"] for k in TOGGLEABLE},
                  "result":res}, indent=1))
