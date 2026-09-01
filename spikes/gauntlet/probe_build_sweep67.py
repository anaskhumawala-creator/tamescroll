# REGRESSION SWEEP OF WHAT IS ACTUALLY SHIPPED (1067), plus the last
# reachable half of priority 3: is there anything shelf-like on SEARCH or
# WATCH the way breaking news is on home? Signed out, so home itself is
# already censused (loop 11) -- this looks at the other two surfaces.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs','home_chips']}); return 1;})()""")
time.sleep(5)

CENSUS = """(function(){
  function count(sel){ return document.querySelectorAll(sel).length; }
  // every custom element that is NOT a plain video item, with its size
  var kinds={};
  var root=document.querySelector('ytm-search, ytm-browse, ytm-watch')||document.body;
  [].slice.call(root.querySelectorAll('*')).forEach(function(el){
    var tag=el.tagName.toLowerCase();
    if(tag.indexOf('-')<0) return;
    var r=el.getBoundingClientRect();
    if(r.height<8) return;
    if(!kinds[tag]) kinds[tag]={n:0, maxH:0, watchLinks:0};
    kinds[tag].n++;
    kinds[tag].maxH=Math.max(kinds[tag].maxH, Math.round(r.height));
    kinds[tag].watchLinks=Math.max(kinds[tag].watchLinks,
      el.querySelectorAll('a[href*="/watch"]').length);});
  var top=Object.keys(kinds).map(function(k){return [k,kinds[k].n,kinds[k].maxH,kinds[k].watchLinks];})
    .sort(function(a,b){return b[2]-a[2];}).slice(0,14);
  var d=null; try{ d=window.__TS_DIAG_NOW&&window.__TS_DIAG_NOW();
    if(typeof d==='string') d=JSON.parse(d);}catch(e){}
  return {path:location.pathname, topByHeight:top,
    shelves:count('ytm-shelf-renderer, ytm-rich-shelf-renderer, ytm-item-section-renderer'),
    watchLinks:count('a[href*="/watch"]'),
    engine: d&&d.engine?{seen:d.engine.seen, blocked:d.engine.blocked,
      rulesGen:d.engine.rulesGen, otaLast:d.engine.otaLast}:null,
    worker: d&&d.worker?{backend:d.worker.backend, ready:d.worker.readyMs}:null,
    csp: d&&d.csp!=null?d.csp:null,
    imgTotal: window.__TS_GAZE_IMGTOTAL||0,
    pending: document.querySelectorAll('.ts-gaze-pending').length,
    promoImg: document.querySelectorAll('img.mobile-topbar-logo').length,
    promoHidden: (function(){var i=document.querySelector('img.mobile-topbar-logo');
      return i?getComputedStyle(i).display:'absent';})(),
    homeBtn: (function(){var b=document.querySelector('button.mobile-topbar-header-endpoint');
      return b?Math.round(b.getBoundingClientRect().width):null;})()};})()"""

out={}
for name,url,wait in [("home","https://m.youtube.com/",26),
                      ("search","https://m.youtube.com/results?search_query=breaking+news",26),
                      ("watch","https://m.youtube.com/watch?v=NWoT1ZVd1Lo",30)]:
    t.cmd("Page.navigate", url=url); time.sleep(wait)
    for i in range(2):
        t.eval("(function(){var e=document.scrollingElement||document.body; e.scrollBy(0,800); return 1;})()")
        time.sleep(3)
    out[name]=t.eval(CENSUS)
print(json.dumps(out, indent=1))
