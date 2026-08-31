# AFTER THE KEYING FIX: with nothing on screen, does the drain still
# spend inference on the tail?
# BEFORE (same script, same page, previous build): pending 85 -> 65 while
# imgTotal jumped 48 -> 70. Twenty-two images judged with 0 on screen.
import json, time
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'woman',
                             shown:['home','search_inserts','watch_recs']});
  return 1;})()""")
time.sleep(5)

COUNT = """(function(){
  var vh=window.innerHeight||0;
  var big=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var pend=big.filter(function(i){return i.classList.contains('ts-gaze-pending');});
  function on(i){var r=i.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<vh;}
  return {imgTotal:window.__TS_GAZE_IMGTOTAL||0, big:big.length, pending:pend.length,
    on:pend.filter(on).length,
    above:pend.filter(function(i){return i.getBoundingClientRect().bottom<=0;}).length,
    scroll:Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(40)
for i in range(34):
    scroll(700); time.sleep(1.2)
peak=t.eval(COUNT)
# wait for the screen to be clear of pending, then watch the tail
settle=[]
for i in range(10):
    time.sleep(6); settle.append(t.eval(COUNT))
clear=[s for s in settle if s["on"]==0]
delta = (settle[-1]["imgTotal"] - clear[0]["imgTotal"]) if clear else None
print(json.dumps({"peak":peak, "settle":settle,
  "firstClearImgTotal": clear[0]["imgTotal"] if clear else None,
  "finalImgTotal": settle[-1]["imgTotal"],
  "judgedWhileNothingOnScreen": delta}, indent=1))
