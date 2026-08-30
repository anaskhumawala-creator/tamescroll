# Does the new `home_shelves` surface actually reach the page while Home
# feed is SHOWN? That is the whole point of splitting it out: his feed is
# shown, so anything scoped to `home` is switched off, and the shelf
# rules have to arrive on a different toggle.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(5)
# Pull the pushed rules first: the OTA cache in app-data shadows the
# compiled-in copy, so a local edit is invisible until it is fetched.
print("refresh:", t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  try{ return await inv('refresh_rules'); }catch(e){ return 'ERR '+e; }})()"""))
time.sleep(3)
print("surfaces:", json.dumps(t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  var s=await inv('surfaces',{id:'youtube'});
  return s.map(function(x){return [x.id, x.label, x.always_on, x.default_shown];});})()""")))

# Home feed SHOWN, shelves left on their default (hidden).
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,
    gender:'man',shown:['home']});
  return 1;})()""")
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(25)
print("sheet:", json.dumps(t.eval("""(function(){
  var css='';
  [].slice.call(document.querySelectorAll('style')).forEach(function(s){
    if(/ytm-|ytd-/.test(s.textContent)) css+=s.textContent;});
  return {bytes:css.length,
    shelfHasRule: css.indexOf('ytm-rich-section-renderer:has(ytm-rich-shelf-renderer)')>=0,
    shelfHasRule2: css.indexOf('ytm-rich-section-renderer:has(ytm-shelf-renderer)')>=0,
    homeGridRule: css.indexOf('ytm-browse ytm-rich-grid-renderer')>=0,
    homeSectionListRule: css.indexOf('ytm-browse ytm-section-list-renderer')>=0,
    gridVisible: [].slice.call(document.querySelectorAll('ytm-rich-grid-renderer'))
      .filter(function(n){return getComputedStyle(n).display!=='none'}).length,
    grids: document.querySelectorAll('ytm-rich-grid-renderer').length};})()"""), indent=1))
