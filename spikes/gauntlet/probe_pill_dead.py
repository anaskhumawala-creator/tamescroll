# IS THE BLUR SWITCH REACHABLE ON A WATCH PAGE?
#
# elementFromPoint at the pill's centre returned YouTube's
# player-controls-background, not the pill, on every sample of a 13s
# playback with the controls AUTOHIDDEN. A clean tap did not toggle the
# label. Both readings were taken on a page a probe had already poked,
# so this run starts from a FRESH navigation and touches nothing before
# measuring.
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
  if(!pill) return {err:'no pill'};
  var q=pill.getBoundingClientRect();
  var cx=Math.round(q.left+q.width/2), cy=Math.round(q.top+q.height/2);
  var e=document.elementFromPoint(cx,cy);
  var mp=document.querySelector('#movie_player');
  var bg=document.querySelector('.player-controls-background');
  var cont=bg?bg.parentElement:null;
  var cc=cont?getComputedStyle(cont):null;
  var name=function(n){var c=(n.className&&n.className.baseVal!==undefined?n.className.baseVal:n.className)||'';
    return n.tagName+(n.id?'#'+n.id:'')+(c?'.'+String(c).split(' ')[0]:'');};
  return {label:(pill.textContent||'').trim(), cx:cx, cy:cy,
    hit:e?name(e):null, hitIsPill:!!(e&&e.closest&&e.closest('.ts-gaze-pill')),
    bgInPlayer: !!(mp&&bg&&mp.contains(bg)),
    contName: cont?name(cont):null,
    contPos: cc?cc.position:null, contZ: cc?cc.zIndex:null,
    contInPlayer: !!(mp&&cont&&mp.contains(cont)),
    bgOpacity: bg?getComputedStyle(bg).opacity:null,
    bgPE: bg?getComputedStyle(bg).pointerEvents:null,
    playerAutohide: !!(mp&&mp.className.indexOf('ytp-autohide')>=0)};})()"""

first = t.eval(Q)
print("FRESH, untouched:", json.dumps(first))
if first.get("err"): raise SystemExit
before = first["label"]
t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x":first["cx"],"y":first["cy"]}])
time.sleep(0.05)
t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
time.sleep(1.6)
after = t.eval(Q)
print("clean tap:", before, "->", after["label"], "| toggled:", before!=after["label"])
print("after tap hit:", after["hit"], "autohide:", after["playerAutohide"])
