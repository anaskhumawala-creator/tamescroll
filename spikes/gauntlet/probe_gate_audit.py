# WHAT THE GHOST GATE IS REFUSING, in the only terms that settle it.
#
# The two rings (1074) established that the refused and kept face
# populations look ALIKE on confidence and size, and that 80% of
# refusals were an uncovered spot. What they could not say is whether a
# refused face was a PERSON -- the gate refuses before any gender read,
# so "not covered" is not the same as "should have been covered".
#
# __TS_GATE_AUDIT (1076, diagnostic only, never set by the app) runs the
# same native-res gender read a KEPT face gets and stamps the verdict on
# the ring entry, while still refusing the face. So this probe answers:
# of the faces the gate threw away, how many would have produced a
# patch, and how confident was the model about them.
#
# g: 0 unknown, 1 male, 2 female. s: certainty 2*|sigmoid-0.5|.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 217
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 180
GENDER = sys.argv[5] if len(sys.argv) > 5 else "man"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(8)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['watch_recs']}); return 1;})()""" % GENDER)
time.sleep(8)

t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(30)

# The flag must be set before the faces we care about reach the branch.
# Seek to HIS regime first -- loop 36 established that the emulator at
# t=55 and his phone at t=217 are different footage, not different
# devices, and comparing them was my own confound.
print("ARM", t.eval("""(function(){
  window.__TS_GATE_AUDIT = 1;
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  var d=(window.__TS_GAZE_IDS=window.__TS_GAZE_IDS||{});
  d.gateRefused=[]; d.gateKept=[];
  return JSON.stringify({armed:!!window.__TS_GATE_AUDIT,
                         t:v?Math.round(v.currentTime):null,
                         bundle:window.__TS_GAZE_BUNDLE__});})()""" % SEEK))

time.sleep(DWELL)

out = t.eval("""(function(){
  var d=window.__TS_GAZE_IDS||{};
  function stats(r){
    r=r||[];
    var read=r.filter(function(e){return typeof e.g==='number';});
    var by={0:0,1:0,2:0};
    // WHAT WOULD HAVE HAPPENED TO THIS FACE had the gate not refused
    // it, in MAN mode: a CERTAIN male reads clear and stays sharp
    // (correct); everything else -- a certain female, and any read
    // under GENDER_MIN_SCORE either way -- fails closed and gets a
    // patch. So the refusals that COST something are (all minus
    // certain-male), and the ones that cost something visible are that
    // set minus the ones already covered.
    var cert=0, certUncov=0, certMale=0, certFemale=0, patch=0, patchUncov=0;
    for(var i=0;i<read.length;i++){
      var e=read[i];
      by[e.g]=(by[e.g]||0)+1;
      var certain = e.s>=0.25;
      if(certain){ cert++; if(!e.cov) certUncov++; }
      if(certain && e.g===1) certMale++;
      if(certain && e.g===2) certFemale++;
      if(!(certain && e.g===1)){ patch++; if(!e.cov) patchUncov++; }
    }
    function p(arr,q){ if(!arr.length) return null;
      var a=arr.slice().sort(function(x,y){return x-y;});
      return a[Math.min(a.length-1,Math.round((a.length-1)*q))]; }
    return {n:r.length, audited:read.length,
            unknown:by[0], male:by[1], female:by[2],
            certain:cert, certainUncovered:certUncov,
            certainMale:certMale, certainFemale:certFemale,
            wouldPatch:patch, wouldPatchUncovered:patchUncov,
            covered:r.filter(function(e){return e.cov===1;}).length,
            sP50:p(read.map(function(e){return e.s;}),0.5),
            sP90:p(read.map(function(e){return e.s;}),0.9),
            pxP50:p(r.map(function(e){return e.px;}).filter(function(x){return typeof x==='number';}),0.5),
            cP50:p(r.map(function(e){return e.c;}),0.5)};
  }
  var v=document.querySelector('video');
  return JSON.stringify({
    t: v?Math.round(v.currentTime):null,
    passes:(d.life||{}).emptyFrame!==undefined?d.passesTotal:d.passesTotal,
    faceNoShape:(d.life||{}).faceNoShape,
    refused: stats(d.gateRefused),
    kept: stats(d.gateKept),
    refusedRaw: (d.gateRefused||[]).slice(-24),
    slots:(d.slots||[]).map(function(s){return s.n;})
  });})()""")
print("AUDIT", out)
