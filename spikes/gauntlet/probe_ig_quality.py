"""Smart mode on Instagram explore: are the COVERED ones women and the
cleared ones not? Saves both sets so the answer is a picture."""
import base64, json, os, time
from gauntlet import targets, Tab, pick

OUT = "runs/igquality"
os.makedirs(OUT, exist_ok=True)
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
lau = pick("localhost:1420")
lau.eval("(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"smart\"]');b&&b.click();})()")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
         ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)
tab = None
for t in targets():
    u = t.get("url", "")
    if "localhost:1420" not in u and "devtools" not in u:
        tab = Tab(t)
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.eval("window.__TS_GAZE_IMGDIAG=[]")
tab.eval("location.href='https://www.instagram.com/explore/'")
time.sleep(22)
for i in range(4):
    tab.eval("window.scrollBy(0,800)")
    time.sleep(5)

grab = json.loads(tab.eval(r"""(function(){
  var out=[];
  var imgs=document.querySelectorAll('img');
  for(var i=0;i<imgs.length;i++){
    var im=imgs[i];
    if(!im.naturalWidth||im.getBoundingClientRect().width<100) continue;
    var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
    try{c.getContext('2d').drawImage(im,0,0);
      out.push({key:(im.currentSrc||im.src||'').slice(0,90), png:c.toDataURL('image/jpeg',0.6).slice(23)});
    }catch(e){}
  }
  return JSON.stringify(out);
})()""") or "[]")
diag = {(r.get("src") or ""): r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])"))}
n = {"face": 0, "clear": 0, "nsfw": 0}
for g in grab:
    d = diag.get(g["key"])
    if not d:
        continue
    why = d.get("why")
    if why not in n:
        continue
    if not d.get("faces") and why == "clear":
        continue
    name = "%s-%02d.jpg" % (why, n[why])
    open(os.path.join(OUT, name), "wb").write(base64.b64decode(g["png"]))
    print(name, d.get("reads"))
    n[why] += 1
print(n)
