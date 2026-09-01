# 1067 fixed the PARKED patch. What about DURING the shrink? rects are
# refreshed on scroll/resize and on each pass -- a transform fires
# neither, so the patch may be anchored to the pre-drag geometry for the
# length of the gesture. If it is, his face is uncovered while his thumb
# is on the screen, which is an exposure with a duty cycle.
#
# Paused frame, so the only thing changing is the transform.
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
  if(!v) return {err:'no video'};
  var vr=v.getBoundingClientRect();
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +(r.width/vr.width).toFixed(3), +(r.height/vr.height).toFixed(3)];});
  pats.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  return {mini:document.documentElement.classList.contains('ts-mini'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    vbox:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
    n:pats.length, norm:pats};})()"""

for i in range(60):
    s=t.eval(SAMPLE)
    if s.get("n"): break
    time.sleep(2)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(3)
base = t.eval(SAMPLE)
out = {"baseline": base, "duringDrag": [], "afterLand": None}
if base.get("n"):
    c = t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
      return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
    cx, cy = c
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1, 11):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":cx, "y":cy+int(200*i/10)}])
        s = t.eval(SAMPLE)
        s["step"] = i
        out["duringDrag"].append(s)
        time.sleep(0.04)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(2.5)
    out["afterLand"] = t.eval(SAMPLE)
    # worst normalized error against the baseline, per step
    b = base["norm"]
    errs = []
    for s in out["duringDrag"]:
        if s.get("n") == len(b):
            e = max(abs(s["norm"][i][k]-b[i][k]) for i in range(len(b)) for k in range(4))
            errs.append([s["step"], round(e, 3), s.get("drag")])
    out["worstErrPerStep"] = errs
print(json.dumps(out, indent=1))
