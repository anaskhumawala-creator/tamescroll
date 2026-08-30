"""Reddit was getting YouTube's rules. Now that it gets its own, do they
actually hide anything?"""
import time
from gauntlet import targets, Tab
tab = None
for t in targets():
    u = t.get("url", "")
    if "localhost:1420" not in u and "devtools" not in u:
        tab = Tab(t)
tab.eval("location.href='https://www.reddit.com/r/popular/'")
time.sleep(18)
print(tab.eval(r"""(function(){
  function h(sel){var n=document.querySelectorAll(sel),c=0;
    for(var i=0;i<n.length;i++) if(getComputedStyle(n[i]).display==='none') c++;
    return n.length+'/'+c;}
  var s=document.getElementById('tamescroll-rules');
  return JSON.stringify({url:location.href.slice(0,40), len:s?s.textContent.length:0,
    scoped:s?s.getAttribute('data-ts-scoped'):null,
    feed:h('shreddit-app[pagetype="popular"] shreddit-feed'),
    trending:h('shreddit-trending-searches'),
    adpost:h('shreddit-ad-post')});
})()"""))
