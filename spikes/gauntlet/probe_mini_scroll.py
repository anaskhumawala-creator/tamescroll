# DOES THE PARKED PLAYER STAY PARKED WHILE THE PAGE SCROLLS?
#
# ts-mini is a TRANSFORM on YouTube's sticky #player-container-id. Sticky
# only pins inside its own containing block, so if the container stops
# being pinned at some scroll position the parked box moves with the
# page -- a mini player that slides off screen. That would read exactly
# as "it sometimes goes down and it doesn't function as it's supposed to".
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'off',strength:24,gender:'man',
                             shown:['home','watch_recs']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(32)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(6)

BOX = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var cs=pc?getComputedStyle(pc):null;
  var se=document.scrollingElement;
  var room=0,best=se;
  [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
    if(!n)return; var rr=(n.scrollHeight||0)-(n.clientHeight||0); if(rr>room){room=rr;best=n;}});
  return {mini:document.documentElement.classList.contains('ts-mini'),
    pos:cs?cs.position:null, stickyTop:cs?cs.top:null,
    left:r?Math.round(r.left):null, top:r?Math.round(r.top):null,
    w:r?Math.round(r.width):null, h:r?Math.round(r.height):null,
    scroll:Math.round(best.scrollTop), scroller:best.tagName.toLowerCase(),
    vh:window.innerHeight,
    offBottom: r ? Math.round(r.bottom - window.innerHeight) : null};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

def drag_down():
    x,y=206,120
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.15)
    for dy in (14,30,50,72,95):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x,"y":y+dy}])
        time.sleep(0.1)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.5)

out=[]
out.append(dict(t.eval(BOX), phase="full, top of page"))
scroll(900); time.sleep(2)
out.append(dict(t.eval(BOX), phase="full, scrolled 900"))
drag_down()
out.append(dict(t.eval(BOX), phase="MINIMISED (while scrolled)"))
for px in (600, 600, -900, -900, 1200):
    mv=scroll(px); time.sleep(2.5)
    out.append(dict(t.eval(BOX), phase="mini, scrolled %+d (moved %s)" % (px, mv)))
print(json.dumps(out, indent=1))
