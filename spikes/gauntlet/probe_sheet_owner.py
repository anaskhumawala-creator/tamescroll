"""Every platform must get ITS OWN rules, whichever window it opens in."""
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
    ("https://www.reddit.com/", "shreddit-ad-post"),
    ("https://x.com/home", '[data-testid="primaryColumn"]'),
    ("https://www.instagram.com/explore/", 'a[href^="/reels"]'),
    ("https://www.facebook.com/", 'div[aria-label="People you may know"]'),
    ("https://www.youtube.com/", "ytd-rich-item-renderer"),
]
for url, needle in CASES:
    tab.eval("location.href='%s'" % url)
    time.sleep(13)
    print("%-40s %s" % (url, tab.eval(
        """(function(){var s=document.getElementById('tamescroll-rules');var t=s?s.textContent:'';
        return JSON.stringify({len:t.length, own:t.indexOf(%s)!==-1,
          scoped:s?s.getAttribute('data-ts-scoped'):null,
          leak:/ytd-rich-item/.test(t)&&%s});})()""" % (json.dumps(needle), json.dumps(needle != "ytd-rich-item-renderer")))))
