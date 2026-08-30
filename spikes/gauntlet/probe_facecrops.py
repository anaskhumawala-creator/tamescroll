"""Save the FACE each image read came from, named by its numbers.

A covered thumbnail with no human in it and one with a weakly-read man
are the same row in the diag; only the picture separates them.
"""
import base64, json, os, sys, time
from gauntlet import open_platform

OUT = sys.argv[1] if len(sys.argv) > 1 else "runs/facecrops"
QUERIES = ["jerryrigeverything", "gta 6 leaks", "pc build guide", "cpu comparison"]
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
os.makedirs(OUT, exist_ok=True)

tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Page.enable")
# Record the boxes with the verdict: the diag ring drops them.
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source="window.__TS_KEEP_BOXES=1;")

GRAB = r"""(function(){
  var out=[];
  var seen=window.__GRABBED||(window.__GRABBED={});
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  for(var i=0;i<ps.length;i++){
    var par=ps[i].parentElement, im=par&&par.querySelector('img');
    if(!im||!im.naturalWidth) continue;
    var key=(im.currentSrc||im.src||'').slice(-24)+'#'+i;
    if(seen[key]) continue; seen[key]=1;
    var ir=im.getBoundingClientRect(), pr=ps[i].getBoundingClientRect();
    if(!(ir.width>0&&pr.width>0)) continue;
    // The patch in the image's own pixel space, padded a little so the
    // surroundings are visible.
    var sx=im.naturalWidth/ir.width, sy=im.naturalHeight/ir.height;
    var x=(pr.left-ir.left)*sx, y=(pr.top-ir.top)*sy, w=pr.width*sx, h=pr.height*sy;
    var pad=Math.max(w,h)*0.15;
    x=Math.max(0,x-pad); y=Math.max(0,y-pad);
    w=Math.min(im.naturalWidth-x,w+pad*2); h=Math.min(im.naturalHeight-y,h+pad*2);
    var c=document.createElement('canvas'); c.width=Math.round(w); c.height=Math.round(h);
    try{ c.getContext('2d').drawImage(im,x,y,w,h,0,0,c.width,c.height);
      out.push({key:key, png:c.toDataURL('image/png').slice(22),
        src:(im.currentSrc||im.src||'').slice(-24)});
    }catch(e){ out.push({key:key, err:String(e).slice(0,40)}); }
  }
  return JSON.stringify(out);
})()"""

n = 0
for q in QUERIES:
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(17)
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3.5)
        got = json.loads(tab.eval(GRAB) or "[]")
        for g in got:
            if g.get("png"):
                open(os.path.join(OUT, "cov-%02d.png" % n), "wb").write(base64.b64decode(g["png"]))
                n += 1
    print(q, "crops", n)
diag = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
json.dump(diag, open(os.path.join(OUT, "diag.json"), "w"), indent=1)
print("saved", n, "covered crops;", len(diag), "diag rows")
