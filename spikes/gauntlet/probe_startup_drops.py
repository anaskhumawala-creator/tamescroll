# Startup lag: dropped frames per 5s window over the first 60s of a video
# opened right after a cold app launch, plus when native came alive.
#   python probe_startup_drops.py <port> <label>
# Caller launches the app fresh (and clears code_cache/tflite-gpu for the
# cold-cache arm) before running this.
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402
PORT = int(sys.argv[1]); LABEL = sys.argv[2]; VIDEO = "NWoT1ZVd1Lo"
t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
if "tauri.localhost" not in (t.eval("location.href") or ""):
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6); t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
t.eval("""(async function(){var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
t0 = time.time(); t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VIDEO)
Q = r"""(function(){var v=document.querySelector('#movie_player video'); if(!v) return null; var q=v.getVideoPlaybackQuality();
 var d=null; try{d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();}catch(e){} if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){}}
 var life=d&&d.player&&d.player.life||{}; var nat=d&&d.native||{};
 return JSON.stringify({t:v.currentTime,paused:v.paused,rs:v.readyState,dropped:q.droppedVideoFrames,total:q.totalVideoFrames,nativePasses:life.nativePasses||0,backend:nat.nativeBackend||null,worker:(d&&d.worker&&d.worker.backend)||null});})()"""
rows = []; prev = None; playing_since = None
while time.time() - t0 < 95:
    time.sleep(2.5)
    try: s = t.eval(Q)
    except Exception: continue
    if not s: continue
    r = json.loads(s); now = round(time.time() - t0, 1)
    if playing_since is None and not r["paused"] and r["t"] > 0.5: playing_since = now
    if playing_since is not None and r.get("total"):
        if prev and now - prev["now"] >= 4.9:
            rows.append({"since": round(now - playing_since, 1), "dropped": r["dropped"] - prev["dropped"], "total": r["total"] - prev["total"], "nativePasses": r["nativePasses"], "backend": r["backend"]})
            prev = {"now": now, "dropped": r["dropped"], "total": r["total"]}
        elif not prev: prev = {"now": now, "dropped": r["dropped"], "total": r["total"]}
    if playing_since is not None and now - playing_since > 60: break
out = {"label": LABEL, "playingAt": playing_since, "rows": rows}
print("STARTUP", json.dumps(out))
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "startup-%s.json" % LABEL), "w"))
