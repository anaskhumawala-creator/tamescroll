# THE CRITIC'S NAMED QUERY: join childP against isNullRead in the reads ring.
#
# The reverted change guarded the null-band gate with isAdultRead, so a
# child could never be refused as a "null read". The critic's charge is
# that the guard is STRUCTURALLY DEAD: a null read IS the age head
# returning its prior, and a prior centred near 37 puts almost no mass
# under 18, so childP is small BY CONSTRUCTION for every null read.
#
# If true, isNullRead can never protect a child and any future use of it
# as a mint gate has to carry a different child signal entirely.
#
# Both fields already ship in __TS_GAZE_IDS.reads (`pc`, `ab`). Nothing
# new is instrumented here; this only collects and joins them.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID  = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 110
DWELL= int(sys.argv[4]) if len(sys.argv) > 4 else 260

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
  window.__TS_NC={reads:[],stop:0};
  var seen=0;
  (function loop(){
    var st=window.__TS_NC; if(st.stop) return;
    try{
      var d=window.__TS_GAZE_IDS||{};
      var r=d.reads||[];
      if(r.length>seen){
        for(var i=seen;i<r.length;i++){
          var e=r[i]||{};
          st.reads.push({g:e.g,s:e.s,a:e.a,pc:e.pc,v:e.v,ab:e.ab,px:e.px,fc:e.fc,n:e.n});
        }
        seen=r.length;
      } else if(r.length<seen){ seen=r.length; }
    }catch(e){}
    setTimeout(loop,250);
  })();
  return JSON.stringify({t:%d,bundle:window.__TS_GAZE_BUNDLE__});
})()""" % (SEEK, SEEK)))

time.sleep(DWELL)
t.eval("(function(){ if(window.__TS_NC) window.__TS_NC.stop=1; return 1; })()")
raw = t.eval("JSON.stringify((window.__TS_NC||{}).reads||[])")
reads = json.loads(raw) if raw else []

def pct(xs, p):
    if not xs: return None
    xs = sorted(xs); i = min(len(xs)-1, int(round((len(xs)-1)*p)))
    return xs[i]

null = [r for r in reads if r.get("ab") == 1]
real = [r for r in reads if r.get("ab") == 0]
def pcs(rs): return [r["pc"] for r in rs if isinstance(r.get("pc"), (int,float))]

npc, rpc = pcs(null), pcs(real)
print("N", json.dumps({"reads":len(reads), "null":len(null), "notNull":len(real),
                       "nullWithPc":len(npc), "notNullWithPc":len(rpc)}))
print("NULL_CHILDP", json.dumps({
  "n":len(npc), "min":min(npc) if npc else None, "p50":pct(npc,0.5),
  "p90":pct(npc,0.9), "max":max(npc) if npc else None,
  "atOrOver_0.25": sum(1 for x in npc if x >= 0.25),
  "over_0.15": sum(1 for x in npc if x > 0.15)}))
print("NOTNULL_CHILDP", json.dumps({
  "n":len(rpc), "min":min(rpc) if rpc else None, "p50":pct(rpc,0.5),
  "p90":pct(rpc,0.9), "max":max(rpc) if rpc else None,
  "atOrOver_0.25": sum(1 for x in rpc if x >= 0.25)}))
# The band itself, so the join can be re-derived against other constants.
print("NULL_RAW", json.dumps({"vP50":pct([r["v"] for r in null if isinstance(r.get("v"),(int,float))],0.5),
                              "aP50":pct([r["a"] for r in null if isinstance(r.get("a"),(int,float))],0.5),
                              "pxP50":pct([r["px"] for r in null if isinstance(r.get("px"),(int,float))],0.5)}))
print("SAMPLE_NULL", json.dumps(null[:20]))
print("LIFE", t.eval("JSON.stringify({life:(window.__TS_GAZE_IDS||{}).life||{},passes:(window.__TS_GAZE_IDS||{}).passesTotal})"))
