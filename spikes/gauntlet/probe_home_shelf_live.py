# THE HOME FEED RENDERS SIGNED OUT AFTER ALL. Every earlier round
# recorded "signed out, m.youtube renders no feed" -- it does now, so the
# shelf rule can finally be verified instead of shipped [unverified].
#
# Two questions, both of which decide whether the rule is safe:
#   1. Is the shelf actually inside a ytm-rich-section-renderer?
#   2. With home_shelves HIDDEN and Home feed SHOWN, do the videos live?
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

def open_with(shown):
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',shown:%s});
      return 1;})()""" % json.dumps(shown))
    time.sleep(5)
    t.cmd("Page.navigate", url="https://m.youtube.com/")
    time.sleep(26)

STRUCTURE = """(function(){
  function vis(n){return getComputedStyle(n).display!=='none' && n.getBoundingClientRect().height>0;}
  var secs=[].slice.call(document.querySelectorAll('ytm-rich-section-renderer')).map(function(s,i){
    return {i:i, visible:vis(s),
      h:Math.round(s.getBoundingClientRect().height),
      hasRichShelf:!!s.querySelector('ytm-rich-shelf-renderer'),
      hasShelf:!!s.querySelector('ytm-shelf-renderer'),
      videoLinks:s.querySelectorAll('a[href*="/watch?v="]').length,
      shortsLinks:s.querySelectorAll('a[href*="/shorts/"]').length,
      title:(function(){var h=s.querySelector('h2,h3,[role="heading"],span');
        return h?(h.textContent||'').trim().slice(0,40):''})()};});
  var shelves=[].slice.call(document.querySelectorAll('ytm-rich-shelf-renderer')).map(function(s){
    return {visible:vis(s), inRichSection:!!s.closest('ytm-rich-section-renderer'),
      h:Math.round(s.getBoundingClientRect().height),
      videoLinks:s.querySelectorAll('a[href*="/watch?v="]').length,
      title:(function(){var h=s.querySelector('h2,h3,[role="heading"],span');
        return h?(h.textContent||'').trim().slice(0,40):''})()};});
  var items=[].slice.call(document.querySelectorAll('ytm-rich-item-renderer'));
  return {path:location.pathname,
    grids:document.querySelectorAll('ytm-rich-grid-renderer').length,
    gridsVisible:[].slice.call(document.querySelectorAll('ytm-rich-grid-renderer')).filter(vis).length,
    richItems:items.length, richItemsVisible:items.filter(vis).length,
    watchLinks:document.querySelectorAll('a[href*="/watch?v="]').length,
    sections:secs, shelves:shelves};})()"""

out={}
open_with(['home','home_shelves','shorts','watch_recs','previews','search_inserts'])
out["everything SHOWN"]=t.eval(STRUCTURE)
open_with(['home'])            # his configuration: feed shown, shelves hidden
out["feed SHOWN, shelves hidden"]=t.eval(STRUCTURE)
print(json.dumps(out, indent=1))
