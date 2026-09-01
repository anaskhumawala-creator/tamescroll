# READ-ONLY. Samples his phone's live player -- visible patches, tracks
# and life counters -- and navigates NOTHING. He is watching; this must
# not touch what is on his screen.
#
# VISIBLE patches only: a display:none overlay is still in the DOM and in
# entry.tracks, and counting it inflates coverage and hides an exposure.
import json, sys, time
from emu_cdp import page, Tab

PORT  = int(sys.argv[1]) if len(sys.argv) > 1 else 9230
LABEL = sys.argv[2] if len(sys.argv) > 2 else "phone"
DWELL = int(sys.argv[3]) if len(sys.argv) > 3 else 90

t = Tab(page(port=PORT, want="youtube"))
print("ARMED", t.eval("""(function(){
  window.__TS_PW={samples:[],stop:0};
  (function loop(){
    var st=window.__TS_PW; if(st.stop) return;
    try{
      var n=0, all=document.querySelectorAll('.ts-gaze-vregion-clip > *');
      for(var i=0;i<all.length;i++){
        var e=all[i];
        if(getComputedStyle(e).display==='none') continue;
        var r=e.getBoundingClientRect();
        if(r.width>0&&r.height>0) n++;
      }
      var tk=(window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS())||[];
      var b=0; for(var j=0;j<tk.length;j++) b+=((tk[j]||{}).tracks||[]).length;
      var v=document.querySelector('video');
      st.samples.push({ms:Math.round(performance.now()),patches:n,tracks:b,
                       t:v?Math.round(v.currentTime):null, paused:v?!!v.paused:null});
    }catch(e){}
    setTimeout(loop,500);
  })();
  return 'armed';})()"""))
time.sleep(DWELL)
out = t.eval("""(function(){
  var st=window.__TS_PW||{samples:[]}; st.stop=1;
  var d=window.__TS_GAZE_IDS||{}, slots=d.slots||[], nz=0;
  for(var i=0;i<slots.length;i++) if((slots[i]||{}).n) nz++;
  var v=document.querySelector('video');
  return JSON.stringify({samples:st.samples, life:d.life||{}, slotsNonZero:nz,
    reads:(d.reads||[]).map(function(r){return {g:r.g,s:r.s,a:r.a,px:r.px,ab:r.ab,v:r.v,fc:r.fc,nm:r.nm};}),
    refused:(d.gateRefused||[]).length, kept:(d.gateKept||[]).length,
    vw:v&&v.videoWidth, vh:v&&v.videoHeight, url:location.href.slice(0,60),
    bundle:window.__TS_GAZE_BUNDLE__||null});})()""")
d = json.loads(out)
s=[x["patches"] for x in d["samples"]]; tr=[x["tracks"] for x in d["samples"]]
def q(a,p):
    if not a: return None
    b=sorted(a); return b[min(len(b)-1,int(p*len(b)))]
L=d["life"]; R=d["reads"]
d["summary"]={"label":LABEL,"samples":len(s),
 "patchesP50":q(s,.5),"patchesP90":q(s,.9),"patchesMax":max(s) if s else None,
 "patchesMean":round(sum(s)/len(s),2) if s else None,
 "tracksP50":q(tr,.5),"tracksMax":max(tr) if tr else None,
 "nullDropped":L.get("nullDropped",0),"faceNoShape":L.get("faceNoShape",0),
 "emptyFrame":L.get("emptyFrame",0),"wipeErasedBlurred":L.get("wipeErasedBlurred",0),
 "birthFresh":L.get("birthFresh",0),"readAbstain":L.get("readAbstain",0),
 "readClearCertain":L.get("readClearCertain",0),"readUncertain":L.get("readUncertain",0),
 "slotsNonZero":d["slotsNonZero"],"reads":len(R),
 "femaleReads":len([r for r in R if r.get("g")=="female"]),
 "maleReads":len([r for r in R if r.get("g")=="male"]),
 "nullReads":len([r for r in R if r.get("ab")==1]),
 "refused":d["refused"],"kept":d["kept"],
 "vw":d["vw"],"vh":d["vh"],"bundle":d["bundle"],"url":d["url"]}
print(json.dumps(d["summary"],indent=1))
open("phonewatch-%s.json"%LABEL,"w").write(json.dumps(d))
