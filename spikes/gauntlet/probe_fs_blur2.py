# Same question, but the probe is given teeth first: it refuses to
# measure until player patches actually exist, and it retries the reveal
# until YouTube's fullscreen button is genuinely hittable.
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
time.sleep(30)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.muted=true;v.play();} return 1})()")

Q = """(function(){
  var v=document.querySelector('#movie_player video');
  var vr=v?v.getBoundingClientRect():null;
  var hosts=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host'));
  var clip=document.querySelector('.ts-gaze-vregion-clip');
  var cr=clip?clip.getBoundingClientRect():null;
  var out=hosts.map(function(h){var r=h.getBoundingClientRect();
    return {box:[r.x|0,r.y|0,r.width|0,r.height|0], display:getComputedStyle(h).display,
      outside: vr?(r.left<vr.left-1||r.top<vr.top-1||r.right>vr.right+1||r.bottom>vr.bottom+1):null};});
  var fe=document.fullscreenElement||document.webkitFullscreenElement||null;
  return {vp:[innerWidth,innerHeight], fs: fe?(fe.id||fe.tagName):null,
    video: vr?[vr.x|0,vr.y|0,vr.width|0,vr.height|0]:null,
    vTime: v?Math.round(v.currentTime*10)/10:null, paused:v?v.paused:null,
    clip: cr?[cr.x|0,cr.y|0,cr.width|0,cr.height|0]:null,
    nHosts: out.length, outside: out.filter(function(x){return x.outside;}).length,
    hosts: out.slice(0,5)};})()"""

# WAIT FOR TEETH: player patches must exist or the test measures nothing.
got=None
for i in range(18):
    time.sleep(6); s=t.eval(Q)
    if s["nHosts"]>0: got=s; break
if not got:
    print("NO PLAYER PATCHES in %ds -- not measured. last:" % (18*6), json.dumps(s))
    print("worker:", json.dumps(t.eval("(function(){return window.__TS_GAZE_WORKER||null})()")))
    raise SystemExit
print("windowed:", json.dumps(got))

def reveal_and_get_btn(tries=6):
    for _ in range(tries):
        b=t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
        t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":b[0]+b[2]//2,"y":b[1]+40}])
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.3)
        s=t.eval("""(function(){var e=document.querySelector('.fullscreen-icon');
          if(!e) return null; var r=e.getBoundingClientRect();
          var x=Math.round(r.left+r.width/2), y=Math.round(r.top+r.height/2);
          var h=document.elementFromPoint(x,y);
          return {x:x,y:y,hittable:!!(h&&h.closest&&h.closest('.fullscreen-icon'))};})()""")
        if s and s["hittable"]: return s
        time.sleep(1.2)
    return None
btn=reveal_and_get_btn()
if not btn:
    print("fullscreen button never hittable -- NOT MEASURED"); raise SystemExit
t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=btn["x"], y=btn["y"], button="left", clickCount=1)
t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=btn["x"], y=btn["y"], button="left", clickCount=1)
for lbl,w in (("fs +1s",1.3),("fs +5s",4),("fs +11s",6),("fs +18s",7)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
for lbl,w in (("exit +2s",2.5),("exit +9s",7)):
    time.sleep(w); print(lbl, json.dumps(t.eval(Q)))
