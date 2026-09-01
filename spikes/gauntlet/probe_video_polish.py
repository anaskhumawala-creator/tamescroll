# HE SAYS HARAMBLUR'S VIDEO BLUR LOOKS MORE POLISHED THAN OURS. Step one
# is a number for OURS, or any change is guesswork. Sample the tracks the
# renderer is working from at ~8Hz on a real playing watch page and
# compute what "polished" actually means for a patch:
#   coverage   -- fraction of samples with at least one patch
#   dCount/s   -- how often the number of patches changes (flicker)
#   jitter     -- mean relative area change per second of a surviving
#                 patch (breathing)
#   drift      -- mean centre movement per second, normalized
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=55; v.play();} return 1;})()")
time.sleep(8)
S = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var boxes=[];
  try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
    if(e) e.forEach(function(en){(en.tracks||[]).forEach(function(b){boxes.push(b);});});
  }catch(err){}
  var drawn=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect(); var vr=v.getBoundingClientRect();
    return [(r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,
            r.width/vr.width, r.height/vr.height];});
  return {now:performance.now(), t:v?+v.currentTime.toFixed(2):null,
    paused:v?v.paused:null, tracks:boxes.length, drawn:drawn};})()"""
samples=[]
t0=time.time()
while time.time()-t0 < 75:
    s=t.eval(S)
    if s and s.get("now") is not None: samples.append(s)
    time.sleep(0.12)
# metrics
n=len(samples)
withPatch=sum(1 for s in samples if s["drawn"])
changes=0
for a,b in zip(samples, samples[1:]):
    if len(a["drawn"])!=len(b["drawn"]): changes+=1
dur=(samples[-1]["now"]-samples[0]["now"])/1000.0 if n>1 else 0
def area(d): return max(0.0,d[2])*max(0.0,d[3])
jit=[]; drift=[]
for a,b in zip(samples, samples[1:]):
    if len(a["drawn"])==1 and len(b["drawn"])==1:
        dt=(b["now"]-a["now"])/1000.0
        if dt<=0: continue
        A,B=a["drawn"][0], b["drawn"][0]
        if area(A)>0:
            jit.append(abs(area(B)-area(A))/area(A)/dt)
        ca=(A[0]+A[2]/2, A[1]+A[3]/2); cb=(B[0]+B[2]/2, B[1]+B[3]/2)
        drift.append((abs(cb[0]-ca[0])+abs(cb[1]-ca[1]))/dt)
def med(x): 
    x=sorted(x); return round(x[len(x)//2],4) if x else None
print(json.dumps({"samples":n,"seconds":round(dur,1),
  "sampleHz":round(n/dur,1) if dur else None,
  "coverage":round(withPatch/n,3) if n else None,
  "dCountPerSec":round(changes/dur,3) if dur else None,
  "areaJitterPerSec_median":med(jit),"areaJitterPerSec_mean":round(sum(jit)/len(jit),4) if jit else None,
  "centreDriftPerSec_median":med(drift),
  "pairsUsed":len(jit)}, indent=1))
