import sys, time, json
sys.path.insert(0,'spikes/gauntlet')
from gauntlet import pick, open_platform
VID=sys.argv[1]
try: tab=pick("youtube.com")
except Exception: tab=open_platform("man")
# long-task + first-frame instrumentation installed by navigating then evaling early
tab.eval("location.href='https://www.youtube.com/watch?v=%s&t=0s'"%VID)
time.sleep(1.0)
tab.eval("""(function(){window.__LT=[];try{new PerformanceObserver(function(l){
 l.getEntries().forEach(function(e){window.__LT.push([Math.round(e.startTime),Math.round(e.duration)])});
}).observe({entryTypes:['longtask']});}catch(e){}
var v=document.querySelector('video');window.__FF=null;
var iv=setInterval(function(){var vv=document.querySelector('video');
 if(vv&&vv.currentTime>0.3){window.__FF=Math.round(performance.now());clearInterval(iv);}},100);
return 1;})()""")
t0=time.time()
while time.time()-t0<60:
    time.sleep(1)
    ff=tab.eval("window.__FF")
    if ff: break
out=tab.eval("""(function(){
 var res=performance.getEntriesByType('resource').filter(function(e){
   return /youtubei\/v1\/player|googlevideo\.com\/videoplayback/.test(e.name);})
  .map(function(e){return {u:/player\b/.test(e.name)&&!/videoplayback/.test(e.name)?'PLAYER':'MEDIA',
    s:Math.round(e.startTime),d:Math.round(e.duration),sz:e.transferSize||0};});
 var lt=(window.__LT||[]).filter(function(a){return a[1]>200;});
 var tot=(window.__LT||[]).reduce(function(a,b){return a+b[1]},0);
 return JSON.stringify({firstFrame:window.__FF,res:res.slice(0,18),longOver200:lt.slice(0,12),
   longTotalMs:Math.round(tot),nLong:(window.__LT||[]).length});})()""")
d=json.loads(out)
print("firstFrame(ms):", d['firstFrame'], " longtask total:", d['longTotalMs'], "ms over", d['nLong'],"tasks")
print("long tasks >200ms [start,dur]:", d['longOver200'])
for r in d['res']: print("  %-6s start=%6dms dur=%6dms size=%d" % (r['u'],r['s'],r['d'],r['sz']))
