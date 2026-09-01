# EVERY MINIPLAYER BEHAVIOUR FIXED IN 1057-1065, RE-RUN ON 1067 IN ONE
# TRACE. He said today it is "not working properly"; the screenshots were
# the misplaced blur (fixed in 1067), but the gestures need their own
# evidence rather than an assumption.
import json, time
from emu_cdp import page, Tab
t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(5)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['home','watch_recs']}); return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=NWoT1ZVd1Lo"); time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v) v.play(); return 1;})()")
time.sleep(6)

ST = """(function(){
  function box(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]; }
  var pc=document.querySelector('#player-container-id'), v=document.querySelector('video');
  return {mini:document.documentElement.classList.contains('ts-mini'),
    drag:document.documentElement.classList.contains('ts-mini-drag'),
    box:box(pc), paused:v?v.paused:null,
    pill:document.querySelectorAll('.ts-gaze-pill').length,
    pillLabel:(function(){var p=document.querySelector('.ts-gaze-pill');
      return p?(p.textContent||'').trim():null;})(),
    btns:document.querySelectorAll('#ts-mini-btns button').length,
    cover:document.querySelectorAll('#ts-mini-cover').length,
    placeholder:(function(){var p=document.querySelector('.player-placeholder');
      return p?Math.round(p.getBoundingClientRect().height):null;})()};})()"""

def gesture(dy, dx=0, cancel=False, steps=8, hold=0.03, at=None):
    s = t.eval(ST); b = s["box"]
    x = at[0] if at else b[0]+b[2]//2
    y = at[1] if at else b[1]+b[3]//2
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":x,"y":y}])
    for i in range(1, steps+1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove",
              touchPoints=[{"x":x+int(dx*i/steps), "y":y+int(dy*i/steps)}])
        time.sleep(hold)
    if cancel:
        t.cmd("Input.dispatchTouchEvent", type="touchCancel", touchPoints=[])
    else:
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.6)
    return t.eval(ST)

out = {"start": t.eval(ST)}
out["tapDrift8px"] = gesture(8, steps=4)              # must NOT claim (CLAIM_PX 16)
out["dragToMini"] = gesture(160)                      # commits
out["miniTapBody"] = gesture(0, steps=1)              # restores
out["dragCancelled"] = gesture(140, cancel=True)      # aborts back to full
out["dragToMini2"] = gesture(160)
# mini buttons: play/pause then close
btn = t.eval("""(function(){var bs=document.querySelectorAll('#ts-mini-btns button');
  return [].slice.call(bs).map(function(b){var r=b.getBoundingClientRect();
    return {label:b.getAttribute('aria-label'),
      c:[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]};});})()""")
out["miniButtons"] = btn
if btn:
    out["pressPlayPause"] = gesture(0, steps=1, at=btn[0]["c"])
    if len(btn) > 1:
        out["pressClose"] = gesture(0, steps=1, at=btn[1]["c"])
out["end"] = t.eval(ST)
print(json.dumps(out, indent=1))
