# HOW LONG DOES THE IMAGE QUEUE ACTUALLY GET?
# The drain sorts only the first PRIORITY_SCAN_MAX=64 by distance; past
# that the tail keeps ARRIVAL order, and the far-defer check is bypassed
# entirely (no key => `typeof pri === 'number'` is false). Both only
# matter if the queue really exceeds 64.
# Upper bound on the queue = images >=48px still wearing ts-gaze-pending.
import json, time
from emu_cdp import page, Tab
t=Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")

COUNT = """(function(){
  var vh=window.innerHeight||0;
  var big=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return Math.min(i.naturalWidth||0,i.naturalHeight||0)>=48;});
  var pend=big.filter(function(i){return i.classList.contains('ts-gaze-pending');});
  function on(i){var r=i.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<vh;}
  return {imgTotal:window.__TS_GAZE_IMGTOTAL||0,
    big:big.length, pending:pend.length,
    pendingOnScreen:pend.filter(on).length,
    pendingAbove:pend.filter(function(i){return i.getBoundingClientRect().bottom<=0;}).length,
    pendingBelow:pend.filter(function(i){return i.getBoundingClientRect().top>=vh;}).length,
    scroll:Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(40)
rows=[]
# fast continuous scroll -- the condition that would build a long queue
for i in range(34):
    scroll(700); time.sleep(1.2)
    rows.append(t.eval(COUNT))
time.sleep(25)
rows.append(dict(t.eval(COUNT), note="settled"))
print(json.dumps({"maxPending":max(r["pending"] for r in rows),
                  "maxBig":max(r["big"] for r in rows),
                  "rows":rows}, indent=1))
