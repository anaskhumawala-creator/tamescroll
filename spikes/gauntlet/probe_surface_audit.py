"""Every rule we own, counted on the live page it claims to describe.

The Home-feed bug (2026-08-28) was a rule that worked perfectly and a
toggle that could not reach it. Neither the test suite nor a DOM probe of
that one selector would have found it -- only asking, per surface, "does
pressing this actually change the page".

This asks that for every surface on a platform, and on the way there it
also counts every selector, which finds the other silent failure: a rule
tagged [live] or [unverified] that matches nothing at all on any page we
can reach.

Usage: probe_surface_audit.py <platform> [mobile|desktop]
"""
import json
import re
import sys
import time
from pathlib import Path

from gauntlet import pick, targets

ROOT = Path(__file__).resolve().parents[2]
UA_MOBILE = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)

PLATFORM = sys.argv[1] if len(sys.argv) > 1 else "youtube"
MODE = sys.argv[2] if len(sys.argv) > 2 else "mobile"

PAGES = {
    ("youtube", "mobile"): [
        ("home", "https://m.youtube.com/"),
        ("search", "https://m.youtube.com/results?search_query=linus+tech+tips"),
        ("watch", "https://m.youtube.com/watch?v=NWoT1ZVd1Lo"),
    ],
    ("youtube", "desktop"): [
        ("home", "https://www.youtube.com/"),
        ("search", "https://www.youtube.com/results?search_query=linus+tech+tips"),
        ("watch", "https://www.youtube.com/watch?v=NWoT1ZVd1Lo"),
    ],
    ("reddit", "desktop"): [
        ("home", "https://www.reddit.com/"),
        ("feed", "https://www.reddit.com/r/pics/"),
    ],
    ("reddit", "mobile"): [
        ("home", "https://www.reddit.com/"),
        ("feed", "https://www.reddit.com/r/pics/"),
    ],
    ("x", "desktop"): [("home", "https://x.com/explore")],
    ("instagram", "mobile"): [("explore", "https://www.instagram.com/explore/")],
}


def parse_rules(platform):
    """surface id -> [(domain, selector)], straight out of the rules file."""
    text = (ROOT / "rules" / f"{platform}.txt").read_text(encoding="utf-8")
    out = {}
    surface = None
    for line in text.splitlines():
        m = re.match(r"^!surface:\s*(\S+)\s+(.*)$", line)
        if m:
            surface = m.group(1)
            out.setdefault(surface, {"label": m.group(2).strip(), "rules": []})
            continue
        if line.startswith("!") or not line.strip():
            continue
        if "##" not in line:
            continue
        domain, sel = line.split("##", 1)
        if surface:
            out[surface]["rules"].append((domain, sel))
    return out


def platform_tab():
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u:
            continue
        if u.startswith("http"):
            return pick(u)
    raise SystemExit("no platform window -- open the tile first")


def open_tile(lau, platform, shown):
    for t in targets():
        u = t.get("url", "")
        if u.startswith("http") and "localhost:1420" not in u and "tauri.localhost" not in u:
            pick(u).eval("window.close()")
    time.sleep(2)
    lau.eval(
        "(function(){var m=JSON.parse(localStorage.getItem('tamescroll.shown')||'{}');"
        "m[%r]=%s;localStorage.setItem('tamescroll.shown',JSON.stringify(m));return 1;})()"
        % (platform, json.dumps(shown))
    )
    # OPEN BY INVOKE, NOT BY TILE. The launcher only shows platforms the
    # user has chosen (main.ts), so a tile press for one they have not
    # added is a silent no-op -- and then the probe measures the right
    # PAGE with whatever shown-state the last platform left behind.
    # Measured 2026-08-29: that alone invented a dead Reels toggle and a
    # leaking Explore nav on instagram.
    lau.eval(
        "(function(){var i=window.__TAURI__.core.invoke;"
        "i('open_platform',{id:%s,mode:'off',strength:16,gender:'man',shown:%s});"
        "return 1;})()" % (json.dumps(platform), json.dumps(shown))
    )
    time.sleep(9)
    return platform_tab()


