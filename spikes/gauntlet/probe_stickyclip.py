"""The owner's screenshot, reproduced: a scrolled mobile watch page.

m.youtube pins the player at the top while the page scrolls under it
(`player-container sticky-player`), which is where his blur ran down over
the recommendation below. Under a mobile UA + touch emulation, scroll the
watch page and assert that no patch ever paints outside the video.
"""
import json, sys, time
from gauntlet import open_platform

UA = ("Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/120.0.0.0 Mobile Safari/537.36")

tab = open_platform(sys.argv[1] if len(sys.argv) > 1 else "woman")
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6,
        mobile=True)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(30)

CHECK = r"""(function(){
  var host=document.querySelector('#movie_player');
  var v=host&&host.querySelector('video');
  if(!v) return null;
  var vr=v.getBoundingClientRect();
  var kids=host.querySelectorAll('.ts-gaze-vregion-host');
  var out=[];
  for(var i=0;i<kids.length;i++){
    var cs=getComputedStyle(kids[i]);
    if(cs.display==='none') continue;
    var r=kids[i].getBoundingClientRect();
    if(!r.width||!r.height) continue;
    out.push({outside: r.left<vr.left-1||r.top<vr.top-1||r.right>vr.right+1||r.bottom>vr.bottom+1,
      w:Math.round(r.width),h:Math.round(r.height),
      overhang:Math.round(Math.max(0, r.bottom-vr.bottom))});
  }
  return {video:{w:Math.round(vr.width),h:Math.round(vr.height),top:Math.round(vr.top)},
    patches:out};
})()"""

worst = 0
outside = 0
samples = 0
for step in range(14):
    tab.eval("window.scrollBy(0,%d)" % (180 if step % 2 == 0 else 120))
    time.sleep(0.7)
    r = tab.eval(CHECK)
    if not r:
        continue
    for p in r["patches"]:
        samples += 1
        if p["outside"]:
            outside += 1
        worst = max(worst, p["overhang"])
    if step in (0, 6, 13):
        print("step", step, json.dumps(r))
print("patch samples:", samples, "outside video:", outside, "worst overhang px:", worst)
