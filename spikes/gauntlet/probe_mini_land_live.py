# THE ONE GAP LOOP 23 LEFT OPEN, AND IT IS PRIORITY 1's NEIGHBOURHOOD:
# patch geometry DURING the miniplayer shrink, with the video PLAYING.
#
# Loop 23 measured containment through a shrink on a PAUSED frame (worst
# normalized error 0.025) and wrote "NOT VERIFIED: patch geometry DURING
# the shrink animation" for the live case. That is the exact moment
# rects go stale: the host is transforming, the subject is moving, and
# the renderer's cached rects are refreshed on scroll/resize and on each
# pass -- not on a transform. A stale rect on a shrinking host draws the
# patch in the wrong place ON the video, which from outside is
# indistinguishable from his "the blur is over the video".
#
# COLLECTED IN PAGE. A CDP round trip here is ~1s and the landing
# transition is 220ms, so sampling from Python measures the endpoints
# and nothing in between -- the failure mode that made an earlier render
# probe report coverage 0.0 on a page that had a patch.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 217

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable"); t.cmd("Input.enable")
t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(6)
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(7)
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID); time.sleep(34)
t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%d; v.play();} return 1;})()" % SEEK)

# Wait for the pipeline to actually mint a patch. A landing probe run on
# a player with nothing drawn measures nothing at all, which is how loop
# 31 nearly recorded patchesMax 0 as a finding.
patches = 0
for _ in range(24):
    time.sleep(5)
    out = t.eval("(function(){return String(document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    patches = int(out) if isinstance(out, str) and out.strip().isdigit() else 0
    if patches:
        break
print("PATCHES_BEFORE", patches)

COLLECT = """(function(){
  window.__TS_LAND = [];
  window.__TS_LAND_STOP = 0;
  function sample(){
    if (window.__TS_LAND_STOP) return;
    try{
      var v=document.querySelector('#movie_player video')||document.querySelector('video');
      if(v){
        var vr=v.getBoundingClientRect();
        if(vr.width>0){
          // A `display:none` overlay is still in the DOM and still in
          // entry.tracks -- video-region sets it when the clip falls
          // entirely outside the picture. Its rect is 0x0 at the origin,
          // and normalizing THAT against a parked video at (169,697)
          // 231x130 produces d[3] = -5.3615 and a "shortfall" of
          // 1.0058 + 5.3615 = 6.3673. That number was reported twice as
          // a restore defect and it is this line, not the renderer.
          var drawn=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host'))
            .filter(function(o){
              if(getComputedStyle(o).display==='none') return false;
              var r=o.getBoundingClientRect();
              return r.width>0 && r.height>0;
            }).map(function(o){
            var r=o.getBoundingClientRect();
            return [(r.left-vr.left)/vr.width,(r.top-vr.top)/vr.height,
                    (r.left-vr.left+r.width)/vr.width,(r.top-vr.top+r.height)/vr.height];});
          var tracks=[];
          try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
            if(e&&e.length) e.forEach(function(en){ (en.tracks||[]).forEach(function(b){
              tracks.push([+b[0],+b[1],+b[2],+b[3]]);});});
          }catch(err){}
          // Worst SHORTFALL of the best-containing patch, in units of the
          // video box. Positive = the track sticks out of every patch =
          // exposure. Patches merge, so a track may be covered by a union.
          var worst=0, out=0;
          tracks.forEach(function(tb){
            var best=Infinity;
            drawn.forEach(function(d){
              var s=Math.max(d[0]-tb[0], d[1]-tb[1], tb[2]-d[2], tb[3]-d[3]);
              if(s<best) best=s;});
            if(best===Infinity) best=1;
            if(best>0) out++;
            if(best>worst) worst=best;});
          // And the other half of the same question: is any patch drawn
          // OUTSIDE the video box it belongs to.
          var stray=0;
          drawn.forEach(function(d){
            if(d[0]<-0.02||d[1]<-0.02||d[2]>1.02||d[3]>1.02) stray++;});
          window.__TS_LAND.push({
            ms:Math.round(performance.now()),
            mini:document.documentElement.classList.contains('ts-mini')?1:0,
            drag:document.documentElement.classList.contains('ts-mini-drag')?1:0,
            n:drawn.length, tr:tracks.length,
            worst:+worst.toFixed(4), out:out, stray:stray,
            vw:Math.round(vr.width), vh:Math.round(vr.height),
            paused:v.paused?1:0
          });
          if(window.__TS_LAND.length>1200) window.__TS_LAND_STOP=1;
        }
      }
    }catch(e){}
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
  return 1;})()"""


def touch(kind, x, y):
    pts = [] if kind == "touchEnd" else [{"x": x, "y": y, "radiusX": 8, "radiusY": 8, "force": 1}]
    t.cmd("Input.dispatchTouchEvent", type=kind, touchPoints=pts)


def box():
    out = t.eval("""(function(){var c=document.querySelector('#player-container-id');
      if(!c) return 'null'; var r=c.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),
        w:Math.round(r.width),h:Math.round(r.height),
        mini:document.documentElement.classList.contains('ts-mini')?1:0});})()""")
    return json.loads(out) if isinstance(out, str) and out != 'null' else None


t.eval(COLLECT)
b = box()
print("BOX_BEFORE", json.dumps(b))
cx = b["x"] + b["w"] // 2
cy = b["y"] + b["h"] // 2
# A real drag: past CLAIM_PX 16 and past the 103px commit threshold.
# ASSERT THE STATE THE ARM IS ABOUT TO MEASURE. One run's drag never
# committed (framesMini 0, sizes only [[412,232]]) and every number in
# it described a full player -- a vacuous run that reads exactly like a
# clean one. Retry the gesture until the player is actually parked.
for attempt in range(3):
    b = box()
    cx = b["x"] + b["w"] // 2
    cy = b["y"] + b["h"] // 2
    touch("touchStart", cx, cy)
    for dy in (10, 25, 45, 70, 95, 120, 150):
        touch("touchMove", cx, cy + dy)
        time.sleep(0.045)
    touch("touchEnd", cx, cy + 150)
    time.sleep(2.5)
    if (box() or {}).get("mini"):
        break
    print("DRAG_DID_NOT_COMMIT attempt", attempt)
    t.eval("(function(){var a=window.__TS_LAND||[]; window.__TS_LAND=[]; return 1;})()")
land = t.eval("(function(){var a=window.__TS_LAND||[]; window.__TS_LAND=[]; return JSON.stringify(a);})()")
land = json.loads(land) if isinstance(land, str) else []
print("BOX_AFTER", json.dumps(box()))


def summarize(label, rows):
    rows = [r for r in rows if r["tr"] > 0]
    if not rows:
        print(label, "NO_TRACKS frames=0")
        return
    worst = max(r["worst"] for r in rows)
    print(label, json.dumps({
        "frames": len(rows),
        "framesMidDrag": sum(1 for r in rows if r["drag"]),
        "framesMini": sum(1 for r in rows if r["mini"]),
        # A live track with NO VISIBLE patch is not a shortfall, it is
        # nothing drawn at all -- and `worst` folds it into the same
        # column via the Infinity sentinel. Counted apart: this is the
        # exposure question, the other is a geometry question.
        "framesTrackNoPatch": sum(1 for r in rows if r["n"] == 0),
        "msTrackNoPatch": (lambda z: (max(z) - min(z)) if len(z) > 1 else 0)(
            [r["ms"] for r in rows if r["n"] == 0]),
        "worstShortfall": worst,
        "framesUnderCovered": sum(1 for r in rows if r["out"]),
        "strayFrames": sum(1 for r in rows if r["stray"]),
        "playingFrames": sum(1 for r in rows if not r["paused"]),
        "sizes": sorted(set((r["vw"], r["vh"]) for r in rows))[:6],
    }))


summarize("SHRINK", land)

# And back: a tap on the mini body restores. The reverse transition has
# the same stale-rect exposure and nobody has sampled it live either.
# A restore arm with no track on screen measures nothing -- the first
# run of this probe read a 6.37 shortfall and the second read
# NO_TRACKS, which is the difference between a finding and a coin
# toss. Wait for the mini player to actually be covering somebody.
for _ in range(16):
    out = t.eval("(function(){return String(document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    if isinstance(out, str) and out.strip().isdigit() and int(out) > 0:
        break
    time.sleep(5)
print("PATCHES_BEFORE_RESTORE", out)
t.eval(COLLECT)
b2 = box()
if b2 and b2["mini"]:
    tx = b2["x"] + b2["w"] // 2
    ty = b2["y"] + b2["h"] // 2
    touch("touchStart", tx, ty)
    time.sleep(0.05)
    touch("touchEnd", tx, ty)
time.sleep(2.5)
land2 = t.eval("(function(){var a=window.__TS_LAND||[]; window.__TS_LAND_STOP=1; return JSON.stringify(a);})()")
land2 = json.loads(land2) if isinstance(land2, str) else []
summarize("RESTORE", land2)
# The rows themselves. A summary that reports a shortfall of 6.37 video
# widths without showing the frames is a number nobody can check -- and
# this repo has recorded four probe artifacts that looked exactly like a
# regression.
bad = sorted([r for r in land2 if r["tr"] > 0], key=lambda r: -r["worst"])[:8]
print("RESTORE_WORST", json.dumps(bad))
print("RESTORE_ALL", json.dumps([r for r in land2 if r["tr"] > 0][:24]))
print("BOX_END", json.dumps(box()))
