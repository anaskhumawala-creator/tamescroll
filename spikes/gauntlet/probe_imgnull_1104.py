"""1104 ON-DEVICE PROOF: does the image null guard actually fire?

The guard (`refusedByNullGuard`) was live in `flaggedFaceIndices` and DEAD
on the worker image path, because worker-entry's reply dropped `raw` and
`shape.norm` -- the two fields both its predicates read. 1104 carries them
across and stamps what it refused.

WHAT COUNTS AS PROOF HERE, and why `faces` - `flagged` does not: a
same-gender CLEAR also subtracts there. The unambiguous row is `nr > 0`,
which is the guard's own count, plus the signature behind it -- a MALE
read below GENDER_IMAGE_MIN_SCORE 0.40 carrying nm below the floor of 5.
On 1103 such a read failed the score bar and was therefore FLAGGED.

Population is deliberately finding 52's: person-free searches, where his
"randomly just blur some text" lives.

    python probe_imgnull_1104.py [queries...]
"""

import json
import sys
import time
from collections import Counter

from gauntlet import pick

QUERIES = sys.argv[1:] or [
    "minecraft gameplay",
    "lofi hip hop radio",
    "car review walkaround",
    "python tutorial code",
]


def launcher_open_youtube(gender="man"):
    lau = pick("tauri.localhost")
    ok = lau.eval(
        "(function(){var b=document.querySelector("
        "'#gender-toggle .toggle-opt[data-value=\"%s\"]');"
        "if(!b)return 'no-toggle';b.click();return localStorage.getItem('tamescroll.gender');})()"
        % gender
    )
    if ok != gender:
        raise SystemExit("gender did not take: wanted %s, launcher says %r" % (gender, ok))
    time.sleep(0.8)
    lau.eval(
        "(function(){var b=[].slice.call(document.querySelectorAll('button.tile'))"
        ".filter(function(x){return /youtube/i.test(x.textContent);})[0];b&&b.click();})()"
    )
    time.sleep(9)
    return pick("youtube.com")


def collect(tab, query):
    tab.eval("window.__TS_GAZE_IMGDIAG = []")
    tab.eval(
        "location.href='https://www.youtube.com/results?search_query="
        + query.replace(" ", "+")
        + "'"
    )
    time.sleep(13)
    for _ in range(6):
        tab.eval("window.scrollBy(0,700)")
        time.sleep(2.5)
    time.sleep(6)
    raw = tab.eval("JSON.stringify(window.__TS_GAZE_IMGDIAG||[])")
    try:
        return json.loads(raw)
    except Exception:
        print("  no diag:", repr(raw)[:160])
        return []


def main():
    # Reuse an already-open platform window when there is one: the
    # launcher window is REPLACED by it, so re-running the launcher flow
    # against a live session throws "no target matching tauri.localhost".
    try:
        tab = pick("youtube.com")
        print("reusing the open YouTube window")
    except SystemExit:
        tab = launcher_open_youtube("man")
    allrows = []
    for q in QUERIES:
        rows = collect(tab, q)
        print("%-26s rows %d" % (q, len(rows)))
        for r in rows:
            r["_q"] = q
        allrows += rows

    if not allrows:
        raise SystemExit("NOTHING COLLECTED -- the probe proves nothing, do not report a result")

    print()
    print("images with a verdict :", len(allrows))
    print("why                   :", dict(Counter(r.get("why") for r in allrows)))

    faces = sum(r.get("faces") or 0 for r in allrows)
    flagged = sum(r.get("flagged") or 0 for r in allrows)
    refused = sum(r.get("nr") or 0 for r in allrows)
    print("face reads            :", faces)
    print("marks minted          :", flagged)
    print("REFUSED BY NULL GUARD :", refused)

    # `nr` is the count; this is the SIGNATURE behind it, so the number
    # names the rows it came from rather than standing alone (the rule
    # finding 48 caught its own 388-vs-5 error with).
    haveN = [x for r in allrows for x in (r.get("reads") or []) if x.get("n") is not None]
    print("reads carrying nm     :", len(haveN), "of", faces)
    if not haveN:
        print("!! nm never crossed -- the boundary fix is NOT live in this build")

    sus = [
        (r["_q"], r.get("flagged"), r.get("nr"), x)
        for r in allrows
        for x in (r.get("reads") or [])
        if x.get("g") == "male" and (x.get("s") or 0) < 0.40 and (x.get("n") is not None and x["n"] < 5)
    ]
    print()
    print("THE 1103 JUNK SIGNATURE (male, s<0.40, nm<5):", len(sus))
    for q, fl, nr, x in sus[:15]:
        print("  %-24s flagged=%s nr=%s  s=%.2f nm=%.2f px=%s conf=%s" %
              (q, fl, nr, x.get("s") or 0, x.get("n"), x.get("p"), x.get("k")))

    nm_all = sorted(x["n"] for x in haveN)
    if nm_all:
        print()
        print("nm p50 over every image read: %.2f  (finding 52 junk p50 3.44, floor 5)" %
              nm_all[len(nm_all) // 2])


if __name__ == "__main__":
    main()
