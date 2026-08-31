# PRIORITY 1: STALE PATCHES ACROSS A REAL SPA NAVIGATION.
#
# Loop 33 tried this and did not exercise it -- clicking a recommendation
# on a watch page reached by CDP produced a HARD navigation (the player
# container was gone at settle, and the 12 samples had nothing over the
# player to rank). Loop 7 measured which path is actually same-document:
# SEARCH -> tap a result is a pushState, and that is also the shape of
# his report (patches over results, then a page with a sticky player).
#
# The navigation is PROVEN same-document by a window marker set before
# the tap, not assumed. Patches are `.ts-gaze-region-patch` (the video
# layer is excluded -- those belong over the player) and are forced hit
# testable, since they are pointer-events:none by design.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
GENDER = sys.argv[2] if len(sys.argv) > 2 else 'man'
Q = sys.argv[3] if len(sys.argv) > 3 else 'podcast interview'

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['home','watch_recs']}); return 1;})()""" % GENDER)
time.sleep(6)
t.cmd("Page.navigate",
      url="https://m.youtube.com/results?search_query=" + Q.replace(' ', '+'))
time.sleep(40)

HIT = """(function(){
  if(!document.getElementById('ts-probe-hit4')){
    var st=document.createElement('style'); st.id='ts-probe-hit4';
    st.textContent='.ts-gaze-region-patch{pointer-events:auto !important}';
    document.documentElement.appendChild(st);
  } return 1;})()"""

RANK = """(function(){
  var o={t:Math.round(performance.now()),path:location.pathname,
         mark:window.__TS_SPA_MARK||null,
         patches:document.querySelectorAll('.ts-gaze-region-patch').length,
         overlap:0,ranked:0,above:0,worst:null,inPlayer:0,
         orphan:0, pc:false};
  var pc=document.querySelector('#player-container-id');
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  // A patch whose host has left the document is stale by definition --
  // count it whether or not a player exists yet.
  for(var q=0;q<ps.length;q++){
    if(!ps[q].isConnected || !document.documentElement.contains(ps[q])) o.orphan++;
  }
  if(!pc) return o;
  o.pc=true;
  var pr=pc.getBoundingClientRect();
  if(pr.width<2) return o;
  for(var i=0;i<ps.length;i++){
    if(pc.contains(ps[i])) o.inPlayer++;
    var r=ps[i].getBoundingClientRect();
    if(r.width<2||r.height<2) continue;
    var ox=Math.max(0,Math.min(r.right,pr.right)-Math.max(r.left,pr.left));
    var oy=Math.max(0,Math.min(r.bottom,pr.bottom)-Math.max(r.top,pr.top));
    if(ox<=1||oy<=1) continue;
    o.overlap++;
    var cx=Math.max(pr.left,r.left)+ox/2, cy=Math.max(pr.top,r.top)+oy/2;
    var hits=document.elementsFromPoint(cx,cy);
    var iP=-1,iV=-1;
    for(var h=0;h<hits.length;h++){
      if(iP<0 && hits[h]===ps[i]) iP=h;
      if(iV<0 && (hits[h]===pc||pc.contains(hits[h]))) iV=h;
    }
    o.ranked++;
    if(iP>=0 && (iV<0 || iP<iV)){
      o.above++;
      if(!o.worst) o.worst={iP:iP,iV:iV,
        box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        player:[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)],
        z:getComputedStyle(ps[i]).zIndex,
        hostConnected:!!(ps[i].parentElement&&ps[i].parentElement.isConnected),
        host:(ps[i].parentElement&&ps[i].parentElement.tagName)+'.'+
             ((ps[i].parentElement&&ps[i].parentElement.className)||'').toString().slice(0,40)};
    }
  }
  return o;})()"""

out = {}
t.eval(HIT)
# make sure patches exist BEFORE the tap -- a probe with nothing to carry
# across the navigation measures nothing (loop 8's lesson).
for i in range(8):
    t.eval("(function(){var b=document.body,e=document.scrollingElement||document.documentElement;"
           "var s=(b.scrollHeight>e.scrollHeight)?b:e;s.scrollBy(0,500);window.scrollBy(0,500);return 1;})()")
    time.sleep(1.5)
    pre = t.eval(RANK)
    if pre["patches"] >= 3:
        break
out["before_tap"] = pre

t.eval("(function(){window.__TS_SPA_MARK='mark-'+Math.round(performance.now()); return 1;})()")
# WHERE the tap happens decides whether the question can even be asked.
# A surviving patch keeps the STALE viewport rect of the result it was
# minted on, and the sticky player lands at roughly y 48..280 -- so a
# patch only lands in the player band if the result it covers was in
# that band when the tap happened. The first run tapped the first link
# in DOM order, which after 4000px of scrolling is far above the
# viewport, and every surviving patch was off-player by construction.
# Tap a result whose own patch is currently in the band instead.
out["tapped"] = t.eval("""(function(){
  var band=[40,340];
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  var best=null;
  for(var i=0;i<ps.length;i++){
    var r=ps[i].getBoundingClientRect();
    if(r.top>=band[0] && r.top<=band[1]) { best=ps[i]; break; }
  }
  var a=null;
  if(best){
    var host=best.parentElement;
    while(host && !a){ a=host.querySelector && host.querySelector('a[href*="/watch?v="]'); host=host.parentElement; }
  }
  if(!a){
    // fall back to any result currently inside the band
    var links=document.querySelectorAll('a[href*="/watch?v="]');
    for(var j=0;j<links.length;j++){
      var lr=links[j].getBoundingClientRect();
      if(lr.top>=band[0] && lr.top<=band[1] && lr.width>2){ a=links[j]; break; }
    }
  }
  if(!a) return null;
  var info={href:a.getAttribute('href'),
            fromPatch:!!best,
            patchTop:best?Math.round(best.getBoundingClientRect().top):null,
            linkTop:Math.round(a.getBoundingClientRect().top)};
  a.click(); return info;})()""")

series = []
t0 = time.time()
while time.time() - t0 < 9:
    t.eval(HIT)
    series.append(t.eval(RANK))
    time.sleep(0.35)
out["series"] = {
    "n": len(series),
    "sameDocument": all(bool(s.get("mark")) for s in series),
    "reachedWatch": sum(1 for s in series if s["path"].startswith("/watch")),
    "patchesMax": max(s["patches"] for s in series),
    "withPlayer": sum(1 for s in series if s["pc"]),
    "overlap": sum(s["overlap"] for s in series),
    "ranked": sum(s["ranked"] for s in series),
    "above": sum(s["above"] for s in series),
    "orphan": sum(s["orphan"] for s in series),
    "inPlayer": sum(s["inPlayer"] for s in series),
    "worst": next((s["worst"] for s in series if s["worst"]), None),
    "firstWithBoth": next(({"t": s["t"], "patches": s["patches"], "overlap": s["overlap"]}
                           for s in series if s["pc"] and s["patches"] > 0), None),
}
time.sleep(6)
out["settled"] = t.eval(RANK)
t.eval("(function(){var s=document.getElementById('ts-probe-hit4'); if(s) s.remove(); return 1;})()")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(3)
out["restored"] = t.eval("location.href")
print(json.dumps(out, indent=1))
