"""Does the shared-frame upload leak a tensor per verdict pass?

A leaked GPU tensor once per pass is far worse than the duplicate upload
the sharing removes, so this is the gate on that change: watch
tf.memory() across a minute of continuous playback and report the drift.
"""
import json, sys, time
from gauntlet import Tab, pick, open_platform

MEM = """
(function(){
  var m = window.__TS_GAZE_MEM && window.__TS_GAZE_MEM();
  if (!m) return null;
  var v = document.querySelector('video');
  return JSON.stringify({t: v ? +v.currentTime.toFixed(1) : -1,
                         numTensors: m.numTensors, numBytes: m.numBytes});
})()
"""

def main(gender, video, start, seconds):
    tab = open_platform(gender)
    tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % video)
    time.sleep(20)
    tab = pick("youtube.com")
    tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % start)
    time.sleep(5)
    rows = []
    end = time.time() + seconds
    while time.time() < end:
        r = tab.eval(MEM)
        if r:
            try: rows.append(json.loads(r))
            except Exception: pass
        time.sleep(2.0)
    if not rows:
        print(json.dumps({"error": "tf not reachable from page scope"}))
        return
    print(json.dumps({
        "samples": len(rows),
        "first": rows[0], "last": rows[-1],
        "tensor_drift": rows[-1]["numTensors"] - rows[0]["numTensors"],
        "bytes_drift": rows[-1]["numBytes"] - rows[0]["numBytes"],
        "max_tensors": max(r["numTensors"] for r in rows),
    }))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]))
