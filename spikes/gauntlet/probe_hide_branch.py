# WHICH BRANCH ACTUALLY HIDES THE PATCH.
#
# Loop 37d measured a covered subject with no visible patch for 84ms
# around a miniplayer restore, and then shipped a fix against
# `clipToBounds` returning null -- a branch that PROVABLY never fires for
# a real track (docs/technical-findings.md, 2026-09-01). Reverted in
# c8420ec. From outside the four ways a patch can vanish are
# indistinguishable, so this probe reads them apart:
#
#   rectsNoBoxes  host.getClientRects().length === 0  -> hr/vr nulled
#   hideNoVr      reposition saw vr null              -> hides EVERY overlay
#   hideZeroVr    vr present but 0x0                  -> hides EVERY overlay
#   hideClipped   clipToBounds returned null          -> hides ONE overlay
#
# All four count FRAMES, so a delta is a duration at the render cadence.
#
# COLLECTED IN PAGE at 50Hz. A CDP round trip here is ~1s and the gap is
# 84ms, so sampling from Python cannot see it at all.
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

# A run with nothing drawn measures nothing. Assert the patch exists
# before believing any number below it (loop 31 nearly recorded
# patchesMax 0 as a finding).
patches = 0
for _ in range(24):
    time.sleep(5)
    out = t.eval("(function(){return String(document.querySelectorAll('.ts-gaze-vregion-host').length);})()")
    patches = int(out) if isinstance(out, str) and out.strip().isdigit() else 0
    if patches:
        break
print("HOSTS_BEFORE", patches)
if not patches:
    print("ABORT no patch host -- nothing to measure"); sys.exit(0)

COLLECT = r"""(function(){
  window.__TS_HB = [];
  window.__TS_HB_STOP = 0;
  function ctr(){ try{ return window.__TS_GAZE_RENDER ? window.__TS_GAZE_RENDER() : null; }catch(e){ return null; } }
  function vis(){
    // A display:none overlay is still in the DOM. Counting it is the
    // instrument defect that invented a 6.3673 shortfall twice.
    var n=0, els=document.querySelectorAll('.ts-gaze-vregion-clip > *');
    for(var i=0;i<els.length;i++){
      var r=els[i].getBoundingClientRect();
      if(r.width>0 && r.height>0 && getComputedStyle(els[i]).display!=='none') n++;
    }
    return n;
  }
  function sample(){
    if(window.__TS_HB_STOP) return;
    try{
      var c=ctr();
      // __TS_GAZE_VTRACKS returns an ARRAY OF ENTRIES, each with its own
      // .tracks. Reading .tracks off the array reads undefined and every
      // sample looks track-free -- which is exactly what the first run of
      // this probe did (withTrack 0 over 3,496 samples).
      var vt=0; try{ var es=window.__TS_GAZE_VTRACKS?window.__TS_GAZE_VTRACKS():[];
        for(var q=0;q<es.length;q++) vt += (es[q].tracks||[]).length; }catch(e){}
      var v=document.querySelector('#movie_player video')||document.querySelector('video');
      var vr=v?v.getBoundingClientRect():null;
      window.__TS_HB.push({
        ms: Math.round(performance.now()),
        mini: document.documentElement.classList.contains('ts-mini')?1:0,
        drag: document.documentElement.classList.contains('ts-mini-drag')?1:0,
        vw: vr?Math.round(vr.width):-1, vh: vr?Math.round(vr.height):-1,
        vt: vt, vis: vis(),
        raf: c?c.raf:-1,
        noVr: c?c.hideNoVr:-1, zeroVr: c?c.hideZeroVr:-1,
        clipped: c?c.hideClipped:-1, noBoxes: c?c.rectsNoBoxes:-1
      });
      // Read from Python so a gesture can be fired the moment somebody
      // is actually covered. A gesture window with no blurred track
      // measures nothing at all.
      window.__TS_HB_VT = vt;
      if (window.__TS_HB.length > 20000) window.__TS_HB.shift();
      // THE ONLY QUESTION THAT MATTERS ON A GAP FRAME: was the video
      // PAINTING? video-region hides every overlay when the host
      // generates no client rects, and that is CORRECT if the host
      // paints no pixels -- there is nothing under the patch to reveal.
      // So a gap frame is an EXPOSURE only if the picture was on screen.
      // Captured only on gap frames; a per-frame deep read would change
      // what it measures.
      if (vt > 0 && !window.__TS_HB_DEEP_STOP) {
        var n=0, els=document.querySelectorAll('.ts-gaze-vregion-clip > *');
        for(var z=0;z<els.length;z++){ var rz=els[z].getBoundingClientRect();
          if(rz.width>0 && rz.height>0 && getComputedStyle(els[z]).display!=='none') n++; }
        if (n === 0) {
          window.__TS_HB_DEEP = window.__TS_HB_DEEP || [];
          if (window.__TS_HB_DEEP.length < 400) {
            var pcE=document.getElementById('player-container-id');
            var mpE=document.getElementById('movie_player');
            var hostE=document.querySelector('.ts-gaze-vregion-host');
            var cs=v?getComputedStyle(v):null;
            var pcs=pcE?getComputedStyle(pcE):null;
            window.__TS_HB_DEEP.push({
              ms: Math.round(performance.now()),
              vDisp: cs?cs.display:null, vVis: cs?cs.visibility:null,
              vOpa: cs?cs.opacity:null,
              vOW: v?v.offsetWidth:-1, vOH: v?v.offsetHeight:-1,
              vBoxes: (v&&v.getClientRects)?v.getClientRects().length:-1,
              vPaused: v?(v.paused?1:0):-1, vT: v?Math.round(v.currentTime*100)/100:-1,
              vRS: v?v.readyState:-1,
              vParent: v&&v.parentElement?(v.parentElement.id||v.parentElement.className||'?'):null,
              pcBoxes: (pcE&&pcE.getClientRects)?pcE.getClientRects().length:-1,
              pcW: pcE?Math.round(pcE.getBoundingClientRect().width):-1,
              pcH: pcE?Math.round(pcE.getBoundingClientRect().height):-1,
              pcDisp: pcs?pcs.display:null, pcPos: pcs?pcs.position:null,
              mpW: mpE?Math.round(mpE.getBoundingClientRect().width):-1,
              hostId: hostE?(hostE.id||hostE.className):null,
              hostBoxes: (hostE&&hostE.getClientRects)?hostE.getClientRects().length:-1,
              hostW: hostE?Math.round(hostE.getBoundingClientRect().width):-1,
              nVideos: document.querySelectorAll('video').length,
              mini: document.documentElement.classList.contains('ts-mini')?1:0
            });
          }
        }
      }
    }catch(e){}
    // rAF, NOT setTimeout(20). A timer is starved during the gesture --
    // the previous run took THREE samples in an 800ms restore window,
    // which cannot see an 84ms gap. rAF is also the exact cadence the
    // renderer runs at, so one sample per rendered frame is the right
    // resolution for a question about rendered frames.
    requestAnimationFrame(sample);
  }
  sample(); return 1;
})()"""
t.eval(COLLECT)


