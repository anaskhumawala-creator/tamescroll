"""Does the ad-free request shaper actually land on m.youtube?

rules/scriptlets.txt carries `isInlinePlaybackNoAd` for BOTH youtube
hosts, tagged [unverified] since it shipped: "needs owner phone; emulator
is never served real ads". But the field either reaches the outbound
/youtubei/v1/player body or it does not, and that half is measurable
here -- it is the mobile page's ONLY ad defence at the stream level,
because m.youtube embeds no streamingData to prune (measured
2026-08-28, probe_sabr_what.py).

Reads the request bodies off the wire via CDP rather than from the page,
so a page-side hook that YouTube captured before us cannot hide them.
"""
import json
import time

from gauntlet import pick, targets

UA = (
    "Mozilla/5.0 (Linux; Android 13; 2201117TG) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Mobile Safari/537.36"
)
VIDEO = "NWoT1ZVd1Lo"


def platform_tab():
    for t in targets():
        u = t.get("url", "")
        if "localhost:1420" in u or "tauri.localhost" in u or "devtools" in u:
            continue
        if u.startswith("http"):
            return pick(u)
    raise SystemExit("no platform window")


tab = platform_tab()
tab.cmd("Emulation.setUserAgentOverride", userAgent=UA)
tab.cmd(
    "Emulation.setDeviceMetricsOverride",
    width=412,
    height=915,
    deviceScaleFactor=2.0,
    mobile=True,
)
tab.cmd("Network.enable")
tab.eval("location.href='https://m.youtube.com/watch?v=%s'" % VIDEO)

seen = []
deadline = time.time() + 45
while time.time() < deadline:
    try:
        tab.ws.settimeout(2)
        msg = json.loads(tab.ws.recv())
    except Exception:
        continue
    if msg.get("method") != "Network.requestWillBeSent":
        continue
    req = msg["params"]["request"]
    url = req.get("url", "")
    if "/youtubei/v1/player" not in url:
        continue
    body = req.get("postData") or ""
    shaped = "isInlinePlaybackNoAd" in body
    seen.append((url.split("?")[0], req.get("method"), len(body), shaped))
    print("player request:", seen[-1])
    if len(seen) >= 3:
        break

print("---")
print("player requests seen:", len(seen))
print("shaped:", sum(1 for s in seen if s[3]), "of", len(seen))
print(
    tab.eval(
        r"""(function(){var v=document.querySelector('video');
 return JSON.stringify({t: v? +v.currentTime.toFixed(2):null, paused: v? v.paused:null,
  err: document.querySelectorAll('.ytp-error').length,
  adSkip: document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-player-overlay').length});})()"""
    )
)
