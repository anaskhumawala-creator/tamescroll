"""Probe a candidate video: title, duration, and truth-only frames at N offsets.

Cheap window-finder for the rotation. Does NOT score anything: it exists
so a round lands its 10-frame capture on footage that actually contains
people, instead of on a title slate.
"""
import json, os, sys, time
import gauntlet as G

vid = sys.argv[1]
offs = [int(x) for x in sys.argv[2].split(",")]
out = sys.argv[3]
os.makedirs(out, exist_ok=True)
tab = G.pick("youtube.com")
tab.eval("location.href='https://www.youtube.com/watch?v=%s'" % vid)
time.sleep(14)
tab = G.pick("youtube.com")
info = tab.eval("(function(){var v=document.querySelector('video');"
  "return JSON.stringify({d:v?v.duration:0,title:document.title});})()")
print(info)
for o in offs:
    tab.eval("(function(){var v=document.querySelector('video');v.currentTime=%d;v.play();})()" % o)
    time.sleep(2.5)
    tab.eval("(function(){var v=document.querySelector('video');v.pause();})()")
    time.sleep(0.4)
    p = tab.eval(G.PROBE)
    if not p or not p.get("rect", {}).get("w"):
        print(o, "no rect"); continue
    tab.eval("(function(){var h=document.querySelector('#movie_player');"
      "if(h)h.querySelectorAll('.ts-gaze-vregion-host').forEach(function(e){e.style.visibility='hidden';});})()")
    time.sleep(0.25)
    tab.clip_shot(os.path.join(out, "p%04d.png" % o), p["rect"])
    tab.eval("(function(){var h=document.querySelector('#movie_player');"
      "if(h)h.querySelectorAll('.ts-gaze-vregion-host').forEach(function(e){e.style.visibility='';});})()")
    print(o, "t=%s persons=%s patches=%d" % (p.get("t"), p.get("persons"), len(p.get("patches") or [])))
    tab.eval("(function(){var v=document.querySelector('video');v.play();})()")
