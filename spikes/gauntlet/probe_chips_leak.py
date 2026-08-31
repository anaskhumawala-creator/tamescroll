# DOES THE NEW CHIP RULE LEAK OFF HOME?
#
# surfaces_css does NOT enforce the `domain##` column -- every selector
# in a platform file ships to every host the universal script matches.
# So the ONLY thing scoping this rule is the `ytm-browse ` prefix, and
# m.youtube's SEARCH page renders in ytm-search, not ytm-browse
# (measured 2026-08-30). If that is still true the search chip bar is
# untouched; if it is not, hiding home chips silently kills search's.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
# home chips HIDDEN -- the state that could leak
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)

LOOK = """(function(){
  function vis(n){return !!n && getComputedStyle(n).display!=='none' &&
                         n.getBoundingClientRect().height>0;}
  var bars=[].slice.call(document.querySelectorAll('ytm-feed-filter-chip-bar-renderer'));
  return {path:location.pathname,
    browse:document.querySelectorAll('ytm-browse').length,
    search:document.querySelectorAll('ytm-search').length,
    chipBars:bars.length,
    chipVisible:bars.map(vis),
    chipInBrowse:bars.map(function(b){return !!b.closest('ytm-browse');}),
    anyChipHidden:bars.some(function(b){return !vis(b);}),
    watchLinks:document.querySelectorAll('a[href*="/watch?v="]').length,
    results:document.querySelectorAll('ytm-video-with-context-renderer').length,
    items:document.querySelectorAll('ytm-rich-item-renderer').length};})()"""

out={}
for name,url in (("home","https://m.youtube.com/"),
                 ("search","https://m.youtube.com/results?search_query=news"),
                 ("watch","https://m.youtube.com/watch?v=NWoT1ZVd1Lo")):
    t.cmd("Page.navigate", url=url); time.sleep(30)
    t.eval("window.scrollBy(0,900);1"); time.sleep(6)
    out[name]=t.eval(LOOK)
print(json.dumps(out, indent=1))
