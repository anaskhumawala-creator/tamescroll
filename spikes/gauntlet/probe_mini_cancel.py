# A CANCELLED TOUCH USED TO STRAND THE PLAYER PART-SHRUNK.
#
# Drive a real minimise drag through Input.dispatchTouchEvent, then send
# touchCancel instead of touchEnd, and read what the player is left as.
# BEFORE: ts-mini-drag stays on <html>, transform frozen mid-scale.
# AFTER : the drag aborts, the player is back exactly as it started.
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
time.sleep(30)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var h=document.documentElement;
  var cs=pc?getComputedStyle(pc):null;
  var r=pc?pc.getBoundingClientRect():null;
  return {mini:h.classList.contains('ts-mini'),
          drag:h.classList.contains('ts-mini-drag'),
          gone:h.classList.contains('ts-mini-gone'),
          transform:cs?cs.transform:null,
          inlineT:pc?pc.style.transform:null,
          opacity:cs?cs.opacity:null,
          w:r?Math.round(r.width):0, h:r?Math.round(r.height):0,
          top:r?Math.round(r.top):0, left:r?Math.round(r.left):0,
          state:window.__TS_MINI_STATE||null};})()"""

def touch(kind, x, y):
    pts = [] if kind=="touchEnd" else [{"x":x,"y":y}]
    t.cmd("Input.dispatchTouchEvent", type=kind, touchPoints=pts)

def drag_then(kind, label):
    out={}
    out["before"]=t.eval(STATE)
    x,y=206,120
    touch("touchStart",x,y); time.sleep(0.15)
    for dy in (14,30,50,72):
        touch("touchMove",x,y+dy); time.sleep(0.12)
    out["midDrag"]=t.eval(STATE)
    if kind=="touchCancel":
        t.cmd("Input.dispatchTouchEvent", type="touchCancel", touchPoints=[])
    else:
        touch("touchEnd",x,y+72)
    time.sleep(1.2)
    out["after"]=t.eval(STATE)
    time.sleep(1.5)
    out["settled"]=t.eval(STATE)
    return {label: out}

res={}
res.update(drag_then("touchCancel","cancelled mid-drag"))
time.sleep(1)
res.update(drag_then("touchEnd","control: same drag, ended normally"))
print(json.dumps(res, indent=1))
