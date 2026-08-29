# Does an image patch paint OVER the sticky watch player?
# Owner screenshot 2026-08-30. JSON only; headless emulator.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=(
 "Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
 "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36"))
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(15)

out = {}
out["boot"] = t.eval("""(function(){
  var pc=document.getElementById('player-container-id');
  return {path:location.pathname, pc:!!pc,
    pcPos: pc?getComputedStyle(pc).position:null,
    pcZ: pc?getComputedStyle(pc).zIndex:null,
    pcBottom: pc?Math.round(pc.getBoundingClientRect().bottom):null,
    patches:document.querySelectorAll('.ts-gaze-patch').length,
    judged:window.__TS_GAZE_IMGTOTAL||0};})()""")

# Scroll in steps; at each one hit-test the strip inside the player and
# report anything of OURS that answers there.
samples = []
for step in range(14):
    t.eval("window.scrollBy(0,420)")
    time.sleep(0.55)
    samples.append(t.eval("""(function(){
      var pc=document.getElementById('player-container-id');
      if(!pc) return null;
      var r=pc.getBoundingClientRect();
      var hits=[], over=0;
      for(var gy=0; gy<5; gy++){
        for(var gx=0; gx<3; gx++){
          var x=r.left+r.width*(0.2+0.3*gx), y=r.top+r.height*(0.15+0.18*gy);
          var stack=document.elementsFromPoint(x,y)||[];
          for(var i=0;i<stack.length;i++){
            var e=stack[i];
            if(e===pc||pc.contains(e)) break;         // player reached first: fine
            if(e.classList && e.classList.contains('ts-gaze-patch')){
              over++;
              hits.push({x:Math.round(x),y:Math.round(y),depth:i,
                         z:getComputedStyle(e).zIndex,
                         hostTag:e.parentElement?e.parentElement.tagName:null});
              break;
            }
          }
        }
      }
      return {y:Math.round(window.scrollY), patches:document.querySelectorAll('.ts-gaze-patch').length,
              over:over, hits:hits.slice(0,3),
              pcTop:Math.round(r.top), pcBottom:Math.round(r.bottom)};})()"""))
out["samples"] = [s for s in samples if s]
out["over_total"] = sum(s["over"] for s in out["samples"])
out["patches_max"] = max([s["patches"] for s in out["samples"]] or [0])
print(json.dumps(out, indent=1))
