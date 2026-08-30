"""Do OUR facebook selectors reach the page? Exact strings, not a regex
loose enough to match EasyList's own facebook rules."""
import json, time
from gauntlet import targets, Tab, pick

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
lau = pick("localhost:1420")
lau.eval("(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"blur\"]');b&&b.click();})()")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
         ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)
tab = None
for t in targets():
    u = t.get("url", "")
    if "localhost:1420" not in u and "devtools" not in u:
        tab = Tab(t)
if not tab:
    raise SystemExit("no window")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

WANT_FB = ['div[aria-label="Reels"]', 'div[role="article"][aria-label*="Suggested"]',
           'a[href^="/marketplace"]', 'div[aria-label="People you may know"]']
WANT_IG = ['a[href^="/reels"]', 'a[href^="/explore"]']

def check(url, want, label):
    tab.eval("location.href='%s'" % url)
    time.sleep(13)
    got = tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');
      var t=s?s.textContent:'';return JSON.stringify({len:t.length,
      has:%s.map(function(sel){return t.indexOf(sel)!==-1;}),
      blur:!!document.getElementById('ts-gaze-blur')});})()""" % json.dumps(want))
    print(label, got)

check("https://www.facebook.com/", WANT_FB, "FB ")
check("https://www.instagram.com/explore/", WANT_IG, "IG ")
print("IG hidden:", tab.eval("""(function(){
  function h(s){var n=document.querySelectorAll(s),c=0;
    for(var i=0;i<n.length;i++)if(getComputedStyle(n[i]).display==='none')c++;return n.length+'/'+c;}
  var imgs=[].slice.call(document.querySelectorAll('img'));
  return JSON.stringify({reels:h('a[href^="/reels"]'), explore:h('a[href^="/explore"]'),
    blurred:imgs.filter(function(i){return /blur\(/.test(getComputedStyle(i).filter);}).length+'/'+imgs.length});
})()"""))
