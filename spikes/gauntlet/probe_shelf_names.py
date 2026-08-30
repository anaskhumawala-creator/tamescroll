# The shelf selectors are [unverified] because his home feed cannot be
# rendered here. But the NAMES can still be read off a live DOM: pages
# that do render shelves signed out will say whether ytm-shelf-renderer
# and ytm-rich-shelf-renderer are real elements or names from memory.
import json, time
from emu_cdp import page, Tab

PAGES = [("home", "https://m.youtube.com/"),
         ("trending", "https://m.youtube.com/feed/trending"),
         ("explore", "https://m.youtube.com/feed/explore")]

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  // Everything SHOWN, so nothing of ours hides what we are trying to read.
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','home_shelves','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)

CENSUS = """(function(){
  var counts={};
  ['ytm-browse','ytm-single-column-browse-results-renderer','ytm-section-list-renderer',
   'ytm-item-section-renderer','ytm-rich-grid-renderer','ytm-rich-item-renderer',
   'ytm-rich-section-renderer','ytm-rich-shelf-renderer','ytm-shelf-renderer',
   'ytm-video-with-context-renderer','ytm-compact-video-renderer'].forEach(function(n){
    counts[n]=document.querySelectorAll(n).length;});
  // And whatever custom elements are actually here, so a name nobody has
  // read cannot hide behind a list we wrote from memory.
  var tags={};
  [].slice.call(document.querySelectorAll('*')).forEach(function(n){
    var tg=n.tagName.toLowerCase();
    if(tg.indexOf('ytm-')===0 || tg.indexOf('yt-')===0){
      var b=n.getBoundingClientRect();
      if(b.height>0) tags[tg]=(tags[tg]||0)+1;
    }});
  var top=Object.keys(tags).sort(function(a,b){return tags[b]-tags[a]}).slice(0,22)
    .map(function(k){return k+':'+tags[k]});
  return {path:location.pathname, known:counts, renderedCustomElements:top,
          bodyText:(document.body.innerText||'').slice(0,90).replace(/\s+/g,' ')};})()"""

out={}
for name,url in PAGES:
    t.cmd("Page.navigate", url=url)
    time.sleep(26)
    try:
        out[name]=t.eval(CENSUS)
    except Exception as e:
        t = Tab(page()); t.cmd("Runtime.enable")
        out[name]={"err":str(e)[:60]}
print(json.dumps(out, indent=1))
