# DOES THE URL VERDICT CACHE ACTUALLY FIRE, AND DOES ANYTHING STAY
# COVERED THAT SHOULD NOT?
#
# probe_dupsrc measured 30% repeated urls among avatars on a settled
# m.youtube search and 0% among thumbnails. This checks the built app:
# how many entries came back `where: cache`, that their verdicts are
# still differentiated (a cache that answered `face` for everything
# would look like a win and be a blanket blur), and that no on-screen
# image is left pending.
import json, time, sys
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://m.youtube.com/results?search_query=interview"

t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var shown=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}').youtube||[];
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',shown:shown});
  return 1;})()""")
time.sleep(5)

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
t.cmd("Page.navigate", url=URL)

def settle(tab, rounds=45):
    last, stable = -1, 0
    for _ in range(rounds):
        time.sleep(2)
        try:
            n = tab.eval("window.__TS_GAZE_IMGTOTAL||0")
        except Exception:
            return None
        if n == last and n > 0:
            stable += 1
            if stable >= 3:
                return tab
        else:
            stable = 0
        last = n
    return tab

t = settle(t) or t
for _ in range(6):
    try:
        t.eval("window.scrollBy(0,1400);1")
    except Exception:
        break
    time.sleep(2)
    settle(t, rounds=14)

print(json.dumps(t.eval("""(function(){
  var d=window.__TS_GAZE_IMGDIAG||[];
  var where={}, why={}, whyCache={};
  d.forEach(function(e){
    where[e.where||'page']=(where[e.where||'page']||0)+1;
    why[e.why||'?']=(why[e.why||'?']||0)+1;
    if(e.where==='cache') whyCache[e.why||'?']=(whyCache[e.why||'?']||0)+1;
  });
  // Nothing on screen may still be waiting for a verdict.
  var pend=0;
  [].slice.call(document.querySelectorAll('.ts-gaze-pending')).forEach(function(el){
    var r=el.getBoundingClientRect();
    if(r.width>2&&r.height>2&&r.bottom>0&&r.top<innerHeight) pend++;
  });
  return {total:window.__TS_GAZE_IMGTOTAL||0, ring:d.length,
          where:where, why:why, whyCache:whyCache, onScreenPending:pend};
})()"""), indent=1))
