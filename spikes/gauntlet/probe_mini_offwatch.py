# Can the gesture engage anywhere it should not? m.youtube plays feed
# previews into the SHARED player, and the owner's oldest interaction
# complaint was the feed feeling "pressed" while he was only scrolling.
# onDown refuses off /watch -- this checks that on the pages he actually
# scrolls, with the same instrument that caught the watch-page theft:
# a defaultPrevented touchmove is a scroll the page will never do.
import json, time
from emu_cdp import page, Tab

PAGES = [("home", "https://m.youtube.com/"),
         ("search", "https://m.youtube.com/results?search_query=interview")]

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
    shown:['home','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)

out={}
for name,url in PAGES:
    t.cmd("Page.navigate", url=url)
    time.sleep(30)
    setup = t.eval("""(function(){
      window.__PV=[];
      document.addEventListener('touchmove', function(e){
        window.__PV.push(e.defaultPrevented?1:0);}, {passive:true});
      var pc=document.getElementById('player-container-id');
      var mp=document.getElementById('movie_player');
      // Somewhere a finger actually lands: the first big thumbnail.
      var im=[].slice.call(document.querySelectorAll('img')).filter(function(i){
        var b=i.getBoundingClientRect();
        return b.width>=200 && b.top>60 && b.bottom<innerHeight-60;})[0];
      var b = im ? im.getBoundingClientRect() : null;
      return {path:location.pathname, playerContainer:!!pc, moviePlayer:!!mp,
        at: b ? [Math.round(b.left+b.width/2), Math.round(b.top+b.height/2)] : null};})()""")
    if not setup.get("at"):
        out[name]={"skip":"no big thumbnail", "setup":setup}; continue
    cx,cy = setup["at"]
    res={}
    for label, dy in (("drag down 120", 120), ("flick up 120", -120)):
        t.eval("window.__PV=[];")
        t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
        for i in range(1,9):
            t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":cy+dy*i//8}])
        mid=t.eval("""(function(){var pc=document.getElementById('player-container-id');
          return {prevented:window.__PV.filter(function(v){return v}).length,
                  moves:window.__PV.length,
                  drag:document.documentElement.classList.contains('ts-mini-drag'),
                  mini:document.documentElement.classList.contains('ts-mini'),
                  transform:(pc&&pc.style.transform)||''};})()""")
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx,"y":cy+dy}])
        time.sleep(0.8)
        mid["afterState"]=t.eval("window.__TS_MINI_STATE||'full'")
        res[label]=mid
    out[name]={"setup":setup, "runs":res}
print(json.dumps(out, indent=1))
