import json, time
from gauntlet import open_platform, pick
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(9)
tab.eval("(function(){var v=document.querySelector('video');if(v){v.muted=true;v.play();}return 1;})()")
time.sleep(3)
# SPA-navigate home the way a user does: click the masthead logo
tab.eval("(function(){var a=document.querySelector('ytd-topbar-logo-renderer a, #logo a');if(a){a.click();return 'clicked';}return 'nologo';})()")
time.sleep(5)
js = r"""
(function(){
  var m = document.querySelector('ytd-miniplayer');
  var app = document.querySelector('ytd-app');
  return JSON.stringify({
    url: location.href,
    miniDisplay: m ? getComputedStyle(m).display : null,
    miniActiveAttr: m ? m.hasAttribute('active') : null,
    appMini: app ? app.hasAttribute('miniplayer-is-active') : null,
    miniRect: m ? (function(r){return {w:Math.round(r.width),h:Math.round(r.height)};})(m.getBoundingClientRect()) : null,
    videoInMini: !!document.querySelector('ytd-miniplayer video'),
    playing: (function(){var v=document.querySelector('video');return v? !v.paused : null;})()
  });
})()
"""
print(tab.eval(js))
