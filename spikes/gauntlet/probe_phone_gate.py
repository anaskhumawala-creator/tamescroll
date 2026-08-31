# THE GATE POPULATIONS AND THE NEW SIZE FLOOR, ON HIS OWN HARDWARE.
#
# 1074 added gateRefused/gateKept; 1075 moved FACE_MIN_NATIVE_PX 64 -> 40.
# Both were measured on the emulator driven to his timestamps, which
# reproduces his regime -- but the whole reason the gate finding exists
# is that his phone reads MoveNet n:0 where the emulator does not, and a
# threshold ruling should rest on the device it will run on.
#
# Also watches the thing flagged when the floor moved: CONFIDENT READS
# AT SMALL px WITH NO SUBJECT. A non-face crop reads CERTAIN 38-53% of
# the time, so if the new floor is going wrong it looks like a cluster
# of certain reads at px just above 40.
#
# 1075 does NOT carry `cov` or __TS_GATE_AUDIT -- those ride the next
# release. This reads what 1075 actually has.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 217
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 200

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
# HIS OWN toggles, read off his storage -- driving with defaults is the
# documented loop-2 gotcha and it has invented a defect twice.
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var shown=[]; try{ shown=(JSON.parse(localStorage.getItem('tamescroll.shown'))||{}).youtube||[]; }catch(e){}
  await inv('open_platform',{id:'youtube',mode:localStorage.getItem('tamescroll.blur')||'smart',
    strength:24, gender:localStorage.getItem('tamescroll.gender')||'man', shown:shown});
  return 1;})()""")
time.sleep(8)

t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(35)
print("ARM", t.eval("""(function(){
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  var d=(window.__TS_GAZE_IDS=window.__TS_GAZE_IDS||{});
  d.gateRefused=[]; d.gateKept=[];
  return JSON.stringify({t:v?Math.round(v.currentTime):null,
    bundle:window.__TS_GAZE_BUNDLE__, cfg:d.cfg});})()""" % SEEK))

time.sleep(DWELL)

print("GATE", t.eval("""(function(){
  var d=window.__TS_GAZE_IDS||{};
  function p(a,q){ if(!a.length) return null;
    var s=a.slice().sort(function(x,y){return x-y;});
    return s[Math.min(s.length-1,Math.round((s.length-1)*q))]; }
  function stats(r){ r=r||[];
    var c=r.map(function(e){return e.c;});
    var px=r.map(function(e){return e.px;}).filter(function(x){return typeof x==='number';});
    var k=r.map(function(e){return e.k;}).filter(function(x){return typeof x==='number';});
    return {n:r.length, cP05:p(c,0.05), cP50:p(c,0.5), cP95:p(c,0.95),
            pxP05:p(px,0.05), pxP50:p(px,0.5), pxP95:p(px,0.95),
            kP50:p(k,0.5), kMax:k.length?Math.max.apply(null,k):null,
            kMin:k.length?Math.min.apply(null,k):null}; }
  var reads=(d.reads||[]);
  var small=reads.filter(function(r){return typeof r.px==='number'&&r.px<64;});
  var by={};
  for(var i=0;i<reads.length;i++) by[reads[i].g||'?']=(by[reads[i].g||'?']||0)+1;
  var v=document.querySelector('video');
  return JSON.stringify({
    t:v?Math.round(v.currentTime):null,
    faceMinPx:(d.cfg||{}).faceMinPx,
    passes:d.passesTotal, verdicts:d.verdictsTotal,
    life:d.life,
    slots:(d.slots||[]).map(function(s){return s.n;}),
    refused:stats(d.gateRefused), kept:stats(d.gateKept),
    reads:reads.length, readsByGender:by,
    smallReads:small.length,
    smallCertain:small.filter(function(r){return (r.s||0)>=0.25;}).length,
    smallSample:small.slice(-14)
  });})()"""))

# BACK TO THE LAUNCHER. His phone is not a test rig; nothing of a feed
# is left on its screen.
t.cmd("Page.navigate", url="http://tauri.localhost/")
