# CLAIM A ON THE REAL DEVICE: does a fresh watch-page load, and a seek,
# cover the WHOLE canvas with blur(24px) while the delay ring refills,
# and for how many milliseconds? Council review of delay-presenter.mjs
# (COVER_FILTER applied whenever refillState==='refilling') and
# delay-core.mjs (DELAY_MS+500ms of frames needed before a pick can
# succeed) inferred ~2000ms from source. This measures it on the old
# Redmi (1ec2c48e0621) instead of trusting that inference.
#
# Honest instrument, v2: a MutationObserver on the canvas's `style`
# attribute, which fires on EVERY set (even a same-task set-then-clear
# that a per-rAF poll can alias away), plus 'seeking'/'seeked' listeners
# on the real video element so the cover window is measured from the
# actual DOM event, not a probe-side guess at when the seek "started".
# v1 (rAF poll) reported zero cover on a seek and that was not trusted
# on its own -- this is the instrument that checks it.
#
# Usage: python probe_cover_real.py [DELAY_MS override or "default"]
import json, os, subprocess, sys, time
from emu_cdp import page, Tab

ADB = os.environ.get("ANDROID_HOME", "") + "/platform-tools/adb.exe"
DEV = "1ec2c48e0621"
PORT = 9241
VID = "NWoT1ZVd1Lo"
DELAY_ARG = sys.argv[1] if len(sys.argv) > 1 else "default"
OUT_TAG = "default" if DELAY_ARG == "default" else "d%s" % DELAY_ARG


def sh(*a):
    e = dict(os.environ); e["MSYS2_ARG_CONV_EXCL"] = "*"
    return subprocess.run([ADB, "-s", DEV] + list(a), capture_output=True, text=True, env=e).stdout.strip()


def forward():
    pid = sh("shell", "pidof", "app.tamescroll.client")
    sh("forward", "--remove", "tcp:%d" % PORT)
    sh("forward", "tcp:%d" % PORT, "localabstract:webview_devtools_remote_%s" % pid)
    return pid


sh("shell", "am", "force-stop", "app.tamescroll.client")
time.sleep(3)
sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
time.sleep(7)
forward()

t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")

if DELAY_ARG != "default":
    override = {"DELAY_MS": int(DELAY_ARG)}
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source="""(function(){
  var override=%s, cur=JSON.stringify(override);
  Object.defineProperty(window,'__TS_GAZE_TUNING__',{
    configurable:true,
    get:function(){return cur;},
    set:function(v){
      var base={};
      try{ base=typeof v==='string'?JSON.parse(v):(v||{}); }catch(e){}
      for(var k in override) base[k]=override[k];
      cur=JSON.stringify(base);
    }});
})();""" % json.dumps(override))

# Re-armed on every new document. Polls for the canvas/video (they don't
# exist at document start), then wires a MutationObserver on style
# (catches every set, no frame-aliasing) and 'seeking'/'seeked' listeners
# on the real video (ground truth for when a discontinuity fired).
SAMPLER = """(function(){
  window.__TS_COVERPROBE = {out: [], t0: performance.now(), wired:false};
  var st = window.__TS_COVERPROBE;
  function log(o){ o.t = Math.round(performance.now()-st.t0); st.out.push(o); if (st.out.length>8000) st.out.shift(); }
  function wire(){
    if (st.wired) return;
    var el = document.querySelector('canvas.ts-gaze-delay');
    var v = document.querySelector('#movie_player video') || document.querySelector('video');
    if (!el || !v) return;
    st.wired = true;
    log({wire:1, initialFilter: el.style.filter || ''});
    new MutationObserver(function(muts){
      muts.forEach(function(){ log({f: el.style.filter || ''}); });
    }).observe(el, {attributes:true, attributeFilter:['style']});
    v.addEventListener('seeking', function(){ log({ev:'seeking', ct: Math.round(v.currentTime*1000)}); });
    v.addEventListener('seeked', function(){ log({ev:'seeked', ct: Math.round(v.currentTime*1000)}); });
    v.addEventListener('waiting', function(){ log({ev:'waiting'}); });
    v.addEventListener('playing', function(){ log({ev:'playing'}); });
  }
  var iv = setInterval(function(){ wire(); if (st.wired) clearInterval(iv); }, 50);
  window.__TS_COVER_SEEK = function(deltaSec){
    var v = document.querySelector('#movie_player video') || document.querySelector('video');
    log({cmdSeek:1, from: v ? Math.round(v.currentTime*1000) : null});
    if (v) v.currentTime = v.currentTime + deltaSec;
  };
})();"""
t.cmd("Page.addScriptToEvaluateOnNewDocument", source=SAMPLER)

