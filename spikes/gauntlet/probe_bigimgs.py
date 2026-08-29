import json
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
print(tab.eval(r"""(function(){
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  function seen(src){ for(var i=ring.length-1;i>=0;i--) if(ring[i].src===src) return ring[i]; return null; }
  var out=[].slice.call(document.images).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>250;}).slice(0,10).map(function(i){
    var e=seen(i.currentSrc);
    return {w:Math.round(i.getBoundingClientRect().width),
            nat:i.naturalWidth+'x'+i.naturalHeight,
            cls:i.classList.contains('ts-gaze-flagged')?'flagged':
                i.classList.contains('ts-gaze-pending')?'pending':'clear',
            id:(i.currentSrc||'').slice(24,35),
            judged:!!e, faces:e?e.faces:null, why:e?e.why:null,
            reads:e?e.reads:null};});
  return JSON.stringify({n:out.length,imgs:out,total:window.__TS_GAZE_IMGTOTAL});
})()"""))
