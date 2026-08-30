"""Regression: after making desktop rules follow the navigation, does
each platform still get ITS OWN sheet -- and does YouTube still hide
what it hid before?"""
import json, time
from gauntlet import targets, Tab, pick

lau = pick("localhost:1420")
lau.eval("(function(){var b=document.querySelector('#blur-toggle .toggle-opt[data-value=\"blur\"]');b&&b.click();})()")
lau.eval("(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
         ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()")
time.sleep(8)
tab = None
for t in targets():
    u = t.get("url", "")
    if "localhost:1420" not in u and "devtools" not in u:
        tab = Tab(t)

CASES = [
    ("https://www.youtube.com/", "ytd-rich-item-renderer", "#ts-shorts-check"),
    ("https://www.reddit.com/", "shreddit-post", None),
    ("https://x.com/home", "tablist", None),
]
for url, needle, _ in CASES:
    tab.eval("location.href='%s'" % url)
    time.sleep(14)
    print(url, tab.eval("""(function(){var s=document.getElementById('tamescroll-rules');
      var t=s?s.textContent:'';
      return JSON.stringify({len:t.length, own:t.indexOf(%s)!==-1,
        blur:!!document.getElementById('ts-gaze-blur'),
        hidden:[].slice.call(document.querySelectorAll('*')).length>0});})()""" % json.dumps(needle)))
