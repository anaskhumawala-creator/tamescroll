# THE SAME CHANNEL PICTURE, AT TWO SIZES, IS TWO URLS.
#
# The verdict cache keys on the exact url, which is what makes replaying
# a verdict safe. But YouTube's avatar urls encode the RENDERED SIZE in
# the path token (=s68-c-k-c0x00ffffff-no-rj), so one channel picture
# shown at two sizes on one page is two urls and two full judgements.
# This counts how much of the avatar population that costs: distinct
# exact urls against distinct urls once ONLY the size number is
# neutralised (the crop and format flags after it are kept -- those
# really are different pixels).
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
for _ in range(6):
    try:
        t.eval("window.scrollBy(0,1400);1")
    except Exception:
        break
    time.sleep(3)

print(json.dumps(t.eval("""(function(){
  var imgs=[].slice.call(document.images).filter(function(i){
    return (i.currentSrc||i.src) && Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  function norm(u){
    // Only the size NUMBER goes. Everything after it -- the crop and
    // format flags -- stays, because those are different pixels.
    return u.replace(/=s\d+-/,'=s*-').replace(/=w\d+-h\d+-/,'=w*-h*-');
  }
  function count(list,f){var s={};list.forEach(function(u){s[f?f(u):u]=1;});return Object.keys(s).length;}
  var av=[],th=[],hosts={};
  imgs.forEach(function(i){
    var u=i.currentSrc||i.src;
    try{ hosts[new URL(u).host]=(hosts[new URL(u).host]||0)+1; }catch(e){}
    (i.naturalWidth<120?av:th).push(u);
  });
  return {avatars:{n:av.length, exact:count(av), normalised:count(av,norm)},
          thumbs:{n:th.length, exact:count(th), normalised:count(th,norm)},
          hosts:hosts,
          sample: av.slice(0,3).map(function(u){return u.slice(-70);})};
})()"""), indent=1))
