# THE CLAMP HAS ONLY EVER BEEN MEASURED AGAINST THE TOP BAR.
#
# Loop 8 proved 0 of 170 patches unclipped above ytm-mobile-topbar-
# renderer. But the element in his screenshot is the STICKY PLAYER:
# #player-container-id, position fixed, top 48, height 231. A
# recommendation patch scrolling up behind it is the exact geometry he
# photographed. occluderBottom should return the player's bottom (279)
# and clamp the patch there. Nobody has ever asked.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1})()")
time.sleep(8)

SAMPLE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var pr=pc?pc.getBoundingClientRect():null;
  var pats=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var rows=pats.map(function(p){
    var r=p.getBoundingClientRect();
    var cs=getComputedStyle(p);
    return {top:Math.round(r.top), bottom:Math.round(r.bottom),
            h:Math.round(r.height), display:cs.display,
            visible: cs.display!=='none' && r.height>0};});
  var live=rows.filter(function(x){return x.visible;});
  // A patch is IN THE BAND if any of it paints between the player's top
  // and bottom while the player is fixed there.
  var band = pr? live.filter(function(x){return x.bottom>pr.top+1 && x.top<pr.bottom-1;}) : [];
  return {playerBox: pr?[pr.x|0,pr.top|0,pr.width|0,pr.height|0]:null,
          playerBottom: pr?Math.round(pr.bottom):null,
          patches: live.length, inBand: band.length,
          worst: band.length? Math.min.apply(null, band.map(function(x){return x.top;})) : null,
          scrollY: Math.round(window.scrollY||document.scrollingElement.scrollTop||0)};})()"""

# the watch page scroller is <body> (documented gotcha) -- drive both
def scroll(px):
    return t.eval("""(function(){
      var before=document.scrollingElement.scrollTop;
      window.scrollBy(0,%d);
      document.scrollingElement.scrollTop += %d;
      document.body.scrollTop += %d;
      return Math.round(document.scrollingElement.scrollTop-before);})()""" % (px,px,px))

out=[]
for i in range(12):
    d=scroll(220); time.sleep(1.1)
    s=t.eval(SAMPLE); s["moved"]=d
    out.append(s)
tot=sum(x["patches"] for x in out)
band=sum(x["inBand"] for x in out)
print(json.dumps({"steps":len(out), "patchSamples":tot, "inBandTotal":band,
                  "playerBox":out[-1]["playerBox"], "rows":out}, indent=1))
