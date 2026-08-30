import time
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
JS = r"""(function(){
  var mp = document.querySelector('#movie_player');
  var prev = document.querySelectorAll('ytm-video-preview, .ytmVideoPreviewHost');
  return JSON.stringify({
    url: location.href.slice(0,52),
    moviePlayer: !!mp,
    mpInsidePreview: mp ? !!mp.closest('ytm-video-preview, .ytmVideoPreviewHost') : null,
    previewHosts: prev.length,
    previewHasVideo: [].map.call(prev,function(p){return !!p.querySelector('video');}),
    videos: document.querySelectorAll('video').length,
    playing: [].map.call(document.querySelectorAll('video'),function(v){return !v.paused;})
  });
})()"""
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(13)
for i in range(6):
    tab.eval("window.scrollBy(0,500);"); time.sleep(1.2)
print("FEED  ", tab.eval(JS))
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(13)
print("WATCH ", tab.eval(JS))
