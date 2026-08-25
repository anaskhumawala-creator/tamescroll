"""Delay-line spike runner — plan-blur-v2 Stage 2, evidence only.

Opens a THROWAWAY watch page, injects probe.js, lets it run, then reads
back the measurements and screenshots the player so the presented canvas
can be compared against the real video.

Nothing here touches the shipping path: the probe lives entirely in the
page and dies with it.

    python run.py <videoId> [seconds]
"""

import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gauntlet"))
from gauntlet import Tab, pick, open_platform  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def main(video, seconds=20.0):
    tab = open_platform("man")
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(18)
    tab = pick("youtube.com")

    # Baseline BEFORE the probe: dropped-frame counters and whether audio
    # is actually flowing. Without a before, "audio is broken" and "this
    # video was always silent" look identical.
    before = tab.eval(
        "(function(){var v=document.querySelector('video');"
        "var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{};"
        "return JSON.stringify({t:v.currentTime,muted:v.muted,vol:v.volume,"
        "paused:v.paused,total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0});})()"
    )

    # A stalled player makes every throughput number meaningless: the
    # first spike run reported 12 presented frames in 18s because the
    # video had advanced 3.85s in that time, not because the ring was
    # slow. Confirm real playback before measuring anything.
    for _ in range(40):
        a1 = tab.eval("(function(){var v=document.querySelector('video');return v.currentTime;})()")
        time.sleep(1.5)
        a2 = tab.eval("(function(){var v=document.querySelector('video');return v.currentTime;})()")
        if a1 and a2 and (a2 - a1) > 1.0:
            break
        tab.eval("(function(){var v=document.querySelector('video');v&&v.play();})()")
    else:
        raise SystemExit("SPIKE INVALID: player never reached real-time playback")

    probe = open(os.path.join(HERE, "probe.js"), encoding="utf-8").read()
    started = tab.eval(probe)

    time.sleep(seconds)

    after = tab.eval(
        "(function(){var v=document.querySelector('video');"
        "var s=window.__TS_DELAY||{};"
        "var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{};"
        "var ac=window.__TS_DELAY_AC;"
        "return JSON.stringify({"
        "t:v.currentTime,paused:v.paused,muted:v.muted,vol:v.volume,"
        "total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0,"
        "presented:s.presented||0,ringDrop:s.closedForSpace||0,"
        "ring:(s.ring||[]).length,lastMediaTime:s.lastPresentedMediaTime,"
        "encrypted:!!s.encrypted,useVideoFrame:!!s.useVideoFrame,"
        "refills:s.refills||0,lastFlush:s.lastFlush||null,"
        "audio:s.audio||null,acState:ac?ac.state:null,"
        "errors:(s.errors||[]).slice(0,5)});})()"
    )

    rect = tab.eval(
        "(function(){var v=document.querySelector('video');var r=v.getBoundingClientRect();"
        "return JSON.stringify({x:r.left,y:r.top,w:r.width,h:r.height});})()"
    )
    try:
        r = json.loads(rect)
        tab.clip_shot(os.path.join(HERE, "delayed.png"), r)
    except Exception as e:
        print("screenshot failed:", e)

    # Tear the probe down so the page is not left in a half-state if a
    # human looks at it. Audio cannot be undone -- that is the point of
    # using a throwaway page.
    tab.eval(
        "(function(){var c=document.getElementById('ts-delay-canvas');c&&c.remove();"
        "var v=document.querySelector('video');if(v)v.style.opacity='';"
        "return 1;})()"
    )

    out = {"video": video, "seconds": seconds, "started": started,
           "before": json.loads(before or "{}"), "after": json.loads(after or "{}")}
    with open(os.path.join(HERE, "result.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        raise SystemExit(__doc__)
    main(a[0], float(a[1]) if len(a) > 1 else 20.0)
