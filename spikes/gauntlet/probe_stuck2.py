import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
for j in range(4):
    tab.eval("window.scrollBy(0,1600)"); time.sleep(6)
time.sleep(10)
out = tab.eval("""(function(){var vh=innerHeight,res=[];
 [].slice.call(document.querySelectorAll('img')).forEach(function(i){
  if(i.naturalWidth<120)return; var r=i.getBoundingClientRect();
  if(r.bottom<=0||r.top>=vh)return;
  var el=i,pend=false; for(var k=0;k<4&&el;k++,el=el.parentElement){
   if(el.classList&&el.classList.contains('ts-gaze-pending'))pend=true;}
  if(!pend)return;
  var chain=[]; var e=i;
  for(var k=0;k<8&&e;k++,e=e.parentElement) chain.push(e.tagName+'.'+(e.className||'').toString().slice(0,40));
  res.push({w:i.naturalWidth,h:i.naturalHeight,loading:i.getAttribute('loading'),
            cls:i.className.toString().slice(0,60),chain:chain,
            inPreview: !!i.closest('ytd-video-preview, #movie_player, .ytmVideoPreviewHost')});});
 return JSON.stringify(res);})()""")
for r in json.loads(out)[:3]:
    print(json.dumps(r, indent=1)[:900])
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
