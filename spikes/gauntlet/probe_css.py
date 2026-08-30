import time
from gauntlet import open_platform
MOB=("Mozilla/5.0 (Linux; Android 13; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
tab = open_platform("man")
tab.cmd("Emulation.setUserAgentOverride", userAgent=MOB, platform="Android")
tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915, deviceScaleFactor=2, mobile=True, screenWidth=412, screenHeight=915)
tab.eval("location.href='https://m.youtube.com/results?search_query=podcast+interview'")
time.sleep(13)
print(tab.eval(r"""(function(){
  var sheets=[].slice.call(document.querySelectorAll('style[id^="tamescroll"]'));
  var all=sheets.map(function(s){return s.textContent||'';}).join('\n');
  return JSON.stringify({
    sheets: sheets.map(function(s){return {id:s.id,len:(s.textContent||'').length};}),
    hasYtmPreview: all.indexOf('ytm-video-preview')!==-1,
    hasYtdPreview: all.indexOf('ytd-video-preview')!==-1,
    hasShorts: all.indexOf('pivot-shorts')!==-1,
    sample: all.slice(0,180)
  });
})()"""))
