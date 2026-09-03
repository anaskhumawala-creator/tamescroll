# The panel's auto test, driven end to end on a device (1100): open the
# panel, press "Test modes on this video", then follow the run across its
# reloads (one arm per document) by polling sessionStorage
# 'tamescroll.autotest' + localStorage 'tamescroll.autotest.results'
# through a fresh CDP tab each tick. Prints every state change and the
# final result rows; banks autotest-<label>.json.
#   python probe_autotest.py <port> <label> [maxSecs=480]
import json, os, sys, time, traceback
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402
PORT = int(sys.argv[1]); LABEL = sys.argv[2]; MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 480
def tab():
    t = Tab(page(port=PORT)); t.cmd("Runtime.enable"); return t
t = tab()
if "/watch" not in (t.eval("location.href") or ""):
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(12); t = tab()
R = r"""(function(){var o={href:location.href,t:(document.querySelector('#movie_player video')||{}).currentTime||null};
 try{o.run=sessionStorage.getItem('tamescroll.autotest');}catch(e){o.run='ERR'} try{o.res=localStorage.getItem('tamescroll.autotest.results');}catch(e){o.res='ERR'}
 var p=document.querySelector('.ts-gaze-tune'); o.panel=!!p; o.testText=p?Array.prototype.map.call(p.querySelectorAll('button'),function(b){return b.textContent.trim()}).filter(function(s){return /test|Stop/i.test(s)}):[];
 return JSON.stringify(o);})()"""
s = json.loads(t.eval(R)); print("START", json.dumps({k: s[k] for k in ("href", "run", "panel", "testText")}))
before_rows = len(json.loads(s["res"] or "[]")) if s["res"] not in (None, "ERR") else 0
if not s["panel"]:
    t.eval("document.querySelector('.ts-gaze-gear').click()"); time.sleep(0.5)
clicked = t.eval(r"""(function(){var b=Array.prototype.filter.call(document.querySelectorAll('.ts-gaze-tune button'),function(b){return /Test modes/.test(b.textContent)})[0]; if(!b) return 'NO BUTTON'; b.click(); return 'clicked: '+b.textContent.trim();})()""")
print("PRESS", clicked)
t0 = time.time(); last = None; ticks = []
while time.time() - t0 < MAX:
    time.sleep(10)
    try:
        s = json.loads(tab().eval(R))
        key = (s["run"], s["href"][:60])
        rows = json.loads(s["res"] or "[]") if s["res"] not in (None, "ERR") else []
        if key != last:
            print("T+%3d run=%s rows=%d t=%s" % (time.time() - t0, (s["run"] or "none")[:120], len(rows), s["t"]))
            last = key
        ticks.append({"at": round(time.time() - t0, 1), "run": s["run"], "rows": len(rows), "t": s["t"]})
        if s["run"] in (None, "null") and len(rows) > before_rows and time.time() - t0 > 60: break
    except Exception:
        print("tick err", traceback.format_exc().splitlines()[-1][:160]); continue
final = json.loads(tab().eval(R))
rows = json.loads(final["res"] or "[]") if final["res"] not in (None, "ERR") else []
print("ROWS", json.dumps(rows[-6:]))
json.dump({"label": LABEL, "ticks": ticks, "rows": rows}, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "autotest-%s.json" % LABEL), "w"))
