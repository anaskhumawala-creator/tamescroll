"""Smart mode on Instagram, and whether the Facebook wiring lands at all."""
import json, time
from gauntlet import targets, Tab, pick

MOB = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
       "Chrome/120.0.0.0 Mobile Safari/537.36")
lau = pick("localhost:1420")
print("mode:", lau.eval(
    "(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"smart\"]');"
    "if(!b)return 'no-toggle';b.click();return localStorage.getItem('tamescroll.blur');})()"))
time.sleep(1)
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
         ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)

def page(sub=None):
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" in u or "devtools" in u:
            continue
        if sub is None or sub in u:
            return Tab(t)
    raise SystemExit("no window " + str(sub))

tab = page()
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2,
        mobile=True, screenWidth=412, screenHeight=915)

tab.eval("location.href='https://www.instagram.com/explore/'")
time.sleep(20)
tab.eval("window.scrollBy(0,900)")
time.sleep(12)
print("IG smart:", tab.eval(r"""(function(){
  var d=window.__TS_GAZE_IMGDIAG||[];
  var w=window.__TS_GAZE_WORKER||{};
  return JSON.stringify({bundle:window.__TS_GAZE_BUNDLE__||null, worker:w,
    verdicts:d.length, why:d.reduce(function(a,r){a[r.why]=(a[r.why]||0)+1;return a;},{}),
    pending:document.querySelectorAll('.ts-gaze-pending').length,
    flagged:document.querySelectorAll('.ts-gaze-flagged').length});
})()"""))

tab.eval("location.href='https://www.facebook.com/'")
time.sleep(14)
print("FB wiring:", tab.eval(r"""(function(){
  var r=document.getElementById('tamescroll-rules');
  return JSON.stringify({url:location.href.slice(0,40),
    rulesLen:r?r.textContent.length:0,
    rulesHasFb:r?/role="article"|marketplace|\/reel\//.test(r.textContent):false,
    gazeSheet:!!document.getElementById('ts-gaze-blur'),
    bundle:window.__TS_GAZE_BUNDLE__||null});
})()"""))
