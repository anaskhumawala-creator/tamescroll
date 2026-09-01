# One patch read 8.8% narrower in fullscreen than windowed on the same
# frame. Is that geometry, or a tracker still gliding after the
# transition? Re-enter fullscreen, pause, and watch the same frozen frame
# for 12s. Converging = lerp. Parked at the wrong width = a real bug.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable"); t.cmd("Input.enable")
SAMPLE = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  if(!v) return {err:'no video'};
  var vr=v.getBoundingClientRect();
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +(r.width/vr.width).toFixed(3), +(r.height/vr.height).toFixed(3)];});
  pats.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  return {fs:!!document.fullscreenElement, t:+v.currentTime.toFixed(2), paused:v.paused,
    vw:Math.round(vr.width), n:pats.length, norm:pats};})()"""
def click(x,y):
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=x, y=y, button="left", clickCount=1)
    time.sleep(0.04)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=x, y=y, button="left", clickCount=1)
rows=[{"phase":"windowedFrozen","s":t.eval(SAMPLE)}]
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
time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%.2f;} return 1;})()" % rows[0]["s"].get("t", 60))
time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
for i in range(8):
    time.sleep(1.5)
    rows.append({"phase":"fsFrozen+%.1fs"%((i+1)*1.5),"s":t.eval(SAMPLE)})
t.eval("(function(){if(document.exitFullscreen) document.exitFullscreen(); return 1;})()")
time.sleep(2)
for i in range(4):
    time.sleep(1.5)
    rows.append({"phase":"winFrozen+%.1fs"%((i+1)*1.5),"s":t.eval(SAMPLE)})
print(json.dumps(rows, indent=1))
