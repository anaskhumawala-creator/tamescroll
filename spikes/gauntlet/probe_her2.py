# THE SECOND DELAY, the one the gate change does not touch.
#
# With MoveNet admitting people (slots non-zero, faceNoShape 0) she is
# still read female and still uncovered: 7 of 16 reads with no patch,
# latP90 12.9s. The gate is not firing there, so something else is
# holding her sharp.
#
# HYPOTHESIS TO KILL OR CONFIRM: her reads are WEAK (scoreP50 0.31, 7 of
# 16 under GENDER_MIN_SCORE) and a track CLEARED on somebody else
# absorbs an uncertain read for CLEARED_TTL_MS. If she re-associates onto
# a track cleared on the man beside her, every weak female read is
# absorbed and she stays sharp.
#
# So this joins the reads ring to the per-pass TRACK STATE ring, which
# nothing has done before: for each female read with no patch, what were
# the track states at that moment.
#
# RETRACTION CARRIED FORWARD: probe_her's `herNoTrackAtAll` is NOT a
# distinct signal. __TS_GAZE_VTRACKS reports the RENDERER's entries, so
# it only ever sees blurred tracks -- "no track" there was just "nothing
# covered" restated. Fixed here by reading videoTracks' own state ring.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 150
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 220

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)

print("ARM", t.eval("""(function(){
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  window.__TS_H2={reads:[],tracks:[],stop:0};
  var seenR=0, seenT=0;
  (function loop(){
    var st=window.__TS_H2; if(st.stop) return;
    try{
      var d=window.__TS_GAZE_IDS||{};
      var now=Math.round(performance.now());
      var np=document.querySelectorAll('.ts-gaze-vregion-host').length;
      var r=d.reads||[];
      if(r.length>seenR){
        for(var i=seenR;i<r.length;i++){
          var e=r[i]||{};
          st.reads.push({ms:now,g:e.g,s:e.s,a:e.a,px:e.px,ab:e.ab,n:e.n,patches:np});
        }
        seenR=r.length;
      } else if(r.length<seenR){ seenR=r.length; }
      var tk=d.tracks||[];
      if(tk.length>seenT){
        for(var j=seenT;j<tk.length;j++){
          var snap=tk[j]||[];
          st.tracks.push({ms:now,patches:np,
            n:snap.length,
            states:snap.map(function(x){return x.st;}),
            cs:snap.map(function(x){return x.cs;}),
            fs:snap.map(function(x){return x.fs;}),
            ca:snap.map(function(x){return x.ca;})});
        }
        seenT=tk.length;
      } else if(tk.length<seenT){ seenT=tk.length; }
    }catch(e){}
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:v?Math.round(v.currentTime):null,
    bundle:window.__TS_GAZE_BUNDLE__});})()""" % SEEK))

time.sleep(DWELL)

raw = t.eval("""(function(){
  var st=window.__TS_H2||{}; st.stop=1;
  var d=window.__TS_GAZE_IDS||{};
  return JSON.stringify({reads:st.reads||[],tracks:st.tracks||[],
    life:d.life, passes:d.passesTotal,
    slots:(d.slots||[]).map(function(s){return s.n;})});})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
reads = d.get("reads", [])
snaps = d.get("tracks", [])
fem = [r for r in reads if r.get("g") == "female"]
unc = [r for r in fem if not r.get("patches")]


def snap_at(ms):
    # The snapshot taken at or just after this read -- the tracker runs
    # once per pass, AFTER every person in it has been observed, so the
    # state that acted on this read is the next one recorded.
    return next((s for s in snaps if s["ms"] >= ms), None)


rows = []
for r in unc:
    s = snap_at(r["ms"])
    rows.append({
        "s": r.get("s"), "px": r.get("px"), "n": r.get("n"),
        "trk": s["n"] if s else None,
        "states": s["states"] if s else None,
        "cs": s["cs"] if s else None,
        "ca": s["ca"] if s else None,
    })

clearedPresent = sum(1 for x in rows if x["states"] and "cleared" in x["states"])
noTrack = sum(1 for x in rows if x["trk"] == 0)
print("SECOND_DELAY", json.dumps({
    "reads": len(reads), "female": len(fem), "femaleUncovered": len(unc),
    "uncoveredWithClearedTrack": clearedPresent,
    "uncoveredWithNoTrackAtAll": noTrack,
    "uncoveredOther": len(rows) - clearedPresent - noTrack,
    "scores": sorted([x["s"] for x in rows if x["s"] is not None]),
}))
print("ROWS", json.dumps(rows[:14]))
print("LIFE", json.dumps({"life": d.get("life"), "passes": d.get("passes"),
                          "slotsNonZero": sum(1 for s in d.get("slots", []) if s)}))
