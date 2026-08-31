# PRIORITY 3, THE PART THAT IS REACHABLE SIGNED OUT: enumerate EVERY
# non-video thing m.youtube puts on home, across several loads, because
# home content varies per load and one census only sees one draw.
#
# Rules already cover: ytm-rich-section-renderer (shelves, incl. Shorts)
# and ytm-feed-nudge-renderer (the history nag). This asks what ELSE is
# there -- his "breaking news and this that yah yah yah".
import json, time, collections
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
# EVERYTHING SHOWN, so nothing of ours hides what we are trying to see.
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
    shown:['home','home_shelves','shorts','watch_recs','previews',
           'search_inserts','mobile_nags']});
  return 1;})()""")
time.sleep(5)

CENSUS = """(function(){
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var out={rows:[], other:[]};
  if(grid){
    var kids=[].slice.call(grid.children);
    // the grid's rows: each is an item, a section, or a continuation
    kids.forEach(function(k){
      var r=k.getBoundingClientRect();
      var tag=k.tagName.toLowerCase();
      var inner=[].slice.call(k.children).map(function(c){return c.tagName.toLowerCase();});
      out.rows.push({tag:tag, h:Math.round(r.height),
        watch:k.querySelectorAll('a[href*="/watch?v="]').length,
        shorts:k.querySelectorAll('a[href^="/shorts/"],a[href*="/shorts/"]').length,
        imgs:k.querySelectorAll('img').length,
        inner:inner.slice(0,3),
        text:(k.textContent||'').replace(/\s+/g,' ').trim().slice(0,52)});
    });
  }
  // anything inside the browse page that is NOT the grid and not chrome
  var browse=document.querySelector('ytm-browse');
  if(browse){
    [].slice.call(browse.querySelectorAll('*')).forEach(function(n){
      var tg=n.tagName.toLowerCase();
      if(tg.indexOf('-')<0) return;                 // custom elements only
      if(n.closest('ytm-rich-grid-renderer')) return;
      var r=n.getBoundingClientRect();
      if(r.height<12) return;
      // only the OUTERMOST of a nested run
      if(n.parentElement && n.parentElement.closest &&
         n.parentElement.tagName.toLowerCase().indexOf('-')>=0 &&
         !n.parentElement.closest('ytm-rich-grid-renderer') &&
         n.parentElement.getBoundingClientRect().height>=12 &&
         n.parentElement!==browse) return;
      out.other.push({tag:tg, h:Math.round(r.height),
        watch:n.querySelectorAll('a[href*="/watch?v="]').length,
        text:(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,52)});
    });
  }
  out.gridPresent=!!grid;
  out.nudges=document.querySelectorAll('ytm-feed-nudge-renderer').length;
  return out;})()"""

loads=[]
for i in range(5):
    t.cmd("Page.navigate", url="https://m.youtube.com/")
    time.sleep(26)
    t.eval("window.scrollBy(0,2600);1"); time.sleep(8)
    loads.append(t.eval(CENSUS))

tags=collections.Counter()
sections=[]
for L in loads:
    for r in L["rows"]:
        tags[r["tag"]]+=1
        if r["tag"]!="ytm-rich-item-renderer" and r["h"]>12:
            sections.append(r)
    for o in L["other"]:
        tags["OTHER:"+o["tag"]]+=1
print(json.dumps({"rowTagCounts":dict(tags),
                  "nonItemRows":sections,
                  "otherPerLoad":[L["other"] for L in loads],
                  "nudgesPerLoad":[L["nudges"] for L in loads]}, indent=1))