def rect_of(sel):
    out = t.eval("(function(){var e=document.querySelector(%s); if(!e) return '';"
                 "var r=e.getBoundingClientRect(); return [r.left,r.top,r.width,r.height].join(',');})()" % json.dumps(sel))
    if not isinstance(out, str) or ',' not in out:
        return None
    return [float(x) for x in out.split(',')]


def touch(kind, x, y):
    tp = [] if kind == "touchEnd" else [{"x": x, "y": y, "radiusX": 6, "radiusY": 6, "force": 1}]
    t.cmd("Input.dispatchTouchEvent", type=kind, touchPoints=tp)


def drag(x0, y0, x1, y1, steps=14):
    touch("touchStart", x0, y0)
    for i in range(1, steps + 1):
        touch("touchMove", x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        time.sleep(0.02)
    touch("touchEnd", x1, y1)


time.sleep(4)
pc = rect_of('#player-container-id')
if not pc:
    print("ABORT no player container"); sys.exit(0)
cx, cy = pc[0] + pc[2] / 2, pc[1] + pc[3] / 2

marks = []


def mark(label):
    out = t.eval("(function(){return String(Math.round(performance.now()));})()")
    marks.append([label, int(out) if isinstance(out, str) and out.strip().isdigit() else -1])


def wait_covered(limit=120):
    # THE GESTURE IS WORTHLESS WITHOUT A COVERED SUBJECT. An earlier run
    # fired all six gestures in windows with withTrack 0, so every number
    # under them was vacuous in the honest direction.
    for _ in range(limit):
        out = t.eval("(function(){return String(window.__TS_HB_VT||0);})()")
        if isinstance(out, str) and out.strip().isdigit() and int(out) > 0:
            return int(out)
        time.sleep(1)
    return 0


def dump():
    # ONE GESTURE PAIR PER DUMP. Accumulating a whole run at rAF cadence
    # builds a multi-megabyte JSON payload and the CDP websocket times
    # out mid-run -- which is what killed the previous attempt, and from
    # outside it reads exactly like the emulator wedging.
    raw = t.eval("(function(){var a=window.__TS_HB||[]; window.__TS_HB=[]; return JSON.stringify(a);})()")
    return json.loads(raw) if isinstance(raw, str) and raw.strip().startswith('[') else []


def dump_deep():
    raw = t.eval("(function(){var a=window.__TS_HB_DEEP||[]; window.__TS_HB_DEEP=[]; return JSON.stringify(a);})()")
    return json.loads(raw) if isinstance(raw, str) and raw.strip().startswith('[') else []


def delta(k, contiguous=True):
    # A filtered subsequence is NOT contiguous, so differencing across the
    # hole charges the state with increments from outside it -- which is
    # why an earlier run reported DELTA_mini and DELTA_full both equal to
    # DELTA_ALL.
    tot = {"noVr": 0, "zeroVr": 0, "clipped": 0, "noBoxes": 0}
    for i in range(1, len(k)):
        if contiguous and k[i]['ms'] - k[i - 1]['ms'] > 120:
            continue
        for f in tot:
            d = k[i].get(f, -1) - k[i - 1].get(f, -1)
            if d > 0:
                tot[f] += d
    return tot


def edges(S, field, frm, to):
    # THE WINDOW IS FOUND IN THE SAMPLES, NOT FROM A MARK. A mark costs a
    # CDP round trip (~1s) and the touch after it costs two more, so a
    # window anchored on the mark can end before the gesture lands.
    return [S[i]['ms'] for i in range(1, len(S))
            if S[i - 1].get(field) == frm and S[i].get(field) == to]


def report(tag, S):
    if not S:
        print("EMPTY " + tag); return
    gaps = [x for x in S if x.get('vt', 0) > 0 and x.get('vis', 0) == 0]
    print(tag, json.dumps({
        "samples": len(S), "spanMs": S[-1]['ms'] - S[0]['ms'],
        "hz": round(1000.0 * len(S) / max(1, S[-1]['ms'] - S[0]['ms']), 1),
        "withTrack": len([x for x in S if x.get('vt', 0) > 0]),
        "gapSamples": len(gaps), "d": delta(S)}))
    for label, es in [("restore", edges(S, 'mini', 1, 0)), ("park", edges(S, 'mini', 0, 1))]:
        for k, ms in enumerate(es):
            w = [x for x in S if ms - 100 <= x['ms'] <= ms + 700]
            g = [x for x in w if x.get('vt', 0) > 0 and x.get('vis', 0) == 0]
            print("  %s %s%d" % (tag, label, k), json.dumps({
                "atMs": ms, "n": len(w), "withTrack": len([x for x in w if x.get('vt', 0) > 0]),
                "gap": len(g), "gapMs": (g[-1]['ms'] - g[0]['ms'] + 16) if g else 0,
                "d": delta(w), "vw": sorted(set(x['vw'] for x in w))}))
    if gaps:
        print("  " + tag + " GAP_SAMPLE", json.dumps(gaps[:6]))


for k in range(3):
    cov = wait_covered()
    print("COVERED_BEFORE %d" % k, cov, flush=True)
    if not cov:
        print("SKIP %d -- nothing covered" % k, flush=True); continue
    dump()  # discard the wait
    drag(cx, cy, cx, cy + 220)
    time.sleep(2.0)
    st = t.eval("(function(){return document.documentElement.classList.contains('ts-mini')?'1':'0';})()")
    if st != '1':
        drag(cx, cy, cx, cy + 240)
        time.sleep(2.0)
        st = t.eval("(function(){return document.documentElement.classList.contains('ts-mini')?'1':'0';})()")
    print("MINI %d" % k, st, flush=True)
    m = rect_of('#player-container-id')
    if m:
        touch("touchStart", m[0] + m[2] / 2, m[1] + m[3] / 2)
        touch("touchEnd", m[0] + m[2] / 2, m[1] + m[3] / 2)
    time.sleep(3.0)
    report("PAIR%d" % k, dump())
    deep = dump_deep()
    print("  DEEP%d n=%d" % (k, len(deep)))
    for row in deep[:6]:
        print("    ", json.dumps(row))

t.eval("(function(){window.__TS_HB_STOP=1; return 1;})()")
