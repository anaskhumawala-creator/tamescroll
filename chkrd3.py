import time
from gauntlet import targets, Tab
tab=None
for t in targets():
    u=t.get("url","")
    if "localhost:1420" not in u and "devtools" not in u: tab=Tab(t)
tab.eval("location.href='https://www.reddit.com/'")
time.sleep(16)
print(tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');var t=s?s.textContent:'';
 return JSON.stringify({url:location.href.slice(0,36), rulesFlag:!!window.__TS_RULES__,
  len:t.length, ytd:/ytd-rich-item/.test(t), rd:/shreddit-ad-post/.test(t),
  styles:[].slice.call(document.querySelectorAll('style[id]')).map(function(x){return x.id+':'+x.textContent.length;})});})()"""))
