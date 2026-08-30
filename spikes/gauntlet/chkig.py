from gauntlet import targets, Tab
def page():
    for t in targets():
        u=t.get("url","")
        if "instagram" in u: return Tab(t)
    raise SystemExit("no ig window")
t=page()
print(t.eval(r"""(function(){
  var out=[];
  var sheets=document.querySelectorAll('style[id]');
  for(var i=0;i<sheets.length;i++) out.push({id:sheets[i].id, len:(sheets[i].textContent||'').length,
    reels:/reels/.test(sheets[i].textContent||''), explore:/explore/.test(sheets[i].textContent||'')});
  return JSON.stringify(out);
})()"""))
