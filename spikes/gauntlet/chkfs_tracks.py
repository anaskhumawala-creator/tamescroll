# MAPPING OR TRACKING? Same frozen frame, both states, now reading the
# TRACK boxes the renderer was handed alongside what it drew. Identical
# tracks + different drawn boxes = our mapping. Different tracks = the
# pipeline saw something different, and the geometry is innocent.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(34)
SAMPLE = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  if(!v) return {err:'no video'};
  var vr=v.getBoundingClientRect();
  var drawn=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +((r.left-vr.left+r.width)/vr.width).toFixed(3),
            +((r.top-vr.top+r.height)/vr.height).toFixed(3)];});
  drawn.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  var tr=[];
  try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
    if(e&&e.length) tr=e[0].tracks.map(function(b){return b.map(function(n){return +Number(n).toFixed(3);});});
    tr.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  }catch(err){ tr=[String(err).slice(0,50)]; }
  return {fs:!!document.fullscreenElement, t:+v.currentTime.toFixed(2), paused:v.paused,
    vw:Math.round(vr.width), drawn:drawn, tracks:tr,
    hook: typeof window.__TS_GAZE_VTRACKS};})()"""
def click(x,y):
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    time.sleep(0.04)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=60; v.play();} return 1;})()")
for i in range(30):
    s=t.eval(SAMPLE)
    if s.get("drawn"): break
    time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(3)
win=t.eval(SAMPLE)
frozen=win.get("t")
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(1.5)
pc=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
click(pc[0], pc[1])
b=t.eval("""(function(){var b=document.querySelector('button.fullscreen-icon,[aria-label*="ull screen" i]');
  if(!b) return null; var r=b.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  var el=document.elementFromPoint(cx,cy);
  return {c:[cx,cy], hit:!!(el&&el.closest&&el.closest('button')===b)};})()""")
out={"windowed":win,"btn":b}
if b and b.get("hit"):
    click(b["c"][0], b["c"][1]); time.sleep(2)
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%.2f; v.pause();} return 1;})()" % frozen)
    time.sleep(4)
    out["fullscreen"]=t.eval(SAMPLE)
    time.sleep(4)
    out["fullscreenSettled"]=t.eval(SAMPLE)
    t.eval("(function(){if(document.exitFullscreen) document.exitFullscreen(); return 1;})()")
    time.sleep(4)
    out["backWindowed"]=t.eval(SAMPLE)
print(json.dumps(out, indent=1))
