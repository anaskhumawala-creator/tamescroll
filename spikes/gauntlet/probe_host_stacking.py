# THE RESIDUAL HOLE IN THE ISOLATION FIX.
#
# isolation:isolate scopes a patch's z-index to its host, so the host
# takes part in the page at ITS OWN level. That is below the sticky
# player only while the host's own level is below the player's z-index 2.
# If YouTube ever gives a feed row a positive z-index, or an ancestor
# between it and the root creates a context above 2, the patch rides
# over the video again -- and the occluder clamp becomes the only net.
#
# So: for every element that could host a patch (the parent of a
# judgeable image), what is its own stacking level, and what is the
# highest context between it and the root?
import json, sys, time
from emu_cdp import page, Tab

PAGES = [("home", "https://m.youtube.com/"),
         ("search", "https://m.youtube.com/results?search_query=interview"),
         ("watch", "https://m.youtube.com/watch?v=NWoT1ZVd1Lo")]

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
    shown:['home','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)

SCAN = """(function(){
  var pc=document.getElementById('player-container-id');
  var playerZ = pc ? parseInt(getComputedStyle(pc).zIndex,10) : null;
  function ctx(n){
    var s=getComputedStyle(n);
    var z=(s.zIndex!=='auto' && s.position!=='static') ? parseInt(s.zIndex,10) : null;
    var why=null;
    if(s.position==='fixed'||s.position==='sticky') why='position:'+s.position;
    else if(z!==null) why='z-index:'+z;
    else if(s.opacity!=='1') why='opacity';
    else if(s.transform!=='none') why='transform';
    else if(s.filter!=='none') why='filter';
    else if(s.isolation==='isolate') why='isolation';
    else if(/paint|layout|strict|content/.test(s.contain||'')) why='contain';
    else if(s.willChange&&/transform|opacity|filter/.test(s.willChange)) why='will-change';
    return why ? {why:why, z:z, tag:n.tagName.toLowerCase()} : null;
  }
  // Everything the image pipeline would actually judge.
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    var b=i.getBoundingClientRect();
    return b.width>=48 && b.height>=48;});
  var hosts=[], seen=[];
  imgs.forEach(function(im){
    var h=im.parentElement;
    if(!h || seen.indexOf(h)>=0) return;
    seen.push(h);
    var chain=[], maxZ=null;
    for(var up=h; up && up!==document.documentElement; up=up.parentElement){
      if(pc && (up===pc || pc.contains(up))) { chain.push({tag:'IN-PLAYER'}); break; }
      var c=ctx(up);
      if(c){ chain.push(c); if(c.z!==null && (maxZ===null || c.z>maxZ)) maxZ=c.z; }
    }
    hosts.push({tag:h.tagName.toLowerCase(), w:Math.round(im.getBoundingClientRect().width),
      hostZ:(function(){var s=getComputedStyle(h);
        return (s.zIndex!=='auto'&&s.position!=='static')?parseInt(s.zIndex,10):null})(),
      maxZAbove:maxZ, chain:chain.slice(0,4)});
  });
  var risky=hosts.filter(function(h){
    return playerZ!==null && h.maxZAbove!==null && h.maxZAbove>=playerZ;});
  return {path:location.pathname, playerZ:playerZ, imgs:imgs.length, hosts:hosts.length,
    RISKY:risky, sample:hosts.slice(0,4)};})()"""

out={}
for name,url in PAGES:
    t.cmd("Page.navigate", url=url)
    time.sleep(30 if name!="watch" else 24)
    if name=="watch":
        t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
        time.sleep(10)
    try:
        out[name]=t.eval(SCAN)
    except Exception as e:
        t=Tab(page()); t.cmd("Runtime.enable"); out[name]={"err":str(e)[:60]}
print(json.dumps(out, indent=1))
