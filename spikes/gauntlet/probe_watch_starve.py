# DOES THE PLAYER PASS STARVE THE THUMBNAIL DRAIN?
#
# On a watch page both compete for ONE worker: the player runs a person
# pass on a cadence forever, and the recommendations below it need
# images judged or they stay covered. His oldest report is "it processes
# some, then it halts" and "thumbnails that never resolve". Counted:
# images judged and player passes over the same windows, plus how many
# on-screen images are still wearing the cover at the end.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(35)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")

SNAP = """(function(){
  var vh=window.innerHeight||0;
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  function onScreen(i){var r=i.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<vh;}
  var vis=imgs.filter(onScreen);
  var d=(window.__TS_GAZE_VDIAG||{});
  var v=document.querySelector('video');
  return {t:Math.round(performance.now()/1000),
    imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    onScreen:vis.length,
    pending:vis.filter(function(i){return i.classList.contains('ts-gaze-pending');}).length,
    passes:d.passes||window.__TS_GAZE_PASSES||null,
    playing:!!(v&&!v.paused), vtime:v?Math.round(v.currentTime):null,
    patches:document.querySelectorAll('#tamescroll-gaze-regions *').length,
    vregions:document.querySelectorAll('.ts-gaze-vregion-clip *').length};})()"""

# SCROLLER GOTCHA: on m.youtube's watch page the scroller is <body>.
SCROLL = """(function(px){
  var best=document.scrollingElement, room=0;
  [document.scrollingElement, document.body, document.documentElement]
    .concat([].slice.call(document.querySelectorAll('ytm-app,#app,ytm-watch')))
    .forEach(function(n){ if(!n) return;
      var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;} });
  var b0=best.scrollTop; best.scrollTop=b0+px;
  return {tag:best.tagName.toLowerCase(), room:room, moved:best.scrollTop-b0};})"""

out=[]
out.append(dict(t.eval(SNAP), phase="video playing, not scrolled"))
time.sleep(20)
out.append(dict(t.eval(SNAP), phase="+20s idle"))
for i in range(6):
    mv=t.eval("(%s)(600)" % SCROLL)
    time.sleep(7)
    r=t.eval(SNAP); r["phase"]="scroll %d (%s moved %s)" % (i+1, mv["tag"], mv["moved"])
    out.append(r)
time.sleep(25)
out.append(dict(t.eval(SNAP), phase="settled after scrolling"))
print(json.dumps(out, indent=1))
