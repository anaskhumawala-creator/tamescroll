import time
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=NWoT1ZVd1Lo'")
time.sleep(12)
print("cfg:", tab.eval("(function(){var c=ytcfg.get('WEB_PLAYER_CONTEXT_CONFIGS');var k=Object.keys(c)[0];var x=c[k];return JSON.stringify({k:k,showMiniplayerButton:x.showMiniplayerButton,showMiniplayerUiWhenMinimized:x.showMiniplayerUiWhenMinimized});})()"))
for i in range(4):
    print(i, tab.eval("(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');return JSON.stringify({nVideos:document.querySelectorAll('video').length,paused:v?v.paused:null,t:v?Math.round(v.currentTime):null,player:!!mp});})()"))
    time.sleep(3)
