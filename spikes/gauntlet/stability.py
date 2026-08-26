"""How STABLE is the blur, as the owner actually experiences it?

The gauntlet scores five per-frame classes and none of them counts how
many separate boxes appear and vanish per second. Owner, 2026-08-26:
"the blurs look much annoying right now with multiple boxes here and
there... previous versions were significantly better at feeling stable".
Every round could improve its score while this got worse, and it did.

Why this is a separate tool and not a gauntlet flag: the gauntlet PAUSES
the video for every frame so its blur-on/blur-off pair is the same
instant. Pause zeroes track velocities and re-pins every overlay, so the
churn it measures is an artifact of its own sampling. This one never
pauses and never screenshots — it polls the live patch state during
continuous playback, which is the only way to see what the eye sees.

Metrics, all per second of playback so runs of different length compare:
  patches       mean / max simultaneous patches
  dCount/s      how often the number of patches changes
  births/s      new track ids per second
  jitter        mean centre movement per patch per second, in frame widths
  breathe       mean size change per patch per second, same units
  life p50      how long a patch survives, seconds

A patch that is correct but blinks twice a second reads as broken. These
are the numbers to beat.
"""

import json
import os
import statistics
import sys
import time

from gauntlet import Tab, open_platform, pick

SAMPLE_HZ = 10.0

# Overlays are .ts-gaze-vregion-host elements parented to the player, and
# their LIVE rects are what the eye sees — read them from the DOM, the
# same way the gauntlet's probe does, not from any internal array. Track
# ids come from the last entry the pipeline pushed.
SAMPLE_JS = r"""
(function () {
  var v = document.querySelector('video');
  var host = document.querySelector('#movie_player');
  if (!v || !host) return null;
  var vr = v.getBoundingClientRect();
  var rects = [];
  var kids = host.querySelectorAll('.ts-gaze-vregion-host');
  for (var i = 0; i < kids.length; i++) {
    var r = kids[i].getBoundingClientRect();
    if (!r.width || !r.height) continue;
    rects.push([
      +(((r.left - vr.left) / vr.width).toFixed(4)),
      +(((r.top - vr.top) / vr.height).toFixed(4)),
      +(((r.right - vr.left) / vr.width).toFixed(4)),
      +(((r.bottom - vr.top) / vr.height).toFixed(4))
    ]);
  }
  var d = window.__TS_GAZE_IDS || {};
  var tr = (d.tracks || []).slice(-1)[0] || [];
  var ids = [];
  for (var k = 0; k < tr.length; k++) ids.push(tr[k].id);
  return JSON.stringify({
    t: +v.currentTime.toFixed(2),
    paused: v.paused,
    ad: /ad-showing|ad-interrupting/.test(host.className || ''),
    n: rects.length,
    r: rects,
    ids: ids
  });
})()
"""



def sample(tab):
    return tab.eval(SAMPLE_JS)


def collect(tab, seconds):
    out = []
    end = time.time() + seconds
    while time.time() < end:
        s = sample(tab)
        try:
            s = json.loads(s or "{}")
        except Exception:
            s = {}
        if s:
            s["wall"] = time.time()
            out.append(s)
        time.sleep(1.0 / SAMPLE_HZ)
    return out


def centre(r):
    return ((r[0] + r[2]) / 2.0, (r[1] + r[3]) / 2.0)


def size(r):
    return (r[2] - r[0], r[3] - r[1])


def analyse(samples):
    """Pure, so the numbers can be recomputed from a saved trace."""
    samples = [s for s in samples if not s.get("paused")]
    if len(samples) < 2:
        return {"error": "no playing samples"}
    span = samples[-1]["wall"] - samples[0]["wall"]
    counts = [s["n"] for s in samples]

    dcount = sum(
        abs(samples[i]["n"] - samples[i - 1]["n"]) for i in range(1, len(samples))
    )

    # Track births. ids are per-video and monotonic, so a set difference
    # is enough; a track that merely MOVED keeps its id.
    births = 0
    seen = set()
    for s in samples:
        for i in s.get("ids") or []:
            if i not in seen:
                seen.add(i)
                births += 1

    # Geometry churn. Matched greedily by nearest centre within a frame
    # pair, because ids are not attached to rects in the probe — and the
    # eye does the same thing: it does not know which patch is which, it
    # just sees movement.
    jit = []
    brh = []
    for i in range(1, len(samples)):
        a, b = samples[i - 1].get("r") or [], samples[i].get("r") or []
        dt = samples[i]["wall"] - samples[i - 1]["wall"]
        if not a or not b or dt <= 0:
            continue
        for rb in b:
            cb = centre(rb)
            best = min(a, key=lambda ra: abs(centre(ra)[0] - cb[0]) + abs(centre(ra)[1] - cb[1]))
            ca = centre(best)
            jit.append((abs(ca[0] - cb[0]) + abs(ca[1] - cb[1])) / dt)
            sa, sb = size(best), size(rb)
            brh.append((abs(sa[0] - sb[0]) + abs(sa[1] - sb[1])) / dt)

    # Patch lifetime, approximated by how long the count stayed >= k.
    lives = []
    run_start = None
    for s in samples:
        if s["n"] > 0 and run_start is None:
            run_start = s["wall"]
        elif s["n"] == 0 and run_start is not None:
            lives.append(s["wall"] - run_start)
            run_start = None
    if run_start is not None:
        lives.append(samples[-1]["wall"] - run_start)

    return {
        "samples": len(samples),
        "span_s": round(span, 1),
        "patches_mean": round(statistics.mean(counts), 2),
        "patches_max": max(counts),
        "dCount_per_s": round(dcount / span, 2) if span else 0,
        "births_per_s": round(births / span, 2) if span else 0,
        "jitter_per_s": round(statistics.mean(jit), 4) if jit else 0,
        "breathe_per_s": round(statistics.mean(brh), 4) if brh else 0,
        "cover_life_p50": round(statistics.median(lives), 2) if lives else 0,
    }


def main(out, gender, video, start, seconds):
    tab = open_platform(gender)
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(20)
    tab = pick("youtube.com")
    boot = tab.eval("JSON.stringify({g: window.__TS_GAZE_GENDER, b: window.__TS_GAZE_BUNDLE__})")
    if ('"g":"%s"' % gender) not in (boot or ""):
        raise SystemExit("BOOTED WRONG DIRECTION: %s" % boot)
    tab.eval(
        "(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start
    )
    time.sleep(3.0)
    samples = collect(tab, seconds)
    res = analyse(samples)
    res["boot"] = boot
    res["video"] = video
    res["gender"] = gender
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w") as f:
        json.dump({"result": res, "samples": samples}, f)
    print(json.dumps(res))


if __name__ == "__main__":
    if len(sys.argv) < 6:
        raise SystemExit(
            "usage: stability.py <out.json> <man|woman> <videoId> <startSec> <seconds>"
        )
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), float(sys.argv[5]))
