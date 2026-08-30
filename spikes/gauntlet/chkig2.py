from gauntlet import targets, Tab
def page():
    for t in targets():
        if "instagram" in t.get("url",""): return Tab(t)
    raise SystemExit("no ig window")
t=page()
print(t.eval(r"""(function(){
  var s=document.getElementById('tamescroll-rules');
  var txt=s?s.textContent:'';
  return JSON.stringify({len:txt.length, yt:/ytd-|ytm-/.test(txt), ig:/reels|explore/.test(txt),
    head:txt.slice(0,140)});
})()"""))
