import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(12)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
def visible_pending():
    return tab.eval("""(function(){
      var vh=innerHeight, n=0, p=0;
      [].slice.call(document.querySelectorAll('img')).forEach(function(i){
        if(i.naturalWidth<120) return;
        var r=i.getBoundingClientRect();
        if(r.bottom<=0||r.top>=vh) return;
        n++;
        var el=i; var pend=false;
        for(var k=0;k<4&&el;k++,el=el.parentElement){
          if(el.classList&&(el.classList.contains('ts-gaze-pending'))) pend=true;
        }
        if(pend) p++;
      });
      return n+':'+p;})()""")
for jump in range(4):
    tab.eval("window.scrollBy(0,2200)")
    t0=time.time(); log=[]
    for i in range(24):
        time.sleep(0.25)
        v=visible_pending()
        log.append((round(time.time()-t0,2), v))
        if isinstance(v,str) and v.endswith(':0'): break
    print("jump", jump, "settled", log[-1], "steps", len(log))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
