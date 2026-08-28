"""One frame of the player, captured, with the patch geometry beside it.

The claim is visual -- "fully hard rectangle with rounded corners" -- so
the evidence is a picture plus the numbers behind it: no mask on any
overlay, and the element rect equal to the requested box.
"""
import base64, json, sys, time
from gauntlet import open_platform, pick

tab = open_platform(sys.argv[1] if len(sys.argv) > 1 else "woman")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(35)
print(tab.eval(r"""(function(){
  var host=document.querySelector('#movie_player');
  var v=host&&host.querySelector('video');
  var kids=host?host.querySelectorAll('.ts-gaze-vregion-host'):[];
  var vr=v?v.getBoundingClientRect():null, hr=host?host.getBoundingClientRect():null;
  var out=[];
  for(var i=0;i<kids.length;i++){
    var cs=getComputedStyle(kids[i]); var r=kids[i].getBoundingClientRect();
    out.push({w:Math.round(r.width),h:Math.round(r.height),
      radius:cs.borderRadius, mask:(cs.maskImage||'none').slice(0,24),
      blur:(cs.backdropFilter||'').slice(0,20),
      outsideVideo: vr ? (r.left<vr.left-1||r.top<vr.top-1||r.right>vr.right+1||r.bottom>vr.bottom+1) : null});
  }
  return JSON.stringify({patches:out, video:vr?{w:Math.round(vr.width),h:Math.round(vr.height)}:null});
})()"""))
r = tab.cmd("Page.captureScreenshot", format="png")
open(sys.argv[2] if len(sys.argv) > 2 else "hardedge.png", "wb").write(base64.b64decode(r["data"]))
print("shot written")
