# Two things at once, and the second is the one that has bitten twice:
#   1. a non-Shorts shelf (Breaking news) is hidden by home_shelves
#   2. a Shorts shelf is NOT -- it still answers to the Shorts toggle
# Home content varies per load, so this reloads until it sees a
# non-Shorts section rather than reporting whatever the first load gave.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
print("refresh:", t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  try{return await inv('refresh_rules');}catch(e){return 'ERR '+e;}})()"""))
time.sleep(2)

REPORT = """(function(){
  function vis(n){return getComputedStyle(n).display!=='none' && n.getBoundingClientRect().height>0;}
  var secs=[].slice.call(document.querySelectorAll('ytm-rich-section-renderer')).map(function(s){
    var shorts=s.querySelectorAll('a[href*="/shorts/"]').length;
    return {kind: shorts>0 ? 'shorts' : 'other', visible:vis(s),
      h:Math.round(s.getBoundingClientRect().height),
      watch:s.querySelectorAll('a[href*="/watch?v="]').length, shorts:shorts,
      text:(s.textContent||'').replace(/\s+/g,' ').trim().slice(0,34)};});
  var items=[].slice.call(document.querySelectorAll('ytm-rich-item-renderer'));
  return {sections:secs, items:items.length, itemsVisible:items.filter(vis).length,
    gridVisible:[].slice.call(document.querySelectorAll('ytm-rich-grid-renderer')).filter(vis).length};})()"""

def open_with(shown):
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',shown:%s});
      return 1;})()""" % json.dumps(shown))
    time.sleep(4)

# Home SHOWN, Shorts SHOWN, Feed shelves hidden -- the configuration that
# separates the two toggles.
open_with(['home','shorts','watch_recs','previews','search_inserts'])
out=[]
for attempt in range(6):
    t.cmd("Page.navigate", url="https://m.youtube.com/?ts=%d" % attempt)
    time.sleep(26)
    r=t.eval(REPORT)
    out.append({"load":attempt, "r":r})
    if any(s["kind"]=="other" for s in r["sections"]):
        break
print(json.dumps(out, indent=1))
