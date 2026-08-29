# Desktop www.youtube has a genuinely fixed masthead that thumbnails
# scroll under -- the one surface where the 1045 occluder clamp has a
# real job. Does a patch ever paint above the masthead's bottom edge?
# JSON only, headless emulator, desktop UA.
import json, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36")

def open_youtube():
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

open_youtube()
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Emulation.setDeviceMetricsOverride", width=1280, height=800,
      deviceScaleFactor=1, mobile=False)
t.cmd("Page.navigate", url="https://www.youtube.com/")
time.sleep(20)

head = t.eval("""(function(){
  var m=document.querySelector('ytd-masthead');
  var cs=m?getComputedStyle(m):null;
  return {masthead: !!m, pos:cs?cs.position:null, z:cs?cs.zIndex:null,
    bottom: m?Math.round(m.getBoundingClientRect().bottom):null,
    judged:window.__TS_GAZE_IMGTOTAL||0,
    patches:document.querySelectorAll('.ts-gaze-patch').length,
    items:document.querySelectorAll('ytd-rich-item-renderer').length};})()""")

samples=[]
for step in range(16):
    t.eval("window.scrollBy(0,300)")
    time.sleep(0.6)
    samples.append(t.eval("""(function(){
      var m=document.querySelector('ytd-masthead');
      if(!m) return null;
      var mb=m.getBoundingClientRect().bottom;
      var mvis=getComputedStyle(m).visibility!=='hidden' &&
               m.getBoundingClientRect().height>0;
      var ps=[].slice.call(document.querySelectorAll('.ts-gaze-patch'));
      var above=0, hidden=0, clamped=0, det=[];
      ps.forEach(function(p){
        var r=p.getBoundingClientRect();
        if(getComputedStyle(p).display==='none'){hidden++; return;}
        if(r.height===0) return;
        if(mvis && r.top < mb - 0.5){
          // does it actually PAINT there, or is the masthead over it?
          var x=r.left+r.width/2, y=Math.max(1, r.top+1);
          var stack=document.elementsFromPoint(x,y)||[];
          var first=null;
          for(var i=0;i<stack.length;i++){
            var e=stack[i];
            if(e.classList&&e.classList.contains('ts-gaze-patch')){first='patch';break;}
            if(e===m||m.contains(e)){first='masthead';break;}}
          if(first==='patch'){above++; det.push({top:Math.round(r.top),
            mb:Math.round(mb), h:Math.round(r.height)});}
          else clamped++;
        }});
      return {y:Math.round(scrollY), patches:ps.length, mastheadBottom:Math.round(mb),
              paintingAbove:above, clampedOrCovered:clamped, hiddenPatches:hidden,
              det:det.slice(0,2)};})()"""))
s=[x for x in samples if x]
print(json.dumps({"head":head, "samples":s[-6:],
  "patch_max": max([x["patches"] for x in s] or [0]),
  "painting_above_total": sum(x["paintingAbove"] for x in s),
  "clamped_total": sum(x["clampedOrCovered"] for x in s),
  "hidden_total": sum(x["hiddenPatches"] for x in s)}, indent=1))
