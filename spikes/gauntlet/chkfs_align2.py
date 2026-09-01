# Fullscreen alignment, second attempt. The controls autohide in about a
# second, so reveal -> locate -> click must happen without a round trip
# in between; and the video must be PLAYING or the tap toggles playback
# instead of the controls.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable"); t.cmd("Input.enable")
SAMPLE = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  var host=clip?clip.parentElement:null;
  if(!v) return {err:'no video'};
  var vr=v.getBoundingClientRect(); var hr=host?host.getBoundingClientRect():null;
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +(r.width/vr.width).toFixed(3), +(r.height/vr.height).toFixed(3)];});
  pats.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  return {fs:!!document.fullscreenElement,
    fsEl:document.fullscreenElement?(document.fullscreenElement.id||document.fullscreenElement.tagName):null,
    hostScale:host&&host.offsetWidth?+(hr.width/host.offsetWidth).toFixed(3):null,
    vbox:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
    paused:v.paused, n:pats.length, norm:pats};})()"""
def click(x,y):
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    time.sleep(0.04)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)

t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=60; v.play();} return 1;})()")
for i in range(30):
    s=t.eval(SAMPLE)
    if s.get("n"): break
    time.sleep(2)
before=t.eval(SAMPLE)
pc=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
click(pc[0], pc[1])   # reveal controls
btn=t.eval("""(function(){
  var b=document.querySelector('button.fullscreen-icon,[aria-label*="ull screen" i]');
  if(!b) return null; var r=b.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  var el=document.elementFromPoint(cx,cy);
  return {c:[cx,cy], hit:!!(el&&el.closest&&el.closest('button')===b),
    label:b.getAttribute('aria-label')};})()""")
out={"before":before, "btn":btn}
if btn and btn["hit"]:
    click(btn["c"][0], btn["c"][1]); time.sleep(2.5)
    out["fs1"]=t.eval(SAMPLE); time.sleep(4)
    out["fs2"]=t.eval(SAMPLE)
    t.eval("(function(){if(document.exitFullscreen) document.exitFullscreen(); return 1;})()")
    time.sleep(3); out["exit"]=t.eval(SAMPLE)
print(json.dumps(out, indent=1))
