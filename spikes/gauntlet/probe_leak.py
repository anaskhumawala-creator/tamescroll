"""Is the SURFACE gone, or just our selector's element?

Owner issue #28 is the standing lesson: the end-screen rule fired, every
DOM probe agreed, and his screenshot had twelve recommendation cards in
reskinned markup. "A computed style proves a RULE fired; only a pixel
proves the SURFACE is covered."

So this counts the surface by its CONTENT -- links, hrefs, visible tiles
-- with the surface set to Hidden. Anything visible here is a leak, no
matter how healthy our selectors look.

Usage: probe_leak.py [mobile|desktop]
"""
import json
import sys
import time

from gauntlet import pick, targets

MODE = sys.argv[1] if len(sys.argv) > 1 else "mobile"
UA_MOBILE = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)
PAGES = (
    [
        ("home", "https://m.youtube.com/"),
        ("search", "https://m.youtube.com/results?search_query=funny+shorts"),
        ("watch", "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"),
    ]
    if MODE == "mobile"
    else [
        ("home", "https://www.youtube.com/"),
        ("search", "https://www.youtube.com/results?search_query=funny+shorts"),
        ("watch", "https://www.youtube.com/watch?v=NWoT1ZVd1Lo"),
    ]
)

LEAK = r"""(function(){
  function visible(el){
    if (!el) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }
  // Stop BELOW body. On desktop YouTube ytd-app is fixed-positioned, so
  // body's own border box is 0 tall and a walk that tests body calls
  // every recommendation on the page invisible -- measured 2026-08-28,
  // 20 lockups, all "blocked by body". An ancestor that hides content
  // is always an element inside body, never body itself.
  function chainVisible(el){
    var p = el;
    while (p && p !== document.body && p !== document.documentElement) {
      if (!visible(p)) return false;
      p = p.parentElement;
    }
    return true;
  }
  function countVisible(sel){
    var out = 0;
    document.querySelectorAll(sel).forEach(function(e){ if (chainVisible(e)) out++; });
    return out;
  }
  // The SHORTS surface, by content: any link into /shorts/ that a person
  // could actually see and tap.
  var shortsLinks = 0, shortsSample = [];
  document.querySelectorAll('a[href*="/shorts/"]').forEach(function(a){
    if (chainVisible(a)) {
      shortsLinks++;
      if (shortsSample.length < 3) {
        var host = a.closest('[class*="renderer"], ytm-video-with-context-renderer, ytd-video-renderer');
        shortsSample.push((host ? host.tagName.toLowerCase() : a.tagName.toLowerCase()));
      }
    }
  });
  return JSON.stringify({
    path: location.pathname,
    shortsVisibleLinks: shortsLinks,
    shortsHosts: shortsSample,
    shortsTabVisible: countVisible('ytm-pivot-bar-item-renderer'),
    // The HOME surface by content: video tiles on the home page.
    homeTiles: location.pathname === '/'
      ? countVisible('ytm-video-with-context-renderer, ytd-rich-item-renderer')
      : null,
    // Watch recommendations, by content, on the watch page only.
    watchRecTiles: location.pathname === '/watch'
      ? countVisible('ytm-video-with-context-renderer, ytd-compact-video-renderer, yt-lockup-view-model')
      : null,
    // Anything that reads as an ad or a nag, by content.
    adish: countVisible('[class*="ad-slot"], [class*="promoted"], ytm-companion-slot, ytd-ad-slot-renderer'),
    installNag: countVisible('a[href^="intent://"]')
  });
})()"""


def main():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            pick(u).eval("window.close()")
    time.sleep(2)
    lau = pick("localhost:1420")
    # Everything HIDDEN except the default-shown watch recommendations --
    # this is the state the app ships in.
    lau.eval(
        "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
        "m.youtube=['watch_recs'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
    )
    lau.eval(
        "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
        ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
    )
    time.sleep(9)
    tab = None
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            tab = pick(u)
            break
    # A stale override from an earlier session sticks to the target, so a
    # desktop run has to state a desktop size rather than clear one.
    if MODE == "mobile":
        tab.cmd("Emulation.setUserAgentOverride", userAgent=UA_MOBILE)
        tab.cmd(
            "Emulation.setDeviceMetricsOverride",
            width=412,
            height=915,
            deviceScaleFactor=2.0,
            mobile=True,
        )
    else:
        tab.cmd("Emulation.setUserAgentOverride", userAgent="")
        tab.cmd(
            "Emulation.setDeviceMetricsOverride",
            width=1426,
            height=900,
            deviceScaleFactor=1,
            mobile=False,
        )
    print("=== %s, surfaces at ship defaults (only watch_recs shown) ===" % MODE)
    for name, url in PAGES:
        tab.eval("location.href=%r" % url)
        time.sleep(20)
        for _ in range(3):
            tab.eval("window.scrollBy(0,1400)")
            time.sleep(3)
        print(name, tab.eval(LEAK))


main()
