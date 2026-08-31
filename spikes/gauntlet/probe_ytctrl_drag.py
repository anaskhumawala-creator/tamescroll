# THE THIRD MEMBER OF THE CLASS: YOUTUBE'S OWN PLAYER CONTROLS.
#
# 1061 fixed our mini buttons, 1062 fixed our blur pill -- both because
# they are children of #movie_player, so inPlayer(target) armed the drag
# on top of the press. YouTube's OWN controls (play/pause, seek bar,
# fullscreen, captions) are children of the same element. Nobody has
# checked them. If a thumb that presses play and rolls down 16px shrinks
# the video, that IS "annoying ... it sometimes goes down".
import json, time
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
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(8)

STATE = """(function(){
  var pc=document.querySelector('#player-container-id');
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var r=pc?pc.getBoundingClientRect():null;
  return {mini:document.documentElement.classList.contains('ts-mini'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    paused:v?!!v.paused:null, t:v?Math.round(v.currentTime*10)/10:null,
    box:r?[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]:null};})()"""

# A player hides its controls during playback. Tap the middle to reveal.
def reveal():
    st=t.eval(STATE)
    if not st["box"]: return st
    x=st["box"][0]+st["box"][2]//2; y=st["box"][1]+st["box"][3]//2
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.2)
    return t.eval(STATE)

reveal()
CTRLS = """(function(){
  var p=document.querySelector('#movie_player'); if(!p) return {err:'no player'};
  var out=[];
  p.querySelectorAll('button,[role="button"],.ytp-progress-bar,.ytp-scrubber-container,.ytp-chrome-bottom,.ytp-play-button,.ytp-fullscreen-button').forEach(function(el){
    var r=el.getBoundingClientRect();
    if(r.width<14||r.height<14) return;
    if(getComputedStyle(el).visibility==='hidden') return;
    var cls=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className)||'';
    out.push({cls:String(cls).slice(0,50), label:(el.getAttribute('aria-label')||el.title||'').slice(0,32),
              cx:Math.round(r.left+r.width/2), cy:Math.round(r.top+r.height/2),
              w:Math.round(r.width), h:Math.round(r.height)});
  });
  return {n:out.length, ctrls:out};})()"""
found=t.eval(CTRLS)

def press_roll(x, y, roll, dx=1):
    before=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    time.sleep(0.06)
    for i in (1,2,3):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x+dx, "y":y+int(roll*i/3)}])
        time.sleep(0.05)
    mid=t.eval(STATE)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.3)
    after=t.eval(STATE)
    return {"roll":roll, "midDrag":mid["drag"], "midBox":mid["box"],
            "afterBox":after["box"], "afterMini":after["mini"],
            "pausedBefore":before["paused"], "pausedAfter":after["paused"]}

out={"controls":found, "trials":[]}
if isinstance(found,dict) and found.get("ctrls"):
    for c in found["ctrls"][:6]:
        reveal()
        rows=[press_roll(c["cx"], c["cy"], r) for r in (0, 25, 60)]
        out["trials"].append({"ctrl":c["label"] or c["cls"], "cx":c["cx"], "cy":c["cy"], "rows":rows})
print(json.dumps(out, indent=1))
