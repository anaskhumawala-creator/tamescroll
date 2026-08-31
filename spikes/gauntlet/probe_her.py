# "LINUS DAUGHTER IS NOT BEING BLURRED INSTANTLY", with ground truth for
# WHEN SHE IS ON SCREEN.
#
# probe_instant measured uncovered gaps and found six of them, median
# 10s -- but on a video that is mostly one man, an uncovered frame is
# usually CORRECT, so that number cannot tell his complaint from the
# app working. This one uses the pipeline's own reads as the ground
# truth it already has: a read that comes back FEMALE, or CHILD by age,
# is the app itself saying she is in this frame.
#
# Then the number he is reporting is the delay between that read and a
# patch existing.
#
# Collected IN PAGE: the reads ring carries no clock, so new entries are
# stamped as they appear, at rAF rate. A CDP poll here is ~1s and would
# round the very quantity being measured.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 110
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
  var d=(window.__TS_GAZE_IDS=window.__TS_GAZE_IDS||{});
  window.__TS_HER={reads:[],frames:[],stop:0};
  var seen=0;
  (function loop(){
    var st=window.__TS_HER;
    if(st.stop) return;
    try{
      var vv=document.querySelector('#movie_player video')||document.querySelector('video');
      var now=Math.round(performance.now());
      var np=document.querySelectorAll('.ts-gaze-vregion-host').length;
      var nt=0, nb=0;
      try{ var ee=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
        if(ee&&ee.length) ee.forEach(function(en){ nt+=(en.tracks||[]).length; });
      }catch(e2){}
      nb=np;
      if(vv) st.frames.push([now,np,+vv.currentTime.toFixed(2),vv.paused?1:0,nt]);
      // NEW reads only. The ring is capped, so once it saturates its
      // length stops changing -- track the tail identity too, which is
      // the same saturation defect that made `player.passes` lie.
      var r=(window.__TS_GAZE_IDS||{}).reads||[];
      if(r.length>seen){
        for(var i=seen;i<r.length;i++){
          var e=r[i]||{};
          st.reads.push({ms:now,g:e.g,s:e.s,a:e.a,px:e.px,ab:e.ab,
                         patches:np,tracks:nt,
                         t:vv?+vv.currentTime.toFixed(2):null});
        }
        seen=r.length;
      } else if (r.length<seen) { seen=r.length; }
      if(st.frames.length>20000) st.stop=1;
    }catch(e){}
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:v?Math.round(v.currentTime):null,
    bundle:window.__TS_GAZE_BUNDLE__});})()""" % SEEK))

time.sleep(DWELL)

raw = t.eval("""(function(){
  var st=window.__TS_HER||{}; st.stop=1;
  var d=window.__TS_GAZE_IDS||{};
  return JSON.stringify({reads:st.reads||[],frames:st.frames||[],
    life:d.life, passes:d.passesTotal, verdicts:d.verdictsTotal,
    slots:(d.slots||[]).map(function(s){return s.n;})});})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
reads = d.get("reads", [])
frames = d.get("frames", [])


def is_her(r):
    # PROBE BUG, FIXED, and it invented fifteen children: an ABSTAINED
    # read returns {gender:'unknown', score:0, age:0}, so `age < 18` was
    # counting every face under FACE_MIN_NATIVE_PX as a child. Age 0 is
    # "no age was read", not a zero-year-old. A child read has to carry
    # a real gender to be a read at all.
    if r.get("g") not in ("male", "female"):
        return None
    a = r.get("a")
    if isinstance(a, (int, float)) and 0 < a < 18:
        return "child"
    if r.get("g") == "female":
        return "female"
    return None


hers = [r for r in reads if is_her(r)]
# Latency: from a her-read landing to the next frame with a patch.
lat = []
for r in hers:
    if r.get("patches"):
        lat.append(0)
        continue
    nxt = next((f for f in frames if f[0] >= r["ms"] and f[1] > 0), None)
    lat.append(nxt[0] - r["ms"] if nxt else None)
res = [x for x in lat if isinstance(x, int)]
res.sort()


def pct(a, q):
    return a[min(len(a) - 1, round((len(a) - 1) * q))] if a else None


print("READS", json.dumps({
    "reads": len(reads), "her": len(hers),
    "child": sum(1 for r in hers if is_her(r) == "child"),
    "female": sum(1 for r in hers if is_her(r) == "female"),
    "herCoveredAtRead": sum(1 for r in hers if r.get("patches")),
    "herTrackedButUnpatched": sum(1 for r in hers if not r.get("patches") and r.get("tracks")),
    "herNoTrackAtAll": sum(1 for r in hers if not r.get("patches") and not r.get("tracks")),
    "scoreP50": sorted([r.get("s") or 0 for r in hers])[len(hers)//2] if hers else None,
    "belowMinScore": sum(1 for r in hers if (r.get("s") or 0) < 0.25),
    "herUncoveredAtRead": sum(1 for r in hers if not r.get("patches")),
    "latP50": pct(res, 0.5), "latP90": pct(res, 0.9),
    "latMax": res[-1] if res else None,
    "neverCovered": sum(1 for x in lat if x is None),
}))
print("HER_SAMPLE", json.dumps(hers[:20]))
print("LIFE", json.dumps({"life": d.get("life"), "passes": d.get("passes"),
                          "verdicts": d.get("verdicts"),
                          "slotsNonZero": sum(1 for s in d.get("slots", []) if s)}))
