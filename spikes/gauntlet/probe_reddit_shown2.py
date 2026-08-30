"""page_css honours the toggle in a unit test and does not in the app.

So the disagreement is between the code and the PROCESS: either the
running dev binary predates the code, or the sheet the page ends up with
is not the one shown-state built. Reads bytes + the scoped stamp for
both states, so the two hypotheses separate.
"""
import time

from gauntlet import pick, targets

SHEET = (
    "(function(){var e=document.getElementById('tamescroll-rules');"
    "if(!e) return JSON.stringify({sheet:null});"
    "var t=e.textContent;"
    "return JSON.stringify({bytes:t.length,scoped:e.getAttribute('data-ts-scoped'),"
    "recent:t.indexOf('recent-posts')>=0,head:t.slice(0,80)});})()"
)


def close_platforms():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            # window.close() no longer closes a platform window (the
            # injected script routes it to the launcher, so a page
            # cannot leave a dead label behind). Close the way the
            # titlebar does.
            pick(u).eval("window.__TAURI__.window.getCurrentWindow().close()")
    time.sleep(2)


def platform_tab():
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            return pick(u)
    return None


lau = pick("localhost:1420")
for label, shown in [("shown=[]        ", "[]"), ("shown=[discovery]", "['discovery']")]:
    close_platforms()
    lau.eval(
        "(function(){var i=window.__TAURI__.core.invoke;"
        "i('open_platform',{id:'reddit',mode:'off',strength:16,gender:'man',shown:%s});"
        "return 1;})()" % shown
    )
    t = None
    for _ in range(12):
        time.sleep(3)
        t = platform_tab()
        if t:
            break
    time.sleep(6)
    print(label, t.eval(SHEET) if t else "no tab")
