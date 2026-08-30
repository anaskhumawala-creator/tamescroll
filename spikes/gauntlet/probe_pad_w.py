import time, json
from gauntlet import open_platform
tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=makeup+tutorial'")
time.sleep(12)
for i in range(5):
    tab.eval("window.scrollBy(0,700)"); time.sleep(2)
time.sleep(4)
js = """(async function(){
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(i){
    return i.naturalWidth>=120 && i.naturalHeight>=120;}).slice(0,24);
  var scales=[0.7,0.85,1.0,1.2,1.45];
  var out=[];
  for (var i=0;i<imgs.length;i++){
    var row={w:imgs[i].naturalWidth,h:imgs[i].naturalHeight,r:{}};
    for (var s=0;s<scales.length;s++){
      try{
        var r=await window.__TS_GAZE_REREAD(imgs[i],scales[s]);
        row.r[scales[s]]=(r||[]).map(function(x){return [x.gender,Math.round((x.score||0)*100)/100];});
      }catch(e){ row.r[scales[s]]='err'; }
    }
    out.push(row);
  }
  return JSON.stringify(out);
})()"""
res = tab.eval_async(js) if hasattr(tab,'eval_async') else tab.eval(js)
print(json.dumps(res)[:200] if not isinstance(res,str) else res[:4000])