t.cmd("Page.navigate", url="http://tauri.localhost/"); time.sleep(7)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")
t.eval("""(async function(){
  var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
          (window.__TAURI__&&window.__TAURI__.invoke);
  await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                             shown:['watch_recs']}); return 1;})()""")
time.sleep(3)

t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VID)
time.sleep(16)  # let it settle: attach, play, ring fill, cover clear (or not)
t = Tab(page(port=PORT)); t.cmd("Page.enable"); t.cmd("Runtime.enable")


def read_ring():
    raw = t.eval("JSON.stringify((window.__TS_COVERPROBE&&window.__TS_COVERPROBE.out)||[])")
    try:
        return json.loads(raw) if isinstance(raw, str) else []
    except Exception:
        return []


def blur_intervals(rows):
    out = []
    run_start = None
    for r in rows:
        if "f" not in r:
            continue
        blurred = "blur" in (r.get("f") or "")
        if blurred and run_start is None:
            run_start = r["t"]
        elif not blurred and run_start is not None:
            out.append({"start": run_start, "end": r["t"], "durationMs": r["t"] - run_start, "open": False})
            run_start = None
    if run_start is not None and rows:
        last_t = rows[-1]["t"]
        out.append({"start": run_start, "end": last_t, "durationMs": last_t - run_start, "open": True})
    return out


def summarize(rows):
    wire = next((r for r in rows if r.get("wire")), None)
    events = [r for r in rows if r.get("ev")]
    return {"wiredAt": wire["t"] if wire else None,
            "initialFilter": wire.get("initialFilter") if wire else None,
            "events": events, "blurIntervals": blur_intervals(rows), "rows": len(rows)}


rows_cold = read_ring()
cold = summarize(rows_cold)
print("COLD LOAD (%s)  %s" % (OUT_TAG, json.dumps(cold)))

scratch = os.environ.get("TS_SCRATCH", "C:/Users/zvcla/AppData/Local/Temp/claude_scratch")
os.makedirs(scratch, exist_ok=True)
shot = t.cmd("Page.captureScreenshot", format="png")
png_b64 = shot.get("result", {}).get("data")
if png_b64:
    import base64
    with open(os.path.join(scratch, "cover_cold_%s.png" % OUT_TAG), "wb") as f:
        f.write(base64.b64decode(png_b64))

# Reset the ring (re-wire immediately since canvas/video already exist),
# let playback settle a moment, then SEEK via the in-page helper (no
# separate round trip between marker and command) and watch what follows.
t.eval("""(function(){
  window.__TS_COVERPROBE = {out: [], t0: performance.now(), wired:false};
  var st = window.__TS_COVERPROBE;
  function log(o){ o.t = Math.round(performance.now()-st.t0); st.out.push(o); if (st.out.length>8000) st.out.shift(); }
  var el = document.querySelector('canvas.ts-gaze-delay');
  var v = document.querySelector('#movie_player video') || document.querySelector('video');
  if (el && v) {
    st.wired = true;
    log({wire:1, initialFilter: el.style.filter || ''});
    new MutationObserver(function(muts){ muts.forEach(function(){ log({f: el.style.filter || ''}); }); })
      .observe(el, {attributes:true, attributeFilter:['style']});
    v.addEventListener('seeking', function(){ log({ev:'seeking', ct: Math.round(v.currentTime*1000)}); });
    v.addEventListener('seeked', function(){ log({ev:'seeked', ct: Math.round(v.currentTime*1000)}); });
    v.addEventListener('waiting', function(){ log({ev:'waiting'}); });
    v.addEventListener('playing', function(){ log({ev:'playing'}); });
  }
})();""")
time.sleep(2)
t.eval("window.__TS_COVER_SEEK(45)")
time.sleep(9)
rows_seek = read_ring()
seek = summarize(rows_seek)
print("SEEK (%s)  %s" % (OUT_TAG, json.dumps(seek)))

shot2 = t.cmd("Page.captureScreenshot", format="png")
png_b64_2 = shot2.get("result", {}).get("data")
if png_b64_2:
    import base64
    with open(os.path.join(scratch, "cover_seek_%s.png" % OUT_TAG), "wb") as f:
        f.write(base64.b64decode(png_b64_2))

out = {"tag": OUT_TAG, "cold": cold, "seek": seek}
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cover-%s.json" % OUT_TAG), "w"))
print("DONE", json.dumps(out))
