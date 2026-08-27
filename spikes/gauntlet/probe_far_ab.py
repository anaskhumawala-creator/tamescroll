"""Does deferring far-off-screen images make the VISIBLE ones resolve
sooner? One fresh page per trial, one jump per trial, both sides
interleaved so page-load luck cannot favour one of them."""
import time, json
from collections import defaultdict
from gauntlet import open_platform

SIDES = [("defer", 2000), ("all", 1e9)]
TRIALS = 3
tab = open_platform("man")

def visible_pending():
    return tab.eval("""(function(){
      var vh=innerHeight, n=0, p=0;
      [].slice.call(document.querySelectorAll('img')).forEach(function(i){
        if(i.naturalWidth<120) return;
        var r=i.getBoundingClientRect();
        if(r.bottom<=0||r.top>=vh) return;
        n++;
        var el=i, pend=false;
        for(var k=0;k<4&&el;k++,el=el.parentElement){
          if(el.classList&&el.classList.contains('ts-gaze-pending')) pend=true; }
        if(pend) p++;
      });
      return n+':'+p;})()""")

def trial(far, tag):
    tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips&x=%s'" % tag)
    time.sleep(13)
    tab.eval("window.__TS_IMG_FAR=%r" % far)
    tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
    tab.eval("window.scrollBy(0,2200)")
    t0 = time.time()
    last = None
    for i in range(60):
        time.sleep(0.4)
        last = visible_pending()
        if isinstance(last, str) and last.endswith(':0'):
            break
    tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
    return round(time.time() - t0, 2), last

res = defaultdict(list)
for t in range(TRIALS):
    for name, far in SIDES:
        r = trial(far, name + str(t))
        res[name].append(r)
        print(f"  trial{t} {name:6s} settled {r[0]:5.2f}s  {r[1]}")
print()
for name, _ in SIDES:
    v = [x[0] for x in res[name]]
    print(f"{name:6s} settle {sum(v)/len(v):5.2f}s  (runs {v})")
