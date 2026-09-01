# PAIRED, PAUSED, BOTH ARMS. Enter fullscreen while playing (activation
# needs a real click), THEN pause -- the picture can no longer change --
# sample, then exitFullscreen (script-callable) and sample the same
# frame windowed. Any difference is our arithmetic, not the content.
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
  return {fs:!!document.fullscreenElement, t:+v.currentTime.toFixed(2), paused:v.paused,
    vbox:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
    hbox:hr?[Math.round(hr.left),Math.round(hr.top),Math.round(hr.width),Math.round(hr.height)]:null,
    clipBox:(function(){if(!clip) return null; var r=clip.getBoundingClientRect();
      return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];})(),
    n:pats.length, norm:pats};})()"""
def click(x,y):
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    time.sleep(0.04)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)

st=t.eval(SAMPLE)
if not st.get("fs"):
    t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
    time.sleep(2)
    pc=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
      return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
    click(pc[0], pc[1])
    b=t.eval("""(function(){var b=document.querySelector('button.fullscreen-icon,[aria-label*="ull screen" i]');
      if(!b) return null; var r=b.getBoundingClientRect();
      var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
      var el=document.elementFromPoint(cx,cy);
      return {c:[cx,cy], hit:!!(el&&el.closest&&el.closest('button')===b)};})()""")
    if b and b["hit"]: click(b["c"][0], b["c"][1])
    time.sleep(3)
# wait for a patch in fullscreen, then freeze
for i in range(30):
    s=t.eval(SAMPLE)
    if s.get("n"): break
    time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(3)
fs=t.eval(SAMPLE)
t.eval("(function(){if(document.exitFullscreen) document.exitFullscreen(); return 1;})()")
time.sleep(3)
win=t.eval(SAMPLE)
time.sleep(4)
win2=t.eval(SAMPLE)
ratio=None
if fs.get("n") and win.get("n")==fs.get("n"):
    ratio=[[None if fs["norm"][i][k]==0 else round(win["norm"][i][k]/fs["norm"][i][k],3)
            for k in range(4)] for i in range(fs["n"])]
print(json.dumps({"fullscreenPaused":fs,"windowedSameFrame":win,"windowedLater":win2,
                  "windowedOverFullscreen":ratio}, indent=1))
