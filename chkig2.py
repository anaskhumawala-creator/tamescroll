from gauntlet import targets, Tab
def page():
    for t in targets():
        if "instagram" in t.get("url",""): return Tab(t)
    raise SystemExit("no ig window")
t=page()
print(t.eval(r"""(function(){
  var s=document.getElementById('tamescroll-rules');
  var txt=s?s.textContent:'';
  return JSON.stringify({len:txt.length, ytd:/ytd-|ytm-/.test(txt), ig:/instagram|_ig|reels/.test(txt),
    head:txt.slice(0,160)});
})()"""))
