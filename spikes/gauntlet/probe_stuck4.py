import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
for j in range(3):
    tab.eval("window.scrollBy(0,1600)"); time.sleep(6)
time.sleep(8)
print(tab.eval("""(function(){
 var els=[].slice.call(document.querySelectorAll('.ts-gaze-pending'));
 return JSON.stringify(els.slice(0,8).map(function(e){
   var r=e.getBoundingClientRect();
   return {tag:e.tagName, cls:(e.className||'').toString().slice(0,50),
           nw:e.naturalWidth||null, vis:(r.bottom>0&&r.top<innerHeight),
           w:Math.round(r.width), h:Math.round(r.height),
           src:(e.currentSrc||e.src||'').slice(0,60)};}));})()"""))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
