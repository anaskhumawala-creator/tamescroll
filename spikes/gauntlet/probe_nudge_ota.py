import json, time
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
print("refresh:", t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  try { return String(await inv('refresh_rules')); } catch(e){ return 'ERR '+e; }})()"""))
time.sleep(3)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)
out={}
for name,url in [("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=news")]:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(22)
    try:
        out[name]=t.eval("""(function(){
          var n=[].slice.call(document.querySelectorAll('ytm-feed-nudge-renderer'));
          var vis=n.filter(function(e){var r=e.getBoundingClientRect();
            return r.height>10&&getComputedStyle(e).display!=='none';});
          return {nudges:n.length, visibleNudges:vis.length,
                  videoLinks:document.querySelectorAll('a[href*="/watch?v="]').length};})()""")
    except Exception as e:
        out[name]={"error":str(e)[:60]}
print(json.dumps(out, indent=1))
