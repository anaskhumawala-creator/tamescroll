"""Ship-path verification: ad, first frame, player integrity. No CDP tricks."""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VIDS = sys.argv[1:] or ["DD54J5kecpg"]
tab=None
for _ in range(4):
    try:
        tab=pick("youtube.com"); break
    except BaseException:
        try:
            tab=open_platform("man"); break
        except BaseException:
            time.sleep(6)
if tab is None: raise SystemExit("could not open a YouTube window")
Q="""(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');
var r=window.ytInitialPlayerResponse;
return JSON.stringify({t:v?v.currentTime:-1,ad:mp?/ad-showing/.test(mp.className):false,
slots:r&&r.adSlots?r.adSlots.length:0,sd:!!(r&&r.streamingData),
title:r&&r.videoDetails?String(r.videoDetails.title).slice(0,28):null,
dur:v&&v.duration?Math.round(v.duration):0,
skip:!!document.querySelector('.ytp-ad-skip-button,.ytp-skip-ad-button'),
err:!!document.querySelector('.ytp-error')});})()"""
for vid in VIDS:
    for k in range(2):
        tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=0s'"%vid)
        t0=time.time(); first=None; ad=False; slots=0; sd=True; err=False; title=None; dur=0; skip=False
        while time.time()-t0<60:
            time.sleep(0.4)
            try: d=json.loads(tab.eval(Q) or "{}")
            except BaseException: continue
            if not d: continue
            if d.get('ad'): ad=True
            if d.get('skip'): skip=True
            if d.get('err'): err=True
            slots=max(slots,d.get('slots') or 0)
            if d.get('title'): title=d['title']; sd=d.get('sd')
            if (d.get('t') or 0)>0.3: first=time.time()-t0; dur=d.get('dur') or 0; break
        print("%s run%d: first=%-7s ad=%-5s skipBtn=%-5s embeddedStream=%-5s adSlots=%d dur=%ds err=%s title=%r" % (
            vid, k+1, ("%.1fs"%first) if first else ">60s", ad, skip, sd, slots, dur, err, title))
        time.sleep(2)
