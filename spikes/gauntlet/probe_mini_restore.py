# THE RESTORE TRANSITION, IN RAW VIEWPORT PIXELS.
#
# probe_mini_land_live measured the mini->full restore twice and got the
# SAME shortfall both times -- 6.3673 video-heights, with the patch
# outside the video box for ~100ms. An identical float across independent
# runs is a deterministic geometry computation, not a timing race, so it
# is worth naming rather than tuning.
#
# The shrink is clean (worst 0.0035-0.0043 over 47 frames across two
# runs, 28 of them mid-drag) because `ts-mini-drag` kills the eased
# transition and the renderer follows the finger. The restore runs the
# transition eased, and video-region refreshes its cached rects on
# scroll, resize and each pass -- NOT on a transform. Loop 23 flagged
# exactly this and left it unmeasured.
#
# So this logs, per frame: the video rect, the host rect, the host's
# computed transform, and every patch rect, all in viewport pixels. No
# normalization, no derived score -- the numbers that say which rect the
# patch was positioned from.
import json, sys, time
from emu_cdp import page, Tab

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9226
VID = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = int(sys.argv[3]) if len(sys.argv) > 3 else 217

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
t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=" + VID)
time.sleep(34)
t.eval("(function(){var v=document.querySelector('video');"
       "if(v){v.currentTime=%d; v.play();} return 1;})()" % SEEK)


def patches():
    out = t.eval("(function(){return String("
                 "document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    return int(out) if isinstance(out, str) and out.strip().isdigit() else 0


def wait_patch(tries=24):
    for _ in range(tries):
        if patches():
            return True
        time.sleep(5)
    return False


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


COLLECT = """(function(){
  window.__TS_RS=[]; window.__TS_RS_STOP=0;
  function rect(e){ if(!e) return null; var r=e.getBoundingClientRect();
    return [Math.round(r.left*10)/10,Math.round(r.top*10)/10,
            Math.round(r.width*10)/10,Math.round(r.height*10)/10]; }
  (function s(){
    if(window.__TS_RS_STOP) return;
    try{
      var v=document.querySelector('#movie_player video')||document.querySelector('video');
      var host=document.querySelector('#movie_player');
      var cont=document.querySelector('#player-container-id');
      var ps=[].slice.call(document.querySelectorAll('.ts-gaze-vregion-host'));
      window.__TS_RS.push({
        ms:Math.round(performance.now()),
        mini:document.documentElement.classList.contains('ts-mini')?1:0,
        drag:document.documentElement.classList.contains('ts-mini-drag')?1:0,
        v:rect(v), host:rect(host), cont:rect(cont),
        tf:cont?getComputedStyle(cont).transform:null,
        // The renderer's own cached rects, which is the whole question.
        vt:(function(){ try{ var e=window.__TS_GAZE_VTRACKS&&window.__TS_GAZE_VTRACKS();
              return e&&e[0]?{hr:e[0].hr,vr:e[0].vr,scale:e[0].scale,
                              tracks:e[0].tracks}:null; }catch(x){ return null; } })(),
        p:ps.map(function(o){ return {r:rect(o),d:getComputedStyle(o).display}; })
      });
      if(window.__TS_RS.length>900) window.__TS_RS_STOP=1;
    }catch(e){}
    requestAnimationFrame(s);
  })();
  return 1;})()"""

if not wait_patch():
    print("NO_PATCH_BEFORE_SHRINK")
    sys.exit(0)

b = box()
print("BOX_BEFORE", json.dumps(b))
cx = b["x"] + b["w"] // 2
cy = b["y"] + b["h"] // 2
touch("touchStart", cx, cy)
for dy in (10, 25, 45, 70, 95, 120, 150):
    touch("touchMove", cx, cy + dy)
    time.sleep(0.045)
touch("touchEnd", cx, cy + 150)
time.sleep(3)
print("BOX_MINI", json.dumps(box()))

if not wait_patch(16):
    print("NO_PATCH_BEFORE_RESTORE")
    sys.exit(0)

t.eval(COLLECT)
b2 = box()
tx = b2["x"] + b2["w"] // 2
ty = b2["y"] + b2["h"] // 2
touch("touchStart", tx, ty)
time.sleep(0.05)
touch("touchEnd", tx, ty)
time.sleep(3.5)
raw = t.eval("(function(){window.__TS_RS_STOP=1; return JSON.stringify(window.__TS_RS||[]);})()")
rows = json.loads(raw) if isinstance(raw, str) else []
print("BOX_END", json.dumps(box()))
print("FRAMES", len(rows))
# Every frame where a patch is outside the video box it belongs to, plus
# the two frames either side, so the transition is readable.
bad = set()
for i, r in enumerate(rows):
    v = r.get("v")
    if not v:
        continue
    for pp in (r.get("p") or []):
        pr = pp.get("r")
        if not pr or pp.get("d") == "none":
            continue
        if pr[0] < v[0] - 4 or pr[1] < v[1] - 4 or \
           pr[0] + pr[2] > v[0] + v[2] + 4 or pr[1] + pr[3] > v[1] + v[3] + 4:
            for k in range(max(0, i - 2), min(len(rows), i + 3)):
                bad.add(k)
print("STRAY_FRAMES", len(bad))
for i in sorted(bad):
    print("  ", json.dumps(rows[i]))
