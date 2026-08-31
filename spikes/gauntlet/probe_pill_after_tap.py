# THE SEQUENCE A PERSON ACTUALLY PERFORMS: tap the video once, then
# reach for the blur switch.
import time, json
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo")
time.sleep(34)
t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v)v.play(); return 1;})()")
time.sleep(8)

Q = """(function(){
  var pill=document.querySelector('.ts-gaze-pill');
  var pc=document.querySelector('#player-container-id');
  var r=pc?pc.getBoundingClientRect():null;
  if(!pill) return {err:'no pill'};
  var q=pill.getBoundingClientRect();
  var cx=Math.round(q.left+q.width/2), cy=Math.round(q.top+q.height/2);
  var e=document.elementFromPoint(cx,cy);
  var bg=document.querySelector('.player-controls-background');
  var name=function(n){var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  return {label:(pill.textContent||'').trim(), cx:cx, cy:cy,
    hit:e?name(e):null, hitIsPill:!!(e&&e.closest&&e.closest('.ts-gaze-pill')),
    bg: !!bg, bgOpacity: bg?getComputedStyle(bg).opacity:null,
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    mini:document.documentElement.classList.contains('ts-mini'),
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null};})()"""

def tap(x,y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.6)
def roll(x,y,d):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}]); time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x":x+1,"y":y+int(d*i/3)}]); time.sleep(0.05)
    mid=t.eval(Q)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[]); time.sleep(1.4)
    return mid, t.eval(Q)

s0=t.eval(Q); print("1 fresh          :", json.dumps(s0))
b=s0["label"]; tap(s0["cx"], s0["cy"]); s1=t.eval(Q)
print("2 tap pill       :", b, "->", s1["label"], "| toggled", b!=s1["label"])
# the user taps the video to see the controls
box=s1["box"]; tap(box[0]+box[2]//2, box[1]+box[3]//2)
s2=t.eval(Q); print("3 tap video      :", json.dumps({k:s2[k] for k in ("hit","hitIsPill","bg","bgOpacity","label")}))
time.sleep(6)
s3=t.eval(Q); print("4 +6s autohide   :", json.dumps({k:s3[k] for k in ("hit","hitIsPill","bg","bgOpacity")}))
b=s3["label"]; tap(s3["cx"], s3["cy"]); s4=t.eval(Q)
print("5 tap pill again :", b, "->", s4["label"], "| toggled", b!=s4["label"])
mid,aft = roll(s4["cx"], s4["cy"], 25)
print("6 pill + 25px    : midDrag", mid["drag"], "midBox", mid["box"], "after", aft["box"], "mini", aft["mini"])
