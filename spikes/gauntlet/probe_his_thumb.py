"""His exact thumbnail: search the title he saw, then read what our
pipeline decided about that image -- faces found, and if any, the gender
reads. Those are two different bugs and this tells them apart.
"""
import time, json
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
tab.eval("location.href='https://m.youtube.com/results?search_query=Only+tall+guys+can+clap+her'")
time.sleep(26)
print(tab.eval(r"""(function(){
  var rows=(window.__TS_GAZE_IMGDIAG||[]).filter(function(e){return e.w>300;});
  var items=[].slice.call(document.querySelectorAll('ytm-video-with-context-renderer')).slice(0,6)
    .map(function(el){
      var im=el.querySelector('img');
      var t=el.querySelector('h3,.media-item-headline');
      return {title:(t&&t.innerText||'').slice(0,44),
              src:im?im.currentSrc:null,
              cls:im?(im.classList.contains('ts-gaze-flagged')?'flagged':
                     im.classList.contains('ts-gaze-pending')?'pending':'clear'):null};
    });
  return JSON.stringify({items:items,rows:rows.map(function(e){
    return {src:(e.src||'').slice(24,36),faces:e.faces,why:e.why,flagged:e.flagged,reads:e.reads};})});
})()"""))
