"""Does the CORS clone cost a second network fetch?

loadDetectable re-requests every cross-origin thumbnail with
crossOrigin='anonymous'. Chrome keys its memory cache by CORS mode, so
the clone may be a full second trip -- 40ms on this desktop, and the
phone pays radio latency for it. This counts resource-timing entries per
thumbnail URL and reports transferSize (0 = served from cache).
"""
import time, json
from gauntlet import open_platform

tab = open_platform("man")
tab.eval("location.href='https://www.youtube.com/results?search_query=linus+tech+tips'")
time.sleep(14)
for i in range(4):
    tab.eval("window.scrollBy(0,900)")
    time.sleep(1.2)
time.sleep(8)
out = tab.eval("""JSON.stringify((function(){
  var e = performance.getEntriesByType('resource').filter(function(r){
    return /ytimg\.com\/(vi|an)/.test(r.name);
  });
  var by = {};
  e.forEach(function(r){ (by[r.name] = by[r.name] || []).push(r); });
  var dup = 0, single = 0, secondFromNet = 0, secondMs = [], firstMs = [];
  Object.keys(by).forEach(function(k){
    var a = by[k];
    if (a.length > 1) {
      dup++;
      firstMs.push(Math.round(a[0].duration));
      secondMs.push(Math.round(a[1].duration));
      if (a[1].transferSize > 0) secondFromNet++;
    } else single++;
  });
  secondMs.sort(function(x,y){return x-y;}); firstMs.sort(function(x,y){return x-y;});
  return {urls: Object.keys(by).length, duplicated: dup, singleFetch: single,
          secondFetchFromNetwork: secondFromNet,
          firstP50: firstMs[Math.floor(firstMs.length/2)] || null,
          secondP50: secondMs[Math.floor(secondMs.length/2)] || null,
          acao: null};
})())""")
print(out)
# Does the CDN even allow CORS?
print(tab.eval("""fetch('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',{mode:'cors'})
  .then(function(r){return 'cors fetch ok '+r.status;}).catch(function(e){return 'cors fetch FAILED '+e.message;})"""))