COUNT = r"""(function(sels){
  var out = {};
  sels.forEach(function(s){
    var n = 0, vis = 0;
    try {
      var els = document.querySelectorAll(s);
      n = els.length;
      for (var i = 0; i < els.length; i++) {
        var cs = getComputedStyle(els[i]);
        if (cs.display !== 'none' && cs.visibility !== 'hidden') vis++;
      }
    } catch (e) { n = -1; }
    out[s] = [n, vis];
  });
  return JSON.stringify(out);
})(%s)"""


def measure(tab, selectors, url, ua):
    # A device-metrics override set by an EARLIER session sticks to the
    # target and survives clearDeviceMetricsOverride, so desktop runs must
    # set a desktop size explicitly. Measured 2026-08-28: without this a
    # "desktop" run reported innerWidth 412, YouTube collapsed #secondary,
    # and the probe called 20 healthy recommendations a dead toggle.
    if ua:
        tab.cmd("Emulation.setUserAgentOverride", userAgent=ua)
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
    tab.eval("location.href=%r" % url)
    time.sleep(20)
    tab.eval("window.scrollTo(0,1200)")
    time.sleep(3)
    return json.loads(tab.eval(COUNT % json.dumps(selectors)))


def main():
    surfaces = parse_rules(PLATFORM)
    pages = PAGES.get((PLATFORM, MODE), [])
    if not pages:
        raise SystemExit("no pages configured for %s/%s" % (PLATFORM, MODE))
    ua = UA_MOBILE if MODE == "mobile" else None
    lau = pick("localhost:1420")

    toggleable = [s for s in surfaces if s not in ("ads",)]
    all_sels = sorted({sel for s in surfaces.values() for _d, sel in s["rules"]})

    # PASS 1 -- everything hidden (the default the app ships).
    tab = open_tile(lau, PLATFORM, [])
    hidden = {}
    for name, url in pages:
        hidden[name] = measure(tab, all_sels, url, ua)
        print("measured hidden:", name)

    # PASS 2 -- everything the user may show, shown.
    tab = open_tile(lau, PLATFORM, toggleable)
    shownm = {}
    for name, url in pages:
        shownm[name] = measure(tab, all_sels, url, ua)
        print("measured shown:", name)

    print("\n=== %s / %s ===" % (PLATFORM, MODE))
    # ALWAYS-ON surfaces have no toggle by design (VISION.md: ad and nag
    # hiding is never user-toggleable), so "still hidden when shown" is
    # correct behaviour there, not a finding.
    ALWAYS_ON = {"ads", "mobile_nags", "promoted"}
    dead_toggles = []
    never_match = []
    for sid, s in surfaces.items():
        print("\n[%s] %s" % (sid, s["label"]))
        for _d, sel in s["rules"]:
            # PER PAGE. Comparing a count from the watch page against a
            # visibility reading from the home page is how a probe
            # invents bugs -- the first version of this did exactly that.
            seen_anywhere = 0
            for page in hidden:
                n_h, v_h = hidden[page].get(sel, [0, 0])
                n_s, v_s = shownm[page].get(sel, [0, 0])
                seen_anywhere = max(seen_anywhere, n_h, n_s)
                note = ""
                if n_h > 0 and v_h > 0 and sid not in ALWAYS_ON:
                    note = "STILL VISIBLE WHILE HIDDEN"
                elif n_s > 0 and v_s == 0 and sid not in ALWAYS_ON:
                    note = "DEAD TOGGLE"
                if note:
                    dead_toggles.append((sid, sel, page, note))
                    print(
                        "   %-6s nHid=%-3d visHid=%-3d nShown=%-3d visShown=%-3d %s  <-- %s"
                        % (page, n_h, v_h, n_s, v_s, sel[:52], note)
                    )
            if seen_anywhere == 0:
                never_match.append((sid, sel))
            else:
                print("   ok     %s (max n=%d)" % (sel[:66], seen_anywhere))

    print("\n--- FINDINGS ---")
    print("dead toggles / leaks: %d" % len(dead_toggles))
    for sid, sel, page, note in dead_toggles:
        print("   %s :: %s on %s (%s)" % (sid, sel, page, note))
    print("selectors matching nothing on any page tested: %d" % len(never_match))
    for sid, sel in never_match:
        print("   %s :: %s" % (sid, sel))


main()
