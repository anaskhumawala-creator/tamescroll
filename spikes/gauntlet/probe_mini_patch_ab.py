# THE PAIRED CONTROL: pause the video so the SAME frame is judged, read
# the patches normalized against the video, drag to mini, read again.
# Right maths = the normalized boxes match. Broken maths = every number
# multiplied by the host scale (0.56).
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
  if(!v||!host) return {err:'no player'};
  var vr=v.getBoundingClientRect(), hr=host.getBoundingClientRect();
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host')).map(function(o){
    var r=o.getBoundingClientRect();
    return [+((r.left-vr.left)/vr.width).toFixed(3), +((r.top-vr.top)/vr.height).toFixed(3),
            +(r.width/vr.width).toFixed(3), +(r.height/vr.height).toFixed(3)];});
  pats.sort(function(a,b){return a[0]-b[0]||a[1]-b[1];});
  return {mini:document.documentElement.classList.contains('ts-mini'),
    scale:+(hr.width/host.offsetWidth).toFixed(3),
    videoBox:[Math.round(vr.width),Math.round(vr.height)],
    paused:v.paused, n:pats.length, norm:pats};})()"""

for i in range(60):
    s=t.eval(SAMPLE)
    if s.get("n"): break
    time.sleep(2)
# freeze the frame so both arms judge the same picture
t.eval("(function(){var v=document.querySelector('video'); if(v) v.pause(); return 1;})()")
time.sleep(3)
full = t.eval(SAMPLE)
pcbox = t.eval("""(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();
  return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
cx, cy = pcbox
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
for i in range(1,9):
    t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":cy+int(160*i/8)}])
    time.sleep(0.03)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(3)
mini = t.eval(SAMPLE)
# and back
t.eval("""(function(){var pc=document.querySelector('#player-container-id');
  var r=pc.getBoundingClientRect(); window.__c=[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)];
  return window.__c;})()""")
c = t.eval("window.__c")
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":c[0],"y":c[1]}])
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(3)
back = t.eval(SAMPLE)
ratios=[]
if full.get("n") and mini.get("n") and full["n"]==mini["n"]:
    for a,b in zip(full["norm"], mini["norm"]):
        ratios.append([None if a[i]==0 else round(b[i]/a[i],3) for i in range(4)])
print(json.dumps({"full":full,"mini":mini,"restored":back,
                  "miniOverFull":ratios}, indent=1))
