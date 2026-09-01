# CONTROL/CANDIDATE arm on the OLD phone (M2010J19SI, Adreno 610 --
# the SAME GPU and the same HIGH_FLOAT 23 as his main device, which is
# what makes this phone able to answer the question at all).
#
# Reads only. Navigates to ONE corpus video so the frames are ones with
# ground-truth labels banked offline, dwells, and reports the counters
# the clamp and the clear bar are supposed to move.
import json, sys, time
from emu_cdp import page, Tab

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 9230
LABEL = sys.argv[2] if len(sys.argv) > 2 else "control"
VID   = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"
AT    = sys.argv[4] if len(sys.argv) > 4 else "292"
DWELL = int(sys.argv[5]) if len(sys.argv) > 5 else 90

t = Tab(page(port=PORT, want="youtube"))
t.eval("location.href='https://m.youtube.com/watch?v=%s&t=%s'" % (VID, AT))
time.sleep(14)
t = Tab(page(port=PORT, want="youtube"))
# Play, and confirm it. A probe on a paused player measures nothing.
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(4)
print("BUNDLE", t.eval("window.__TS_GAZE_BUNDLE__"),
      "GENDER", t.eval("window.__TS_GAZE_GENDER"),
      "t", t.eval("(function(){var v=document.querySelector('video');return v?Math.round(v.currentTime):null;})()"))
time.sleep(DWELL)

out = t.eval("""(function(){
  var d = window.__TS_GAZE_IDS || {};
  var reads = d.reads || [], slots = d.slots || [];
  var nz = 0; for (var i=0;i<slots.length;i++) if ((slots[i]||{}).n) nz++;
  function q(a,p){ if(!a.length) return null; var s=a.slice().sort(function(x,y){return x-y;});
    return Math.round(s[Math.floor(p*(s.length-1))]*1000)/1000; }
  var px = reads.map(function(r){return r.px;}).filter(function(x){return typeof x==='number';});
  var sc = reads.map(function(r){return r.s;}).filter(function(x){return typeof x==='number';});
  var nm = reads.map(function(r){return r.nm;}).filter(function(x){return typeof x==='number';});
  var g  = {}; reads.forEach(function(r){ g[r.g]=(g[r.g]||0)+1; });
  var vis = 0, allp = document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for (var k=0;k<allp.length;k++){ var e=allp[k];
    if (getComputedStyle(e).display==='none') continue;
    var rr=e.getBoundingClientRect(); if (rr.width>0&&rr.height>0) vis++; }
  var v = document.querySelector('video');
  return JSON.stringify({
    life: d.life || null,
    reads: reads.length, slotsNonZero: nz, slotSamples: slots.length,
    genders: g,
    px:{p05:q(px,0.05),p50:q(px,0.5),p95:q(px,0.95)},
    score:{p05:q(sc,0.05),p50:q(sc,0.5),p95:q(sc,0.95)},
    nm:{p05:q(nm,0.05),p50:q(nm,0.5),p95:q(nm,0.95)},
    visiblePatches: vis,
    vt: v?Math.round(v.currentTime):null, paused: v?!!v.paused:null,
    vw: v?v.videoWidth:null, vh: v?v.videoHeight:null
  });})()""")
print(LABEL, out)
open("oldphone-%s.json" % LABEL, "w").write(out)
