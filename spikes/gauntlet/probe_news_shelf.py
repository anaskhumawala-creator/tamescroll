# WHERE DOES THE "BREAKING NEWS" SHELF LIVE ON MOBILE YOUTUBE?
#
# Owner 2026-08-30: "breaking news still shows on the homepage". The home
# surface hides ytm-rich-grid-renderer and ytm-rich-section-renderer, so
# whatever carries the news shelf is outside both. Selectors are read
# from the live DOM, never guessed -- this dumps the actual custom
# elements and their headers on every reachable surface.
import json, time, sys
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
URLS = sys.argv[1:] or ["https://m.youtube.com/"]

t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:localStorage.getItem('tamescroll.gender')||'man',shown:['home']});
  return 1;})()""")
time.sleep(5)
out={}
for url in URLS:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(14)
    try:
        out[url]=t.eval("""(function(){
          var tags={};
          [].slice.call(document.querySelectorAll('*')).forEach(function(e){
            var n=e.tagName.toLowerCase();
            if(n.indexOf('-')===-1) return;
            tags[n]=(tags[n]||0)+1;
          });
          // Any element whose visible text starts with a shelf-style
          // header, so the container that OWNS "Breaking news" is named.
          var shelves=[];
          [].slice.call(document.querySelectorAll('*')).forEach(function(e){
            if(e.tagName.toLowerCase().indexOf('-')===-1) return;
            var txt=(e.textContent||'').trim().slice(0,40);
            if(/^(breaking news|news|latest news|top news)/i.test(txt)){
              shelves.push([e.tagName.toLowerCase(),
                            (e.parentElement&&e.parentElement.tagName.toLowerCase())||null,
                            txt]);
            }
          });
          return {bodyText:(document.body.innerText||'').slice(0,160),
                  tagCount:Object.keys(tags).length,
                  shelfLike:shelves.slice(0,12),
                  richGrid:document.querySelectorAll('ytm-rich-grid-renderer').length,
                  richSection:document.querySelectorAll('ytm-rich-section-renderer').length,
                  itemSection:document.querySelectorAll('ytm-item-section-renderer').length,
                  shelfRenderer:document.querySelectorAll('ytm-shelf-renderer').length};})()""")
    except Exception as e:
        out[url]={"error":str(e)[:80]}
print(json.dumps(out, indent=1)[:3500])
