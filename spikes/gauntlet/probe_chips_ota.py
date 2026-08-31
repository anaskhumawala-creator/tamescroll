# THROUGH THE REAL DELIVERY PATH. The OTA cache in app-data SHADOWS local
# rules edits, so the earlier run could not see the new surface at all --
# refresh first, then ask both directions.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
print("refresh:", t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  try{ return await inv('refresh_rules'); }catch(e){ return 'ERR '+e; }})()"""))
time.sleep(6)

def open_with(shown):
    t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                                 shown:%s}); return 1;})()""" % json.dumps(shown))
    time.sleep(5)
    t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(30)
    t.eval("window.scrollBy(0,1000);1"); time.sleep(6)

LOOK = """(function(){
  function vis(n){return !!n && getComputedStyle(n).display!=='none' &&
                         n.getBoundingClientRect().height>0;}
  var bar=document.querySelector('ytm-feed-filter-chip-bar-renderer');
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var items=[].slice.call(document.querySelectorAll('ytm-rich-item-renderer'));
  var sheet=document.getElementById('tamescroll-rules');
  var css=sheet?(sheet.textContent||''):'';
  return {chipBars:document.querySelectorAll('ytm-feed-filter-chip-bar-renderer').length,
    chipVisible:vis(bar),
    chipDisplay:bar?getComputedStyle(bar).display:null,
    chipH:bar?Math.round(bar.getBoundingClientRect().height):null,
    gridVisible:vis(grid), items:items.length, itemsVisible:items.filter(vis).length,
    watchLinks:document.querySelectorAll('a[href*="/watch?v="]').length,
    ruleInSheet:css.indexOf('ytm-feed-filter-chip-bar-renderer')>=0};})()"""

out={}
base=['home','shorts','watch_recs','previews','search_inserts']
open_with(base+['home_chips']); out["chips SHOWN"]=t.eval(LOOK)
open_with(base);                out["chips HIDDEN"]=t.eval(LOOK)
print(json.dumps(out, indent=1))
