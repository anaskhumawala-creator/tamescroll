import time
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) "
     "Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2, mobile=True, screenWidth=412, screenHeight=915)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
JS = r"""(function(){
  var p = document.querySelector('ytm-video-preview, .ytmVideoPreviewHost');
  var cs = p ? getComputedStyle(p) : null;
  var thumbs = document.querySelectorAll('ytm-thumbnail-cover img, .media-item-thumbnail-container img');
  return JSON.stringify({
    url: location.href.slice(0,46),
    previewHost: !!p, previewDisplay: cs?cs.display:null,
    thumbs: thumbs.length,
    thumbsVisible: [].filter.call(thumbs,function(t){return t.getBoundingClientRect().width>0;}).length,
    videos: document.querySelectorAll('video').length,
    player: !!document.querySelector('#movie_player')
  });
})()"""
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(14)
for i in range(5):
    tab.eval("window.scrollBy(0,500);"); time.sleep(1.2)
print("FEED ", tab.eval(JS))
tab.eval("location.href='https://m.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(13)
print("WATCH", tab.eval(JS))
print("plays", tab.eval("(function(){var v=document.querySelector('video');return v? (v.paused?'paused':'playing'):'novideo';})()"))
