# PRIORITY 1, WITH AN INSTRUMENT THAT SELECTS SOMETHING.
#
# probe_patch_rank_dense.py queries `#tamescroll-gaze-regions > *`. That
# id has not existed since 2026-08-24 (00ce2c8, "parent-anchored
# patches"): image patches are `.ts-gaze-region-patch` appended to the
# thumbnail's own host, and video patches live in `.ts-gaze-vregion-clip`
# inside the player. So its patchesMax 0 was guaranteed on any hardware
# in any arm -- it was never counting patches at all.
#
# This one counts BOTH layers, keeps them apart (his report is about a
# RECOMMENDATION's blur, which is the image path), forces our patches
# hit-testable (they are pointer-events:none, which blinded three earlier
# sessions) and ranks every overlapping one against the player.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 180.0
GENDER = sys.argv[3] if len(sys.argv) > 3 else 'man'
VID = sys.argv[4] if len(sys.argv) > 4 else 'NWoT1ZVd1Lo'

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['home','watch_recs']}); return 1;})()""" % GENDER)
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID); time.sleep(45)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

t.eval("""(function(){
  if(window.__TS_RANK2) return 'already';
  var st=document.createElement('style'); st.id='ts-probe-hit2';
  st.textContent='.ts-gaze-region-patch,.ts-gaze-vregion-clip > *{pointer-events:auto !important}';
  document.documentElement.appendChild(st);
  var S={frames:0,ticks:0,noPlayer:0,
         imgMax:0,vidMax:0,imgSeen:0,vidSeen:0,
         overlap:0,ranked:0,above:0,worst:null,
         hostInPlayer:0,unclipped:0};
  var last=0;
  function rank(el, pc, pr, kind){
    var r=el.getBoundingClientRect();
    if(r.width<2||r.height<2) return;
    var ox=Math.max(0,Math.min(r.right,pr.right)-Math.max(r.left,pr.left));
    var oy=Math.max(0,Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top));
    if(ox<=1||oy<=1) return;
    S.overlap++;
    // A VIDEO patch is SUPPOSED to be over the player. Only an IMAGE
    // patch overlapping it is the owner's report.
    if(kind!=='img') return;
    var cx=Math.max(pr.left,r.left)+ox/2, cy=Math.max(pr.top,r.top)+oy/2;
    var hits=document.elementsFromPoint(cx,cy);
    var iPatch=-1,iPlayer=-1;
    for(var h=0;h<hits.length;h++){
      var e=hits[h];
      if(iPatch<0 && e===el) iPatch=h;
      if(iPlayer<0 && (e===pc||(pc&&pc.contains(e)))) iPlayer=h;
    }
    S.ranked++;
    if(iPatch>=0 && (iPlayer<0 || iPatch<iPlayer)){
      S.above++;
      if(!S.worst) S.worst={x:Math.round(cx),y:Math.round(cy),iPatch:iPatch,iPlayer:iPlayer,
        box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        player:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
        host:(el.parentElement&&el.parentElement.tagName)+'.'+
             ((el.parentElement&&el.parentElement.className)||'').toString().slice(0,50),
        top:(hits[0]&&hits[0].tagName)+'.'+((hits[0]&&hits[0].className)||'').toString().slice(0,40)};
    }
  }
  function tick(ts){
    if(S.stop) return;
    S.frames++;
    if(ts-last>=100){
      last=ts; S.ticks++;
      var pc=document.querySelector('#player-container-id');
      var pr=pc?pc.getBoundingClientRect():null;
      var imgs=document.querySelectorAll('.ts-gaze-region-patch');
      var vids=document.querySelectorAll('.ts-gaze-vregion-clip > *');
      if(imgs.length>S.imgMax) S.imgMax=imgs.length;
      if(vids.length>S.vidMax) S.vidMax=vids.length;
      S.imgSeen+=imgs.length; S.vidSeen+=vids.length;
      // Is any image patch HOSTED inside the player subtree? That is a
      // separate mechanism from stacking and needs no overlap to fire.
      for(var q=0;q<imgs.length;q++){
        if(pc && pc.contains(imgs[q])) S.hostInPlayer++;
      }
      if(!pr||pr.width<2){ S.noPlayer++; requestAnimationFrame(tick); return; }
      for(var i=0;i<imgs.length;i++) rank(imgs[i],pc,pr,'img');
      for(var j=0;j<vids.length;j++) rank(vids[j],pc,pr,'vid');
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  window.__TS_RANK2=function(){S.stop=true; return JSON.stringify(S);};
  return 'started';})()""")

t0=time.time(); step=0
while time.time()-t0 < SECS:
    d = 420 if (step//4) % 2 == 0 else -420
    t.eval("(function(){var e=document.scrollingElement||document.body;"
           "var b=document.body; var s=(b.scrollHeight>e.scrollHeight)?b:e;"
           "s.scrollBy(0,%d); return 1;})()" % d)
    step += 1
    time.sleep(2.0)

raw=t.eval("(function(){return window.__TS_RANK2?window.__TS_RANK2():'{}';})()")
S=json.loads(raw) if isinstance(raw,str) else (raw or {})
extra=t.eval("""(function(){
 var st=document.getElementById('ts-probe-hit2'); if(st) st.remove();
 var v=document.querySelector('video');
 return {paused:v?v.paused:null, ct:v?Math.round(v.currentTime):null,
   imgNow:document.querySelectorAll('.ts-gaze-region-patch').length,
   vidNow:document.querySelectorAll('.ts-gaze-vregion-clip > *').length,
   deadId:document.querySelectorAll('#tamescroll-gaze-regions > *').length,
   bundle:window.__TS_GAZE_BUNDLE__};})()""")
S.update(extra or {}); S["secs"]=round(time.time()-t0,1); S["steps"]=step; S["gender"]=GENDER
print(json.dumps(S, indent=1))
