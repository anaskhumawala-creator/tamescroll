# DOES REFUSING A NULL READ'S BIRTH REMOVE PATCHES WITHOUT UNCOVERING
# ANYBODY?
#
# The gate refuses a BIRTH, never a refresh, so the two numbers that
# decide it pull in opposite directions and both have to be read from
# the same run:
#
#   patchesP50 / patchesMax  down  = his "random blur marks" going away
#   femaleUncovered          == 0  = nobody who should be covered isn't
#
# `nullDropped` is the counter that proves the branch is alive at all --
# a gate nobody has seen fire is a claim, and this repo has shipped two
# of those. If it reads 0 the arm measured NOTHING and must not be
# compared against anything.
#
# VISIBLE patches only. 67 probes under this directory count patch nodes
# with no display check, and a display:none overlay inflates the count --
# which biases toward "coverage is fine" and under-reports an exposure.
import json, sys, time
from emu_cdp import page, Tab

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
LABEL = sys.argv[2] if len(sys.argv) > 2 else "arm"
VID   = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"
SEEK  = int(sys.argv[4]) if len(sys.argv) > 4 else 150
DWELL = int(sys.argv[5]) if len(sys.argv) > 5 else 200
GEN   = sys.argv[6] if len(sys.argv) > 6 else "man"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['watch_recs']}); return 1;})()""" % GEN)
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)

print("ARMED", t.eval("""(function(){
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  window.__TS_AB={samples:[],stop:0};
  (function loop(){
    var st=window.__TS_AB; if(st.stop) return;
    try{
      var d=window.__TS_GAZE_IDS||{};
      // VISIBLE patches: in the document, not display:none, non-zero box.
      var n=0, all=document.querySelectorAll('.ts-gaze-vregion-clip > *');
      for(var i=0;i<all.length;i++){
        var e=all[i];
        if(getComputedStyle(e).display==='none') continue;
        var r=e.getBoundingClientRect();
        if(r.width>0 && r.height>0) n++;
      }
      var tk=(window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS())||[];
      var blurred=0;
      for(var j=0;j<tk.length;j++){
        var e2=tk[j]||{}; var bs=e2.tracks||[];
        for(var k=0;k<bs.length;k++) blurred++;
      }
      st.samples.push({ms:Math.round(performance.now()), patches:n, tracks:blurred});
    }catch(e){}
    setTimeout(loop,500);
  })();
  return 'armed';})()""" % SEEK))

time.sleep(DWELL)

out = t.eval("""(function(){
  var st=window.__TS_AB||{samples:[]}; st.stop=1;
  var d=window.__TS_GAZE_IDS||{};
  var life=d.life||{};
  var slots=d.slots||[];
  var nz=0; for(var i=0;i<slots.length;i++) if((slots[i]||{}).n) nz++;
  var reads=(d.reads||[]).map(function(r){
    return {g:r.g,s:r.s,a:r.a,px:r.px,ab:r.ab,v:r.v,pc:r.pc,fc:r.fc,nm:r.nm};});
  var v=document.querySelector('video');
  return JSON.stringify({
    samples:st.samples,
    life:life,
    slotsNonZero:nz,
    reads:reads,
    vw:v&&v.videoWidth, vh:v&&v.videoHeight,
    bundle:window.__TS_GAZE_BUNDLE__||null
  });})()""")

d = json.loads(out)
s = [x["patches"] for x in d["samples"]]
tr = [x["tracks"] for x in d["samples"]]
def q(a,p):
    if not a: return None
    b=sorted(a); return b[min(len(b)-1,int(p*len(b)))]
life = d["life"]
reads = d["reads"]
fem = [r for r in reads if r.get("g")=="female"]
d["summary"] = {
  "label": LABEL, "video": VID, "seek": SEEK, "dwell": DWELL, "gender": GEN,
  "samples": len(s),
  "patchesP50": q(s,.5), "patchesP90": q(s,.9), "patchesMax": max(s) if s else None,
  "patchesMean": round(sum(s)/len(s),2) if s else None,
  "tracksP50": q(tr,.5), "tracksMax": max(tr) if tr else None,
  "nullDropped": life.get("nullDropped",0),
  "faceNoShape": life.get("faceNoShape",0),
  "emptyFrame": life.get("emptyFrame",0),
  "wipeErasedBlurred": life.get("wipeErasedBlurred",0),
  "birthFresh": life.get("birthFresh",0),
  "readAbstain": life.get("readAbstain",0),
  "readClearCertain": life.get("readClearCertain",0),
  "slotsNonZero": d["slotsNonZero"],
  "reads": len(reads), "femaleReads": len(fem),
  "vw": d["vw"], "vh": d["vh"], "bundle": d["bundle"],
}
print(json.dumps(d["summary"], indent=1))
open("nullmint-%s.json" % LABEL, "w").write(json.dumps(d))
print("banked nullmint-%s.json" % LABEL)
