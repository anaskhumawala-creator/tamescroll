# WHAT DOES SKIPPING THE PERSON PASS ACTUALLY BUY ON A PHONE?
#
# MoveNet is 63-78% of a verdict pass on measured hardware (504ms of 794
# on his daily phone, 3028 of 3872 p50 on this Redmi) and admitted ZERO
# persons in every one of those passes. The corpus says the CLOCK is the
# dominant driver of exposure -- 81.0s at 1.5s per verdict against 8.0s
# at 0.5s, where every threshold swept this month moves 1-3s. So the
# cadence a skip buys is worth more than any dial.
#
# PERSON_SKIP_EVERY ships INERT (1) on the OTA tuning channel. This A/Bs
# it WITHOUT pushing anything: the tuning payload is injected as
# window.__TS_GAZE_TUNING__ before the page boots, which is the same
# entry point the app uses, so the arm exercises the shipped path rather
# than a bench reimplementation.
#
# BOTH ARMS RUN IN ONE INVOCATION, on the same video at the same
# timestamp, because pass cost on this device varies by more between
# sessions than the effect being measured.
import json, os, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9231
VID  = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SECS = float(sys.argv[3]) if len(sys.argv) > 3 else 100.0
SEEK = float(sys.argv[4]) if len(sys.argv) > 4 else 55.0

def arm(skip_every):
    t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    # BEFORE the page boots, AND IT HAS TO SURVIVE THE APP'S OWN WRITE.
    # lib.rs sets window.__TS_GAZE_TUNING__ at on_page_load, which lands
    # AFTER addScriptToEvaluateOnNewDocument -- a plain assignment here is
    # silently overwritten and BOTH ARMS RUN THE SHIPPED VALUE. The first
    # version of this probe did exactly that and reported a flat A/B; it
    # was caught only because it asserts the dial rather than assuming it.
    #
    # So the probe COMPOSES over the app's write the way the repo's own
    # scriptlets compose over a page's: an accessor whose setter merges
    # the app's payload and then re-applies the override on top.
    t.cmd("Page.addScriptToEvaluateOnNewDocument",
          source="""(function(){
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
          })();""" % json.dumps({"PERSON_SKIP_EVERY": skip_every}))
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

    # THE DIAL IS ASSERTED, NOT ASSUMED. A payload the whitelist refused
    # would leave the arm running the shipped value and the A/B would
    # read flat -- which is exactly how a broken instrument reports a
    # null result.
    tuned = t.eval("JSON.stringify((window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.tuning)||null)")
    if not tuned or '"PERSON_SKIP_EVERY":%d' % skip_every not in str(tuned):
        raise SystemExit(
            "ARM DID NOT TAKE THE DIAL: tuning reads %s. Both arms would "
            "run the shipped value and the A/B would read flat -- refusing "
            "rather than reporting it." % tuned)
    def life():
        r = t.eval("JSON.stringify((window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.life)||{})")
        try: return json.loads(r) if isinstance(r, str) else {}
        except Exception: return {}
    # Pass timings come from the stage ring the diagnostics already keep.
    def stages():
        return t.eval("""(function(){
          var s=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.player&&
                 window.__TS_GAZE_IDS.player.stages)||[];
          return JSON.stringify(s.map(function(x){return x.en||0;}));})()""")

    a = life(); s0 = stages(); t0 = time.time()
    # rAF and verdict count sampled in page: a CDP round trip here is
    # ~100ms and would undercount.
    t.eval("""(function(){ if(window.__TS_SKIPAB) return 1;
      var st={raf:0,cov:0,stopped:false}; window.__TS_SKIPAB=st;
      (function r(){ if(st.stopped) return; st.raf++;
        if(document.querySelectorAll('.ts-gaze-vregion-host').length) st.cov++;
        requestAnimationFrame(r); })(); return 1;})()""")
    time.sleep(SECS)
    b = life()
    rc = t.eval("JSON.stringify(window.__TS_SKIPAB||{})")
    t.eval("(function(){if(window.__TS_SKIPAB)window.__TS_SKIPAB.stopped=true;return 1;})()")
    try: rc = json.loads(rc) if isinstance(rc, str) else {}
    except Exception: rc = {}
    dur = time.time() - t0
    d = {k: b.get(k, 0) - a.get(k, 0) for k in set(list(a) + list(b))}
    return {"tuned": tuned, "dur": dur, "life": d, "raf": rc.get("raf", 0),
            "cov": rc.get("cov", 0), "stages": s0}

# ARM ORDER IS AN ARGUMENT, AND IT HAS TO BE (critic B7). Both arms run
# in one process with arm 1 first, so a warm HTTP/GPU cache is an
# unexcluded explanation for any improvement the SECOND arm shows -- and
# the headline of the first run of this probe was rAF 24.1 -> 33.6 Hz in
# exactly that direction. Run it once each way; a real effect survives
# the swap.
ORDER = (3, 1) if os.environ.get("REVERSED") else (1, 3)

out = {}
for n in ORDER:
    print("--- PERSON_SKIP_EVERY %d ---" % n)
    r = arm(n); out[n] = r
    L = r["life"]
    verdicts = L.get("readClearCertain",0)+L.get("readAbstain",0)+L.get("readUncertain",0)
    print("  tuned            %s" % r["tuned"])
    print("  window           %.0fs" % r["dur"])
    print("  reads            %d" % verdicts)
    print("  cutDetected      %d" % L.get("cutDetected",0))
    print("  passDropped      %d" % L.get("passDropped",0))
    print("  births           %d (cleared %d)" % (L.get("birthCleared",0)+L.get("birthBlurred",0),
                                                  L.get("birthCleared",0)))
    print("  coastExpired     %d" % L.get("coastExpired",0))
    print("  faceNoShape      %d" % L.get("faceNoShape",0))
    print("  rAF              %d frames (%.1f Hz), covered %.1f%%"
          % (r["raf"], r["raf"]/max(1.0,r["dur"]), 100.0*r["cov"]/max(1,r["raf"])))

a, b = out[1], out[3]
ra = (a["life"].get("readClearCertain",0)+a["life"].get("readAbstain",0)
      +a["life"].get("readUncertain",0)) / max(1.0, a["dur"])
rb = (b["life"].get("readClearCertain",0)+b["life"].get("readAbstain",0)
      +b["life"].get("readUncertain",0)) / max(1.0, b["dur"])
print("\nreads/s  off %.3f   skip3 %.3f   -> %.2fx" % (ra, rb, rb/max(1e-9, ra)))

# PERSIST IT. The first run of this probe produced a table that lived
# ONLY in docs/engine-findings.md prose -- nothing under spikes/ held the
# numbers, so no later round could re-read them, re-derive from them, or
# check them against a second run. Every other instrument in this
# directory banks its raw output; this one did not, and a figure with no
# artefact behind it is the shape this repo has been burned by all week.
rec = {"order": list(ORDER), "video": VID, "secs": SECS,
       "arms": {str(k): out[k] for k in out}}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                    "skip-ab-%s%s.json" % (VID, "-rev" if ORDER[0] == 3 else ""))
with open(path, "w") as fh:
    json.dump(rec, fh, indent=1)
print("banked %s" % path)
