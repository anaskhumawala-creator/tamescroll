# PORTRAIT TAP-TO-RESTORE, WITH REAL INPUT EVENTS.
#
# The e510710 fix is about a click the BROWSER synthesizes ~35ms after a
# touchend, so a synthesized TouchEvent (probe_mini_yt.py) cannot see it
# at all -- it never produces that click. This drives CDP
# Input.dispatchTouchEvent, which does, and asserts what the owner sees:
# after a tap on the parked player, the player is FULL again.
#
# Portrait is FORCED, and asserted (vw < vh), because the bug only shows
# there -- in landscape the mini's centre sits inside the full player's
# rect, so the container wandering back under the finger still took the
# tap. `accelerometer_rotation` must go to 0 first or `user_rotation` is
# ignored and the arm labelled PORTRAIT measures landscape (2026-09-02,
# twice).
#
# AND A ROTATION THAT ACTUALLY CHANGES ORIENTATION RESTARTS THE APP
# (3b1e68c, found the same evening on the letterbox probe), which kills
# the CDP socket under any probe holding one. So every rotate() here
# happens BEFORE the watch page this run measures is navigated to: a
# restart then costs nothing, and the trials run on a page that was
# loaded in the orientation they are scored in. If a rotate is ever
# needed mid-run, re-read the devtools socket
# (webview_devtools_remote_<pid>) and re-forward first.
import json
import os
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
TRIALS = int(sys.argv[3]) if len(sys.argv) > 3 else 2

ADB = os.environ.get("ADB", os.path.expanduser("~") +
                     "/AppData/Local/Android/Sdk/platform-tools/adb.exe")
SERIAL = os.environ.get("SERIAL", "1ec2c48e0621")

STATE_JS = """(function(){
  var pc=document.getElementById('player-container-id');
  if(!pc) return null; var r=pc.getBoundingClientRect();
  return JSON.stringify({state: window.__TS_MINI_STATE||'full',
    x:Math.round(r.left), y:Math.round(r.top),
    w:Math.round(r.width), h:Math.round(r.height),
    cls: document.documentElement.className.indexOf('ts-mini')>=0,
    vw: innerWidth, vh: innerHeight,
    cover: document.getElementById('ts-mini-cover')?1:0,
    paused: (function(){var v=document.querySelector('#player-container-id video');
      return v?v.paused:null;})()});})()"""


def rotate(user_rotation):
    for args in (("settings", "put", "system", "accelerometer_rotation", "0"),
                 ("settings", "put", "system", "user_rotation", str(user_rotation))):
        subprocess.run([ADB, "-s", SERIAL, "shell"] + list(args),
                       capture_output=True, timeout=30)
    time.sleep(3)


def st(t):
    v = t.eval(STATE_JS)
    try:
        return json.loads(v)
    except Exception:
        return v


def touch(t, kind, x=None, y=None):
    pts = [] if kind == "touchEnd" else [
        {"x": x, "y": y, "radiusX": 12, "radiusY": 12, "force": 1}]
    t.cmd("Input.dispatchTouchEvent", type=kind, touchPoints=pts)


def trial(t):
    r = {}
    r["before"] = st(t)
    b = r["before"] or {}
    r["is_portrait"] = bool(b and b["vw"] < b["vh"])
    if b.get("state") != "full":
        t.eval("(function(){if(window.__TS_MINI__)window.__TS_MINI__.exit();return 1;})()")
        time.sleep(1.0)
        r["before"] = b = st(t)
    cx, cy = b["x"] + b["w"] // 2, b["y"] + b["h"] // 2
    touch(t, "touchStart", cx, cy)
    for d in (20, 60, 110, 160):
        time.sleep(0.05)
        touch(t, "touchMove", cx, cy + d)
    touch(t, "touchEnd")
    time.sleep(1.2)
    r["parked"] = m = st(t)
    if m and m.get("state") == "mini":
        tx, ty = m["x"] + m["w"] // 2, m["y"] + m["h"] // 2
        r["tap_at"] = [tx, ty]
        touch(t, "touchStart", tx, ty)
        time.sleep(0.06)
        touch(t, "touchEnd")
        time.sleep(0.15)
        r["t150"] = st(t)
        time.sleep(0.9)
        r["restored"] = st(t)
    rr = r.get("restored") or {}
    r["ok"] = bool(r["is_portrait"] and m and m.get("state") == "mini"
                   and rr.get("state") == "full" and rr.get("cls") is False)
    return r


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Input.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['watch_recs']}); return 1;})()""")
    time.sleep(7)
    rotate(0)
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
    time.sleep(28)
    rotate(0)
    out = {"ts": int(time.time()), "video": VID, "trials": []}
    for i in range(TRIALS):
        out["trials"].append(trial(t))
        time.sleep(1.5)
    out["verdict"] = ("PORTRAIT TAP RESTORES: %d of %d"
                      % (sum(1 for x in out["trials"] if x["ok"]), TRIALS))
    print("VERDICT", out["verdict"])
    name = "mini-restore-%d.json" % out["ts"]
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)
    for i, x in enumerate(out["trials"]):
        print(i, "portrait", x["is_portrait"], "parked",
              (x.get("parked") or {}).get("state"), (x.get("parked") or {}).get("w"),
              "-> restored", (x.get("restored") or {}).get("state"),
              (x.get("restored") or {}).get("w"))


main()
