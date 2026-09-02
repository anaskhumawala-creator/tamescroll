# RELEASE CHECK FOR 1091. One thing changed that can reach the screen and
# it is a DECISION-LAYER change: `updatePersonTracks` claims pairs through
# `optimalAssign` (Hungarian, cardinality-first) instead of walking an
# IoU-sorted list greedily. Everything else in the diff is documents,
# benches and counters.
#
# So the questions are (a) does the pipeline still judge and place, which
# is what every release check asks, and (b) is the new code ALIVE on the
# device rather than merely emitted -- `PTRACK_ASSIGN` reads out of the
# live bundle, and the birth counters are what would move if the
# assignment had regressed to greedy behind a stale bundle.
#
# THE THREE NEW COUNTERS ARE DELIBERATELY NOT EXPECTED TO FIRE HERE.
# `wholeFrameSamples` only rises where `isPlayer` is false, and on a
# YouTube watch page it is true (findings 16). Reading them as 0 on this
# arm is the CORRECT answer and is recorded so a future run does not
# mistake it for a dead hook.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)

# --- ARM 1: the image path on a real search feed ------------------------
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(34)
for _ in range(5):
    t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,700); return 1;})()")
    time.sleep(4)
time.sleep(14)

print("BUNDLE", t.eval("(function(){return String(window.__TS_GAZE_BUNDLE__||'?');})()"))

IMG = r"""(function(){
  var out={imgTotal: window.__TS_GAZE_IMGTOTAL||0, errors:0, why:{}, onScreenPending:0,
           patches:0, inside:0, stray:0};
  var d = window.__TS_GAZE_IMGDIAG||[];
  for(var i=0;i<d.length;i++){
    var w=d[i].why||'?'; out.why[w]=(out.why[w]||0)+1;
    if(w==='error') out.errors++;
  }
  var imgs=document.querySelectorAll('img.ts-gaze-pending');
  for(var j=0;j<imgs.length;j++){
    var r=imgs[j].getBoundingClientRect();
    if(r.bottom>0 && r.top<innerHeight && r.width>0) out.onScreenPending++;
  }
  // A display:none patch is still in the DOM. Counting it overstates
  // coverage, which is the bias that runs the dangerous way.
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  for(var k=0;k<ps.length;k++){
    var p=ps[k], pr=p.getBoundingClientRect();
    if(!(pr.width>0 && pr.height>0) || getComputedStyle(p).display==='none') continue;
    out.patches++;
    var host=p.parentElement, im=host?host.querySelector('img'):null;
    if(!im){ out.stray++; continue; }
    var ir=im.getBoundingClientRect();
    if(pr.left>=ir.left-2 && pr.top>=ir.top-2 && pr.right<=ir.right+2 && pr.bottom<=ir.bottom+2) out.inside++;
    else out.stray++;
  }
  return JSON.stringify(out);
})()"""
print("SEARCH", t.eval(IMG))

# --- ARM 2: the player path, the assignment, and the birth counters -----
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(32)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=217; v.play();} return 1;})()")
hosts = 0
for _ in range(20):
    time.sleep(5)
    o = t.eval("(function(){return String(document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    hosts = int(o) if isinstance(o, str) and o.strip().isdigit() else 0
    if hosts:
        break
print("PLAYER_HOSTS", hosts)
time.sleep(25)

# THE ASSIGNMENT, READ OFF THE LIVE BUNDLE RATHER THAN THE SOURCE. This
# repo has shipped a dead constant for six rounds (`var IY;`), so a
# constant that decides who gets covered is checked at runtime.
print("CFG", t.eval(
    "(function(){try{var c=window.__TS_GAZE_CFG&&window.__TS_GAZE_CFG();"
    "return JSON.stringify(c);}catch(e){return 'ERR '+String(e);}})()"))

print("REPORT", t.eval(
    "(function(){try{var r=window.__TS_DIAG_NOW(); if(typeof r==='string') r=JSON.parse(r);"
    "var L=(r.player&&r.player.life)||{}; var keep={};"
    "['birthFresh','birthNearMiss','birthContended','birthSizeRejected','coastExpired',"
    " 'cutDetected','passDropped','wipeErased','wholeFrameSamples','wholeFrameNoFaces',"
    " 'wholeFrameCleared'].forEach(function(k){keep[k]=L[k];});"
    "return JSON.stringify({version:r.app&&r.app.versionCode, life:keep,"
    "tuning:r.tuning, blocked:r.engine&&r.engine.blocked, seen:r.engine&&r.engine.seen,"
    "violations:(window.__TS_DIAG_VIOLATIONS?window.__TS_DIAG_VIOLATIONS(r).length:null)});}"
    "catch(e){return 'ERR '+String(e);}})()"))
