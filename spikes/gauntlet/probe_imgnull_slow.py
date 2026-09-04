"""The same 1104 proof, paced for the OLD REDMI.

probe_imgnull_1104.py drives the page the way every other probe here does
-- eval, scroll, eval -- and on this phone that hangs: the CPU tfjs
backend chews a search page full of thumbnails, an `eval` waits behind the
main thread past the 180s websocket timeout, and the WebView drops to its
offline interstitial. Ping from the same device answers in 28ms, so the
"No connection" card is a symptom of the block, not a network fault.

So: one navigation, no scrolling, long unattended waits, ONE read at the
end. Slower, and it survives a phone that is genuinely saturated.
"""

import json
import sys
import time
from collections import Counter

from gauntlet import pick

QUERIES = sys.argv[1:] or ["minecraft gameplay", "lofi hip hop radio"]
SETTLE_S = 75


def youtube_tab():
    """The platform window, however it is currently presenting.

    A failed navigation leaves the WebView on our offline interstitial,
    which is a `data:` URL -- `pick("youtube.com")` then throws "no target
    matching" and the run dies mid-probe on a phone that is merely busy.
    There is exactly one page target in this app, so take it and recover.
    """
    from gauntlet import targets, Tab

    ts = targets()
    if not ts:
        raise SystemExit("no page target at all -- is the app running?")
    for t in ts:
        if "youtube.com" in t.get("url", ""):
            return Tab(t)
    return Tab(ts[0])




def read_ring(tab):
    raw = tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")
    try:
        return json.loads(raw)
    except Exception:
        print("  unreadable ring:", repr(raw)[:200])
        return []


def main():
    allrows = []
    for q in QUERIES:
        tab = youtube_tab()
        url = "https://m.youtube.com/results?search_query=" + q.replace(" ", "+")
        tab.cmd("Page.navigate", url=url)
        print("navigated:", q, "-- waiting %ds" % SETTLE_S)
        time.sleep(SETTLE_S)
        tab = youtube_tab()
        rows = read_ring(tab)
        print("  rows %d, total processed %s" % (len(rows), tab.eval("window.__TS_GAZE_IMGTOTAL||0")))
        for r in rows:
            r["_q"] = q
        allrows += rows

    if not allrows:
        raise SystemExit("NOTHING COLLECTED -- proves nothing, do not report a result")

    faces = sum(r.get("faces") or 0 for r in allrows)
    flagged = sum(r.get("flagged") or 0 for r in allrows)
    refused = sum(r.get("nr") or 0 for r in allrows)
    haveN = [x for r in allrows for x in (r.get("reads") or []) if x.get("n") is not None]

    print()
    print("images with a verdict :", len(allrows))
    print("why                   :", dict(Counter(r.get("why") for r in allrows)))
    print("face reads            :", faces)
    print("marks minted          :", flagged)
    print("REFUSED BY NULL GUARD :", refused)
    print("reads carrying nm     :", len(haveN), "of", faces)
    if faces and not haveN:
        print("!! nm never crossed the worker boundary -- the fix is NOT live here")

    sus = [
        (r["_q"], r.get("flagged"), r.get("nr"), x)
        for r in allrows
        for x in (r.get("reads") or [])
        if x.get("g") == "male" and (x.get("s") or 0) < 0.40 and x.get("n") is not None and x["n"] < 5
    ]
    print()
    print("THE 1103 JUNK SIGNATURE (male, s<0.40, nm<5):", len(sus))
    for q, fl, nr, x in sus[:20]:
        print("  %-22s flagged=%s nr=%s  s=%.2f nm=%.2f px=%s conf=%s"
              % (q, fl, nr, x.get("s") or 0, x["n"], x.get("p"), x.get("k")))

    if haveN:
        nm = sorted(x["n"] for x in haveN)
        print()
        print("nm p50 over image reads: %.2f (finding 52 junk p50 3.44, floor 5)" % nm[len(nm) // 2])
        print("nm min/max            : %.2f / %.2f" % (nm[0], nm[-1]))


if __name__ == "__main__":
    main()
