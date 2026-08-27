"""Scroll smoothness AND queue throughput in the same run.

The two are the trade: the image drain is allowed a slice of the main
thread while the page is being scrolled, and too big a slice is jank the
owner will report as "laggy". Measures both at once so the constant can
be chosen from evidence rather than nerve.

Frames come from a rAF recorder (interval > 32ms = a dropped frame at
60Hz) and long tasks from a PerformanceObserver.
"""
import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(14)
tab.cmd("Emulation.setCPUThrottlingRate", rate=6)
tab.eval("""(function(){
  window.__F=[]; window.__LT=[];
  var last=performance.now();
  (function loop(){ var n=performance.now(); window.__F.push(n-last); last=n; requestAnimationFrame(loop); })();
  try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ window.__LT.push(Math.round(e.duration)); }); })
       .observe({entryTypes:['longtask']}); }catch(e){}
})()""")
tab.eval("window.__TS_GAZE_IMGDIAG=[]; window.__F=[]; window.__LT=[]")
t0 = tab.eval("performance.now()")
# A real gesture, not scrollBy: eight flicks with a human pause between.
for i in range(8):
    tab.cmd("Input.synthesizeScrollGesture", x=700, y=400, yDistance=-700, speed=2000)
    time.sleep(0.9)
t1 = tab.eval("performance.now()")
time.sleep(10)
t2 = tab.eval("performance.now()")
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)

f = json.loads(tab.eval("JSON.stringify(window.__F||[])"))
lt = json.loads(tab.eval("JSON.stringify(window.__LT||[])"))
rows = [r for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")) if r.get("t")]
scroll_imgs = [r for r in rows if t0 <= r["t"] <= t1]
still_imgs = [r for r in rows if t1 < r["t"] <= t2]
f = [x for x in f if x < 5000]
dropped = [x for x in f if x > 32]
print(f"frames {len(f)}  dropped>32ms {len(dropped)} ({100*len(dropped)/max(1,len(f)):.0f}%)  worst {max(f or [0]):.0f}ms")
print(f"long tasks {len(lt)} totalling {sum(lt)}ms, worst {max(lt or [0])}ms")
print(f"while scrolling {len(scroll_imgs)} imgs in {(t1-t0)/1000:.1f}s = {len(scroll_imgs)/((t1-t0)/1000):.2f} img/s")
print(f"after         {len(still_imgs)} imgs in {(t2-t1)/1000:.1f}s = {len(still_imgs)/((t2-t1)/1000):.2f} img/s")
