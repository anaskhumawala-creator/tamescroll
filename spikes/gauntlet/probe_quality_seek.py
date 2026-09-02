"""Owner report 2026-09-02 night: after changing the stream quality and
seeking BACK on the timeline, one patch froze at one position and never
moved again. Reproduce on the device and watch every layer per second:
live media time (vt), presented media time (pm), newest timeline
snapshot (lm), passes, render loop, patches.

    python probe_quality_seek.py <port> <label> [videoId] [seekTo]
Timeline: t0 play at seekTo; t20 quality -> hd720; t40 seek back 25s;
t60 quality -> small; t80 seek back 20s; t100 stop.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1]); LABEL = sys.argv[2]
VIDEO = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[4]) if len(sys.argv) > 4 else 55.0
GENDER = os.environ.get("TS_GENDER", "man")

SAMPLE = r"""(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var d=window.__TS_GAZE_IDS||{}; var ds=null,rs=null,vt=null;
  try{ ds=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;}catch(e){}
  try{ rs=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null;}catch(e){}
  try{ vt=window.__TS_GAZE_VTRACKS?window.__TS_GAZE_VTRACKS():null;}catch(e){}
  var vr=v?v.getBoundingClientRect():null; var p=[];
  var nodes=document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for(var i=0;i<nodes.length;i++){ var n=nodes[i]; if(getComputedStyle(n).display==='none') continue;
    var r=n.getBoundingClientRect(); if(r.width<1||!vr) continue;
    p.push([(r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,(r.right-vr.left)/vr.width,(r.bottom-vr.top)/vr.height].map(function(x){return Math.round(x*100)/100;})); }
  var st=ds&&ds.stats||{};
  var mp=document.getElementById('movie_player');
  return JSON.stringify({vt:v?Math.round(v.currentTime*100)/100:null, vw:v?v.videoWidth:null, vh:v?v.videoHeight:null, paused:v?v.paused:null,
    pm:ds&&ds.presentedMediaTime!=null?Math.round(ds.presentedMediaTime*100)/100:null,
    lm:ds&&ds.snapshots?Math.round(ds.snapshots.mediaTime*100)/100:null, nlm:ds&&ds.snapshots?ds.snapshots.tracks.length:null,
    late:st.late, ring:st.ring, flushes:st.flushes, refills:st.refills, cap:st.captured,
    raf:rs?rs.raf:null, rerr:rs?rs.repositionErrors:null, tf:rs?rs.timelineFallback:null,
    passes:d.passesTotal, verdicts:d.verdictsTotal, vtr:vt&&vt.tracks?vt.tracks.length:(vt&&vt.length),
    p:p, q:mp&&mp.getPlaybackQuality?mp.getPlaybackQuality():null});
})()"""

def quality(t, q):
    return t.eval("""(function(){ var mp=document.getElementById('movie_player'); if(!mp||!mp.setPlaybackQualityRange) return 'noapi';
      try{ mp.setPlaybackQualityRange('%s','%s'); return 'ok:'+mp.getPlaybackQuality(); }catch(e){ return 'err:'+e; } })()""" % (q, q))

def main():
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    if "tauri.localhost" not in (t.eval("location.href") or ""):
        t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
        t = Tab(page(port=PORT)); t.cmd("Runtime.enable")
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',shown:['watch_recs']}); return 1;})()""" % GENDER)
    time.sleep(7)
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VIDEO)
    time.sleep(30)
    print("bundle", t.eval("window.__TS_GAZE_BUNDLE__"))
    t.eval("(function(){var v=document.querySelector('#movie_player video');v.muted=true;v.currentTime=%f;v.play();return 1;})()" % SEEK)
    rows = []
    t0 = time.time()
    events = {20: ("quality", "hd720"), 40: ("seek", -25), 60: ("quality", "small"), 80: ("seek", -20)}
    done = set()
    while time.time() - t0 < 100:
        el = int(time.time() - t0)
        for k, (kind, arg) in events.items():
            if el >= k and k not in done:
                done.add(k)
                if kind == "quality":
                    print("EVENT t%d quality %s -> %s" % (el, arg, quality(t, arg)))
                else:
                    print("EVENT t%d seek %+d -> %s" % (el, arg, t.eval("(function(){var v=document.querySelector('#movie_player video');v.currentTime=v.currentTime+(%d);return v.currentTime;})()" % arg)))
        s = t.eval(SAMPLE)
        try:
            o = json.loads(s) if isinstance(s, str) else s
        except Exception:
            o = {"raw": s}
        o["t"] = el; rows.append(o)
        print(json.dumps(o))
        time.sleep(1)
    json.dump(rows, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "qseek-%s.json" % LABEL), "w"))

main()
