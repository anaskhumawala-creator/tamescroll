# After the OTA lands: is the home feed body empty, and do search and the
# rest still render?  Rules changes cannot be verified from local files --
# the OTA cache in app-data shadows them -- so this refreshes first.
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
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',shown:[]});
  return 1;})()""")
time.sleep(5)
out={}
for name,url in [("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=news")]:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(13)
    try:
        out[name]=t.eval("""(function(){
          function vis(sel){var n=0;[].slice.call(document.querySelectorAll(sel))
            .forEach(function(e){var r=e.getBoundingClientRect();
              if(r.height>20&&getComputedStyle(e).display!=='none') n++;});return n;}
          return {browse:document.querySelectorAll('ytm-browse').length,
                  visibleFeedContainers: vis('ytm-browse ytm-rich-grid-renderer,'+
                    'ytm-browse ytm-rich-section-renderer, ytm-browse ytm-item-section-renderer,'+
                    'ytm-browse ytm-shelf-renderer, ytm-browse ytm-section-list-renderer'),
                  searchResults: vis('ytm-search ytm-item-section-renderer'),
                  videoLinks: document.querySelectorAll('a[href*="/watch?v="]').length};})()""")
    except Exception as e:
        out[name]={"error":str(e)[:70]}
print(json.dumps(out, indent=1))
