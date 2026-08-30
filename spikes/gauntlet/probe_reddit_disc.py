"""recent-posts stays display:none with Discovery feeds set to Shown.

That is the exact shape of the Home-feed bug: a correct rule the toggle
cannot reach. So this reads WHO is hiding it -- our surfaces layer, the
engine's cosmetic filters (vendor lists have their own reddit rules), or
Reddit itself -- rather than assuming.

It also visits /r/popular and /r/all, which the audit never opened, so
the four "matches nothing" discovery selectors get a fair test.
"""
import json
import time

from gauntlet import pick, targets

Q = r"""(function(){
  function sheets(){
    var out = {};
    ['tamescroll-rules','tamescroll-surfaces','tamescroll-blur','tamescroll-gaze'].forEach(function(id){
      var e = document.getElementById(id);
      out[id] = e ? e.textContent.length : null;
    });
    return out;
  }
  function whoHides(sel){
    var el = document.querySelector(sel);
    if (!el) return {found:false};
    var hits = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var ss = document.styleSheets[i];
      var rules;
      try { rules = ss.cssRules; } catch (e) { continue; }
      for (var j = 0; j < rules.length; j++) {
        var r = rules[j];
        if (!r.selectorText || !r.style) continue;
        if (!/display/.test(r.style.cssText)) continue;
        try { if (!el.matches(r.selectorText)) continue; } catch (e) { continue; }
        hits.push({
          owner: (ss.ownerNode && ss.ownerNode.id) || (ss.href || 'inline'),
          sel: r.selectorText.slice(0, 70),
          css: r.style.cssText.slice(0, 60)
        });
      }
    }
    var cs = getComputedStyle(el);
    var r = el.getBoundingClientRect();
    return {found:true, display:cs.display, h:Math.round(r.height), w:Math.round(r.width),
            children:el.children.length, hits:hits};
  }
  var app = document.querySelector('shreddit-app');
  return JSON.stringify({
    path: location.pathname,
    pagetype: app ? app.getAttribute('pagetype') : null,
    sheets: sheets(),
    surfacesHasRecent: (function(){
      var e=document.getElementById('tamescroll-surfaces');
      return e ? e.textContent.indexOf('recent-posts') >= 0 : null;
    })(),
    rulesHasRecent: (function(){
      var e=document.getElementById('tamescroll-rules');
      return e ? e.textContent.indexOf('recent-posts') >= 0 : null;
    })(),
    recentPosts: whoHides('recent-posts'),
    feeds: {
      popularFeed: document.querySelectorAll('shreddit-app[pagetype="popular"] shreddit-feed').length,
      allFeed: document.querySelectorAll('shreddit-app[pagetype="all"] shreddit-feed').length,
      trending: document.querySelectorAll('shreddit-trending-searches').length,
      highlight: document.querySelectorAll('community-highlight-carousel').length,
      anyFeed: document.querySelectorAll('shreddit-feed').length
    }
  }, null, 1);
})()"""

for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        pick(u).eval("window.close()")
time.sleep(2)
lau = pick("localhost:1420")
# Discovery feeds SHOWN -- the state the owner would set to get them back.
lau.eval(
    "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
    "m.reddit=['discovery'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
)
lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /reddit/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(10)
tab = None
for t in targets():
    u = t.get("url", "")
    if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
        tab = pick(u)
        break
tab.cmd("Emulation.setUserAgentOverride", userAgent="")
tab.cmd("Emulation.setDeviceMetricsOverride", width=1426, height=900,
        deviceScaleFactor=1, mobile=False)
for url in ["https://www.reddit.com/", "https://www.reddit.com/r/popular/",
            "https://www.reddit.com/r/all/"]:
    tab.eval("location.href=%r" % url)
    time.sleep(18)
    print("==", url)
    print(tab.eval(Q))
