"""Measure WHY a pre-roll ad renders: did our scriptlet win the race?"""
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "gauntlet"))
from gauntlet import Tab, pick, open_platform

VID = sys.argv[1] if len(sys.argv) > 1 else "DD54J5kecpg"

try:
    tab = pick("youtube.com")
except BaseException:
    tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % VID)

PROBE = """(function(){
 var d=Object.getOwnPropertyDescriptor(window,'ytInitialPlayerResponse');
 var r=window.ytInitialPlayerResponse;
 var mp=document.querySelector('#movie_player');
 var v=document.querySelector('video');
 return JSON.stringify({
  hasAccessor: !!(d && d.get),
  descKind: d ? (d.get?'accessor':'data') : 'absent',
  prAbsent: r===undefined,
  adSlots: r && r.adSlots ? r.adSlots.length : (r?0:-1),
  adPlacements: r && r.adPlacements ? r.adPlacements.length : (r?0:-1),
  playerAds: r && r.playerAds ? r.playerAds.length : (r?0:-1),
  cls: mp ? mp.className : null,
  adBadge: !!document.querySelector('.ytp-ad-player-overlay,.ytp-ad-badge,.ytp-ad-simple-ad-badge,.ytp-ad-preview-container,.ytp-ad-text'),
  skip: !!document.querySelector('.ytp-ad-skip-button,.ytp-skip-ad-button'),
  t: v?v.currentTime:-1,
  scriptletMarker: typeof window.__TS_SCRIPTLETS
 });})()"""

for i in range(24):
    time.sleep(0.6)
    try:
        out = tab.eval(PROBE)
    except Exception as e:
        print(i, "eval err", e); continue
    if out:
        print(("%4.1fs " % (i*0.6)) + out)
