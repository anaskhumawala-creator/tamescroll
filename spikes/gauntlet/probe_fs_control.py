# THE CONTROL ARM. Before claiming fullscreen removes the blur, measure
# the WINDOWED duty cycle over the same span on the same video.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Input.enable")
Q = """(function(){
  var v=document.querySelector('#movie_player video');
  return {hosts:document.querySelectorAll('.ts-gaze-vregion-host').length,
    clip: !!document.querySelector('.ts-gaze-vregion-clip'),
    fs: !!(document.fullscreenElement||document.webkitFullscreenElement),
    t: v?Math.round(v.currentTime):null, paused:v?v.paused:null,
    vp:[innerWidth,innerHeight]};})()"""
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.muted=true;v.currentTime=60;v.play();} return 1})()")
time.sleep(6)
def sweep(label, n=20, gap=2.0):
    rows=[]
    for i in range(n):
        time.sleep(gap); rows.append(t.eval(Q))
    on=sum(1 for r in rows if r["hosts"]>0)
    print("%-12s samples %d  covered %d  duty %.0f%%  t %s->%s  vp %s" % (
        label, len(rows), on, 100.0*on/len(rows), rows[0]["t"], rows[-1]["t"], rows[-1]["vp"]))
    return rows
sweep("WINDOWED")
def reveal_btn(tries=6):
    for _ in range(tries):
        b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
        t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0]+b[2]//2,"y":b[1]+40}])
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.3)
        r=t.eval("""(function(){var e=document.querySelector('.fullscreen-icon'); if(!e) return null;
          var q=e.getBoundingClientRect(); var x=Math.round(q.left+q.width/2), y=Math.round(q.top+q.height/2);
          var h=document.elementFromPoint(x,y);
          return {x:x,y:y,hittable:!!(h&&h.closest&&h.closest('.fullscreen-icon'))};})()""")
        if r and r["hittable"]: return r
        time.sleep(1.0)
    return None
btn=reveal_btn()
if btn:
    t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=btn["x"], y=btn["y"], button="left", clickCount=1)
    t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=btn["x"], y=btn["y"], button="left", clickCount=1)
    time.sleep(1.5)
    sweep("FULLSCREEN")
    t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
    time.sleep(2)
    sweep("AFTER EXIT", n=10)
else:
    print("fullscreen not reachable this run")
