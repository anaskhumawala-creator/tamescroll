"""Latency A/B on a real arm64 device (plan 2026-09-02, Task 5 / Task 11).

    python probe_latency_ab.py <cdpPort> <label> [secs] [videoId] [seekTo]

Drives the app through its REAL path (launcher -> open_platform man/smart
-> watch page), then samples for `secs`:
  - verdict / position pass counts and p50 costs from __TS_GAZE_IDS.stages
    (first-seen tagging: the ring saturates, so a diff of lengths is the
    fill, not the rate -- loop 29)
  - rAF Hz and the fraction of frames with a patch up, in page
  - life counters that name the mechanism (positionPassSkipped,
    genderReadSkipped, personPassSkipped, coastExpired, birthFresh,
    delayVerdictLate)
  - when the delay presenter is live (__TS_DELAY_STATS), its stats too.
Banks to latency-ab-<label>.json beside this file.
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
LABEL = sys.argv[2] if len(sys.argv) > 2 else "unlabelled"
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 150.0
VIDEO = sys.argv[4] if len(sys.argv) > 4 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[5]) if len(sys.argv) > 5 else 55.0
HERE = os.path.dirname(os.path.abspath(__file__))


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(6)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(26)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(12)
    pre = t.eval("(function(){var v=document.querySelector('video');return JSON.stringify({paused:v.paused,t:v.currentTime,w:v.videoWidth,h:v.videoHeight,bundle:window.__TS_GAZE_BUNDLE__,mode:window.__TS_GAZE_MODE})})()")
    print("pre", pre)
    t.eval("""(function(){
      var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[]; for(var i=0;i<r.length;i++) r[i].__seen=1;
      var life=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{};
      var st={v:0,p:0,vms:[],pms:[],t0:performance.now(),stopped:false,raf:0,cov:0,frames:0,
              vAt:[],life0:JSON.parse(JSON.stringify(life))};
      (function raf(){ if(st.stopped) return; st.raf++;
        var hosts=document.querySelectorAll('.ts-gaze-vregion-clip > *');
        var up=0; for(var i=0;i<hosts.length;i++){ if(getComputedStyle(hosts[i]).display!=='none') up++; }
        if(up) st.cov++; st.frames++; requestAnimationFrame(raf); })();
      var iv=setInterval(function(){
        var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[];
        for(var i=0;i<r.length;i++){ var e=r[i]; if(!e||e.__seen) continue; e.__seen=1;
          if(e.v){ st.v++; if(typeof e.end==='number'){ st.vms.push(Math.round(e.end)); } st.vAt.push(Math.round(performance.now()-st.t0)); }
          else { st.p++; if(typeof e.end==='number') st.pms.push(Math.round(e.end)); } }
      },200);
      window.__TS_LAT=function(){ clearInterval(iv); st.stopped=true;
        st.secs=(performance.now()-st.t0)/1000;
        st.rafHz=Math.round(st.raf/st.secs*10)/10;
        st.coverage=Math.round(st.cov/Math.max(1,st.frames)*1000)/1000;
        st.life=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{};
        st.tuning=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.tuning)||null;
        st.slots=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.slots||[]).slice(-3);
        st.delay=window.__TS_DELAY_STATS?window.__TS_DELAY_STATS():null;
        var v=document.querySelector('video'); st.video={paused:v.paused,t:v.currentTime,w:v.videoWidth,h:v.videoHeight};
        return JSON.stringify(st);};
      return 'started';})()""")
    time.sleep(SECS)
    raw = t.eval("(function(){return window.__TS_LAT?window.__TS_LAT():'{}';})()")
    st = json.loads(raw) if isinstance(raw, str) else (raw or {})
    gaps = [b - a for a, b in zip(st.get("vAt", []), st.get("vAt", [])[1:])]
    life0 = st.get("life0", {})
    life = st.get("life", {})
    dl = {k: life.get(k, 0) - life0.get(k, 0) for k in
          ("positionPassSkipped", "genderReadSkipped", "personPassSkipped", "coastExpired", "cutCoastExpired",
           "birthFresh", "birthBlurred", "delayVerdictLate", "faceNoShape", "passDropped", "wipeErasedBlurred", "cutDetected")}
    out = {
        "label": LABEL, "video": VIDEO, "seek": SEEK, "secs": round(st.get("secs", 0), 1),
        "bundle": json.loads(pre).get("bundle") if isinstance(pre, str) else None,
        "verdicts": st.get("v"), "positions": st.get("p"),
        "verdictMsP50": pct(st.get("vms", []), 0.5), "verdictMsP95": pct(st.get("vms", []), 0.95),
        "positionMsP50": pct(st.get("pms", []), 0.5),
        "verdictGapP50": pct(gaps, 0.5), "verdictGapP95": pct(gaps, 0.95),
        "secsPerVerdict": round(st.get("secs", 0) / max(1, st.get("v", 0)), 2),
        "rafHz": st.get("rafHz"), "coverage": st.get("coverage"),
        "lifeDelta": dl, "tuning": (st.get("tuning") or {}).get("applied"),
        "coastMs": (st.get("tuning") or {}).get("coastMs"), "toldMs": (st.get("tuning") or {}).get("toldMs"),
        "slotsN": [s.get("n") for s in st.get("slots", [])], "delay": st.get("delay"), "video_state": st.get("video"),
    }
    with open(os.path.join(HERE, "latency-ab-%s.json" % LABEL), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
