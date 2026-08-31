# EVERY NON-VIDEO THING ON HIS SIGNED-IN MOBILE HOME. Compact.
#
# v1 of this probe made both classic mistakes at once: it enumerated
# every yt-*-view-model inside each video card (noise, not shelves), and
# its scroll moved 0px so five identical passes read as "the feed has 5
# items". Distance is printed now, and the census is renderer-level.
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
  function txt(e){return (e.textContent||'').replace(/\s+/g,' ').trim().slice(0,70);}
  var e0=document.scrollingElement||document.documentElement, b=document.body;
  var s=(b.scrollHeight>e0.scrollHeight)?b:e0;
  var o={y:Math.round(s.scrollTop||window.scrollY||0),
         sh:Math.round(s.scrollHeight), ih:window.innerHeight,
         signedIn:!!(document.cookie.indexOf('SID=')>-1) ||
                  !!document.querySelector('[aria-label*="Account"],ytm-topbar-menu-button-renderer img'),
         items:document.querySelectorAll('ytm-rich-item-renderer').length,
         kinds:{}, shelves:[]};
  // Renderer-level only: ytm-* custom elements that are NOT inside
  // another ytm-* element. That is the level shelves live at.
  // `ytm-*` is NOT a valid CSS selector -- querySelectorAll throws on it
  // and the whole eval comes back as an error object, which is how v2 of
  // this probe died. Enumerate and filter by tag prefix instead.
  var grid=document.querySelector('ytm-rich-grid-renderer');
  var all=grid?grid.querySelectorAll('*'):[];
  function ytmAncestor(e){
    var p=e.parentElement;
    while(p){ if(p.tagName.toLowerCase().indexOf('ytm-')===0) return p; p=p.parentElement; }
    return null;
  }
  for(var i=0;i<all.length;i++){
    var e=all[i], n=e.tagName.toLowerCase();
    if(n.indexOf('ytm-')!==0) continue;
    var p=ytmAncestor(e);
    if(p && p.tagName.toLowerCase()!=='ytm-rich-grid-renderer') continue;
    o.kinds[n]=(o.kinds[n]||0)+1;
    if(n==='ytm-rich-item-renderer'||n==='ytm-continuation-item-renderer') continue;
    var r=e.getBoundingClientRect();
    o.shelves.push({tag:n,h:Math.round(r.height),
      watch:e.querySelectorAll('a[href*="/watch"]').length,
      shorts:e.querySelectorAll('a[href^="/shorts/"]').length,
      title:txt(e)});
  }
  // things that are not feed videos at all, anywhere on the page
  o.other=[];
  ['ytm-feed-nudge-renderer','ytm-promoted-video-renderer','ytm-companion-slot',
   'ytm-alert-with-button-renderer','ytm-feed-filter-chip-bar-renderer',
   'ytm-rich-section-renderer','ytm-shelf-renderer','ytm-rich-shelf-renderer',
   'ytm-item-section-renderer','ytm-horizontal-card-list-renderer',
   'ytm-statement-banner-renderer','ytm-post-renderer','ytm-video-with-context-renderer'
  ].forEach(function(sel){
    var l=document.querySelectorAll(sel);
    for(var i=0;i<l.length;i++){
      var r=l[i].getBoundingClientRect();
      o.other.push({tag:sel,h:Math.round(r.height),
        watch:l[i].querySelectorAll('a[href*="/watch"]').length,
        shorts:l[i].querySelectorAll('a[href^="/shorts/"]').length,
        t:txt(l[i])});
    }
  });
  return o;})()"""

SCROLL = """(function(){
  var e0=document.scrollingElement||document.documentElement, b=document.body;
  var s=(b.scrollHeight>e0.scrollHeight)?b:e0;
  var before=s.scrollTop||window.scrollY||0;
  s.scrollBy(0,2400); window.scrollBy(0,2400);
  var after=s.scrollTop||window.scrollY||0;
  return {before:Math.round(before),after:Math.round(after),
          moved:Math.round(after-before)};})()"""

out = {"p0": t.eval(CENSUS), "moves": []}
for k in range(1, 7):
    out["moves"].append(t.eval(SCROLL))
    time.sleep(3.0)
    out["p%d" % k] = t.eval(CENSUS)

t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(3)
out["restored"] = t.eval("location.href")

# compact report
rep = {"moves": out["moves"], "restored": out["restored"], "passes": []}
seen = {}
for k in range(0, 7):
    p = out.get("p%d" % k)
    if not p: continue
    rep["passes"].append({"y": p["y"], "sh": p["sh"], "items": p["items"],
                          "signedIn": p["signedIn"], "kinds": p["kinds"]})
    for s in p["shelves"] + p["other"]:
        key = (s.get("tag"), s.get("t") or s.get("title") or "")[0] + "|" + \
              ((s.get("t") or s.get("title") or "")[:50])
        if key not in seen:
            seen[key] = s
rep["nonVideoThings"] = list(seen.values())
print(json.dumps(rep, indent=1)[:6000])
