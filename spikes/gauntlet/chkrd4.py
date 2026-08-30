from gauntlet import targets, Tab
tab=None
for t in targets():
    u=t.get("url","")
    if "reddit" in u: tab=Tab(t)
if not tab:
    raise SystemExit("no reddit window")
print(tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');var t=s?s.textContent:'';
 return JSON.stringify({head:t.slice(0,180), tail:t.slice(-180)});})()"""))
