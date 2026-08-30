"""What CLEARED on female-heavy pages? The square crop raises male
certainty, so the exposure question is whether a woman ever rides that
into a clear. Saves every cleared face-bearing thumbnail with its read."""
import base64, json, os, sys, time
from gauntlet import open_platform

OUT = "runs/cleared"
QUERIES = sys.argv[1:] or ["makeup tutorial", "yoga for beginners", "get ready with me"]
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
os.makedirs(OUT, exist_ok=True)
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

GRAB = r"""(function(){
  var out=[], seen=window.__G2||(window.__G2={});
  var imgs=document.querySelectorAll('img');
  for(var i=0;i<imgs.length;i++){
    var im=imgs[i];
    if(!im.naturalWidth||im.getBoundingClientRect().width<150) continue;
    var key=(im.currentSrc||im.src||'').slice(0,90);
    if(seen[key]) continue; seen[key]=1;
    var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    try{ c.getContext('2d').drawImage(im,0,0);
      out.push({key:key, png:c.toDataURL('image/jpeg',0.7).slice(23)});
    }catch(e){}
  }
  return JSON.stringify(out);
})()"""

n = 0
for q in QUERIES:
    tab.eval("window.__TS_GAZE_IMGDIAG=[]")
    tab.eval("location.href='https://m.youtube.com/results?search_query=%s'" % q.replace(" ", "+"))
    time.sleep(17)
    grabbed = []
    for i in range(5):
        tab.eval("window.scrollBy(0,760)")
        time.sleep(3.2)
        grabbed += json.loads(tab.eval(GRAB) or "[]")
    diag = {(r.get("src") or ""): r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))}
    for g in grabbed:
        d = diag.get(g["key"])
        if not d or not d.get("faces") or d.get("why") != "clear":
            continue
        name = "%s-%02d.jpg" % (q.split()[0], n)
        open(os.path.join(OUT, name), "wb").write(base64.b64decode(g["png"]))
        print(name, d.get("reads"))
        n += 1
print("cleared face-bearing thumbnails:", n)
