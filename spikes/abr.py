"""Does our own inference load drive YouTube's ABR down?"""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick
tab=pick("youtube.com")
Q=("(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');"
   "var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{};"
   "return JSON.stringify({vw:v.videoWidth,vh:v.videoHeight,"
   "label:(mp.getPlaybackQualityLabel&&mp.getPlaybackQualityLabel())||null,"
   "total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0,"
   "gaze:typeof window.__TS_GAZE_PERSONS,t:v.currentTime});})()")
prev=None
print("--- baseline (blur pipeline running) ---")
for i in range(6):
    d=json.loads(tab.eval(Q) or "{}")
    drop = d['dropped']-(prev['dropped'] if prev else d['dropped'])
    tot  = d['total']-(prev['total'] if prev else d['total'])
    print("  %s %sx%s dropped+%d/total+%d (%.1f%%) t=%.0f" % (
        d['label'],d['vw'],d['vh'],drop,tot,(100.0*drop/tot if tot else 0),d['t']))
    prev=d; time.sleep(4)
print("--- request hd720 via YouTube's own player API ---")
print(" ", tab.eval("(function(){var mp=document.querySelector('#movie_player');"
      "try{mp.setPlaybackQualityRange('hd720','hd720');return 'called';}catch(e){return 'ERR '+e.message;}})()"))
prev=None
for i in range(8):
    d=json.loads(tab.eval(Q) or "{}")
    drop = d['dropped']-(prev['dropped'] if prev else d['dropped'])
    tot  = d['total']-(prev['total'] if prev else d['total'])
    print("  %s %sx%s dropped+%d/total+%d (%.1f%%) t=%.0f" % (
        d['label'],d['vw'],d['vh'],drop,tot,(100.0*drop/tot if tot else 0),d['t']))
    prev=d; time.sleep(4)
