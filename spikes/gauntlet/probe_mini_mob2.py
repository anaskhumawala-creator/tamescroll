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
print(tab.eval(r"""(function(){
  var e = {};
  try { var f = ytcfg.get('EXPERIMENT_FLAGS')||{};
    Object.keys(f).forEach(function(k){ if(/minimi|miniplayer|mini_player|swipe|drag/i.test(k)) e[k]=f[k]; });
  } catch(x){ e.err = ''+x; }
  var out = {
    flags: e,
    hasMinimizedEl: !!document.querySelector('[class*=minimized], ytm-miniplayer-bar, .player-minimized'),
    playerParentCls: (function(){var p=document.querySelector('#player-container-id');return p&&p.parentElement?p.parentElement.className:null;})(),
    overlayHost: !!document.querySelector('#tamescroll-gaze-regions'),
    overlaysInPlayer: document.querySelectorAll('#movie_player [id^=tamescroll], #movie_player .ts-gaze-region').length,
    gazeMarker: window.__TS_GAZE_BUNDLE__||null,
    ptrEvents: (function(){var o=document.querySelector('#movie_player div[style*=backdrop-filter]');return o?getComputedStyle(o).pointerEvents:null;})()
  };
  return JSON.stringify(out).slice(0,1200);
})()"""))
