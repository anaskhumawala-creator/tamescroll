"""Instagram, live in the app: does Stage A blur land and do the nav
rules actually hide the Reels/Explore entry points?

Signed out, mobile UA -- /explore/ is the one Meta surface that renders
without a session, so it is the only one that can be verified here.
"""
import json, time
from gauntlet import targets, Tab, pick

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")

lau = pick("localhost:1420")
mode = lau.eval(
    "(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"blur\"]');"
    "if(!b){return 'no-toggle:'+(document.querySelector('#blur-toggle')||{}).outerHTML;}"
    "b.click();return localStorage.getItem('tamescroll.blur');})()"
)
print("blur mode:", str(mode)[:120])
time.sleep(1)

lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(8)


def page():
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" not in u and "devtools" not in u:
            return Tab(t)
    raise SystemExit("no platform window")

tab = page()
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)
tab.eval("location.href='https://www.instagram.com/explore/'")
time.sleep=__import__("time").sleep
time.sleep(14)
print(tab.eval(r"""(function(){
  function hidden(sel){var n=document.querySelectorAll(sel),h=0;
    for(var i=0;i<n.length;i++){var s=getComputedStyle(n[i]);
      if(s.display==='none'||s.visibility==='hidden'||n[i].getBoundingClientRect().width===0)h++;}
    return n.length+'/'+h+' hidden';}
  var imgs=[].slice.call(document.querySelectorAll('img'));
  var blurred=imgs.filter(function(i){return /blur\(/.test(getComputedStyle(i).filter);});
  return JSON.stringify({
    url: location.href.slice(0,50),
    sheet: !!document.getElementById('ts-gaze-blur'),
    rulesSheet: !!document.getElementById('tamescroll-rules') || !!document.getElementById('ts-rules'),
    imgs: imgs.length, blurred: blurred.length,
    reels: hidden('a[href^="/reels"]'),
    explore: hidden('a[href^="/explore"]'),
    grid: document.querySelectorAll('a[href^="/popular"]').length
  });
})()"""))
