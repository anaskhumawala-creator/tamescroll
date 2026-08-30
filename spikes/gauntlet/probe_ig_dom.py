"""Live (signed-out, mobile UA) Instagram DOM: what can we anchor on?"""
import json, time
from gauntlet import targets, Tab
MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
def any_page():
    for t in targets():
        if "localhost:1420" not in t.get("url", "") and "devtools" not in t.get("url", ""):
            return Tab(t)
    raise SystemExit("no platform window")


tab = any_page()
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.eval("location.href='https://www.instagram.com/explore/'")
time.sleep(14)
print(tab.eval(r"""(function(){
  function chain(e,n){var a=[];while(e&&a.length<n){a.push(e.tagName.toLowerCase()
    +(e.getAttribute('role')?'[role='+e.getAttribute('role')+']':'')
    +(e.getAttribute('aria-label')?'[al='+e.getAttribute('aria-label')+']':''));e=e.parentElement;}return a;}
  var img=document.querySelector('img[src*="cdninstagram"], img[srcset]');
  var out={
    navReels: document.querySelectorAll('a[href^="/reels"]').length,
    ariaReels: document.querySelectorAll('[aria-label="Reels"]').length,
    exploreLinks: document.querySelectorAll('a[href^="/explore"]').length,
    popularLinks: document.querySelectorAll('a[href^="/popular"]').length,
    imgs: document.querySelectorAll('img').length,
    imgHosts: [].slice.call(document.querySelectorAll('img')).map(function(i){
      try{return new URL(i.currentSrc||i.src).host;}catch(e){return 'none';}}).filter(function(v,i,a){return a.indexOf(v)===i;}),
    firstImgChain: img?chain(img,6):null,
    gridSample: [].slice.call(document.querySelectorAll('a[href^="/popular"]')).slice(0,2).map(function(a){
      return {href:a.getAttribute('href').slice(0,40), imgs:a.querySelectorAll('img').length,
              vids:a.querySelectorAll('video').length};})
  };
  return JSON.stringify(out);
})()"""))
