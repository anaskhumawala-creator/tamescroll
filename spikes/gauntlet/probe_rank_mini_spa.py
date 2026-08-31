# PRIORITY 1, THE TWO ANGLES NOBODY HAS RUN WITH AN INSTRUMENT THAT SEES.
#
# probe_patch_rank2 answered the ordinary scrolled watch page (363 ranked
# samples, 0 above). Two named angles were never tried with it because
# every earlier probe queried a dead container id:
#   A. the MINIPLAYER TRANSFORM -- while parked, the player container is
#      position:fixed at z-index 2147482000 and scaled; a recommendation
#      patch that outranks it there is exactly his screenshot.
#   B. an SPA NAVIGATION -- patches minted over the previous page's
#      results are removed only when the 500ms sweep notices their
#      element left, so for a moment they can be live over a new player.
#
# Image patches are `.ts-gaze-region-patch`; video patches live in
# `.ts-gaze-vregion-clip` and are excluded, since those belong over the
# player. Patches are pointer-events:none, so they are forced hit
# testable first.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9225
GENDER = sys.argv[2] if len(sys.argv) > 2 else 'man'

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'%s',
                             shown:['home','watch_recs']}); return 1;})()""" % GENDER)
time.sleep(6)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(45)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

HIT = """(function(){
  if(!document.getElementById('ts-probe-hit3')){
    var st=document.createElement('style'); st.id='ts-probe-hit3';
    st.textContent='.ts-gaze-region-patch{pointer-events:auto !important}';
    document.documentElement.appendChild(st);
  } return 1;})()"""
RANK = """(function(){
  var pc=document.querySelector('#player-container-id');
  var o={patches:0,overlap:0,ranked:0,above:0,worst:null,
         mini:document.documentElement.classList.contains('ts-mini'),
         pcZ:null,pcPos:null,tf:null,inPlayer:0};
  if(!pc) return o;
  var cs=getComputedStyle(pc);
  o.pcZ=cs.zIndex; o.pcPos=cs.position; o.tf=(pc.style.transform||'').slice(0,40);
  var pr=pc.getBoundingClientRect();
  var ps=document.querySelectorAll('.ts-gaze-region-patch');
  o.patches=ps.length;
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
      if(!o.worst) o.worst={iP:iP,iV:iV,x:Math.round(cx),y:Math.round(cy),
        box:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        z:getComputedStyle(ps[i]).zIndex,
        host:(ps[i].parentElement&&ps[i].parentElement.tagName)+'.'+
             ((ps[i].parentElement&&ps[i].parentElement.className)||'').toString().slice(0,40)};
    }
  }
  return o;})()"""

def scroll(px):
    t.eval("(function(){var b=document.body,e=document.scrollingElement||document.documentElement;"
           "var s=(b.scrollHeight>e.scrollHeight)?b:e;s.scrollBy(0,%d);window.scrollBy(0,%d);return 1;})()"
           % (px, px))

def touch(kind, pts):
    t.cmd("Input.dispatchTouchEvent", type=kind,
          touchPoints=[{"x": p[0], "y": p[1], "id": p[2]} for p in pts])

out = {}
t.eval(HIT)
# get patches on screen first
for i in range(6):
    scroll(420); time.sleep(1.4)
out["A_before_mini"] = t.eval(RANK)

# --- A: park the miniplayer, then rank with it parked ---
b = t.eval("""(function(){var pc=document.getElementById('player-container-id');
  var r=pc.getBoundingClientRect();
  return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)];})()""")
cx = b[0] + b[2] // 2; cy = b[1] + b[3] // 2
touch("touchStart", [(cx, cy, 3)])
for d in (30, 70, 110, 150):
    touch("touchMove", [(cx, cy + d, 3)]); time.sleep(0.05)
touch("touchEnd", [(cx, cy + 150, 3)])
time.sleep(1.6)
out["A_parked"] = t.eval(RANK)
samples = []
for i in range(10):
    scroll(320 if i % 2 == 0 else -320); time.sleep(0.9)
    t.eval(HIT)
    samples.append(t.eval(RANK))
out["A_scrolled_while_mini"] = {
    "n": len(samples),
    "patches": sum(s["patches"] for s in samples),
    "overlap": sum(s["overlap"] for s in samples),
    "ranked": sum(s["ranked"] for s in samples),
    "above": sum(s["above"] for s in samples),
    "worst": next((s["worst"] for s in samples if s["worst"]), None),
    "mini": samples[-1]["mini"], "pcZ": samples[-1]["pcZ"], "pcPos": samples[-1]["pcPos"],
    "inPlayer": sum(s["inPlayer"] for s in samples),
}
# restore
t.eval("(function(){var c=document.getElementById('ts-mini-cover'); if(c) c.click(); return 1;})()")
time.sleep(1.5)

# --- B: SPA navigation with patches live ---
out["B_before_nav"] = t.eval(RANK)
t.eval("""(function(){
  var a=document.querySelector('a[href*="/watch?v="]');
  if(a){a.click(); return a.getAttribute('href');} return null;})()""")
spa = []
for i in range(12):
    time.sleep(0.4)
    t.eval(HIT)
    spa.append(t.eval(RANK))
out["B_after_nav"] = {"n": len(spa),
                      "patchesMax": max(s["patches"] for s in spa),
                      "overlap": sum(s["overlap"] for s in spa),
                      "ranked": sum(s["ranked"] for s in spa),
                      "above": sum(s["above"] for s in spa),
                      "worst": next((s["worst"] for s in spa if s["worst"]), None),
                      "inPlayer": sum(s["inPlayer"] for s in spa)}
out["B_settled"] = t.eval(RANK)
t.eval("(function(){var s=document.getElementById('ts-probe-hit3'); if(s) s.remove(); return 1;})()")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(3)
out["restored"] = t.eval("location.href")
print(json.dumps(out, indent=1))
