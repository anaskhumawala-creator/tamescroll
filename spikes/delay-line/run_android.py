"""Delay-line spike, Android runner (2026-09-02). Evidence only.

    python run_android.py <cdpPort> [secsPerConfig]

Assumes the app is already on a playing m.youtube watch page on the
device behind <cdpPort> (adb forward tcp:<port> localabstract:webview_devtools_remote_<pid>).
Runs each config in CONFIGS for `secs`, with a +5s seek at 40% and a
3s pause at 70%, then tears the probe down. Result -> result_android.json.
"""
import json, os, sys, time, statistics as st
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "gauntlet"))
from emu_cdp import page, Tab  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0

CONFIGS = [
    {"delayMs": 1500, "mode": "videoframe", "resize": None, "ringMax": 120},
    {"delayMs": 2500, "mode": "bitmap", "resize": None, "ringMax": 120},
    {"delayMs": 2500, "mode": "bitmap", "resize": [640, 360], "ringMax": 120},
]

Q = ("(function(){var v=document.querySelector('#movie_player video')||document.querySelector('video');"
     "var q=v.getVideoPlaybackQuality?v.getVideoPlaybackQuality():{};"
     "return JSON.stringify({t:v.currentTime,paused:v.paused,muted:v.muted,vw:v.videoWidth,vh:v.videoHeight,"
     "total:q.totalVideoFrames||0,dropped:q.droppedVideoFrames||0,rate:v.playbackRate});})()")


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


def summarize(d):
    o = {k: d.get(k) for k in ("cfg", "captured", "presented", "capFail", "closedForSpace", "rvfc", "refills", "flushes", "errors", "encrypted", "audio")}
    for k in ("capMs", "presMs", "skewMs", "ringLen"):
        xs = d.get(k) or []
        o[k] = {"n": len(xs), "p50": pct(xs, 0.5), "p95": pct(xs, 0.95), "max": max(xs) if xs else None}
    rms = d.get("rms") or []
    rs = d.get("rmsSrc") or []
    o["rmsOut"] = {"n": len(rms), "p50": pct(rms, 0.5), "nonzero": sum(1 for x in rms if x > 0.001)}
    o["rmsSrc"] = {"n": len(rs), "p50": pct(rs, 0.5), "nonzero": sum(1 for x in rs if x > 0.001)}
    o["rmsSeries"] = rms
    return o


def main():
    tab = Tab(page(port=PORT))
    tab.cmd("Runtime.enable")
    tab.cmd("Page.enable")
    probe = open(os.path.join(HERE, "probe_android.js"), encoding="utf-8").read()
    results = []
    for cfg in CONFIGS:
        tab.eval("(function(){var v=document.querySelector('video');if(v&&v.paused)v.play();return 1})()")
        for _ in range(20):
            a1 = tab.eval("(function(){return document.querySelector('video').currentTime})()")
            time.sleep(1.5)
            a2 = tab.eval("(function(){return document.querySelector('video').currentTime})()")
            if a1 and a2 and (a2 - a1) > 1.0:
                break
        else:
            raise SystemExit("SPIKE INVALID: player not advancing")
        before = json.loads(tab.eval(Q))
        # rAF sampler for the render loop cost.
        tab.eval("(function(){window.__TS_RAF={n:0,stop:false,t0:performance.now()};"
                 "(function r(){if(window.__TS_RAF.stop)return;window.__TS_RAF.n++;requestAnimationFrame(r);})();return 1})()")
        tab.eval("window.__TS_DELAY_CFG=%s;1" % json.dumps(cfg))
        started = tab.eval(probe)
        print("started", cfg, started)
        t0 = time.time()
        seeked = paused = False
        shot = None
        while time.time() - t0 < SECS:
            el = time.time() - t0
            if not shot and el > SECS * 0.25:
                r = json.loads(tab.eval("(function(){var r=document.querySelector('#movie_player').getBoundingClientRect();"
                                        "return JSON.stringify({x:r.left,y:r.top,w:r.width,h:r.height,s:devicePixelRatio})})()"))
                png = tab.cmd("Page.captureScreenshot", format="png",
                              clip={"x": r["x"], "y": r["y"], "width": r["w"], "height": r["h"], "scale": 1})
                shot = png.get("result", {}).get("data")
                if shot:
                    import base64
                    open(os.path.join(HERE, "android-%s-%s.png" % (cfg["mode"], "rs" if cfg["resize"] else "nat")), "wb").write(base64.b64decode(shot))
            if not seeked and el > SECS * 0.4:
                tab.eval("(function(){var v=document.querySelector('video');v.currentTime+=5;return 1})()")
                seeked = True
            if not paused and el > SECS * 0.7:
                tab.eval("(function(){document.querySelector('video').pause();return 1})()")
                time.sleep(3)
                # While paused: the delayed output must be silent and the canvas frozen.
                mid = json.loads(tab.eval("(function(){var s=window.__TS_DELAY;return JSON.stringify({presented:s.presented,rmsTail:s.rms.slice(-8),acState:window.__TS_DELAY_AC.state})})()"))
                tab.eval("(function(){document.querySelector('video').play();return 1})()")
                paused = True
                pausedInfo = mid
            time.sleep(1)
        raf = json.loads(tab.eval("(function(){var r=window.__TS_RAF;r.stop=true;return JSON.stringify({hz:Math.round(r.n/((performance.now()-r.t0)/1000)*10)/10})})()"))
        after = json.loads(tab.eval(Q))
        d = tab.eval("(function(){return JSON.stringify(window.__TS_DELAY_STOP())})()")
        d = json.loads(d)
        s = summarize(d)
        s["before"] = before
        s["after"] = after
        s["raf"] = raf
        s["paused"] = pausedInfo
        s["mediaAdvanced"] = round(after["t"] - before["t"], 2)
        s["wallSecs"] = SECS
        results.append(s)
        print(json.dumps({k: v for k, v in s.items() if k != "rmsSeries"}, indent=1))
        time.sleep(3)
    with open(os.path.join(HERE, "result_android.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=1)


if __name__ == "__main__":
    main()
