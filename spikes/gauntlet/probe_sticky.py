import time
from gauntlet import open_platform
MOB_UA = ("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB_UA, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2.6, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(14)
tab.eval("(function(){var v=document.querySelector('video');if(v){v.muted=true;v.play();}})()")
time.sleep(3)
def st(tag):
    print(tag, tab.eval(r"""(function(){
      var p=document.querySelector('#player-container-id');
      var r=p?p.getBoundingClientRect():null;
      return JSON.stringify({y:Math.round(scrollY),
        rect:r?{y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,
        cls:p?p.className:null,
        cmts:document.querySelectorAll('ytm-comment-thread-renderer, ytm-comment-entity-payload-renderer').length,
        rel:document.querySelectorAll('ytm-video-with-context-renderer').length,
        paused:(function(){var v=document.querySelector('video');return v?v.paused:null;})()});
    })()"""))
st("top:")
for i in range(4):
    tab.eval("window.scrollBy(0,800);")
    time.sleep(2)
st("scrolled:")
