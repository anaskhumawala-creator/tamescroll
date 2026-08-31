# THE CHIP SURFACE, BOTH WAYS, ON A BUILT APK.
#   default (nothing passed)  -> chips SHOWN, feed intact
#   chips hidden              -> chip row gone, EVERY video item still there
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

def open_with(shown):
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                                 shown:%s});
      return 1;})()""" % json.dumps(shown))
    time.sleep(5)
    t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(30)
    t.eval("window.scrollBy(0,1200);1"); time.sleep(6)

LOOK = """(function(){
  function vis(n){return n && getComputedStyle(n).display!=='none' &&
                         n.getBoundingClientRect().height>0;}
  var bar=document.querySelector('ytm-feed-filter-chip-bar-renderer');
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var items=[].slice.call(document.querySelectorAll('ytm-rich-item-renderer'));
  var sheet=document.getElementById('tamescroll-rules');
  var css=sheet?(sheet.textContent||''):'';
  return {chipBars:document.querySelectorAll('ytm-feed-filter-chip-bar-renderer').length,
    chipVisible:vis(bar),
    chipH:bar?Math.round(bar.getBoundingClientRect().height):null,
    chipDisplay:bar?getComputedStyle(bar).display:null,
    gridVisible:vis(grid),
    items:items.length, itemsVisible:items.filter(vis).length,
    watchLinks:document.querySelectorAll('a[href*="/watch?v="]').length,
    ruleInSheet:css.indexOf('ytm-feed-filter-chip-bar-renderer')>=0,
    cssBytes:css.length};})()"""

out={}
# whatever the app defaults to when the surface is not named at all
open_with(['home','shorts','watch_recs','previews','search_inserts'])
out["chips NOT named (default)"]=t.eval(LOOK)
open_with(['home','home_chips','shorts','watch_recs','previews','search_inserts'])
out["chips SHOWN explicitly"]=t.eval(LOOK)
open_with(['home','shorts','watch_recs','previews','search_inserts'])
out["chips hidden (surface omitted, default-shown must still show)"]=out["chips NOT named (default)"]
print(json.dumps(out, indent=1))
