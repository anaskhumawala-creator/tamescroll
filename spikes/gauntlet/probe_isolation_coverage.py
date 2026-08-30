# The isolation fix only helps a patch whose host actually got the write.
# So: of the hosts that currently carry a patch, how many are isolated?
# Anything less than all of them is a path through resolveHost that does
# not exist yet in my head.
import json, time
from emu_cdp import page, Tab

t = Tab(page()); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/")
time.sleep(4)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
    shown:['home','shorts','watch_recs','previews','search_inserts']});
  return 1;})()""")
time.sleep(5)
t.cmd("Page.navigate", url="https://m.youtube.com/results?search_query=podcast+interview+face")
time.sleep(45)
for _ in range(6):
    t.eval("window.scrollBy(0,300); (document.scrollingElement||document.body).scrollTop += 300;")
    time.sleep(2)
time.sleep(6)

print(json.dumps(t.eval("""(function(){
  var ps=[].slice.call(document.querySelectorAll('.ts-gaze-region-patch'));
  var hosts=[], iso=0, notIso=[];
  ps.forEach(function(o){
    var h=o.parentElement; if(!h) return;
    if(hosts.indexOf(h)>=0) return; hosts.push(h);
    var s=getComputedStyle(h);
    if(s.isolation==='isolate') iso++;
    else notIso.push({tag:h.tagName.toLowerCase(),
      cls:String(h.className||'').split(' ')[0],
      pos:s.position, z:s.zIndex, transform:s.transform!=='none'});
  });
  // And does anything each host sits under still outrank the player?
  var pc=document.getElementById('player-container-id');
  return {patches:ps.length, hosts:hosts.length, isolated:iso,
    NOT_ISOLATED:notIso, judged:window.__TS_GAZE_IMGTOTAL||0,
    playerPresent:!!pc};})()"""), indent=1))
