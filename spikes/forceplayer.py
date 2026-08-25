"""Does removing the EMBEDDED streamingData push the player onto the
client-side /player request (where our isInlinePlaybackNoAd shaper works)?
Tested via a CDP document-start script so no rebuild is needed."""
import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VID = sys.argv[1]
MODE = sys.argv[2] if len(sys.argv)>2 else "streamingData"
try: tab=pick("youtube.com")
except BaseException: tab=open_platform("man")

DOC = """
(function(){
  var stored;
  window.__PLAYER_FETCHES = 0;
  var of = window.fetch;
  window.fetch = function(a,b){
    try{ var u = typeof a==='string'?a:(a&&a.url)||'';
      if(/youtubei\/v1\/player/.test(u)) window.__PLAYER_FETCHES++; }catch(e){}
    return of.apply(this, arguments);
  };
  function strip(v){
    if(v && typeof v==='object'){ try{ delete v.%s; }catch(e){} }
    return v;
  }
  try{
    Object.defineProperty(window,'ytInitialPlayerResponse',{
      configurable:true,
      get:function(){return stored;},
      set:function(v){stored=strip(v);}
    });
  }catch(e){}
})();
""" % MODE

tab.cmd("Page.enable")
r = tab.cmd("Page.addScriptToEvaluateOnNewDocument", source=DOC)
sid = r.get("identifier")
print("doc-start installed:", sid, "mode=strip", MODE)

Q="""(function(){var v=document.querySelector('video');var mp=document.querySelector('#movie_player');
var r=window.ytInitialPlayerResponse;
return JSON.stringify({t:v?v.currentTime:-1,ad:mp?/ad-showing/.test(mp.className):false,
slots:r&&r.adSlots?r.adSlots.length:0,sd:!!(r&&r.streamingData),
pf:window.__PLAYER_FETCHES||0,err:!!document.querySelector('.ytp-error')});})()"""

try:
    for k in range(2):
        tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=0s'"%VID)
        t0=time.time(); first=None; sawad=False; slots=0; pf=0; err=False
        while time.time()-t0<60:
            time.sleep(0.4)
            try: d=json.loads(tab.eval(Q) or "{}")
            except BaseException: continue
            if not d: continue
            if d.get('ad'): sawad=True
            slots=max(slots,d.get('slots') or 0); pf=max(pf,d.get('pf') or 0)
            err = err or bool(d.get('err'))
            if (d.get('t') or 0)>0.3: first=time.time()-t0; break
        print("load %d: first-frame %-7s ad=%-5s adSlots=%d playerFetches=%d ytpError=%s" % (
            k+1, ("%.1fs"%first) if first else ">60s", sawad, slots, pf, err))
        time.sleep(2)
finally:
    if sid: tab.cmd("Page.removeScriptToEvaluateOnNewDocument", identifier=sid)
    print("doc-start removed")
