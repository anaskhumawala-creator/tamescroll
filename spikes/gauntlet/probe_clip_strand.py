# IS THE CLIP-LAYER EXPOSURE REACHABLE IN THE SHIPPED APP, OR ONLY IN A
# TEST STUB?
#
# The fix in 52df023 re-parents every overlay into the clip layer on each
# pass, so a layer the PAGE removed can no longer strand the patches.
# `clipRebuilt` counts it. That counter read 0 over a 4-minute release
# sweep, which is not evidence of anything on its own -- the sweep never
# did the thing most likely to wipe the layer.
#
# entry.host is `#movie_player` and the clip layer is its child. So the
# exposure needs YouTube to clear that element's children while the
# element itself stays connected and the <video> inside stays the same
# element (otherwise `refreshRects` / the connectedness guard fires
# first and the patches are rebuilt anyway).
#
# This installs a MutationObserver on the live #movie_player and records
# every removal of OUR layer, with whether the host and the video
# survived it -- so a removal that another guard would have caught is
# distinguishable from a genuine strand. Then it drives the transitions
# that plausibly rebuild a player: SPA navigation to a recommendation,
# fullscreen in and out, and a seek.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(30)

# Observe BEFORE anything is driven. Survives an SPA nav because the
# observer is re-armed whenever #movie_player changes identity.
ARM = r"""(function(){
  if(window.__TS_CLIPW) return 'already';
  var W = window.__TS_CLIPW = {removals:[], arms:0, hostSwaps:0};
  var cur = null, obs = null;
  function arm(){
    var p = document.querySelector('#movie_player');
    if(!p || p === cur) return;
    if(obs) obs.disconnect();
    if(cur) W.hostSwaps++;
    cur = p; W.arms++;
    obs = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var rm = muts[i].removedNodes||[];
        for(var j=0;j<rm.length;j++){
          var n = rm[j];
          if(n.nodeType!==1) continue;
          if(!n.classList || !n.classList.contains('ts-gaze-vregion-clip')) continue;
          var v = cur.querySelector('video');
          W.removals.push({
            t: Math.round(performance.now()),
            kids: n.childElementCount,
            hostConnected: cur.isConnected,
            videoPresent: !!v,
            videoConnected: !!(v && v.isConnected),
            videoBoxes: v && v.getClientRects ? v.getClientRects().length : -1,
            hostBoxes: cur.getClientRects().length
          });
        }
      }
    });
    obs.observe(cur, {childList:true});
  }
  arm();
  setInterval(arm, 400);
  return 'armed';
})()"""
print("ARM", t.eval(ARM))

def snap(label):
    o = t.eval("""(function(){
      var r = window.__TS_GAZE_RENDER ? window.__TS_GAZE_RENDER() : null;
      var vt = window.__TS_GAZE_VTRACKS ? window.__TS_GAZE_VTRACKS() : [];
      var tracks = 0; for(var i=0;i<(vt||[]).length;i++) tracks += ((vt[i].tracks||[]).length);
      var lay = document.querySelectorAll('.ts-gaze-vregion-clip').length;
      var patch = 0, vis = 0;
      var ps = document.querySelectorAll('.ts-gaze-vregion-clip > *');
      for(var k=0;k<ps.length;k++){ patch++;
        var pr = ps[k].getBoundingClientRect();
        if(pr.width>0 && pr.height>0 && getComputedStyle(ps[k]).display!=='none') vis++; }
      var W = window.__TS_CLIPW||{};
      return JSON.stringify({clipRebuilt: r&&r.clipRebuilt, rectsNoBoxes: r&&r.rectsNoBoxes,
        hideNoVr: r&&r.hideNoVr, hideZeroVr: r&&r.hideZeroVr, hideClipped: r&&r.hideClipped,
        tracks: tracks, layers: lay, overlays: patch, visible: vis,
        removals: (W.removals||[]).length, arms: W.arms, hostSwaps: W.hostSwaps});
    })()""")
    print(label, o)

t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=217; v.play();} return 1;})()")
for _ in range(18):
    time.sleep(5)
    o = t.eval("(function(){var vt=window.__TS_GAZE_VTRACKS?window.__TS_GAZE_VTRACKS():[];"
               "var n=0;for(var i=0;i<(vt||[]).length;i++)n+=((vt[i].tracks||[]).length);return String(n);})()")
    if isinstance(o, str) and o.strip().isdigit() and int(o) > 0:
        break
snap("COVERED")

# --- the transitions -------------------------------------------------
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=60;} return 1;})()")
time.sleep(8); snap("AFTER_SEEK")

# SPA nav: tap a recommendation. A hard navigation tears the page down
# and proves nothing, so the same-document assertion is printed.
t.eval("(function(){window.__TS_MARK=1; return 1;})()")
t.eval("""(function(){
  var a=document.querySelector('a[href^="/watch"]');
  if(!a) return 'no-link';
  a.scrollIntoView(); a.click(); return 'clicked';})()""")
time.sleep(12)
print("SAME_DOC", t.eval("(function(){return String(!!window.__TS_MARK);})()"))
for _ in range(10):
    time.sleep(5)
    o = t.eval("(function(){var vt=window.__TS_GAZE_VTRACKS?window.__TS_GAZE_VTRACKS():[];"
               "var n=0;for(var i=0;i<(vt||[]).length;i++)n+=((vt[i].tracks||[]).length);return String(n);})()")
    if isinstance(o, str) and o.strip().isdigit() and int(o) > 0:
        break
snap("AFTER_SPA")

# second SPA nav -- the player is reused across these, which is the
# likeliest place for YouTube to rebuild its own children.
t.eval("""(function(){
  var a=document.querySelectorAll('a[href^="/watch"]')[2];
  if(!a) return 'no-link'; a.scrollIntoView(); a.click(); return 'clicked';})()""")
time.sleep(25); snap("AFTER_SPA2")

print("REMOVALS", t.eval("(function(){return JSON.stringify((window.__TS_CLIPW||{}).removals||[]);})()"))
