"""Which half of the toggle is broken: the launcher's or Rust's?

surfaces_css skips a surface whose id is in SHOWN_STATE, and SHOWN_STATE
is set by open_platform from whatever the launcher passes. So this calls
open_platform TWICE -- once with shown=['discovery'] stated explicitly,
once by clicking the tile with the same value in localStorage -- and
reads our injected sheet after each. Whichever one still hides
recent-posts names the broken half.
"""
import time

from gauntlet import pick, targets

SHEET = (
    "(function(){var e=document.getElementById('tamescroll-rules');"
    "return JSON.stringify({bytes:e?e.textContent.length:null,"
    "recent:e?e.textContent.indexOf('recent-posts')>=0:null,"
    "trending:e?e.textContent.indexOf('shreddit-trending-searches')>=0:null,"
    "adpost:e?e.textContent.indexOf('shreddit-ad-post')>=0:null});})()"
)


def close_platforms():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            pick(u).eval("window.close()")
    time.sleep(2)


def platform_tab():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            return pick(u)
    return None


lau = pick("localhost:1420")
print("surfaces reported to the pane:",
      lau.eval("(async function(){var i=window.__TAURI__.core.invoke;"
               "return JSON.stringify(await i('surfaces',{id:'reddit'}));})()"))
print("stored shown map:", lau.eval("localStorage.getItem('tamescroll.shown')"))

# A -- Rust asked directly, no launcher state involved.
close_platforms()
lau.eval(
    "(function(){var i=window.__TAURI__.core.invoke;"
    "i('open_platform',{id:'reddit',mode:'off',strength:16,gender:'man',"
    "shown:['discovery']});return 1;})()"
)
time.sleep(12)
t = platform_tab()
print("A explicit shown=['discovery']:", t.eval(SHEET) if t else "no tab")

# B -- through the tile, the path the owner actually uses.
close_platforms()
lau.eval(
    "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
    "m.reddit=['discovery'];localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
)
lau.eval(
    "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
    ".filter(function(x){return /reddit/i.test(x.textContent);})[0];b&&b.click();})()"
)
time.sleep(12)
t = platform_tab()
print("B via the tile:", t.eval(SHEET) if t else "no tab")
