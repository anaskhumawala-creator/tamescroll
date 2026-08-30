import time, base64
from gauntlet import pick
tab = pick("youtube.com")
tab.eval("window.__TS_MINI__.exit(); window.scrollTo(0,600);")
time.sleep(0.7)
print(tab.eval(r"""(function(){var el=document.elementFromPoint(200,500); window.__mark=el;
 return JSON.stringify({scrollY:window.scrollY, markY:Math.round(el.getBoundingClientRect().top)});})()"""))
tab.eval("window.__TS_MINI__.enter()")
time.sleep(0.6)
print(tab.eval(r"""(function(){return JSON.stringify({scrollY:window.scrollY,
 markY:Math.round(window.__mark.getBoundingClientRect().top)});})()"""))
d=tab.cmd("Page.captureScreenshot", format="png"); open("mini-mark.png","wb").write(base64.b64decode(d["data"]))
tab.eval("window.__TS_MINI__.exit()")
time.sleep(0.6)
print(tab.eval(r"""(function(){return JSON.stringify({scrollY:window.scrollY,
 markY:Math.round(window.__mark.getBoundingClientRect().top)});})()"""))
