# WAS SHE ACTUALLY UNCOVERED? The second-delay number, re-measured with
# an instrument that can see every way a person gets covered.
#
# probe_her/probe_her2 classified a read as UNCOVERED when
# document.querySelectorAll('.ts-gaze-vregion-host').length === 0. That
# is region patches only, and it is blind in BOTH directions:
#
#   (1) WHOLE BLUR is invisible. When setTracks cannot find the player
#       host it falls back to markFlagged(video) -- the whole video is
#       covered and there are zero region patches. Blur-first PENDING is
#       the same picture. Those moments were counted as exposures.
#   (2) ANY patch on screen counted as covering HER. A patch over the
#       man beside her satisfied the old test.
#
# This asks the honest question per read: at that moment, was the centre
# of the region this read came from inside something that covers it --
# a rendered track box, or whole blur on the video.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID  = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 150
DWELL= int(sys.argv[4]) if len(sys.argv) > 4 else 240

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)

print("ARM", t.eval("""(function(){
  var v=document.querySelector('video');
  if(v){ try{ v.currentTime=%d; v.play(); }catch(e){} }
  window.__TS_CV={reads:[],stop:0}; var seen=0;
  function coverOf(b){
    // b = [x1,y1,x2,y2] normalized on the video. Returns how this read's
    // own region was covered at this instant.
    var out={whole:0,inPatch:0,patches:0};
    try{
      // The LARGEST video is the watch player; a feed preview reuses
      // the shared element but a wrong pick here would read the blur
      // state of something nobody is looking at.
      var vs=document.querySelectorAll('video'), vid=null, best=-1;
      for(var q=0;q<vs.length;q++){
        var rr=vs[q].getBoundingClientRect(), ar=rr.width*rr.height;
        if(ar>best){ best=ar; vid=vs[q]; }
      }
      if(vid && (vid.classList.contains('ts-gaze-pending')||
                 vid.classList.contains('ts-gaze-flagged'))) out.whole=1;
      var f=window.__TS_GAZE_VTRACKS?window.__TS_GAZE_VTRACKS():[];
      var cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2;
      for(var i=0;i<f.length;i++){
        var tr=f[i].tracks||[]; out.patches+=tr.length;
        for(var j=0;j<tr.length;j++){
          var k=tr[j];
          if(cx>=k[0]&&cx<=k[2]&&cy>=k[1]&&cy<=k[3]) out.inPatch=1;
        }
      }
    }catch(e){}
    return out;
  }
  (function loop(){
    var st=window.__TS_CV; if(st.stop) return;
    try{
      var r=(window.__TS_GAZE_IDS||{}).reads||[];
      if(r.length>seen){
        for(var i=seen;i<r.length;i++){
          var e=r[i]||{};
          var c=e.b?coverOf(e.b):{whole:0,inPatch:0,patches:0};
          st.reads.push({ms:Math.round(performance.now()),g:e.g,s:e.s,a:e.a,
                         pc:e.pc,ab:e.ab,px:e.px,b:e.b,
                         whole:c.whole,inPatch:c.inPatch,patches:c.patches});
        }
        seen=r.length;
      } else if(r.length<seen){ seen=r.length; }
    }catch(e){}
    requestAnimationFrame(loop);
  })();
  return JSON.stringify({t:%d,bundle:window.__TS_GAZE_BUNDLE__});
})()""" % (SEEK, SEEK)))

time.sleep(DWELL)
raw = t.eval("""(function(){var st=window.__TS_CV||{};st.stop=1;
  var d=window.__TS_GAZE_IDS||{};
  return JSON.stringify({reads:st.reads||[],life:d.life,passes:d.passesTotal,
    slots:(d.slots||[]).map(function(s){return s.n;})});})()""")
d = json.loads(raw) if isinstance(raw, str) else {}
reads = d.get("reads", [])
fem = [r for r in reads if r.get("g") == "female"]

def bucket(rs):
    return {
      "n": len(rs),
      "covered_inPatch": sum(1 for r in rs if r.get("inPatch")),
      "covered_wholeOnly": sum(1 for r in rs if not r.get("inPatch") and r.get("whole")),
      "UNCOVERED": sum(1 for r in rs if not r.get("inPatch") and not r.get("whole")),
      # what the OLD instrument would have said
      "old_uncovered": sum(1 for r in rs if not r.get("patches")),
      # a patch on screen that is NOT over her -- the old test's false pass
      "patchButNotHers": sum(1 for r in rs if r.get("patches") and not r.get("inPatch") and not r.get("whole")),
    }

print("FEMALE", json.dumps(bucket(fem)))
print("ALL", json.dumps(bucket(reads)))
unc = [r for r in fem if not r.get("inPatch") and not r.get("whole")]
print("UNCOVERED_SAMPLE", json.dumps(unc[:16]))
print("LIFE", json.dumps({"life": d.get("life"), "passes": d.get("passes"),
                          "slotsNonZero": sum(1 for x in (d.get("slots") or []) if x)}))
