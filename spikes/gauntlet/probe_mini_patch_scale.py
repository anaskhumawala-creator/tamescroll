# HIS SCREENSHOT: inside the parked mini player the blur patch sits
# up-left of the face and is too small. HYPOTHESIS: boxToHostRect uses
# getBoundingClientRect (post-transform, SCALED) but writes CSS px into
# a container the mini transform scales AGAIN -- so the patch is drawn
# at s^2 instead of s.
#
# Measure the SAME patches full and mini, normalized against the video's
# own viewport rect. Right maths = same normalized box in both states.
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
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")

SAMPLE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  if(!pc||!v) return {err:'no player'};
  var pr=pc.getBoundingClientRect(), vr=v.getBoundingClientRect();
  var host=clip?clip.parentElement:null;
  var hr=host?host.getBoundingClientRect():null;
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return {vp:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      norm: vr.width&&vr.height ? [ +((r.left-vr.left)/vr.width).toFixed(3),
                                    +((r.top-vr.top)/vr.height).toFixed(3),
                                    +(r.width/vr.width).toFixed(3),
                                    +(r.height/vr.height).toFixed(3) ] : null,
      css:[o.style.left,o.style.top,o.style.width,o.style.height,o.style.transform]};});
  return {mini:document.documentElement.classList.contains('ts-mini'),
    playerBox:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
    videoBox:[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)],
    hostScale: host&&host.offsetWidth ? +(hr.width/host.offsetWidth).toFixed(3) : null,
    hostTag: host?host.tagName.toLowerCase()+(host.id?'#'+host.id:''):null,
    n:pats.length, patches:pats.slice(0,4)};})()"""

def wait_patches(limit=60):
    for i in range(limit):
        s = t.eval(SAMPLE)
        if s.get("n"): return s
        time.sleep(2)
    return t.eval(SAMPLE)

full = wait_patches()
out = {"full": full}
if full.get("n"):
    pb = full["playerBox"]
    cx, cy = pb[0]+pb[2]//2, pb[1]+pb[3]//2
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1,9):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":cx, "y":cy+int(160*i/8)}])
        time.sleep(0.03)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(2.5)
    out["miniA"] = t.eval(SAMPLE)
    time.sleep(6)
    out["miniB"] = t.eval(SAMPLE)
print(json.dumps(out, indent=1))
