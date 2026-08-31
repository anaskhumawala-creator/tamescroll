# GAZE BLUR IN FULLSCREEN -- never verified since it was written
# (CLAUDE.md 2026-08-24 flagged "fullscreen coverage, esp. Android native
# custom-view fullscreen" as unverified). The player red line lives here:
# a stale patch in fullscreen is a face on a full screen.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1})()")
time.sleep(12)

Q = """(function(){
  var v=document.querySelector('#movie_player video');
  var vr=v?v.getBoundingClientRect():null;
  var hosts=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host'));
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  var cr=clip?clip.getBoundingClientRect():null;
  var out=hosts.map(function(h){var r=h.getBoundingClientRect();
    var cs=getComputedStyle(h);
    return {box:[r.x|0,r.y|0,r.width|0,r.height|0], display:cs.display,
      outside: vr? (r.left<vr.left-1||r.top<vr.top-1||r.right>vr.right+1||r.bottom>vr.bottom+1) : null};});
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  return {vp:[innerWidth,innerHeight],
    fs: fe?(fe.id||fe.tagName):null,
    video: vr?[vr.x|0,vr.y|0,vr.width|0,vr.height|0]:null,
    vTime: v?Math.round(v.currentTime*10)/10:null, paused: v?v.paused:null,
    clip: cr?[cr.x|0,cr.y|0,cr.width|0,cr.height|0]:null,
    nHosts: out.length, outside: out.filter(function(x){return x.outside;}).length,
    hosts: out.slice(0,6)};})()"""

print("windowed:", json.dumps(t.eval(Q)))
# reveal + click fullscreen, asserting the button is hittable at click time
b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0]+b[2]//2,"y":b[1]+b[3]//2}])
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(0.35)
s=t.eval("""(function(){var e=document.querySelector('.fullscreen-icon');
  if(!e) return null; var r=e.getBoundingClientRect();
  var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
  var h=document.elementFromPoint(x,y);
  return {x:x,y:y,hittable:!!(h&&h.closest&&h.closest('.fullscreen-icon'))};})()""")
if not s or not s["hittable"]:
    print("fullscreen button not hittable -- NOT MEASURED"); raise SystemExit
t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=s["x"], y=s["y"], button="left", clickCount=1)
t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=s["x"], y=s["y"], button="left", clickCount=1)
for lbl,w in (("fs +1s",1.2),("fs +4s",3),("fs +9s",5),("fs +15s",6)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
for lbl,w in (("exit +2s",2.5),("exit +8s",6)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
