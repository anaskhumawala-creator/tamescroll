# HOW MANY OF THE IMAGES WE JUDGE ARE THE SAME IMAGE TWICE?
#
# Loop 9 measured that an image costs ~310ms to detect plus ~1.25s per
# face, regardless of size. A repeated url is that whole cost paid again
# for pixels already judged. The old note says a url verdict cache hits
# 4-8% -- but that was measured over THUMBNAILS, whose `sqp` parameter
# varies the crop per surface. Channel avatars have no sqp. This counts
# duplicates over the exact, untruncated url of every image the pipeline
# would actually take, split by whether it is an avatar or a thumbnail.
import json, time, sys
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://m.youtube.com/results?search_query=interview"

t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
  return 1;})()""")
time.sleep(5)

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)
time.sleep(12)
# Scroll the way a person does, so the sample is a real feed and not one
# screen of it.
for _ in range(6):
    try:
        t.eval("window.scrollBy(0,1400);1")
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
    time.sleep(3)

print(json.dumps(t.eval("""(function(){
  // The pipeline's own floor: below 48px an image is never looked at.
  var imgs=[].slice.call(document.images).filter(function(i){
    return (i.currentSrc||i.src) && Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  function tally(list){
    var seen={},dup=0;
    list.forEach(function(u){ if(seen[u]){dup++;} seen[u]=(seen[u]||0)+1; });
    var top=Object.keys(seen).sort(function(a,b){return seen[b]-seen[a];}).slice(0,3)
      .map(function(u){return [seen[u], u.length];});
    return {n:list.length, distinct:Object.keys(seen).length, repeats:dup,
            pct: list.length?Math.round(dup*1000/list.length)/10:0, topCounts:top};
  }
  var urls=imgs.map(function(i){return i.currentSrc||i.src;});
  var avatar=[],thumb=[];
  imgs.forEach(function(i){
    var u=i.currentSrc||i.src;
    (i.naturalWidth<120?avatar:thumb).push(u);
  });
  return {all:tally(urls), avatars:tally(avatar), thumbs:tally(thumb),
          judged: window.__TS_GAZE_IMGTOTAL||0};
})()"""), indent=1))
