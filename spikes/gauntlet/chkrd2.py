import time
from gauntlet import targets, Tab
tab=None
for t in targets():
    u=t.get("url","")
    if "localhost:1420" not in u and "devtools" not in u: tab=Tab(t)
if not tab: raise SystemExit("no window")
tab.eval("location.href='https://www.reddit.com/'")
time.sleep(15)
print(tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');var t=s?s.textContent:'';
 return JSON.stringify({url:location.href.slice(0,40),len:t.length,
  trending:t.indexOf('shreddit-trending-searches')!==-1,
  adpost:t.indexOf('shreddit-ad-post')!==-1, ytd:/ytd-rich-item/.test(t)});})()"""))
