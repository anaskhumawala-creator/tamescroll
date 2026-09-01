import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]); LABEL=sys.argv[2]; DWELL=int(sys.argv[3])
t = Tab(page(port=PORT, want="youtube"))
# Clear the rings so the window is THIS window, not whatever preceded it.
t.eval("(function(){var d=window.__TS_GAZE_IDS; if(d){d.reads=[];d.slots=[];d.life={};} return 1;})()")
print("ARMED", t.eval("window.__TS_GAZE_BUNDLE__"))
time.sleep(DWELL)
js = """(function(){
  var d = window.__TS_GAZE_IDS || {};
  var reads = d.reads || [], slots = d.slots || [];
  var nz = 0; for (var i=0;i<slots.length;i++) if ((slots[i]||{}).n) nz++;
  function q(a,p){ if(!a.length) return null; var s=a.slice().sort(function(x,y){return x-y;});
    return Math.round(s[Math.floor(p*(s.length-1))]*1000)/1000; }
  function col(k){ return reads.map(function(r){return r[k];})
    .filter(function(x){return typeof x==='number';}); }
  var px=col('px'), sc=col('s'), nm=col('nm'), v9=col('v');
  var g={}; reads.forEach(function(r){ g[r.g]=(g[r.g]||0)+1; });
  var vis=0, allp=document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for (var k=0;k<allp.length;k++){ var e=allp[k];
    if (getComputedStyle(e).display==='none') continue;
    var rr=e.getBoundingClientRect(); if (rr.width>0&&rr.height>0) vis++; }
  var v=document.querySelector('video'), mp=document.querySelector('#movie_player');
  var mr = mp?mp.getBoundingClientRect():null;
  return JSON.stringify({
    life:d.life||null, reads:reads.length, slotsNonZero:nz, slotSamples:slots.length,
    genders:g,
    px:{p05:q(px,0.05),p50:q(px,0.5),p95:q(px,0.95)},
    score:{p05:q(sc,0.05),p50:q(sc,0.5),p95:q(sc,0.95)},
    nm:{p05:q(nm,0.05),p50:q(nm,0.5),p95:q(nm,0.95)},
    raw:{p05:q(v9,0.05),p50:q(v9,0.5),p95:q(v9,0.95)},
    visiblePatches:vis, vt:v?Math.round(v.currentTime):null, paused:v?!!v.paused:null,
    vw:v?v.videoWidth:null, vh:v?v.videoHeight:null,
    playerBox: mr?[Math.round(mr.width),Math.round(mr.height)]:null,
    dpr: window.devicePixelRatio});})()"""
out = t.eval(js)
print(LABEL, out)
open("oldphone-%s.json" % LABEL, "w").write(out)
