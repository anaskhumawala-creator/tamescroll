"""Owner: "home feed is not showing even if I keep it enabled".

Two candidate answers: he is signed out and m.youtube shows him nothing,
or the Home feed toggle does not control the rule that actually hides it
on his device. Under a mobile UA the mobile rules are the ones that run,
and they live under a DIFFERENT surface, so this reads both.
"""
import time

from gauntlet import pick, targets, open_platform

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)


def platform_tab():
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u:
            continue
        if u.startswith("http"):
            return pick(u)
    return open_platform("man")


lau = pick("localhost:1420")
print("shown prefs:", lau.eval("localStorage.getItem('tamescroll.shown')"))

tab = platform_tab()
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd(
    "Emulation.setDeviceMetricsOverride",
    width=412,
    height=915,
    deviceScaleFactor=2.0,
    mobile=True,
)
tab.eval("location.href='https://m.youtube.com/'")
time.sleep(20)

print(
    tab.eval(
        r"""(function(){
  function n(s){ try { return document.querySelectorAll(s).length; } catch(e){ return 'ERR'; } }
  function shownOf(s){
    var e=document.querySelector(s); if(!e) return 'absent';
    var cs=getComputedStyle(e);
    return cs.display+'/'+cs.visibility+' h='+Math.round(e.getBoundingClientRect().height);
  }
  var sheet=document.getElementById('tamescroll-rules');
  var css=sheet?sheet.textContent:'';
  return JSON.stringify({
    signedIn: /SIGNED_IN|LOGGED_IN/.test('') || !!document.querySelector('a[href*="/channel/"] img[alt]'),
    avatar: n('button[aria-label*="ccount" i], img.ytm-profile-icon'),
    ytmBrowse: n('ytm-browse'),
    richGrid: n('ytm-browse ytm-rich-grid-renderer'),
    richGridState: shownOf('ytm-browse ytm-rich-grid-renderer'),
    richSection: n('ytm-single-column-browse-results-renderer ytm-rich-section-renderer'),
    videoTiles: n('ytm-video-with-context-renderer'),
    cssBytes: css.length,
    hidesRichGrid: css.indexOf('ytm-rich-grid-renderer') >= 0,
    hidesDesktopHome: css.indexOf('ytd-rich-grid-renderer') >= 0
  }, null, 1);
})()"""
    )
)
