"""Does 1080p make the seated subject readable, and what does it cost?"""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
tab=None
for _ in range(4):
    try: tab=pick("youtube.com"); break
    except BaseException:
        try: tab=open_platform("woman"); break
        except BaseException: time.sleep(6)
tab.eval("location.href='https://www.youtube.com/watch?v=H14bBuluwB8&t=60s'")
time.sleep(16)
Q=("(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');"
   "var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{};"
   "var p=window.__TS_GAZE_PROBE&&window.__TS_GAZE_PROBE();"
   "return JSON.stringify({vw:v.videoWidth,vh:v.videoHeight,"
   "label:(mp.getPlaybackQualityLabel&&mp.getPlaybackQualityLabel())||null,"
   "total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0,t:v.currentTime,"
   "tracks:p&&p.tracks?p.tracks.map(function(x){return [x.id,x.st,x.cs,x.lv];}):null});})()")
def sample(tag,n):
    prev=None
    for i in range(n):
        d=json.loads(tab.eval(Q) or "{}")
        if not d: time.sleep(3); continue
        dd=d['dropped']-(prev['dropped'] if prev else d['dropped'])
        dt=d['total']-(prev['total'] if prev else d['total'])
        print("  %-6s %s %sx%s drop+%d/%d t=%.0f tracks=%s"%(tag,d['label'],d['vw'],d['vh'],dd,dt,d['t'],d['tracks']))
        prev=d; time.sleep(3)
print("--- at whatever the floor gave us ---"); sample("base",5)
print("--- forced hd1080 ---")
print(" ", tab.eval("(function(){var mp=document.querySelector('#movie_player');"
      "try{mp.setPlaybackQualityRange('hd1080','hd1080');return 'called';}catch(e){return 'ERR';}})()"))
time.sleep(4); sample("1080",8)
