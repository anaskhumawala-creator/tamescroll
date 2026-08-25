"""Time from navigation to the first advancing frame, N loads."""
import sys, time
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VID=sys.argv[1]; N=int(sys.argv[2]) if len(sys.argv)>2 else 3
try: tab=pick("youtube.com")
except BaseException: tab=open_platform("man")
Q="""(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');
var r=window.ytInitialPlayerResponse;
return JSON.stringify({t:v?v.currentTime:-1,ad:mp?/ad-showing/.test(mp.className):false,
slots:r&&r.adSlots?r.adSlots.length:0});})()"""
import json
for k in range(N):
    tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=0s'"%VID)
    t0=time.time(); first=None; sawad=False; slots=0
    while time.time()-t0 < 45:
        time.sleep(0.4)
        try: d=json.loads(tab.eval(Q) or "{}")
        except BaseException: continue
        if not d: continue
        if d.get('ad'): sawad=True
        slots=max(slots,d.get('slots') or 0)
        if (d.get('t') or 0) > 0.3:
            first=time.time()-t0; break
    print("load %d: first-frame %s  ad-showing=%s adSlots=%d" % (
        k+1, ("%.1fs"%first) if first else ">45s", sawad, slots))
    time.sleep(2)
