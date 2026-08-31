# Catch a patch painting inside the sticky player's band and dump
# everything about it: geometry, host, and -- with pointer events
# temporarily enabled on OUR patch (the 2026-08-31 lesson) -- whether it
# actually outranks the player where they overlap.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1})()")
time.sleep(8)

SAMPLE = """(function(){
  var pc=document.querySelector('#player-container-id');
  if(!pc) return {err:'no player'};
  var pr=pc.getBoundingClientRect();
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var nm=function(n){if(!n)return null;var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  var live=[], band=[];
  pats.forEach(function(p){
    var cs=getComputedStyle(p); var r=p.getBoundingClientRect();
    if(cs.display==='none'||r.height<=0) return;
    live.push(1);
    if(r.bottom>pr.top+1 && r.top<pr.bottom-1){
      // hit test where they overlap -- our patches are pointer-events:none
      var y=Math.max(r.top, pr.top)+2, x=Math.round(r.left+r.width/2);
      var old=p.style.pointerEvents; p.style.pointerEvents='auto';
      var stack=document.elementsFromPoint(x,y);
      p.style.pointerEvents=old;
      var iP=-1,iV=-1;
      for(var i=0;i<stack.length;i++){
        if(iP<0 && stack[i]===p) iP=i;
        if(iV<0 && pc.contains(stack[i])) iV=i;
      }
      band.push({rect:[r.left|0,r.top|0,r.width|0,r.height|0],
        clipTop: p.style.clipPath||p.style.clip||'',
        host: nm(p.parentElement), hostFixed: getComputedStyle(p.parentElement).position,
        z: cs.zIndex, iPatch:iP, iPlayer:iV,
        patchOverPlayer: (iP>=0 && iV>=0 && iP<iV),
        stackTop: stack.slice(0,3).map(nm)});
    }});
  return {playerTop:pr.top|0, playerBottom:pr.bottom|0, live:live.length,
          band:band, scrollY: Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    return t.eval("""(function(){
      window.scrollBy(0,%d); document.scrollingElement.scrollTop += %d;
      document.body.scrollTop += %d; return 1;})()""" % (px,px,px))

hits=[]; samples=0; steps=0
for direction in (90, 90, -90):
    for i in range(14):
        scroll(direction); time.sleep(0.55)
        s=t.eval(SAMPLE)
        if s.get("err"): continue
        steps+=1; samples+=s["live"]
        if s["band"]:
            hits.append({"scrollY":s["scrollY"],"playerBottom":s["playerBottom"],"band":s["band"]})
print(json.dumps({"steps":steps,"patchSamples":samples,"bandHits":len(hits),
                  "over": sum(1 for h in hits for b in h["band"] if b["patchOverPlayer"]),
                  "detail":hits[:6]}, indent=1))
