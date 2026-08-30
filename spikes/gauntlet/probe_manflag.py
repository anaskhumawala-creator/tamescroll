"""Covered thumbnails on male-dominated queries, with the numbers that
covered them, paired to the crop so the read can be judged."""
import base64, json, os, sys, time
from gauntlet import open_platform

OUT = "runs/manflag"
QUERIES = ["pc build guide", "cpu comparison", "jerryrigeverything"]
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
os.makedirs(OUT, exist_ok=True)
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

GRAB = r"""(function(){
  var out=[], seen=window.__G||(window.__G={});
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  for(var i=0;i<ps.length;i++){
    var im=ps[i].parentElement&&ps[i].parentElement.querySelector('img');
    if(!im||!im.naturalWidth) continue;
    var key=(im.currentSrc||im.src||'').slice(0,90);
    if(seen[key]) continue; seen[key]=1;
    var c=document.createElement('canvas');
    c.width=im.naturalWidth; c.height=im.naturalHeight;
    try{ c.getContext('2d').drawImage(im,0,0);
      out.push({key:key, png:c.toDataURL('image/png').slice(22)});
    }catch(e){}
  }
  return JSON.stringify(out);
})()"""

n = 0
index = []
for q in QUERIES:
    tab.eval("window.__TS_GAZE_IMGDIAG=[]")
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(17)
    grabbed = []
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3.5)
        grabbed += json.loads(tab.eval(GRAB) or "[]")
    diag = json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))
    bysrc = {}
    for d in diag:
        bysrc[(d.get("src") or "")] = d
    for g in grabbed:
        name = "%s-%02d.png" % (q.split()[0], n)
        open(os.path.join(OUT, name), "wb").write(base64.b64decode(g["png"]))
        d = bysrc.get(g["key"])
        index.append({"file": name, "why": d and d.get("why"), "reads": d and d.get("reads")})
        print(name, d and d.get("why"), d and d.get("reads"))
        n += 1
json.dump(index, open(os.path.join(OUT, "index.json"), "w"), indent=1)
print("covered thumbnails:", n)
