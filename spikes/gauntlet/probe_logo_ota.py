# THE REAL DELIVERY PATH: refresh_rules, then does the promo mark
# actually go, does the HOME BUTTON survive, and is the feed untouched?
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
inv = """(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var r=await inv('refresh_rules'); return String(r);})()"""
ota = t.eval(inv); time.sleep(2)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs','home_chips']}); return 1;})()""")
time.sleep(5)

READ = """(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.width),Math.round(r.height)]; }
  var img=document.querySelector('img.mobile-topbar-logo');
  var b=document.querySelector('button.mobile-topbar-header-endpoint');
  var out={img:!!img, imgDisplay:img?getComputedStyle(img).display:null, imgBox:box(img),
    btnBox:box(b), btnLabel:b?b.getAttribute('aria-label'):null,
    bar:box(document.querySelector('ytm-mobile-topbar-renderer')),
    grid:document.querySelectorAll('ytm-rich-grid-renderer').length,
    items:document.querySelectorAll('ytm-rich-item-renderer').length,
    watchLinks:document.querySelectorAll('a[href*="/watch"]').length,
    chips:document.querySelectorAll('ytm-feed-filter-chip-bar-renderer').length,
    sheetHasRule:(function(){var s=document.getElementById('tamescroll-rules');
      return !!(s&&s.textContent.indexOf('mobile-topbar-logo')>=0);})()};
  if(b){var r=b.getBoundingClientRect();
    if(r.width>1){var el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      out.btnHit=el?el.tagName.toLowerCase():null;
      out.btnInside=!!(el&&el.closest&&el.closest('button')===b);}}
  return out;})()"""

t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(26)
home = t.eval(READ)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=linus"); time.sleep(24)
search = t.eval("""(function(){
  var img=document.querySelector('img.mobile-topbar-logo');
  return {img:!!img, imgDisplay:img?getComputedStyle(img).display:null,
    results:document.querySelectorAll('a[href*="/watch"]').length,
    search:document.querySelectorAll('ytm-search').length};})()""")
print(json.dumps({"ota":ota,"home":home,"search":search}, indent=1))
