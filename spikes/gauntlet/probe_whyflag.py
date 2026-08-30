"""WHY is a tech thumbnail covered in man mode?

Owner's two screenshots are male tech channels (JerryRigEverything, Shub)
under a full-size patch, plus a patch on a CPU-box collage with no human
in it. Pull the verdict ring for the covered ones and shoot each covered
thumbnail so the read can be checked against the picture.
"""
import json, sys, time
from gauntlet import open_platform

Q = sys.argv[1] if len(sys.argv) > 1 else "jerryrigeverything"
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % Q.replace(" ", "+"))
time.sleep(20)
for i in range(6):
    tab.eval("window.scrollBy(0,700)")
    time.sleep(3)

rows = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
flag = [r for r in rows if r.get("why") in ("face", "nsfw", "text")]
print("total", len(rows), "covered", len(flag))
for r in flag[:12]:
    print(" ", r.get("why"), "faces", r.get("faces"), "flagged", r.get("flagged"),
          "reads", r.get("reads"), "w", r.get("w"), r.get("src", "")[-34:])

shots = tab.eval(r"""(function(){
  var out=[];
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  for(var i=0;i<ps.length;i++){
    var par=ps[i].parentElement, im=par&&par.querySelector('img');
    if(!im) continue;
    var r=im.getBoundingClientRect();
    if(r.width<120) continue;
    out.push({src:(im.currentSrc||im.src||'').slice(-34), x:Math.round(r.x),y:Math.round(r.y),
      w:Math.round(r.width),h:Math.round(r.height)});
  }
  return JSON.stringify(out);
})()""")
print("patched thumbnails on screen:", shots)
