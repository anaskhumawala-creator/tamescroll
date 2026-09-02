"""Native inference, Task 6: fullscreen, miniplayer and a seek with the
native engine carrying the player.

    python probe_native_task6.py <cdpPort> [videoId] [seekTo]

Each arm reads, over a fixed window, the same three things: verdict
passes (stage ring growth -- the native path keeps ANSWERING), visible
video patches (something is covered), and the native counters
(nativeDead 0, nativeErrors flat, nativePasses rising). Arms:
  WINDOWED   control on the same span
  FULLSCREEN real click on YouTube's own button (Input.dispatchMouseEvent;
             the button is asserted hittable at click time -- the mobile
             player autohides its controls in under a second, loop 18)
  AFTER EXIT windowed again
  MINI       drag-to-mini via the 1046 gesture (touch, 140px down), then
             tap the mini body to restore
  SEEK       a 300s jump: tracks wipe + immediate pass; the engine must
             answer on the new shot
Banks native-task6-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[3]) if len(sys.argv) > 3 else 217.0

READ_JS = """(function(){
  var ids = window.__TS_GAZE_IDS || {};
  var life = ids.life || {};
  var st = ids.stages || [];
  var fresh = 0;
  for (var i = 0; i < st.length; i++) { if (st[i] && !st[i].__seen) { st[i].__seen = 1; fresh++; } }
  var visible = 0;
  var nodes = document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for (var j = 0; j < nodes.length; j++) {
    var cs = getComputedStyle(nodes[j]); var r = nodes[j].getBoundingClientRect();
    if (cs.display !== 'none' && r.width > 1 && r.height > 1) visible++;
  }
  var v = document.querySelector('#movie_player video');
  var pc = document.querySelector('#player-container-id');
  var pr = pc ? pc.getBoundingClientRect() : null;
  return JSON.stringify({
    freshPasses: fresh, visiblePatches: visible,
    nativePasses: life.nativePasses || 0, nativeErrors: life.nativeErrors || 0, nativeDead: life.nativeDead || 0,
    fs: !!(document.fullscreenElement || document.webkitFullscreenElement),
    mini: document.documentElement.classList.contains('ts-mini'),
    box: pr ? [pr.x | 0, pr.top | 0, pr.width | 0, pr.height | 0] : null,
    vp: [innerWidth, innerHeight],
    t: v ? Math.round(v.currentTime) : null, paused: v ? v.paused : null
  });
})()"""


def read(t):
    r = t.eval(READ_JS)
    return json.loads(r) if isinstance(r, str) else (r or {})


def sweep(t, label, secs=24.0, gap=2.0):
    rows = []
    t0 = time.time()
    while time.time() - t0 < secs:
        rows.append(read(t))
        time.sleep(gap)
    passes = sum(r.get("freshPasses", 0) for r in rows)
    covered = sum(1 for r in rows if r.get("visiblePatches", 0) > 0)
    a, b = rows[0], rows[-1]
    summ = {
        "label": label, "samples": len(rows), "passes": passes, "samplesWithPatch": covered,
        "nativePassesDelta": b["nativePasses"] - a["nativePasses"], "nativeErrorsDelta": b["nativeErrors"] - a["nativeErrors"],
        "nativeDead": b["nativeDead"], "fs": b["fs"], "mini": b["mini"], "box": b["box"], "vp": b["vp"],
        "t": [a["t"], b["t"]], "paused": b["paused"],
    }
    print("%-11s samples %2d passes %3d covered %2d/%-2d native +%d err +%d dead %d fs %s mini %s box %s vp %s t %s->%s" % (
        label, summ["samples"], passes, covered, len(rows), summ["nativePassesDelta"], summ["nativeErrorsDelta"],
        summ["nativeDead"], b["fs"], b["mini"], b["box"], b["vp"], a["t"], b["t"]))
    return summ


def reveal_fs_btn(t, tries=6):
    for _ in range(tries):
        b = t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
        t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": b[0] + b[2] // 2, "y": b[1] + 40}])
        t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
        time.sleep(0.3)
        r = t.eval("""(function(){var e=document.querySelector('.fullscreen-icon'); if(!e) return null;
          var q=e.getBoundingClientRect(); var x=Math.round(q.left+q.width/2), y=Math.round(q.top+q.height/2);
          var h=document.elementFromPoint(x,y);
          return {x:x,y:y,hittable:!!(h&&h.closest&&h.closest('.fullscreen-icon'))};})()""")
        if r and r.get("hittable"):
            return r
        time.sleep(1.0)
    return None


def drag(t, x, y, dy, steps=6):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": x, "y": y}])
    time.sleep(0.05)
    for i in range(1, steps + 1):
        t.cmd("Input.dispatchTouchEvent", type="touchMove", touchPoints=[{"x": x, "y": y + int(dy * i / steps)}])
        time.sleep(0.04)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.4)


def tap(t, x, y):
    t.cmd("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": x, "y": y}])
    time.sleep(0.05)
    t.cmd("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.4)


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Input.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(22)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.cmd("Input.enable")
    t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.muted=true; v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(8)
    arms = {}
    arms["windowed"] = sweep(t, "WINDOWED")

    btn = reveal_fs_btn(t)
    if btn:
        t.cmd("Input.dispatchMouseEvent", type="mousePressed", x=btn["x"], y=btn["y"], button="left", clickCount=1)
        t.cmd("Input.dispatchMouseEvent", type="mouseReleased", x=btn["x"], y=btn["y"], button="left", clickCount=1)
        time.sleep(2.0)
        arms["fullscreen"] = sweep(t, "FULLSCREEN")
        t.eval("(function(){try{(document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}return 1})()")
        time.sleep(2.5)
        arms["afterExit"] = sweep(t, "AFTER EXIT", secs=16)
    else:
        print("fullscreen button not reachable this run")
        arms["fullscreen"] = None

    b = t.eval("(function(){var r=document.querySelector('#player-container-id').getBoundingClientRect();return [r.x|0,r.top|0,r.width|0,r.height|0]})()")
    cx, cy = b[0] + b[2] // 2, b[1] + b[3] // 2
    drag(t, cx, cy, 140)
    st = read(t)
    print("after drag: mini %s box %s" % (st["mini"], st["box"]))
    arms["mini"] = sweep(t, "MINI", secs=20)
    mb = arms["mini"]["box"]
    if arms["mini"]["mini"] and mb:
        tap(t, mb[0] + mb[2] // 2, mb[1] + mb[3] // 2)
        st = read(t)
        print("after tap: mini %s box %s" % (st["mini"], st["box"]))
    arms["restored"] = sweep(t, "RESTORED", secs=12)

    t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.currentTime=v.currentTime+300; v.play();} return 1;})()")
    time.sleep(1.0)
    arms["seek"] = sweep(t, "SEEK+300", secs=20)

    ok = []
    bad = []
    for k, a in arms.items():
        if not a:
            continue
        if a["nativeDead"] or a["nativeErrorsDelta"] > 0 or a["passes"] == 0 or a["nativePassesDelta"] == 0:
            bad.append("%s: passes %d native +%d err +%d dead %d" % (k, a["passes"], a["nativePassesDelta"], a["nativeErrorsDelta"], a["nativeDead"]))
        else:
            ok.append(k)
    fs_ok = bool(arms.get("fullscreen")) and arms["fullscreen"]["fs"]
    mini_ok = arms["mini"]["mini"]
    verdict = ("NATIVE ANSWERED IN EVERY ARM (%s); fullscreen entered %s; mini entered %s" % (", ".join(ok), fs_ok, mini_ok)) if not bad else "FAILED: " + "; ".join(bad)
    print("VERDICT", verdict)
    out = {"port": PORT, "video": VIDEO, "seek": SEEK, "arms": arms, "verdict": verdict}
    name = "native-task6-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
