# WAS SHE COVERED, ASKED WITH AN INSTRUMENT THAT SURVIVES ITS OWN CRITIC.
#
# probe_covered.py (v1) answered the question the wrong way three times,
# all found by review before anything was written down:
#
#  1. Its "what the old instrument would have said" arm counted VTRACKS
#     entries, not `.ts-gaze-vregion-host` DOM nodes -- so the agreement
#     it reported was between one source and itself. Both are emitted
#     side by side here.
#  2. Coverage was sampled the first time a read was SEEN. The read ring
#     is written inside each person's gender promise; setTracks runs
#     after ALL persons resolve. So the LAST person in a pass is judged
#     against this pass's patches and the earlier ones against the
#     previous pass's -- a bias toward covered and toward uncovered
#     respectively, inside the same column. Each read is scored TWICE
#     now: at first sight, and again once this pass's tracks land.
#  3. A patch can be `display: none` and still sit in the DOM and in
#     entry.tracks (video-region sets it when the clip falls entirely
#     outside the picture). Both instruments counted it as coverage.
#     Containment here runs over VISIBLE DOM patches only.
#
# And `b` is personCropRegion, which is the HEAD square for most people
# and the BODY box for a back-turned one; its centre is then the torso
# and a head-and-shoulders patch fails containment. Both the centre and
# the head end are tested, and the aspect ratio rides every row so the
# branches can be told apart afterwards.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 150
DWELL = int(sys.argv[4]) if len(sys.argv) > 4 else 400

t = Tab(page(port=PORT))
t.cmd("Page.enable")
t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)

ARM = """(function(){
  var v0=document.querySelector('video');
  if(v0){ try{ v0.currentTime=SEEKV; v0.play(); }catch(e){} }
  window.__TS_CV2={done:[],pend:[],stop:0}; var seen=0;

  function bigVideo(){
    var vs=document.querySelectorAll('video'), vid=null, best=-1;
    for(var q=0;q<vs.length;q++){
      var rr=vs[q].getBoundingClientRect(), ar=rr.width*rr.height;
      if(ar>best){ best=ar; vid=vs[q]; }
    }
    return vid;
  }
  function cover(b){
    var o={whole:0,inPatch:0,inPatchTop:0,domAll:0,domVisible:0,vtCount:0};
    try{
      var vid=bigVideo(); if(!vid) return o;
      if(vid.classList.contains('ts-gaze-pending')||
         vid.classList.contains('ts-gaze-flagged')) o.whole=1;
      var vr=vid.getBoundingClientRect();
      var hosts=document.querySelectorAll('.ts-gaze-vregion-host');
      o.domAll=hosts.length;
      var boxes=[];
      for(var i=0;i<hosts.length;i++){
        var h=hosts[i];
        if(getComputedStyle(h).display==='none') continue;
        var r=h.getBoundingClientRect();
        if(!(r.width>0&&r.height>0)) continue;
        o.domVisible++;
        if(vr.width>0&&vr.height>0){
          boxes.push([(r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,
                      (r.right-vr.left)/vr.width,(r.bottom-vr.top)/vr.height]);
        }
      }
      try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
        if(e) e.forEach(function(en){ o.vtCount+=(en.tracks||[]).length; });
      }catch(err){}
      var cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2;
      var ty=b[1]+(b[3]-b[1])*0.2;
      for(var j=0;j<boxes.length;j++){
        var k=boxes[j];
        if(cx>=k[0]&&cx<=k[2]&&cy>=k[1]&&cy<=k[3]) o.inPatch=1;
        if(cx>=k[0]&&cx<=k[2]&&ty>=k[1]&&ty<=k[3]) o.inPatchTop=1;
      }
    }catch(e){}
    return o;
  }
  function passN(){ var d=window.__TS_GAZE_IDS||{}; return (d.tracks||[]).length; }

  (function loop(){
    var st=window.__TS_CV2; if(st.stop) return;
    try{
      var d=window.__TS_GAZE_IDS||{};
      var r=d.reads||[]; var pn=passN();
      if(r.length>seen){
        for(var i=seen;i<r.length;i++){
          var e=r[i]||{};
          if(!e.b) continue;
          st.pend.push({ms:Math.round(performance.now()),pn0:pn,
            g:e.g,s:e.s,a:e.a,pc:e.pc,ab:e.ab,px:e.px,b:e.b,
            asp:Math.round(((e.b[2]-e.b[0])/Math.max(1e-6,e.b[3]-e.b[1]))*100)/100,
            at:cover(e.b)});
        }
        seen=r.length;
      } else if(r.length<seen){ seen=r.length; }
      for(var k=st.pend.length-1;k>=0;k--){
        var p=st.pend[k];
        if(pn>p.pn0){ p.after=cover(p.b); p.dPn=pn-p.pn0;
                      st.done.push(p); st.pend.splice(k,1); }
        else if(performance.now()-p.ms>12000){ p.after=null;
                      st.done.push(p); st.pend.splice(k,1); }
      }
    }catch(e){}
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:SEEKV,bundle:window.__TS_GAZE_BUNDLE__});
})()""".replace("SEEKV", str(SEEK))
print("ARM", t.eval(ARM))

