"""Can m.youtube survive losing its embedded stream?

The streamingData drop is the fix that killed the 24-37s "fake buffering"
stall on desktop, and it is DESKTOP ONLY by an explicit decision in
rules/scriptlets.txt: dropping the embedded fallback stream is a
player-red-line change and nobody had measured it on the mobile page.

This measures it, without touching rules (the OTA cache shadows local
rules edits anyway): a document-start accessor prunes streamingData off
ytInitialPlayerResponse exactly the way the scriptlet would, and we watch
whether the player still reaches real playback and how long it takes.

Run with an argument: `control` (no prune) or `prune`.
"""
import base64
import json
import sys
import time

from gauntlet import open_platform, pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)
MODE = sys.argv[1] if len(sys.argv) > 1 else "prune"
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"

PRUNE = r"""
(function(){
  var v = undefined, armed = false;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: function(){ return v; },
      set: function(nv){
        try {
          if (nv && typeof nv === 'object') {
            delete nv.streamingData;
            delete nv.adSlots; delete nv.adPlacements;
            delete nv.playerAds; delete nv.adBreakHeartbeatParams;
            armed = true;
          }
        } catch(e){}
        v = nv;
        window.__TS_PRUNED = armed;
      }
    });
  } catch(e){ window.__TS_PRUNE_ERR = String(e); }
})();
"""

WATCH = r"""
(function(){
  window.__TS_PLAYERREQ = 0;
  var of = window.fetch;
  window.fetch = function(a, b){
    try {
      var u = typeof a === 'string' ? a : (a && a.url) || '';
      if (u.indexOf('/youtubei/v1/player') >= 0) window.__TS_PLAYERREQ++;
    } catch(e){}
    return of.apply(this, arguments);
  };
  var ox = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u){
    try { if ((u||'').indexOf('/youtubei/v1/player') >= 0) window.__TS_PLAYERREQ++; } catch(e){}
    return ox.apply(this, arguments);
  };
})();
"""

def platform_tab():
    # The platform window is reused across probes, so it may currently be
    # sitting on whatever the last run navigated it to. Take it by
    # elimination rather than by the URL we hope it has.
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u:
            continue
        if u.startswith("http"):
            return pick(u)
    return open_platform("man")


tab = platform_tab()
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd("Emulation.setTouchEmulationEnabled", enabled=True, maxTouchPoints=5)
tab.cmd(
    "Emulation.setDeviceMetricsOverride",
    width=412,
    height=915,
    deviceScaleFactor=2.0,
    mobile=True,
)
src = WATCH + (PRUNE if MODE == "prune" else "")
tab.cmd("Page.addScriptToEvaluateOnNewDocument", source=src)
t0 = time.time()
tab.eval("location.href='https://m.youtube.com/watch?v=%s'" % VIDEO)

first = None
ad = False
err = None
for _ in range(120):
    time.sleep(0.5)
    try:
        raw = tab.eval(
            r"""(function(){
  var v=document.querySelector('video');
  return JSON.stringify({
    t: v? +v.currentTime.toFixed(2) : null,
    ready: v? v.readyState : null,
    pruned: !!window.__TS_PRUNED,
    hasSD: !!(window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.streamingData),
    playerReq: window.__TS_PLAYERREQ||0,
    adSkip: document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-player-overlay').length,
    adShowing: document.querySelectorAll('#movie_player.ad-showing, .ad-interrupting').length,
    err: document.querySelectorAll('.ytp-error').length,
    pruneErr: window.__TS_PRUNE_ERR || null
  });})()"""
        )
    except Exception:
        continue
    if not raw or raw.startswith("no "):
        continue
    d = json.loads(raw)
    if d.get("adSkip") or d.get("adShowing"):
        ad = True
    if d.get("err"):
        err = d
        break
    if d.get("t") and d["t"] > 0.3:
        first = time.time() - t0
        break

final = tab.eval(
    r"""(function(){var v=document.querySelector('video');
 return JSON.stringify({t: v? +v.currentTime.toFixed(2):null, paused: v? v.paused:null,
  pruned: !!window.__TS_PRUNED, hasSD: !!(window.ytInitialPlayerResponse&&window.ytInitialPlayerResponse.streamingData),
  playerReq: window.__TS_PLAYERREQ||0, err: document.querySelectorAll('.ytp-error').length,
  adSkip: document.querySelectorAll('.ytp-ad-skip-button').length});})()"""
)
print(
    "mode=%s video=%s firstFrame=%s adSeen=%s errState=%s"
    % (MODE, VIDEO, ("%.1fs" % first) if first else "NEVER", ad, err)
)
print("final:", final)
shot = tab.cmd("Page.captureScreenshot", format="png")
name = "sabr-%s-%s.png" % (MODE, VIDEO)
open(name, "wb").write(base64.b64decode(shot["data"]))
print("wrote", name)
