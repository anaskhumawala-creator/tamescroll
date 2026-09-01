# The pass rate on this emulator is ~9x slower than his phone, so
# pass-driven smoothness cannot be measured here. The RENDER side can:
# the loop interpolates at 60Hz whatever the pass rate, and that is what
# "polished" looks like frame to frame. Collect in-page (a CDP round trip
# is ~1s here, which would sample at 1Hz and see nothing).
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd('Runtime.enable')
print('collector:', t.eval("(function(){\n  if (window.__TS_POLISH) return 'already';\n  var out=[]; var stop=false;\n  function tick(){\n    if(stop) return;\n    var v=document.querySelector('#movie_player video')||document.querySelector('video');\n    if(v){ var vr=v.getBoundingClientRect();\n      if(vr.width>0){\n        var ds=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){\n          var r=o.getBoundingClientRect();\n          return [(r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,r.width/vr.width,r.height/vr.height];});\n        out.push([performance.now(), ds]);\n      }}\n    requestAnimationFrame(tick);\n  }\n  requestAnimationFrame(tick);\n  window.__TS_POLISH=function(){ stop=true; return out; };\n  return 'started';})()"))
time.sleep(45)
raw = t.eval('(function(){ var d=window.__TS_POLISH?window.__TS_POLISH():[];\n  return JSON.stringify(d.slice(0, 4000)); })()')
data = json.loads(raw) if isinstance(raw, str) else []
n=len(data)
frames_with=sum(1 for r in data if r[1])
changes=0
for a,b in zip(data, data[1:]):
    if len(a[1])!=len(b[1]): changes+=1
dur=(data[-1][0]-data[0][0])/1000.0 if n>1 else 0
def area(d): return max(0.0,d[2])*max(0.0,d[3])
jit=[]; drift=[]; steps=0
for a,b in zip(data, data[1:]):
    if len(a[1])==1 and len(b[1])==1:
        dt=(b[0]-a[0])/1000.0
        if dt<=0: continue
        A,B=a[1][0], b[1][0]
        if area(A)>0: jit.append(abs(area(B)-area(A))/area(A)/dt)
        ca=(A[0]+A[2]/2, A[1]+A[3]/2); cb=(B[0]+B[2]/2, B[1]+B[3]/2)
        drift.append((abs(cb[0]-ca[0])+abs(cb[1]-ca[1]))/dt)
        if abs(B[0]-A[0])+abs(B[1]-A[1])+abs(B[2]-A[2])+abs(B[3]-A[3]) > 1e-9: steps+=1
def med(x):
    x=sorted(x); return round(x[len(x)//2],5) if x else None
print(json.dumps({'frames':n,'seconds':round(dur,1),
  'renderHz':round(n/dur,1) if dur else None,
  'framesWithPatch':frames_with,
  'coverage':round(frames_with/n,3) if n else None,
  'dCountPerSec':round(changes/dur,3) if dur else None,
  'movingFrameFrac':round(steps/len(jit),3) if jit else None,
  'areaJitterPerSec_median':med(jit),
  'centreDriftPerSec_median':med(drift),
  'pairs':len(jit)}, indent=1))
