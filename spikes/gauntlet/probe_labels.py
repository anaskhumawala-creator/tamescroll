"""Which close paths leave the window LABEL taken?

open_platform returns Ok after set_focus whenever a window with the
platform's label exists, so a label that outlives its window makes the
tile a silent no-op forever. The launcher can enumerate labels, so ask it
rather than inferring from CDP targets (a target disappears the moment
the webview navigates away, which is not the same thing).
"""
import sys
import time

from gauntlet import pick, targets

PLAT = sys.argv[1] if len(sys.argv) > 1 else "instagram"
lau = pick("localhost:1420")

LABELS = (
    "(async function(){var w=await window.__TAURI__.window.getAllWebviewWindows();"
    "return JSON.stringify(w.map(function(x){return x.label;}));})()"
)


def tab():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u:
            return pick(u)
    return None


def tile():
    lau.eval(
        "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
        ".filter(function(x){return new RegExp(%r,'i').test(x.textContent);})[0];b&&b.click();})()"
        % PLAT
    )


print("labels at start:", lau.eval(LABELS))
for how, js in [
    ("tauri close", "window.__TAURI__.window.getCurrentWindow().close()"),
    ("page window.close()", "window.close()"),
]:
    tile()
    time.sleep(10)
    print("%s: opened=%s labels=%s" % (how, bool(tab()), lau.eval(LABELS)))
    t = tab()
    if not t:
        continue
    try:
        t.eval(js)
    except Exception:
        pass
    time.sleep(8)
    print("   after close: labels=%s" % lau.eval(LABELS))
    tile()
    time.sleep(10)
    print("   after re-tap: opened=%s labels=%s" % (bool(tab()), lau.eval(LABELS)))
