# Served-codec read that does NOT depend on the codec probe winning its race
# against the first addSourceBuffer: the videoplayback requests carry
# `mime=video/<container>` and an `itag` -- NOT on m.youtube's SABR urls
# (measured: no mime/itag in the query). The read that works is the player's
# own `getVideoStats().fmt` itag: 394-399 = av01, 242-248 = vp09, 133-137 = avc1.
# Redmi 2026-09-03: base fmt 395 (av01 240p), NO_AV1 plant fmt 242 (vp9 240p).
#   python probe_served_codec.py <port> <label> [plantFile]
# One plant per process (see probe_drops_ab.py).
import json, os, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402
PORT = int(sys.argv[1]); LABEL = sys.argv[2]; PF = sys.argv[3] if len(sys.argv) > 3 else None
VIDEO = "NWoT1ZVd1Lo"
def plant(t):
    if PF: t.cmd("Page.enable"); t.cmd("Page.addScriptToEvaluateOnNewDocument", source=open(PF, encoding="utf-8").read())
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); plant(t)
if "tauri.localhost" not in (t.eval("location.href") or ""):
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6); t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); plant(t)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VIDEO); time.sleep(30)
t.eval("(function(){var v=document.querySelector('#movie_player video');v.muted=true;v.play();return 1;})()"); time.sleep(20)
raw = t.eval(r"""(function(){ var out={urls:[]}; performance.getEntriesByType('resource').forEach(function(e){ if(e.name.indexOf('videoplayback')>=0) out.urls.push(e.name); });
  out.noav1=window.__TS_NO_AV1; out.refused=window.__TS_AV1_REFUSED; out.plant=!!window.__TS_PLANT_noav1;
  var d=null; try{d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();}catch(e){} if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){}}
  out.codec=d&&d.player&&d.player.codec||d&&d.codec||null; try{var st=document.getElementById('movie_player').getVideoStats(); out.fmt=st.fmt; out.afmt=st.afmt;}catch(e){} var v=document.querySelector('#movie_player video'); out.vw=v&&v.videoWidth; return JSON.stringify(out); })()""")
o = json.loads(raw); seen = {}
for u in o["urls"]:
    q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    key = (q.get("mime", ["?"])[0], q.get("itag", ["?"])[0]); seen[key] = seen.get(key, 0) + 1
o["streams"] = [{"mime": k[0], "itag": k[1], "n": n} for k, n in seen.items()]; del o["urls"]
print("CODEC", json.dumps(o))
json.dump(o, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "servedcodec-%s.json" % LABEL), "w"))
