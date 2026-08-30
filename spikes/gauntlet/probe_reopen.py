"""Close a platform window, then press its tile again.

open_platform's desktop guard returns Ok after set_focus if a window with
that label exists. That is the same shape as the Android re-tap bug the
project already paid for once: "silently succeeded". So this closes a
window BOTH ways -- the app's own close (what the titlebar X does) and a
page-initiated window.close() -- and asks whether the tile brings it back.
"""
import time

from gauntlet import pick, targets


def platform_urls():
    return [
        t.get("url", "")
        for t in targets()
        if t.get("url", "").startswith("http") and "localhost:1420" not in t.get("url", "")
    ]


def tab():
    for u in platform_urls():
        return pick(u)
    return None


def tile(lau, name):
    lau.eval(
        "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
        ".filter(function(x){return new RegExp(%r,'i').test(x.textContent);})[0];b&&b.click();})()"
        % name
    )


import sys
PLAT = sys.argv[1] if len(sys.argv) > 1 else "reddit"
lau = pick("localhost:1420")
for how, js in [
    ("tauri close (what the X does)", "window.__TAURI__.window.getCurrentWindow().close()"),
    ("page window.close()", "window.close()"),
]:
    tile(lau, PLAT)
    time.sleep(10)
    t = tab()
    print(how, "-> opened:", bool(t))
    if not t:
        continue
    try:
        t.eval(js)
    except Exception as exc:
        print("   close eval:", exc)
    time.sleep(4)
    print("   after close, windows:", platform_urls())
    tile(lau, PLAT)
    time.sleep(10)
    print("   REOPENED:", platform_urls())
    # leave nothing open for the next round
    t2 = tab()
    if t2:
        try:
            t2.eval("window.__TAURI__.window.getCurrentWindow().close()")
        except Exception:
            pass
        time.sleep(3)
