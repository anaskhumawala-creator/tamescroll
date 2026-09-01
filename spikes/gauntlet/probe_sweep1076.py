# RELEASE CHECK FOR 1076. Two things changed that can reach the screen:
# the clip layer is re-parented after every pass, and six render counters
# were added. Neither should move a patch, so this asks the pipeline the
# same questions the 1075 check asked, plus the new counters.
#
# The counters are the point of the run as much as the sweep is: a
# counter nobody has seen is a claim, and `clipRebuilt` above zero on a
# real feed would mean the page really does take our overlay layer away.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)

# --- ARM 1: the image path on a real search feed ------------------------
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview")
time.sleep(34)
for _ in range(5):
    t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,700); return 1;})()")
    time.sleep(4)
time.sleep(14)

IMG = r"""(function(){
  var out={imgTotal: window.__TS_GAZE_IMGTOTAL||0, errors:0, why:{}, onScreenPending:0,
           patches:0, inside:0, stray:0};
  var d = window.__TS_GAZE_IMGDIAG||[];
  for(var i=0;i<d.length;i++){
    var w=d[i].why||'?'; out.why[w]=(out.why[w]||0)+1;
    if(w==='error') out.errors++;
  }
  var imgs=document.querySelectorAll('img.ts-gaze-pending');
  for(var j=0;j<imgs.length;j++){
    var r=imgs[j].getBoundingClientRect();
    if(r.bottom>0 && r.top<innerHeight && r.width>0) out.onScreenPending++;
  }
  // A display:none patch is still in the DOM. Counting it overstates
  // coverage, which is the bias that runs the dangerous way.
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  for(var k=0;k<ps.length;k++){
    var p=ps[k], pr=p.getBoundingClientRect();
    if(!(pr.width>0 && pr.height>0) || getComputedStyle(p).display==='none') continue;
    out.patches++;
    var host=p.parentElement, im=host?host.querySelector('img'):null;
    if(!im){ out.stray++; continue; }
    var ir=im.getBoundingClientRect();
    if(pr.left>=ir.left-2 && pr.top>=ir.top-2 && pr.right<=ir.right+2 && pr.bottom<=ir.bottom+2) out.inside++;
    else out.stray++;
  }
  return JSON.stringify(out);
})()"""
print("SEARCH", t.eval(IMG))

# --- ARM 2: the player path, and the new counters -----------------------
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(32)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=217; v.play();} return 1;})()")
hosts = 0
for _ in range(20):
    time.sleep(5)
    o = t.eval("(function(){return String(document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    hosts = int(o) if isinstance(o, str) and o.strip().isdigit() else 0
    if hosts:
        break
print("PLAYER_HOSTS", hosts)
time.sleep(20)
print("RENDER", t.eval("(function(){return JSON.stringify(window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null);})()"))
print("REPORT_LIFE", t.eval(
    "(function(){try{var r=window.__TS_DIAG_NOW(); if(typeof r==='string') r=JSON.parse(r);"
    "return JSON.stringify({life:r.player&&r.player.life, render:r.render,"
    "violations:(window.__TS_DIAG_VIOLATIONS?window.__TS_DIAG_VIOLATIONS(r).length:null)});}"
    "catch(e){return 'ERR '+String(e);}})()"))
