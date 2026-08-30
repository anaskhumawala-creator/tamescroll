# Same defect, on the surface that can actually produce patches.
#
# The occluder clamp lives ONLY inside positionEntry, and the 500ms sweep
# calls positionEntry only when the element's PARENT-RELATIVE rect
# changed. A scroll moves a thumbnail together with its parent, so that
# rect is identical and positionEntry never runs again -- while the
# clamp's own gate is VIEWPORT-relative. So a patch minted low on the
# page keeps occ = 0 for the life of the page and rides up under the
# fixed chrome still wearing it.
import json, time
from emu_cdp import page, Tab

URL = "https://m.youtube.com/results?search_query=podcast+interview+face"

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
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
t.cmd("Page.navigate", url=URL)
time.sleep(40)

REPORT = """(function(){
  var bar=null, barB=0;
  [[Math.round(innerWidth/2),4],[Math.round(innerWidth/2),20]].forEach(function(p){
    (document.elementsFromPoint(p[0],p[1])||[]).forEach(function(n){
      for(var up=n; up && up!==document.body; up=up.parentElement){
        var ps; try{ps=getComputedStyle(up).position}catch(e){break}
        if(ps==='fixed'||ps==='sticky'){
          var r=up.getBoundingClientRect();
          if(r.height>0 && r.bottom>barB){barB=r.bottom; bar=up.tagName.toLowerCase()+'.'+String(up.className||'').split(' ')[0];}
          break;
        }
      }
    });
  });
  var out={scrollY:Math.round(window.scrollY), bar:bar, barBottom:Math.round(barB),
           patches:0, onScreen:0, escaped:[], judged:window.__TS_GAZE_IMGTOTAL||0};
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  out.patches=ps.length;
  if(!barB) return out;
  ps.forEach(function(o){
    if(o.style.display==='none') return;
    var b=o.getBoundingClientRect();
    if(b.width<1||b.height<1||b.bottom<=0||b.top>=innerHeight) return;
    out.onScreen++;
    if(b.top >= barB) return;
    var over = Math.round(Math.min(b.bottom,barB) - Math.max(b.top,0));
    if(over<=0) return;
    var x=Math.round(b.left+Math.min(4,b.width/2)), y=Math.round(Math.max(b.top,0)+2);
    var hits=document.elementsFromPoint(x,y)||[];
    var iP=hits.indexOf(o), iBar=-1;
    for(var k=0;k<hits.length;k++){
      for(var up=hits[k]; up && up!==document.body; up=up.parentElement){
        var p2; try{p2=getComputedStyle(up).position}catch(e){break}
        if(p2==='fixed'||p2==='sticky'){iBar=k;break;}
      }
      if(iBar>=0) break;
    }
    out.escaped.push({intoChromePx:over, patchTop:Math.round(b.top), barBottom:Math.round(barB),
                      iPatch:iP, iBar:iBar, patchWins: iP>=0 && (iBar<0 || iP<iBar)});
  });
  return out;})()"""

runs=[{"phase":"settled","r":t.eval(REPORT)}]
for step in range(1,10):
    t.eval("window.scrollBy(0, 220);")
    time.sleep(0.7)
    runs.append({"phase":"scroll %d"%step,"r":t.eval(REPORT)})
time.sleep(3)
runs.append({"phase":"+3s (six sweeps)","r":t.eval(REPORT)})
print(json.dumps(runs, indent=1))
