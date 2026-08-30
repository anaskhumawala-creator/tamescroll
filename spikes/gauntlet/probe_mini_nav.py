# Does the parked mini state survive a navigation to another video?
#
# ts-mini lives on <html> and setState is only ever called by a gesture,
# so an in-page navigation from one watch page to another keeps the class,
# the cover, the buttons and the collapsed placeholder -- while the page
# underneath is a different video the user just chose to watch. The
# native app expands when you pick a recommendation.
import json, time
from emu_cdp import page, Tab

A = "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"
B = "https://m.youtube.com/watch?v=aqz-KE-bpKQ"

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url=A)
time.sleep(25)
t.eval("(function(){var v=document.querySelector('video');if(v)v.play();return 1})()")
time.sleep(8)

READ = """(function(){var pc=document.getElementById('player-container-id');
  var ph=document.querySelector('.player-placeholder');
  return {path:location.pathname+location.search.slice(0,14),
    state:window.__TS_MINI_STATE||'full',
    miniClass:document.documentElement.classList.contains('ts-mini'),
    cover:!!document.getElementById('ts-mini-cover'),
    btns:!!document.getElementById('ts-mini-btns'),
    inline:pc?pc.style.transform||'':'(no player)',
    rect:pc?(function(){var b=pc.getBoundingClientRect();
      return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]})():null,
    placeholderH:ph?Math.round(ph.getBoundingClientRect().height):null};})()"""

def drag(dy, steps=8):
    c=t.eval("""(function(){var b=document.getElementById('player-container-id').getBoundingClientRect();
      return [Math.round(b.left+b.width/2),Math.round(b.top+b.height/2)];})()""")
    cx,cy=c
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":cx,"y":cy}])
    for i in range(1,steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":cx,"y":cy+dy*i//steps}])
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[{"x":cx,"y":cy+dy}])
    time.sleep(1.2)

out={"on A": t.eval(READ)}
drag(120)
out["A minimised"]=t.eval(READ)

# An in-page navigation, the way tapping a recommendation does it.
t.eval("(function(){history.pushState({},'', %s); window.dispatchEvent(new PopStateEvent('popstate')); return 1})()" % json.dumps(B))
time.sleep(3)
out["after pushState to B"]=t.eval(READ)

# And the real thing: a full navigation.
t.cmd("Page.navigate", url=B)
time.sleep(22)
out["after real nav to B"]=t.eval(READ)
print(json.dumps(out, indent=1))
