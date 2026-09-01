# WHERE DOES A VERDICT PASS ACTUALLY GO, AND WHAT SETS THE CLOCK?
#
# The corpus prices the verdict CLOCK as the biggest lever this system
# has: man exposure 81.0s at 1.5s per verdict against 8.0s at 0.5s,
# where every threshold swept this month moves 1-3s. So "why is the
# cadence what it is" is worth more than any constant.
#
# THE CADENCE IS NOT ALWAYS A FUNCTION OF COST, and that is the thing
# this probe exists to establish on a device. init-entry:3376 reads
#
#     effZoom = min(VERDICT_MAX_INTERVAL_MS, max(ZOOM_INTERVAL_MS,
#                   lastVerdictMs * VERDICT_DUTY))
#            = min(2000, max(400, lastVerdictMs * 4))
#
# so there are THREE regimes and they behave completely differently:
#
#   cost <  500ms   duty-limited   cadence = cost * 4      cheaper helps
#   500..2000ms     CAP-limited    cadence = 2000ms        cheaper does NOTHING
#   cost > 2000ms   busy-limited   cadence ~= cost         cheaper helps
#
# Every verdict cost this repo has ever measured on a device is over
# 500ms, so the middle regime is the one his phone lives in -- and in it,
# making a pass cheaper cannot buy a single extra verdict. That is a
# complete mechanical explanation for the person-skip A/B reading
# reads/s 1.00x while the render loop gained 39% (engine-findings 10i),
# and it needs checking rather than believing.
#
# WHAT THIS READS: `__TS_GAZE_IDS.stages`, the per-pass mark ring the
# player already keeps. Marks are CUMULATIVE from the pass start
# (upload -> persons -> fullFaces -> crops -> tracks -> end), so the
# per-segment cost is a difference between neighbours, and `v` says
# whether the pass was a verdict.
#
# RING, NOT A COUNTER: stages is capped at 120 in page. Entries are
# tagged by identity on first sight so a long window cannot silently
# measure the FILL instead of the rate -- the defect that once turned a
# 2.09s gap into 5.77s in this repo.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9231
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 90.0
SEEK = float(sys.argv[4]) if len(sys.argv) > 4 else 55.0
SKIP = int(sys.argv[5]) if len(sys.argv) > 5 else 1

ORDER = ["upload", "persons", "fullFaces", "crops", "tracks", "end"]

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
# Compose over the app's own write, exactly as probe_skip_ab does -- a
# plain assignment lands BEFORE lib.rs's on_page_load write and is
# silently overwritten, which reads as a flat A/B.
t.cmd("Page.addScriptToEvaluateOnNewDocument", source="""(function(){
  var override=%s, cur=JSON.stringify(override);
  Object.defineProperty(window,'__TS_GAZE_TUNING__',{
    configurable:true,
    get:function(){return cur;},
    set:function(v){
      var base={};
      try{ base=typeof v==='string'?JSON.parse(v):(v||{}); }catch(e){}
      for(var k in override) base[k]=override[k];
      cur=JSON.stringify(base);
    }});
})();""" % json.dumps({"PERSON_SKIP_EVERY": SKIP}))

t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VID); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video');"
       "if(v){v.currentTime=%f; v.muted=true; v.play();} return 1;})()" % SEEK)
time.sleep(10)

tuned = t.eval("JSON.stringify((window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.tuning)||null)")
if not tuned or '"PERSON_SKIP_EVERY":%d' % SKIP not in str(tuned):
    raise SystemExit("ARM DID NOT TAKE THE DIAL: tuning reads %s" % tuned)

# TAG-ON-SIGHT, in page: a 120-entry ring read twice with a diff would
# measure the fill. Each entry gets an id the first time it is seen, and
# the collector keeps every id it has ever emitted.
t.eval("""(function(){
  if(window.__TS_PASSCOST) return 1;
  var st={seen:0,out:[],stop:false}; window.__TS_PASSCOST=st;
  (function loop(){
    if(st.stop) return;
    var ids=window.__TS_GAZE_IDS||{}, s=ids.stages||[];
    for(var i=0;i<s.length;i++){
      if(s[i].__tag) continue;
      s[i].__tag=1; st.seen++;
      st.out.push(s[i]);
      if(st.out.length>4000) st.out.shift();
    }
    setTimeout(loop,150);
  })();
  return 1;})()""")
t0 = time.time()
time.sleep(SECS)
raw = t.eval("JSON.stringify(window.__TS_PASSCOST.out)")
t.eval("(function(){if(window.__TS_PASSCOST)window.__TS_PASSCOST.stop=true;return 1;})()")
dur = time.time() - t0
life = t.eval("JSON.stringify((window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{})")
try: passes = json.loads(raw) if isinstance(raw, str) else []
except Exception: passes = []
try: L = json.loads(life) if isinstance(life, str) else {}
except Exception: L = {}


def q(a, p):
    a = sorted(a)
    return a[int(p * (len(a) - 1))] if a else float("nan")


verdicts = [p for p in passes if p.get("v")]
positions = [p for p in passes if not p.get("v")]
print("--- PERSON_SKIP_EVERY %d, window %.0fs ---" % (SKIP, dur))
print("  tuned            %s" % tuned)
print("  passes           %d  (verdict %d, position %d)"
      % (len(passes), len(verdicts), len(positions)))
if not verdicts:
    raise SystemExit("NO VERDICT PASSES IN THE WINDOW -- nothing to decompose.")

ends = [p.get("end", 0) for p in verdicts if p.get("end")]
print("  verdict cost     p50 %d  p90 %d  max %d ms"
      % (q(ends, .5), q(ends, .9), max(ends)))

print("\n  SEGMENT (cumulative marks differenced; blank = mark absent)")
prev = None
for name in ORDER:
    have = [p for p in verdicts if name in p]
    if not have:
        print("    %-10s --  never marked" % name)
        continue
    if prev is None:
        seg = [p[name] for p in have]
    else:
        seg = [p[name] - p.get(prev, 0) for p in have if prev in p]
    if seg:
        share = 100.0 * q(seg, .5) / max(1.0, q(ends, .5))
        print("    %-10s n %3d   p50 %5d ms  p90 %5d   (%.0f%% of a p50 pass)"
              % (name, len(seg), q(seg, .5), q(seg, .9), share))
    prev = name

# WHICH REGIME IS THIS DEVICE IN? The whole point of the probe.
c = q(ends, .5)
eff = min(2000, max(400, c * 4))
if c > 2000:
    regime = "BUSY-limited (cost > the 2000ms cap): a cheaper pass DOES buy cadence"
elif c >= 500:
    regime = "CAP-limited (500 <= cost <= 2000): a cheaper pass buys NOTHING"
else:
    regime = "DUTY-limited (cost < 500ms): cadence = cost * 4"
print("\n  lastVerdictMs ~ %d  ->  effZoom = min(2000, max(400, %d)) = %d ms"
      % (c, c * 4, eff))
print("  REGIME: %s" % regime)
reads = L.get("readClearCertain", 0) + L.get("readAbstain", 0) + L.get("readUncertain", 0)
print("  reads %d (%.3f/s)   cutDetected %d   passDropped %d   faceNoShape %d"
      % (reads, reads / max(1.0, dur), L.get("cutDetected", 0),
         L.get("passDropped", 0), L.get("faceNoShape", 0)))
