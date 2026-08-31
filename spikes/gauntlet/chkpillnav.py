# The pill's host is now the CONTAINER, which survives an SPA nav where
# #movie_player may not. Does that leave two pills?
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
Q = """(function(){
  var ps=document.querySelectorAll('.ts-gaze-pill');
  var boxes=[].slice.call(ps).map(function(p){var r=p.getBoundingClientRect();
    return {box:[r.x|0,r.y|0,r.width|0,r.height|0], label:(p.textContent||'').trim(),
            parent:p.parentElement?(p.parentElement.id||p.parentElement.tagName):null};});
  return {url:location.pathname+location.search.slice(0,20), nPills:ps.length, pills:boxes,
          video: !!document.querySelector('#movie_player video')};})()"""
print("start:", json.dumps(t.eval(Q)))
for i in range(3):
    # SPA nav: tap a recommendation link below the player
    hit=t.eval("""(function(){
      var a=[].slice.call(document.querySelectorAll('a[href^="/watch"]'))
        .filter(function(x){var r=x.getBoundingClientRect(); return r.top>320 && r.width>100;})[0];
      if(!a) return null; var r=a.getBoundingClientRect();
      return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)];})()""")
    if not hit: print("no recommendation link"); break
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":hit[0],"y":hit[1]}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(14)
    print("nav %d:" % (i+1), json.dumps(t.eval(Q)))