time.sleep(DWELL)
raw = t.eval("""(function(){var st=window.__TS_CV2||{};st.stop=1;
  var d=window.__TS_GAZE_IDS||{};
  return JSON.stringify({done:st.done||[],pend:st.pend||[],life:d.life,
    passes:d.passesTotal,slots:(d.slots||[]).map(function(s){return s.n;})});})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
rows = (d.get("done") or []) + (d.get("pend") or [])


def bucket(rs, key):
    def c(r):
        return r.get(key) or {}

    def cov(r):
        return c(r).get("inPatch") or c(r).get("inPatchTop") or c(r).get("whole")

    return {
        "n": len(rs),
        "covered": sum(1 for r in rs if cov(r)),
        "coveredCentre": sum(1 for r in rs if c(r).get("inPatch")),
        "coveredTopOnly": sum(1 for r in rs if c(r).get("inPatchTop") and not c(r).get("inPatch")),
        "wholeOnly": sum(1 for r in rs if c(r).get("whole") and not c(r).get("inPatch")
                         and not c(r).get("inPatchTop")),
        "UNCOVERED": sum(1 for r in rs if not cov(r)),
    }


fem = [r for r in rows if r.get("g") == "female"]
print("FEMALE_AT_READ", json.dumps(bucket(fem, "at")))
print("FEMALE_AFTER_PASS", json.dumps(bucket([r for r in fem if r.get("after")], "after")))
print("ALL_AT_READ", json.dumps(bucket(rows, "at")))
print("ALL_AFTER_PASS", json.dumps(bucket([r for r in rows if r.get("after")], "after")))
dis = [r for r in rows if r.get("at")]
mid = len(dis) // 2
print("SELECTORS", json.dumps({
    "n": len(dis),
    "domAll_ne_vtCount": sum(1 for r in dis if r["at"]["domAll"] != r["at"]["vtCount"]),
    "domHidden": sum(1 for r in dis if r["at"]["domAll"] != r["at"]["domVisible"]),
    "domAllP50": sorted(r["at"]["domAll"] for r in dis)[mid] if dis else None,
    "vtCountP50": sorted(r["at"]["vtCount"] for r in dis)[mid] if dis else None}))
unc = [r for r in fem if r.get("after") and not (r["after"]["inPatch"] or
       r["after"]["inPatchTop"] or r["after"]["whole"])]
print("FEMALE_UNCOVERED_SAMPLE", json.dumps(unc[:12]))
print("LIFE", json.dumps({"life": d.get("life"), "passes": d.get("passes"),
                          "slotsNonZero": sum(1 for x in (d.get("slots") or []) if x)}))
