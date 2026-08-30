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
  if(pend)res.push({w:i.naturalWidth,c:i.complete,src:(i.currentSrc||i.src||'').slice(0,80)});});
 return JSON.stringify({stuck:res,diag:(window.__TS_GAZE_IMGDIAG||[]).length});})()""")
d=json.loads(out)
print("still pending:", len(d["stuck"]), "processed:", d["diag"])
for s in d["stuck"][:5]: print(" ", s["w"], s["c"], s["src"][:70])
srcs=set(r.get("src","")[:80] for r in json.loads(tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")))
for s in d["stuck"][:5]:
    print("  seen-by-pipeline:", s["src"][:60] in " ".join(srcs))
tab.cmd("Emulation.setCPUThrottlingRate", rate=1)
