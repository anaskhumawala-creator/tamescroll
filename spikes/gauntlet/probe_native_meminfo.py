"""J11: process memory with the native engine ON versus the kill-switch
(NATIVE_INFER 0, same build, worker carrying the player).

    python probe_native_meminfo.py <cdpPort> <serial> [videoId] [seekTo]

Navigates twice (plant-native-off.js on the second), plays 60s each,
then reads `dumpsys meminfo` TOTAL PSS / RSS / Graphics / Native Heap.
Banks native-meminfo-<ts>.json.
"""
import json
import os
import re
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
SERIAL = sys.argv[2] if len(sys.argv) > 2 else "1ec2c48e0621"
VIDEO = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[4]) if len(sys.argv) > 4 else 217.0
ADB = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk", "platform-tools", "adb.exe")
PLANT = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "plant-native-off.js"), encoding="utf-8").read()


def meminfo():
    out = subprocess.run([ADB, "-s", SERIAL, "shell", "dumpsys", "meminfo", "app.tamescroll.client"], capture_output=True, text=True).stdout
    def grab(pat):
        m = re.search(pat, out)
        return int(m.group(1)) if m else None
    return {
        "totalPssKb": grab(r"TOTAL PSS:\s+(\d+)"),
        "totalRssKb": grab(r"TOTAL RSS:\s+(\d+)"),
        "graphicsKb": grab(r"Graphics:\s+(\d+)"),
        "nativeHeapKb": grab(r"Native Heap\s+(\d+)"),
        "javaHeapKb": grab(r"Java Heap:\s+(\d+)"),
    }


def arm(label, plant):
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    if plant:
        t.cmd("Page.addScriptToEvaluateOnNewDocument", source=plant)
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(22)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.muted=true; v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(60)
    st = t.eval("(function(){var l=(window.__TS_GAZE_IDS||{}).life||{}; var w=window.__TS_GAZE_WORKER||{}; return JSON.stringify({nativePasses:l.nativePasses||0, nativeReady:l.nativeReady||0, worker:w.backend||null, planted:!!window.__TS_PLANT_NATIVE_OFF});})()")
    st = json.loads(st) if isinstance(st, str) else st
    m = meminfo()
    m.update(st)
    print(label, json.dumps(m))
    return m


def main():
    out = {"nativeOn": arm("NATIVE ON ", None), "nativeOff": arm("NATIVE OFF", PLANT)}
    a, b = out["nativeOn"], out["nativeOff"]
    if a.get("totalPssKb") and b.get("totalPssKb"):
        out["deltaPssKb"] = a["totalPssKb"] - b["totalPssKb"]
        print("PSS native on - off: %+d KB (graphics %+d, native heap %+d)" % (
            out["deltaPssKb"], (a.get("graphicsKb") or 0) - (b.get("graphicsKb") or 0), (a.get("nativeHeapKb") or 0) - (b.get("nativeHeapKb") or 0)))
    name = "native-meminfo-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
