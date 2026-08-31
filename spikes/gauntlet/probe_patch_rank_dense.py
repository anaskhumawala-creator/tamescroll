# SUPERSEDED BY probe_patch_rank2.py -- DO NOT TRUST THIS FILE'S
# NUMBERS. It queries `#tamescroll-gaze-regions`, an id that has not
# existed since 2026-08-24 (00ce2c8, parent-anchored patches), so its
# patchesMax is 0 on every device in every arm. Real selectors:
# `.ts-gaze-region-patch` (image) and `.ts-gaze-vregion-clip > *`
# (video). MEASURED on the owner's phone the same night, same page,
# same 180s: this file 0 patches, probe_patch_rank2 imgMax 7.
# PRIORITY 1, DENSER INSTRUMENT. Every previous answer to "does a
# recommendation's blur paint over the video" came from a HANDFUL of
# CDP-sampled moments (232 patch samples across whole sessions). A CDP
# round trip here is ~1s, so those probes could only ever see the page
# at rest -- and his report is of something he SAW, which means a frame.
#
# This samples IN PAGE at 10Hz for the whole run, so a transient (a
# sticky transition, a scroll step, the frame right after a verdict)
# cannot hide between samples. Patches are pointer-events:none by
# design, so the probe forces them hit-testable for the session --
# without that every hit test is blind (the 2026-08-31 loop 2 lesson).
import json, sys, time
from emu_cdp import page, Tab
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 9226
SECS=float(sys.argv[2]) if len(sys.argv)>2 else 180.0
# WHICH ARM. Loop 19 measured this same video at 37% coverage with
# gender='man' and 0% with 'woman' -- so the arm is not a detail, it is
# whether the instrument has anything to rank at all. A run on the wrong
# one returns patchesMax 0 and reads exactly like an empty pipeline.
GENDER=sys.argv[3] if len(sys.argv)>3 else 'man'

t=Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['home','watch_recs']}); return 1;})()""" % GENDER)
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(45)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

t.eval("""(function(){
  if(window.__TS_RANK) return 'already';
  var st=document.createElement('style'); st.id='ts-probe-hit';
  st.textContent='#tamescroll-gaze-regions > *{pointer-events:auto !important}';
  document.documentElement.appendChild(st);
  var S={samples:0,overlap:0,above:0,worst:null,frames:0,noPlayer:0,patchesMax:0};
  var last=0;
  function tick(ts){
    if(S.stop) return;
    S.frames++;
    if(ts-last>=100){
      last=ts;
      var pc=document.querySelector('#player-container-id');
      var pr=pc?pc.getBoundingClientRect():null;
      if(!pr||pr.width<2){ S.noPlayer++; requestAnimationFrame(tick); return; }
      var ps=document.querySelectorAll('#tamescroll-gaze-regions > *');
      if(ps.length>S.patchesMax) S.patchesMax=ps.length;
      for(var i=0;i<ps.length;i++){
        var r=ps[i].getBoundingClientRect();
        if(r.width<2||r.height<2) continue;
        var ox=Math.max(0,Math.min(r.right,pr.right)-Math.max(r.left,pr.left));
        var oy=Math.max(0,Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top));
        if(ox<=1||oy<=1) continue;
        S.overlap++;
        var cx=Math.max(pr.left,r.left)+ox/2, cy=Math.max(pr.top,r.top)+oy/2;
        var hits=document.elementsFromPoint(cx,cy);
        var iPatch=-1,iPlayer=-1;
        for(var h=0;h<hits.length;h++){
          var e=hits[h];
          if(iPatch<0 && e===ps[i]) iPatch=h;
          if(iPlayer<0 && (e===pc||(pc&&pc.contains(e)))) iPlayer=h;
        }
        S.samples++;
        if(iPatch>=0 && (iPlayer<0 || iPatch<iPlayer)){
          S.above++;
          if(!S.worst) S.worst={x:Math.round(cx),y:Math.round(cy),iPatch:iPatch,iPlayer:iPlayer,
            box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
            player:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
            top:(hits[0]&&hits[0].tagName)+'.'+((hits[0]&&hits[0].className)||'').toString().slice(0,40)};
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__TS_RANK=function(){S.stop=true; return JSON.stringify(S);};
  return 'started';})()""")

# drive the page the way he does: scroll the recommendations under the
# sticky player, in both directions, for the whole window
t0=time.time(); step=0
while time.time()-t0 < SECS:
    d = 420 if (step//4) % 2 == 0 else -420
    t.eval("(function(){var e=document.scrollingElement||document.body;"
           "var b=document.body; var s=(b.scrollHeight>e.scrollHeight)?b:e;"
           "s.scrollBy(0,%d); return 1;})()" % d)
    step += 1
    time.sleep(2.0)
raw=t.eval("(function(){return window.__TS_RANK?window.__TS_RANK():'{}';})()")
S=json.loads(raw) if isinstance(raw,str) else (raw or {})
extra=t.eval("""(function(){
 var st=document.getElementById('ts-probe-hit'); if(st) st.remove();
 var v=document.querySelector('video');
 return {paused:v?v.paused:null, ct:v?Math.round(v.currentTime):null,
   patchesNow:document.querySelectorAll('#tamescroll-gaze-regions > *').length,
   bundle:window.__TS_GAZE_BUNDLE__};})()""")
S.update(extra or {}); S["secs"]=round(time.time()-t0,1); S["steps"]=step
print(json.dumps(S, indent=1))
