# The in-player tuning panel (1099): is the gear beside the pill, does a
# tap open the panel, does it list every dial, does an override persist
# across a reload, does Reset put it back.
#   python probe_tune_overlay.py <port>
# Assumes the app is on a watch page in smart mode (run after
# probe_drops_ab or drive it there first).
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402
PORT = int(sys.argv[1])
t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
if "/watch" not in (t.eval("location.href") or ""):
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(12)
    t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
J = lambda s: t.eval("JSON.stringify(" + s + ")")
def state():
    return json.loads(J(r"""(function(){var g=document.querySelector('.ts-gaze-gear'),p=document.querySelector('.ts-gaze-pill'),o=document.querySelector('.ts-gaze-tune');
      function r(e){if(!e)return null;var b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)];}
      var vis=o?getComputedStyle(o).display!=='none'&&o.getBoundingClientRect().height>0:false;
      var hit=g?document.elementFromPoint(g.getBoundingClientRect().left+g.getBoundingClientRect().width/2,g.getBoundingClientRect().top+g.getBoundingClientRect().height/2):null;
      return {gear:r(g),pill:r(p),panel:r(o),panelVisible:vis,gearHit:hit?(hit===g||g.contains(hit)):null,gearParent:g?g.parentElement.id||g.parentElement.tagName:null,
        rows:o?o.querySelectorAll('input,select,button').length:0,keys:o?Array.prototype.map.call(o.querySelectorAll('button'),function(e){return e.textContent.trim().slice(0,24)}):[],
        text:o?o.innerText.slice(0,600):null,ls:localStorage.getItem('tamescroll.tuning')};})()"""))
s0 = state(); print("BEFORE", json.dumps({k: s0[k] for k in ("gear", "pill", "panel", "panelVisible", "gearHit", "gearParent")}))
# tap the gear with a real click
t.eval("document.querySelector('.ts-gaze-gear').click()"); time.sleep(0.5)
s1 = state(); print("OPEN", json.dumps({k: s1[k] for k in ("panel", "panelVisible", "rows", "keys")}))
print("TEXT", (s1["text"] or "").replace("\n", " | ")[:600])
json.dump({"before": s0, "open": s1}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "tune-overlay-1099.json"), "w"))
