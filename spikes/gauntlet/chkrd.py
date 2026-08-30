from gauntlet import targets, Tab
tab=None
for t in targets():
    u=t.get("url","")
    if "reddit" in u: tab=Tab(t)
if not tab: raise SystemExit("no reddit window")
print(tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');var t=s?s.textContent:'';
 return JSON.stringify({len:t.length, trending:t.indexOf('shreddit-trending-searches')!==-1,
  adpost:t.indexOf('shreddit-ad-post')!==-1, ytd:/ytd-rich-item/.test(t), url:location.href.slice(0,40)});})()"""))
