# HE ASKED: is anything ELSE wrong the same way? The defect class is
# "geometry measured in viewport pixels, written into an element's own
# space". Audit every host we write into, on all three surfaces:
#   - every judgeable image's patch host
#   - the video player host
#   - the miniplayer's container (its transform is written the same way)
# A scale != 1 means the write is being scaled again.
import json, sys, time
from emu_cdp import page, Tab

AUDIT = """(function(){
  function scaleOf(el){ if(!el) return null; var r=el.getBoundingClientRect();
    var ow=el.offsetWidth; if(!(ow>0)||!(r.width>0)) return null;
    return +(r.width/ow).toFixed(3); }
  function transformedAncestors(el){ var out=[];
    for(var n=el&&el.parentElement;n&&n!==document.documentElement;n=n.parentElement){
      var cs=getComputedStyle(n);
      if(cs.transform&&cs.transform!=='none') out.push(n.tagName.toLowerCase()+
        (n.id?'#'+n.id:'')+' '+cs.transform.slice(0,40));
      if(cs.zoom&&cs.zoom!=='1'&&cs.zoom!=='normal') out.push('zoom '+cs.zoom+' on '+n.tagName);
    } return out; }
  var imgs=[].slice.call(document.images).filter(function(i){
    return i.naturalWidth>=48 && i.getBoundingClientRect().width>0;});
  var hostScales={}, weird=[];
  imgs.forEach(function(i){ var h=i.parentElement; var s=scaleOf(h);
    var k=String(s); hostScales[k]=(hostScales[k]||0)+1;
    if(s!==null && Math.abs(s-1)>0.01) weird.push({img:i.src.slice(0,60),
      host:h.tagName.toLowerCase()+(h.id?'#'+h.id:''), scale:s,
      anc:transformedAncestors(i)});});
  var v=document.querySelector('video');
  var mp=document.querySelector('#movie_player');
  var pc=document.querySelector('#player-container-id');
  return {url:location.pathname, images:imgs.length, hostScales:hostScales,
    weird:weird.slice(0,5),
    moviePlayerScale:scaleOf(mp), playerContainerScale:scaleOf(pc),
    pcTransformedAncestors: pc?transformedAncestors(pc):null,
    videoHostScale: v?scaleOf(v.parentElement):null,
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length};})()"""

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs','home_chips']}); return 1;})()""")
time.sleep(5)
out={}
for name,url,wait in [("home","https://m.youtube.com/",26),
                      ("search","https://m.youtube.com/results?search_query=podcast+interview",26),
                      ("watch","https://m.youtube.com/watch?v=NWoT1ZVd1Lo",30)]:
    t.cmd("Page.navigate", url=url); time.sleep(wait)
    for i in range(3):
        t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,600); return 1;})()")
        time.sleep(2)
    out[name]=t.eval(AUDIT)
print(json.dumps(out, indent=1))
