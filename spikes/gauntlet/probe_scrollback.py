# DID LOOP 9'S FIX STRAND ANYTHING? The direct blur-first check.
#
# After a long scroll the queue settles at 64 pending, every one of them
# ABOVE the fold and correctly deferred. The whole safety argument is
# that deferral is not abandonment: scroll back up and those images must
# be judged and revealed. If they are not, the fix traded wasted
# inference for permanently covered thumbnails, which is worse.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
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
  var onScreen=big.filter(on);
  return {imgTotal:window.__TS_GAZE_IMGTOTAL||0, big:big.length,
    pending:pend.length, onScreenBig:onScreen.length,
    onScreenPending:pend.filter(on).length,
    scroll:Math.round(document.scrollingElement.scrollTop)};})()"""

def scroll(px):
    return t.eval("""(function(px){var room=0,best=document.scrollingElement;
      [document.scrollingElement,document.body,document.documentElement].forEach(function(n){
        if(!n)return; var r=(n.scrollHeight||0)-(n.clientHeight||0); if(r>room){room=r;best=n;}});
      var b=best.scrollTop; best.scrollTop=Math.max(0,b+px); return best.scrollTop-b;})(%d)""" % px)

t.cmd("Page.navigate", url="https://m.youtube.com/")
time.sleep(40)
for i in range(30):
    scroll(700); time.sleep(1.2)
time.sleep(30)
out={"after long scroll down": t.eval(COUNT)}

# now go back UP in steps and let each screenful settle
up=[]
for i in range(9):
    mv=scroll(-1600); time.sleep(14)
    r=t.eval(COUNT); r["moved"]=mv; up.append(r)
out["scrolling back up"]=up
scroll(-40000); time.sleep(25)
out["back at the top"]=t.eval(COUNT)
print(json.dumps(out, indent=1))
