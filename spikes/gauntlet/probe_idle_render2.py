# Same question, but the earlier run measured windows with NO patch, so
# every counter was trivially zero. Park on a frame that holds one
# (paused keeps its cover -- measured last loop), then count.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Runtime.enable"); t.cmd("Input.enable")
R = """(function(){
  var r=window.__TS_GAZE_RENDER?window.__TS_GAZE_RENDER():null;
  var v=document.querySelector('video');
  return {r:r, now:performance.now(),
    patches:document.querySelectorAll('.ts-gaze-vregion-host').length,
    paused:v?v.paused:null, t:v?+v.currentTime.toFixed(1):null,
    mini:document.documentElement.classList.contains('ts-mini')};})()"""
def rate(label, seconds):
    a=t.eval(R); time.sleep(seconds); b=t.eval(R)
    if not a.get("r"): return {"phase":label,"err":"no counters"}
    dt=(b["now"]-a["now"])/1000.0
    o={"phase":label,"secs":round(dt,1),"patchesStart":a["patches"],"patchesEnd":b["patches"],
       "paused":b["paused"],"mini":b["mini"]}
    for k in a["r"]: o[k]=round((b["r"][k]-a["r"][k])/dt,1)
    return o

def park_on_patch(tries=12):
    for k in range(tries):
        t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%d; v.play();} return 1;})()" % (55+k*3))
        for i in range(6):
            time.sleep(1.2)
            s=t.eval(R)
            if s.get("patches"):
                t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
                time.sleep(1.5)
                s2=t.eval(R)
                if s2.get("patches"): return s2
        # keep trying
    return None

# make sure we are on a watch page with the pipeline warm
st=t.eval(R)
parked=park_on_patch()
rows=[{"parked":parked}]
if parked:
    rows.append(rate("PAUSED, patch frozen, full player", 8))
    b=t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
      return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0],"y":b[1]}])
    for i in range(1,9):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":b[0],"y":b[1]+int(160*i/8)}])
        time.sleep(0.03)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(3)
    rows.append(rate("PAUSED, patch frozen, PARKED mini", 8))
    t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
    time.sleep(1)
    rows.append(rate("PLAYING, parked mini", 8))
print(json.dumps(rows, indent=1))
