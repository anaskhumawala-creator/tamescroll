# EVERY NON-VIDEO THING ON HIS SIGNED-IN MOBILE HOME.
#
# Loop 17 recorded this as blocked: the shelves he calls "random"
# (breaking news and its kind) do not render signed out, and no harness
# here could reach a signed-in mobile home. His phone is on wireless adb
# now, so this reads that DOM directly. JSON only -- nothing is drawn
# anywhere he can see, and the launcher is restored at the end.
#
# The census walks INSIDE ytm-rich-grid-renderer, one level below its
# direct children: loop 11 measured that those children are wrapper DIVs
# now, so a census at that level sees two 4,295px "rows" and learns
# nothing.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/"); time.sleep(30)

CENSUS = """(function(){
  function txt(e){ return (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,90); }
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var out={grid:!!grid, kinds:{}, shelves:[], chips:0, nags:[]};
  if(!grid) return out;
  // every custom element inside the grid, one level below the wrappers
  var all=grid.querySelectorAll('*');
  for(var i=0;i<all.length;i++){
    var e=all[i], n=e.tagName.toLowerCase();
    if(n.indexOf('-')===-1) continue;
    // only the top-most instance of each renderer, not their innards
    if(e.parentElement && e.parentElement.closest &&
       e.parentElement.closest(n)) continue;
    var r=e.getBoundingClientRect();
    out.kinds[n]=(out.kinds[n]||0)+1;
    if(n==='ytm-rich-item-renderer') continue;
    if(n==='ytm-continuation-item-renderer') continue;
    if(r.height<8) continue;
    out.shelves.push({tag:n, h:Math.round(r.height),
      watch:e.querySelectorAll('a[href*="/watch"]').length,
      shorts:e.querySelectorAll('a[href^="/shorts/"]').length,
      inner:(function(){var s=new Set();
        e.querySelectorAll('*').forEach(function(c){
          if(c.tagName.toLowerCase().indexOf('-')>-1) s.add(c.tagName.toLowerCase());});
        return [].slice.call(s).slice(0,8);})(),
      title:txt(e)});
  }
  out.chips=document.querySelectorAll('ytm-feed-filter-chip-bar-renderer').length;
  document.querySelectorAll('ytm-feed-nudge-renderer,ytm-promoted-video-renderer,ytm-companion-slot,ytm-alert-with-button-renderer').forEach(function(e){
    var r=e.getBoundingClientRect();
    out.nags.push({tag:e.tagName.toLowerCase(),h:Math.round(r.height),t:txt(e)});
  });
  out.items=document.querySelectorAll('ytm-rich-item-renderer').length;
  out.sections=document.querySelectorAll('ytm-rich-section-renderer').length;
  out.signedIn=!!document.querySelector('ytm-profile-icon,img.ytmProfileIcon,#avatar-btn');
  return out;})()"""

out = {"pass0": t.eval(CENSUS)}
# scroll and census again -- shelves appear further down the feed
for k in range(1, 5):
    t.eval("(function(){var e=document.scrollingElement||document.body;"
           "var b=document.body; var s=(b.scrollHeight>e.scrollHeight)?b:e;"
           "s.scrollBy(0,2400); return 1;})()")
    time.sleep(3.5)
    out["pass%d" % k] = t.eval(CENSUS)

t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(3)
out["restored"] = t.eval("location.href")
print(json.dumps(out, indent=1))
