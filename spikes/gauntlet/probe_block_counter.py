# IS REQUEST INTERCEPTION ACTUALLY WIRED ON ANDROID?
#
# The owner's phone report (1051, a watch page) came back seen 0 /
# blocked 0, which the diagnostics block says means "page interception is
# not wired at all". But `seen` is stamped INTO the page-load script, so
# it is a snapshot of the process counter at the moment that page's
# script was built -- on the first http page of an app run it is 0 no
# matter how well the interceptor works. This loads two pages in a row
# and reads the stamp on each.
import json, time
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
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
time.sleep(6)
out=[]
for i, url in enumerate([
        "https://m.youtube.com/results?search_query=news",
        "https://m.youtube.com/feed/trending",
        "https://m.youtube.com/results?search_query=music"]):
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(14)
    try:
        d = t.eval("JSON.stringify(window.__TS_DIAG_APP||null)")
    except Exception:
        t = Tab(page()); t.cmd("Runtime.enable")
        d = t.eval("JSON.stringify(window.__TS_DIAG_APP||null)")
    v = json.loads(d) if d and d != 'null' else None
    out.append({"nav": i + 1, "seen": v and v.get("seen"),
                "blocked": v and v.get("blocked"),
                "cssBytes": v and v.get("cssBytes")})
print(json.dumps(out, indent=1))
