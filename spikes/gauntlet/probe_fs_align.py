# THE SAME QUESTION FULLSCREEN. Loop 18 measured whether the blur is
# PRESENT in fullscreen; nobody measured whether it LANDS. The fullscreen
# element is #player-container-id itself, so the video's box changes
# shape completely while our host stays the same element.
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
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")

SAMPLE = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  var host=clip?clip.parentElement:null;
  if(!v) return {err:'no video'};
  var vr=v.getBoundingClientRect();
  var hr=host?host.getBoundingClientRect():null;
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +(r.width/vr.width).toFixed(3), +(r.height/vr.height).toFixed(3)];});
  pats.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  return {fs:!!document.fullscreenElement,
    fsEl:document.fullscreenElement?(document.fullscreenElement.id||document.fullscreenElement.tagName):null,
    hostScale: host&&host.offsetWidth?+(hr.width/host.offsetWidth).toFixed(3):null,
    vbox:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
    paused:v.paused, n:pats.length, norm:pats,
    clipBox:(function(){if(!clip) return null; var r=clip.getBoundingClientRect();
      return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];})()};})()"""

for i in range(60):
    s=t.eval(SAMPLE)
    if s.get("n"): break
    time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(3)
out={"windowed": t.eval(SAMPLE)}

def click(x, y):
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    time.sleep(0.05)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)

pc = t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
click(pc[0], pc[1]); time.sleep(0.6)
btn = t.eval("""(function(){
  var b=document.querySelector('button.fullscreen-icon,[aria-label*="ull screen" i],[aria-label*="ullscreen" i]');
  if(!b) return null; var r=b.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  var el=document.elementFromPoint(cx,cy);
  return {c:[cx,cy], hit:!!(el&&el.closest&&el.closest('button')===b)};})()""")
out["fsButton"]=btn
if btn and btn.get("hit"):
    click(btn["c"][0], btn["c"][1]); time.sleep(3)
    out["fullscreen"]=t.eval(SAMPLE)
    time.sleep(4)
    out["fullscreenLater"]=t.eval(SAMPLE)
    t.eval("(function(){ if(document.exitFullscreen) document.exitFullscreen(); return 1;})()")
    time.sleep(3)
    out["exited"]=t.eval(SAMPLE)
print(json.dumps(out, indent=1))
