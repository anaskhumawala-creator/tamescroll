# BOTH OWNER ASKS IN ONE RUN.
# (1) the top-left YouTube mark must not be blurred any more, and the
#     account avatar must still be judged;
# (2) a patch clipped by the fixed top bar must have a SQUARE top edge.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(30)

LOGO = """(function(){
  var im=document.querySelector('img.mobile-topbar-logo');
  if(!im) return {logo:'absent'};
  var cs=getComputedStyle(im);
  return {logo:'present', filter:cs.filter,
    pending: im.classList.contains('ts-gaze-pending'),
    flagged: im.classList.contains('ts-gaze-flagged'),
    host:(im.currentSrc||im.src||'').split('/')[2]||''};})()"""
print("logo:", json.dumps(t.eval(LOGO)))

EDGE = """(function(){
  var bar=document.querySelector('ytm-mobile-topbar-renderer');
  var br=bar?bar.getBoundingClientRect():null;
  var out=[];
  [].slice.call(document.querySelectorAll('.ts-gaze-region-patch')).forEach(function(p){
    var cs=getComputedStyle(p); if(cs.display==='none') return;
    var r=p.getBoundingClientRect();
    out.push({top:Math.round(r.top), h:Math.round(r.height),
      tl:cs.borderTopLeftRadius, tr:cs.borderTopRightRadius,
      bl:cs.borderBottomLeftRadius,
      atBar: br? Math.abs(r.top-br.bottom)<2 : null});});
  return {barBottom: br?Math.round(br.bottom):null, n:out.length,
    clipped: out.filter(function(x){return x.atBar;}),
    sample: out.slice(0,4)};})()"""

def scroll(px):
    t.eval("(function(){window.scrollBy(0,%d);document.scrollingElement.scrollTop+=%d;return 1})()" % (px,px))

clipped=[]; total=0
for i in range(16):
    scroll(120); time.sleep(0.8)
    s=t.eval(EDGE); total+=s["n"]
    for c in s["clipped"]: clipped.append(c)
sq = sum(1 for c in clipped if c["tl"]=="0px" and c["tr"]=="0px")
print(json.dumps({"patchSamples":total, "clippedAtBar":len(clipped),
  "squareTop":sq, "roundedStillBottom": sum(1 for c in clipped if c["bl"]!="0px"),
  "examples":clipped[:4]}, indent=1))
