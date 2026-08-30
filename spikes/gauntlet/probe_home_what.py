import time
from gauntlet import pick, targets
tab=None
for t in targets():
    u=t.get("url","")
    if u.startswith("http") and "localhost:1420" not in u: tab=pick(u); break
print(tab.eval(r"""JSON.stringify({url:location.href,title:document.title,
 imgs:document.images.length,
 big:[].slice.call(document.images).filter(function(i){var r=i.getBoundingClientRect();return r.width>60;}).length,
 withSrc:[].slice.call(document.images).filter(function(i){return !!i.currentSrc;}).length,
 body:(document.body.innerText||'').slice(0,180)})"""))
