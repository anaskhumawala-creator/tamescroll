"""Is 480p a stall, a ramp, or a consequence of our window size?"""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VID=sys.argv[1]
tab=None
for _ in range(4):
    try: tab=pick("youtube.com"); break
    except BaseException:
        try: tab=open_platform("woman"); break
        except BaseException: time.sleep(6)
tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=60s'"%VID)
time.sleep(14)
Q=("(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');"
   "var r=v.getBoundingClientRect();"
   "var q=null,lv=null,avail=null;"
   "try{q=mp.getPlaybackQuality&&mp.getPlaybackQuality();}catch(e){}"
   "try{avail=mp.getAvailableQualityLevels&&mp.getAvailableQualityLevels();}catch(e){}"
   "try{lv=mp.getPlaybackQualityLabel&&mp.getPlaybackQualityLabel();}catch(e){}"
   "return JSON.stringify({vw:v.videoWidth,vh:v.videoHeight,ew:Math.round(r.width),eh:Math.round(r.height),"
   "iw:window.innerWidth,ih:window.innerHeight,dpr:window.devicePixelRatio,q:q,label:lv,avail:avail,t:v.currentTime});})()")
for i in range(10):
    print(tab.eval(Q)); time.sleep(3)
