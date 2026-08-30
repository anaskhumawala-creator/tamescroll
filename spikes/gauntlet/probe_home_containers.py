# WHAT ACTUALLY RENDERS INSIDE MOBILE HOME, AND DOES SEARCH SHARE IT?
#
# The home surface hides ytm-rich-grid-renderer and ytm-rich-section-
# renderer inside ytm-browse / ytm-single-column-browse-results-renderer.
# Owner 2026-08-30: "breaking news still shows on the homepage", so the
# shelf carrying it is outside both. Broadening the scope is only safe if
# search does not render inside the same container -- the caution the
# rule file already carries and nobody has measured.
import json, time, sys
from emu_cdp import page, Tab
UA = ("Mozilla/5.0 (Linux; Android 13; Pixel 5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36")
t = Tab(page()); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
# Home SHOWN, so the page renders what the rule would otherwise hide.
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,
    gender:'man',shown:['home','watch_recs','search_inserts']});
  return 1;})()""")
time.sleep(5)
out={}
for name,url in [("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=news"),
                 ("subs","https://m.youtube.com/feed/subscriptions")]:
    t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
    t.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    t.cmd("Page.navigate", url=url)
    time.sleep(12)
    try:
        out[name]=t.eval("""(function(){
          function n(sel){return document.querySelectorAll(sel).length;}
          var root=document.querySelector('ytm-single-column-browse-results-renderer')||
                   document.querySelector('ytm-browse');
          var kids=[];
          if(root){
            [].slice.call(root.querySelectorAll('*')).forEach(function(e){
              var tag=e.tagName.toLowerCase();
              if(tag.indexOf('ytm-')!==0) return;
              if(e.getBoundingClientRect().height<40) return;
              kids.push(tag);
            });
          }
          var counts={};
          kids.forEach(function(k){counts[k]=(counts[k]||0)+1;});
          return {browse:n('ytm-browse'),
                  singleCol:n('ytm-single-column-browse-results-renderer'),
                  richGrid:n('ytm-rich-grid-renderer'),
                  richSection:n('ytm-rich-section-renderer'),
                  itemSection:n('ytm-item-section-renderer'),
                  shelf:n('ytm-shelf-renderer'),
                  sectionList:n('ytm-section-list-renderer'),
                  searchRoot:n('ytm-search'),
                  visibleInsideBrowse:counts};})()""")
    except Exception as e:
        out[name]={"error":str(e)[:70]}
print(json.dumps(out, indent=1)[:3000])
