"""Dropped frames, OFF vs SMART, same video/seek/duration, on the device.
Reads video.getVideoPlaybackQuality() (decoder/compositor drops) plus the
renderer's rAF rate, so our share of the drops he sees in Stats for nerds
is measured rather than guessed.

    python probe_drops_ab.py <port> <label> [secs] [videoId] [seekTo]
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1]); LABEL = sys.argv[2]
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 120.0
VIDEO = sys.argv[4] if len(sys.argv) > 4 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[5]) if len(sys.argv) > 5 else 55.0
# TS_ARMS: comma list of mode[:plantFile]; a plant pins window.__TS_GAZE_TUNING__
# on every new document (same mechanism as probe_events.py TS_PLANT_FILE).
# ONE PLANTED ARM PER PROCESS. Page.addScriptToEvaluateOnNewDocument lives
# for the CDP session that added it, and Tab() never closes the previous
# socket, so a second planted arm in the same run gets BOTH plants -- the
# first (non-configurable) wins and the second arm silently measures the
# first (v1097-decomp: the duty4 and both arms were delay0 arms). Run
# TS_ARMS with at most one plant per invocation.
ARMS = [a.split(":", 1) for a in (os.environ.get("TS_ARMS") or "smart,off").split(",")]

Q = r"""(function(){ var v=document.querySelector('#movie_player video')||document.querySelector('video'); if(!v) return null;
  var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{}; var rs=null; try{rs=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null;}catch(e){}
  var mp=document.getElementById('movie_player'); var ds=null; try{ds=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;}catch(e){}
  var st=ds&&ds.stats||{};
  return JSON.stringify({cap:st.captured,pres:st.presented,late:st.late,delayMs:ds?ds.delayMs:null,t:v.currentTime, dropped:q.droppedVideoFrames, total:q.totalVideoFrames, vw:v.videoWidth, vh:v.videoHeight, paused:v.paused,
    raf:rs?rs.raf:null, q:mp&&mp.getPlaybackQuality?mp.getPlaybackQuality():null, now:performance.now()}); })()"""

def plant(t, f):
    if f:
        t.cmd("Page.enable"); t.cmd("Page.addScriptToEvaluateOnNewDocument", source=open(f, encoding="utf-8").read())

def arm(mode, pf=None):
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); plant(t, pf)
    if "tauri.localhost" not in (t.eval("location.href") or ""):
        t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
        t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'%s',strength:24,gender:'man',shown:['watch_recs']}); return 1;})()""" % mode)
    time.sleep(7)
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); plant(t, pf)
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VIDEO)
    time.sleep(30)
    t.eval("(function(){var v=document.querySelector('#movie_player video');v.muted=true;v.currentTime=%f;v.play();return 1;})()" % SEEK)
    time.sleep(8)  # let the seek settle and the delay ring refill before the window opens
    a = json.loads(t.eval(Q)); time.sleep(SECS); b = json.loads(t.eval(Q))
    out = {"mode": mode, "plant": pf, "delayMs": b.get("delayMs"), "captured": (b.get("cap") or 0) - (a.get("cap") or 0), "presented": (b.get("pres") or 0) - (a.get("pres") or 0), "late": (b.get("late") or 0) - (a.get("late") or 0), "bundle": t.eval("window.__TS_GAZE_BUNDLE__"), "gazeMode": t.eval("window.__TS_GAZE_MODE"),
           "vw": b["vw"], "q": b["q"], "mediaSecs": round(b["t"] - a["t"], 2), "wallSecs": round((b["now"] - a["now"]) / 1000, 2),
           "dropped": b["dropped"] - a["dropped"], "total": b["total"] - a["total"],
           "rafHz": round((b["raf"] - a["raf"]) / ((b["now"] - a["now"]) / 1000), 1) if a["raf"] is not None and b["raf"] is not None else None}
    out["dropPct"] = round(100.0 * out["dropped"] / out["total"], 2) if out["total"] else None
    print("ARM", json.dumps(out)); return out

res = [arm(a[0], a[1] if len(a) > 1 and a[1] else None) for a in ARMS]
json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "drops-%s.json" % LABEL), "w"))
