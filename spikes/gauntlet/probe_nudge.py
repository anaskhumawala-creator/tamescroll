# The "turn on watch history" prompt on mobile home: what is it, how big,
# and does hiding it reach anything else?  NO NAGS is a hard rule in this
# repo, and this is one.
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
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','watch_recs','previews','search_inserts','mobile_nags']});
  return 1;})()""")
time.sleep(5)
out={}
for name,url in [("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=news"),
                 ("watch","https://m.youtube.com/watch?v=NWoT1ZVd1Lo")]:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(14)
    try:
        out[name]=t.eval("""(function(){
          var n=[].slice.call(document.querySelectorAll('ytm-feed-nudge-renderer'));
          return {count:n.length,
            boxes:n.map(function(e){var r=e.getBoundingClientRect();
              return {w:Math.round(r.width),h:Math.round(r.height),
                      text:(e.textContent||'').trim().slice(0,70),
                      links:e.querySelectorAll('a[href*="/watch"]').length};}),
            videoLinks:document.querySelectorAll('a[href*="/watch?v="]').length};})()""")
    except Exception as e:
        out[name]={"error":str(e)[:60]}
print(json.dumps(out, indent=1))
