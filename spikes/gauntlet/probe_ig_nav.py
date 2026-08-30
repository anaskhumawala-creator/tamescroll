"""Instagram audit: the Reels nav stays hidden when Shown, and the
Explore nav stays visible when Hidden. Both are toggle failures if they
are OURS -- so read the sheet and the winning rule rather than the
symptom.
"""
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

Q = r"""(function(){
  function report(sel){
    var els = [].slice.call(document.querySelectorAll(sel));
    return els.map(function(el){
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var hits = [];
      for (var i = 0; i < document.styleSheets.length; i++) {
        var rules; try { rules = document.styleSheets[i].cssRules; } catch(e){ continue; }
        for (var j = 0; j < rules.length; j++) {
          var rl = rules[j];
          if (!rl.selectorText || !rl.style || !/display/.test(rl.style.cssText)) continue;
          try { if (!el.matches(rl.selectorText)) continue; } catch(e){ continue; }
          hits.push(((document.styleSheets[i].ownerNode||{}).id || 'page') + ' :: ' + rl.selectorText.slice(0,40));
        }
      }
      return {href: el.getAttribute('href'), display: cs.display,
              w: Math.round(r.width), h: Math.round(r.height), hits: hits};
    });
  }
  var sheet = document.getElementById('tamescroll-rules');
  var css = sheet ? sheet.textContent : '';
  return JSON.stringify({
    url: location.href,
    cssBytes: css.length,
    hasReels: css.indexOf('a[href^="/reels"]') >= 0,
    hasExplore: css.indexOf('a[href^="/explore"]') >= 0,
    reels: report('a[href^="/reels"]'),
    explore: report('a[href^="/explore"]')
  }, null, 1);
})()"""


def tab_for():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u:
            return pick(u)
    return None


lau = pick("localhost:1420")
for label, shown in [("all HIDDEN", "[]"), ("reels+explore SHOWN", "['reels','explore']")]:
    lau.eval(
        "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
        "m.instagram=%s;localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()" % shown
    )
    # By invoke: this launcher has no Instagram tile (the user chooses
    # which platforms appear), and a missing tile fails silently.
    lau.eval(
        "(function(){var i=window.__TAURI__.core.invoke;"
        "i('open_platform',{id:'instagram',mode:'off',strength:16,gender:'man',shown:%s});"
        "return 1;})()" % shown
    )
    time.sleep(10)
    tab = tab_for()
    tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
    tab.cmd("Emulation.setDeviceMetricsOverride", width=412, height=915,
            deviceScaleFactor=2.0, mobile=True)
    tab.eval("location.href='https://www.instagram.com/explore/'")
    time.sleep(20)
    print("===", label)
    print(tab.eval(Q))
