"""Delay presenter, letterboxed player: does the PRESENTED picture land on
the video rect when the player is wider than the video?

    python probe_delay_letterbox.py <cdpPort> [videoId] [seekTo]

Rotates the Redmi to landscape (user_rotation 1 with auto-rotate off), so
m.youtube lays the sticky player out across the full width and the
16:9 video letterboxes inside it -- measured 2026-09-02: video
[85,48,652,367] inside a player [0,48,823,367]. The delay canvas is
`inset:0; width/height:100%` of that player, so without `object-fit:
contain` it stretched a 16:9 frame to 2.24:1 and every patch, which is
positioned against the VIDEO rect, landed beside the face it was drawn
for. Reads, in landscape then back in portrait:
  - the video rect, the canvas box, the canvas's intrinsic size and its
    computed object-fit, and the PAINTED rect derived from them,
  - paintedEqualsVideo (every edge within 2px),
  - that patches are inside the player (they are positioned off the
    video rect, so the only question is the picture).
Restores portrait lock at the end. Banks delay-letterbox-<ts>.json.
Nothing renders on the owner's desktop.
"""
import json
import os
import subprocess
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[3]) if len(sys.argv) > 3 else 217.0
SERIAL = os.environ.get("TS_SERIAL", "1ec2c48e0621")
ADB = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk", "platform-tools", "adb.exe")

GEOM_JS = """(function(){
  var v=document.querySelector('#movie_player video')||document.querySelector('video');
  var c=document.querySelector('.ts-gaze-delay');
  if(!v) return JSON.stringify({video:null});
  var vr=v.getBoundingClientRect();
  var cr=c?c.getBoundingClientRect():null;
  var painted=null, fit=null;
  if(c && cr && c.width && c.height){
    fit=getComputedStyle(c).objectFit;
    if(fit==='contain'){
      var k=Math.min(cr.width/c.width, cr.height/c.height);
      var pw=c.width*k, ph=c.height*k;
      painted=[Math.round(cr.left+(cr.width-pw)/2),Math.round(cr.top+(cr.height-ph)/2),Math.round(pw),Math.round(ph)];
    } else painted=[Math.round(cr.left),Math.round(cr.top),Math.round(cr.width),Math.round(cr.height)];
  }
  var vv=[Math.round(vr.left),Math.round(vr.top),Math.round(vr.width),Math.round(vr.height)];
  var ok=null;
  if(painted){ ok=true; for(var i=0;i<4;i++) if(Math.abs(painted[i]-vv[i])>2) ok=false; }
  var pl=document.querySelector('#movie_player'); var pr=pl?pl.getBoundingClientRect():null;
  var outside=0, patches=0;
  var nodes=document.querySelectorAll('.ts-gaze-vregion-clip > *');
  for(var j=0;j<nodes.length;j++){ var cs=getComputedStyle(nodes[j]); if(cs.display==='none') continue;
    var r=nodes[j].getBoundingClientRect(); if(r.width<1||r.height<1) continue; patches++;
    if(pr && (r.left<pr.left-1||r.right>pr.right+1||r.top<pr.top-1||r.bottom>pr.bottom+1)) outside++; }
  return JSON.stringify({vp:[innerWidth,innerHeight], orientation:screen.orientation?screen.orientation.type:null,
    video:vv, canvas:cr?[Math.round(cr.left),Math.round(cr.top),Math.round(cr.width),Math.round(cr.height)]:null,
    intrinsic:c?[c.width,c.height]:null, objectFit:fit, painted:painted, paintedEqualsVideo:ok,
    player:pr?[Math.round(pr.left),Math.round(pr.top),Math.round(pr.width),Math.round(pr.height)]:null,
    patches:patches, patchesOutsidePlayer:outside,
    t:Math.round(v.currentTime), paused:v.paused});
})()"""


def adb(*args):
    return subprocess.run([ADB, "-s", SERIAL, "shell"] + list(args), capture_output=True, text=True).stdout.strip()


