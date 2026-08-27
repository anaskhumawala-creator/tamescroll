import time, sys
from gauntlet import open_platform
tab = open_platform("man")
JS = """(function(){var vh=innerHeight,n=0,p=0;
 [].slice.call(document.querySelectorAll('img')).forEach(function(i){
  if(i.naturalWidth<120)return; var r=i.getBoundingClientRect();
  if(r.bottom<=0||r.top>=vh)return; n++;
  var el=i,pend=false; for(var k=0;k<4&&el;k++,el=el.parentElement){
   if(el.classList&&el.classList.contains('ts-gaze-pending'))pend=true;}
  if(pend)p++;});
 return n+':'+p;})()"""
def trial(frac, jumps=5):
    tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
    time.sleep(11)
    tab.eval("window.__TS_IMG_BUDGET=%s" % frac)
    tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
    pending_seconds=0.0; unsettled=0
    for j in range(jumps):
        tab.eval("window.scrollBy(0,1600)")
        settled=False
        for k in range(27):   # 8.1s
            time.sleep(0.3)
            v=tab.eval(JS)
            if not isinstance(v,str): continue
            n,p=[int(x) for x in v.split(':')]
            pending_seconds += 0.3*p
            if p==0: settled=True; break
        if not settled: unsettled+=1
    tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
    return pending_seconds, unsettled
for frac in [0.25, 0.6, 0.25, 0.6]:
    ps,un = trial(frac)
    print("frac=%s pendingSeconds=%.1f unsettledJumps=%d" % (frac, ps, un))
    sys.stdout.flush()
