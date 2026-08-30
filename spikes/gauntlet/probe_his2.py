import time
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
tab.cmd("Emulation.setUserAgentOverride", userAgent=(
    "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"))
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
        deviceScaleFactor=2.0, mobile=True)
tab.eval("location.href='https://m.youtube.com/results?search_query=Only+tall+guys+can+clap+her'")
time.sleep(28)
print(tab.eval(r"""(function(){
  var ring=(window.__TS_GAZE_IMGDIAG||[]);
  function seen(s){for(var i=ring.length-1;i>=0;i--) if(ring[i].src===s) return ring[i]; return null;}
  var out=[].slice.call(document.images).filter(function(i){
    var r=i.getBoundingClientRect(); return r.width>250;}).slice(0,8).map(function(i){
    var e=seen(i.currentSrc);
    return {w:Math.round(i.getBoundingClientRect().width),nat:i.naturalWidth+'x'+i.naturalHeight,
      cls:i.classList.contains('ts-gaze-flagged')?'flagged':
          i.classList.contains('ts-gaze-pending')?'pending':'clear',
      id:(i.currentSrc||'').slice(24,35),judged:!!e,faces:e?e.faces:null,
      why:e?e.why:null,reads:e?e.reads:null};});
  return JSON.stringify({url:location.href,n:out.length,imgs:out});
})()"""))
