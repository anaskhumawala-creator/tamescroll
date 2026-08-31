import time, json
import emu_cdp
t = emu_cdp.Tab(emu_cdp.page()); t.cmd("Input.enable")
STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  var pill=document.querySelector('.ts-gaze-pill');
  var q=pill?pill.getBoundingClientRect():null;
  return {drag:document.documentElement.classList.contains('ts-mini-drag'),
   mini:document.documentElement.classList.contains('ts-mini'),
   label:pill?(pill.textContent||'').trim():null,
   pillC:q?[Math.round(q.left+q.width/2),Math.round(q.top+q.height/2)]:null,
   box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null};})()"""
st=t.eval(STATE); print("state", st)
px,py = st["pillC"]
hit = t.eval("""(function(){var e=document.elementFromPoint(%d,%d);
  if(!e) return null; var cls=(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'';
  return {tag:e.tagName, cls:String(cls).slice(0,60), id:e.id,
          isPill: !!(e.closest&&e.closest('.ts-gaze-pill'))};})()""" % (px,py))
print("hit at pill centre:", hit)

def roll(x,y,d):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x+1,"y":y+int(d*i/3)}]); time.sleep(0.05)
    mid=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.2)
    aft=t.eval(STATE)
    return {"roll":d,"midDrag":mid["drag"],"midBox":mid["box"],"after":aft["box"],
            "labelBefore":st["label"],"labelAfter":aft["label"]}
print("no-reveal 25px:", json.dumps(roll(px,py,25)))