def rotate(user_rotation):
    adb("settings", "put", "system", "accelerometer_rotation", "0")
    adb("settings", "put", "system", "user_rotation", str(user_rotation))
    time.sleep(3)


def read(t):
    r = t.eval(GEOM_JS)
    return json.loads(r) if isinstance(r, str) else (r or {})


def arm(t, label, secs=14.0):
    rows = []
    t0 = time.time()
    while time.time() - t0 < secs:
        rows.append(read(t))
        time.sleep(2.0)
    last = rows[-1]
    eq = [r.get("paintedEqualsVideo") for r in rows]
    # BANK EVERY SAMPLE, and the worst edge error. Keeping only `last`
    # made a failing arm unreadable: the 2026-09-02 landscape run
    # printed painted == video exactly and `paintedEqualsVideoAll`
    # false, with nothing in the file saying which of the 7 samples
    # disagreed or by how much -- a verdict nobody can act on. A miss
    # while the rotation is still settling and a miss in the steady
    # state are different findings.
    worst = None
    for i, r in enumerate(rows):
        v, pn = r.get("video"), r.get("painted")
        if not v or not pn:
            continue
        d = max(abs(pn[k] - v[k]) for k in range(4))
        if worst is None or d > worst[1]:
            worst = (i, d, v, pn)
    summ = {
        "label": label, "samples": len(rows), "last": last, "rows": rows,
        "paintedEqualsVideoAll": all(x is True for x in eq), "samplesWithCanvas": sum(1 for r in rows if r.get("canvas")),
        "eqPerSample": eq,
        "worstEdgePx": (worst[1] if worst else None),
        "worstSampleIndex": (worst[0] if worst else None),
        "worstSample": ({"video": worst[2], "painted": worst[3]} if worst else None),
        "patchesOutsidePlayerMax": max(r.get("patchesOutsidePlayer", 0) for r in rows),
        "patchesMax": max(r.get("patches", 0) for r in rows),
    }
    print("%-10s eqPerSample %s worst edge %s px at sample %s" % (
        label, "".join("T" if x is True else ("-" if x is None else "F") for x in eq),
        summ["worstEdgePx"], summ["worstSampleIndex"]))
    print("%-10s vp %s %s video %s canvas %s fit %s painted %s eq %s patches<=%d outside %d" % (
        label, last.get("vp"), last.get("orientation"), last.get("video"), last.get("canvas"), last.get("objectFit"),
        last.get("painted"), summ["paintedEqualsVideoAll"], summ["patchesMax"], summ["patchesOutsidePlayerMax"]))
    return summ


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(22)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('#movie_player video'); if(v){v.muted=true; v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(8)
    arms = {}
    # FORCE portrait for the first arm: on a phone left rotated, the arm
    # labelled PORTRAIT re-measured landscape twice on 2026-09-02.
    rotate(0)
    time.sleep(3)
    arms["portrait"] = arm(t, "PORTRAIT")
    rotate(1)
    time.sleep(3)
    arms["landscape"] = arm(t, "LANDSCAPE")
    rotate(0)
    time.sleep(3)
    arms["portrait2"] = arm(t, "PORTRAIT2")
    ok = all(a["samplesWithCanvas"] > 0 and a["paintedEqualsVideoAll"] and a["patchesOutsidePlayerMax"] == 0 for a in arms.values())
    wider = (arms["landscape"]["last"].get("canvas") or [0, 0, 0])[2] > (arms["landscape"]["last"].get("video") or [0, 0, 0])[2] + 2
    verdict = ("PAINTED RECT == VIDEO RECT in every arm (landscape player wider than video: %s)" % wider) if ok else \
        "FAILED: " + "; ".join("%s eq %s canvas %d outside %d" % (k, a["paintedEqualsVideoAll"], a["samplesWithCanvas"], a["patchesOutsidePlayerMax"]) for k, a in arms.items())
    print("VERDICT", verdict)
    out = {"port": PORT, "video": VIDEO, "seek": SEEK, "arms": arms, "verdict": verdict}
    name = "delay-letterbox-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
