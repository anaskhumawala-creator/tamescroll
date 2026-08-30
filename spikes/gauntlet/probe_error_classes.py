# What does the image pipeline actually FAIL at, per platform? The last
# round found a whole failure class by reading `why`/`msg` in the
# diagnostic ring instead of the counters. This sweeps every platform for
# the same thing. JSON only, headless emulator.
import json, time
from emu_cdp import page, Tab

UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
import sys
ALL = {
    "m.youtube": "https://m.youtube.com/results?search_query=interview",
    "reddit": "https://www.reddit.com/r/pics/",
    "x": "https://x.com/explore",
    "instagram": "https://www.instagram.com/explore/",
}
# One site per run: the emulator died part-way through a four-site sweep
# (swiftshader plus three models per page is enough to lose the whole
# harness), and losing every result to the last site is not a finding.
SITES = [(k, ALL[k]) for k in (sys.argv[1:] or list(ALL))]

def open_youtube():
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

open_youtube()
out = {}
for name, url in SITES:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    last, stable = -1, 0
    for _ in range(45):
        time.sleep(2)
        # A navigation on Android's single WebView can drop the socket;
        # reconnecting is the probe's job, not a finding.
        try:
            n = t.eval("(window.__TS_GAZE_IMGDIAG||[]).length")
        except Exception:
            t = Tab(page()); t.cmd("Runtime.enable")
            continue
        if n == last and n > 0:
            stable += 1
            if stable >= 3:
                break
        else:
            stable = 0
        last = n
    out[name] = t.eval("""(function(){
      var d=window.__TS_GAZE_IMGDIAG||[];
      var why={}, msg={}, where={};
      d.forEach(function(e){
        why[e.why||'?']=(why[e.why||'?']||0)+1;
        if(e.msg) msg[e.msg]=(msg[e.msg]||0)+1;
        where[e.where||'page']=(where[e.where||'page']||0)+1;});
      var w=window.__TS_GAZE_WORKER||{};
      return {url:location.href.slice(0,60), entries:d.length,
        total:window.__TS_GAZE_IMGTOTAL||0,
        why:why, msg:msg, where:where,
        worker:{up:w.up||null, ready:w.ready||null, backend:w.backend||null},
        onPending:[].slice.call(document.querySelectorAll('img.ts-gaze-pending'))
          .filter(function(i){var b=i.getBoundingClientRect();
            return b.bottom>0&&b.top<innerHeight&&b.width>=120;}).length,
        csp:(window.__TS_CSP_VIOLATIONS||[]).length};})()""")
print(json.dumps(out, indent=1))
