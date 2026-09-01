"""SPA click path: does the request-shaper give us a fast, ad-free stream?"""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VID=sys.argv[1]
try: tab=pick("youtube.com")
except Exception: tab=open_platform("man")
tab.eval("location.href='https://www.youtube.com/'")
time.sleep(9)
# SPA-navigate the way the app does (in-page router), not a hard load
tab.eval("""(function(){
 var a=document.querySelector('a#thumbnail[href*="watch"], a.ytd-thumbnail[href*="watch"]');
 if(window.__ytSpaNav) return 'x';
 return 1;})()""")
Q="""(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');
var r=window.ytInitialPlayerResponse;
return JSON.stringify({t:v?v.currentTime:-1,ad:mp?/ad-showing/.test(mp.className):false,
slots:r&&r.adSlots?r.adSlots.length:0,url:location.pathname});})()"""
# click the first organic thumbnail -> real SPA nav
clicked = tab.eval("""(function(){
 var as=[].slice.call(document.querySelectorAll('a#thumbnail[href*="/watch"]'));
 if(!as.length) return 'none';
 as[0].click(); return as[0].getAttribute('href');})()""")
print("clicked:", clicked)
t0=time.time(); first=None; sawad=False; slots=0
while time.time()-t0<50:
    time.sleep(0.4)
    try: d=json.loads(tab.eval(Q) or "{}")
    except Exception: continue
    if not d or d.get('url')!='/watch': continue
    if d.get('ad'): sawad=True
    slots=max(slots,d.get('slots') or 0)
    if (d.get('t') or 0)>0.3: first=time.time()-t0; break
print("SPA first-frame %s  ad-showing=%s adSlots=%d" % (("%.1fs"%first) if first else ">50s", sawad, slots))
