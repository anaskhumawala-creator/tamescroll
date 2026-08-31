# THE SAME QUERY, ON A POPULATION BIG ENOUGH TO SETTLE IT.
#
# The player ring gives ~1 null read per 40s. The IMAGE ring gives one
# per thumbnail face, and a search feed produces hundreds -- and it is
# the surface where non-faces (logos, graphics, text cards) abound,
# which is exactly the population isNullRead exists to catch.
#
# The image ring does not carry the raw sigmoid, so isNullRead is
# RECONSTRUCTED: detector.js computes score = min(0.99, 2*|raw - 0.5|),
# so for a MALE label raw = 0.5 + s/2 and the shipped band
# [NULL_V_LO 0.53, NULL_V_HI 0.72] is exactly s in [0.06, 0.44].
# `s` is rounded to 2dp in the ring, so raw is recovered to +-0.005
# against a band 0.19 wide. Reads at s >= 0.99 are dropped: the clamp
# in detector.js makes raw unrecoverable there (and they are far outside
# the band either way).
import json, sys, time
from emu_cdp import page, Tab

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
QUERY = sys.argv[2] if len(sys.argv) > 2 else "podcast interview"
STEPS = int(sys.argv[3]) if len(sys.argv) > 3 else 26

NULL_V_LO, NULL_V_HI = 0.53, 0.72
NULL_AGE_LO, NULL_AGE_HI = 34, 42
CHILD_MASS = 0.25

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate",
      url="https://m.youtube.com/results?search_query=" + QUERY.replace(" ", "+"))
time.sleep(26)

# Collect the ring incrementally in page -- it caps at 120 and a long
# scroll overruns it many times over.
print("ARM", t.eval("""(function(){
  window.__TS_NCI={reads:[],stop:0}; var seen=0;
  (function loop(){
    var st=window.__TS_NCI; if(st.stop) return;
    try{
      var r=window.__TS_GAZE_IMGDIAG||[];
      // The ring SHIFTS, so index-based resume is wrong once it wraps.
      // Every entry carries `t` (completion wall clock); resume on that.
      for(var i=0;i<r.length;i++){
        var e=r[i]||{};
        if(!(e.t>seen)) continue;
        seen=e.t;
        var rd=e.reads||[];
        for(var j=0;j<rd.length;j++){
          var x=rd[j]||{};
          st.reads.push({g:x.g,s:x.s,a:x.a,c:x.c,k:x.k,p:x.p,why:e.why});
        }
      }
    }catch(e){}
    setTimeout(loop,400);
  })();
  return JSON.stringify({total:window.__TS_GAZE_IMGTOTAL||0,
                         bundle:window.__TS_GAZE_BUNDLE__});
})()"""))

for _ in range(STEPS):
    t.eval("(function(){window.scrollBy(0,700);return 1;})()")
    time.sleep(3.6)
time.sleep(20)

raw = t.eval("""(function(){var st=window.__TS_NCI||{};st.stop=1;
  return JSON.stringify({reads:st.reads||[],total:window.__TS_GAZE_IMGTOTAL||0});})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
reads = d.get("reads", [])

def is_null(r):
    if r.get("g") != "male": return False
    s, a = r.get("s"), r.get("a")
    if not isinstance(s, (int, float)) or not isinstance(a, (int, float)): return False
    if s >= 0.99: return False              # clamped; raw unrecoverable
    v = 0.5 + s / 2.0
    return NULL_V_LO <= v <= NULL_V_HI and NULL_AGE_LO <= a <= NULL_AGE_HI

def pct(xs, p):
    if not xs: return None
    xs = sorted(xs); return xs[min(len(xs)-1, int(round((len(xs)-1)*p)))]

null = [r for r in reads if is_null(r)]
rest = [r for r in reads if not is_null(r)]
def cs(rs): return [r["c"] for r in rs if isinstance(r.get("c"), (int, float))]
nc, rc = cs(null), cs(rest)

print("N", json.dumps({"images": d.get("total"), "reads": len(reads),
                       "null": len(null), "notNull": len(rest),
                       "nullWithChildP": len(nc), "notNullWithChildP": len(rc)}))
print("NULL_CHILDP", json.dumps({
  "n": len(nc), "min": min(nc) if nc else None, "p50": pct(nc,.5),
  "p90": pct(nc,.9), "p99": pct(nc,.99), "max": max(nc) if nc else None,
  "atOrOver_0.25": sum(1 for x in nc if x >= CHILD_MASS)}))
print("NOTNULL_CHILDP", json.dumps({
  "n": len(rc), "min": min(rc) if rc else None, "p50": pct(rc,.5),
  "p90": pct(rc,.9), "max": max(rc) if rc else None,
  "atOrOver_0.25": sum(1 for x in rc if x >= CHILD_MASS)}))
# The children the pipeline DID find, and whether any of them is in band.
kids = [r for r in reads if isinstance(r.get("c"), (int,float)) and r["c"] >= CHILD_MASS]
print("CHILDREN", json.dumps({"n": len(kids), "inNullBand": sum(1 for r in kids if is_null(r)),
                              "sample": kids[:12]}))
print("NULL_SAMPLE", json.dumps(null[:12]))
