# THE CADENCE NUMBER IN probe_phone_baseline.py WAS A RING ARTIFACT.
# diag-report's player.passes is `stages.length` over a ring capped at
# 120 in page and sliced to 40 in the report, so it SATURATES at 40 and
# a b-minus-a diff measures the fill, not the rate. Same defect class as
# the documented __TS_GAZE_IMGDIAG one.
#
# This counts for real: the ring holds live objects, so tag each one the
# first time it is seen and count the tags. Polling at 250ms is far
# faster than the ring can turn over, so nothing is missed.
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9225
LABEL=sys.argv[2] if len(sys.argv)>2 else "1067"
SECS=float(sys.argv[3]) if len(sys.argv)>3 else 150.0

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(26)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(12)

# tag-and-count collector, driven in page so a slow CDP round trip
# cannot lose an entry
t.eval("""(function(){
  if(window.__TS_CAD) return 'already';
  var st={v:0,p:0,vms:[],pms:[],t0:performance.now(),stopped:false,ticks:0,
          raf:0,cov:0,frames:0};
  // SMOOTHNESS IS THE OTHER HALF OF THE A/B. Cheaper passes raise the
  // pass RATE (the duty rule is cost-proportional), so a cadence win
  // that costs frames is not a win -- sample the render loop and the
  // fraction of frames with a patch up, in page, at rAF.
  (function raf(){ if(st.stopped) return; st.raf++;
    if(document.querySelectorAll('.ts-gaze-vregion-host').length) st.cov++;
    st.frames++; requestAnimationFrame(raf); })();
  var iv=setInterval(function(){
    st.ticks++;
    var r=(window.__TS_GAZE_IDS&&window.__TS_GAZE_IDS.stages)||[];
    for(var i=0;i<r.length;i++){
      var e=r[i]; if(!e||e.__seen) continue; e.__seen=1;
      if(e.v){st.v++; if(typeof e.end==='number') st.vms.push(Math.round(e.end));}
      else {st.p++; if(typeof e.end==='number') st.pms.push(Math.round(e.end));}
    }
  },250);
  window.__TS_CAD=function(){clearInterval(iv); st.stopped=true;
    st.secs=(performance.now()-st.t0)/1000;
    st.rafHz=Math.round(st.raf/st.secs*10)/10;
    st.coverage=Math.round(st.cov/Math.max(1,st.frames)*1000)/1000;
    return JSON.stringify(st);};
  return 'started';})()""")

time.sleep(SECS)
raw=t.eval("(function(){return window.__TS_CAD?window.__TS_CAD():'{}';})()")
st=json.loads(raw) if isinstance(raw,str) else (raw or {})
extra=t.eval("""(function(){
  var v=document.querySelector('video');
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){}
  var p=(d&&d.player)||{};
  return {paused:v?v.paused:null, ct:v?Math.round(v.currentTime):null,
    slotsN:(p.slots||[]).map(function(s){return s.n;}),
    hosts:document.querySelectorAll('.ts-gaze-vregion-host').length,
    bundle:window.__TS_GAZE_BUNDLE__||null};})()""")

def pct(a,q):
    if not a: return None
    a=sorted(a); return a[min(len(a)-1,int(q*len(a)))]
secs=st.get("secs") or SECS
out={"label":LABEL,"secs":round(secs,1),
 "verdicts":st.get("v"),"positions":st.get("p"),
 "verdictsPerMin":round((st.get("v") or 0)*60.0/secs,2),
 "secsPerVerdict":round(secs/max(1,st.get("v") or 0),2),
 "positionsPerMin":round((st.get("p") or 0)*60.0/secs,2),
 "verdictMsP50":pct(st.get("vms") or [],0.5),
 "verdictMsP95":pct(st.get("vms") or [],0.95),
 "positionMsP50":pct(st.get("pms") or [],0.5),
 "ticks":st.get("ticks"), "rafHz":st.get("rafHz"), "coverage":st.get("coverage")}
out.update(extra or {})
print(json.dumps(out, indent=1))
