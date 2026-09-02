"""Frame-transport bench on the OLD Redmi (1ec2c48e0621, Snapdragon 662,
Android 12, WebView Chrome 151) for the native-inference plan: how much
does it cost to move one decoded video frame from the page to Kotlin,
for two transports --

  (a) a JS bridge taking a base64 string   -- TsFrameBench.postBase64
  (b) a WebMessagePort taking a raw ArrayBuffer -- window.__tsFramePort

The Kotlin half (MainActivity.kt, BuildConfig.DEBUG-only) decodes/copies
the bytes and keeps a 200-sample ring per transport, exposing
TsFrameBench.stats() as JSON. This probe drives the app through its REAL
path (launcher -> open_platform -> watch page, same recipe as
probe_latency_ab.py / probe_phone_cold2.py), runs three frame-size/format
variants, and banks both the Kotlin-side stats and the page-side
per-stage timings (createImageBitmap / drawImage+getImageData / base64
encode) plus rAF Hz (idle control vs bench-active).

    python probe_frame_bridge.py [secsPerVariant] [videoId] [seek]

Banks to spikes/native/bridge-<label>.json (label = timestamp).
"""
import json, os, subprocess, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from emu_cdp import page, Tab  # noqa: E402

ADB = os.environ.get("ANDROID_HOME", "") + "/platform-tools/adb.exe"
DEV = "1ec2c48e0621"
PORT = 9227
SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 20.0
VIDEO = sys.argv[2] if len(sys.argv) > 2 else "NWoT1ZVd1Lo"
SEEK = float(sys.argv[3]) if len(sys.argv) > 3 else 40.0
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "native")
os.makedirs(OUT_DIR, exist_ok=True)
LABEL = time.strftime("%Y%m%d-%H%M%S")


def sh(*a):
    e = dict(os.environ)
    e["MSYS2_ARG_CONV_EXCL"] = "*"
    r = subprocess.run([ADB, "-s", DEV] + list(a), capture_output=True, text=True, env=e)
    return r.stdout.strip()


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round((len(xs) - 1) * p)))]


PORT_LISTENER_JS = """(function(){
  window.addEventListener('message', function(e){
    if (e.data === 'ts-frame-port' && e.ports && e.ports[0]) {
      window.__tsFramePort = e.ports[0];
      window.__tsFramePort.start();
    }
  });
  return 1;
})()"""

RAF_HZ_JS = """(function(){
  return new Promise(function(resolve){
    var n = 0, t0 = performance.now();
    function raf(){
      n++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(raf);
      else resolve(n / ((performance.now() - t0) / 1000));
    }
    requestAnimationFrame(raf);
  });
})()"""


def BENCH_JS(w, h, mode):
    return """(function(){
  var video = document.querySelector('video');
  if (!video) return 'no-video';
  window.__TSFB = {createMs:[], drawMs:[], encMs:[], sent:0, portSent:0, err:0};
  window.__TSFB_running = true;
  var W = %d, H = %d, MODE = '%s';
  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d', {willReadFrequently:true});

  function b64(bytes){
    var CHUNK = 0x8000, s = '';
    for (var i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
    }
    return btoa(s);
  }

  async function tick(){
    if (!window.__TSFB_running) return;
    var t0 = performance.now();
    try {
      var bmp = await createImageBitmap(video);
      var t1 = performance.now();
      ctx.drawImage(bmp, 0, 0, W, H);
      if (bmp.close) bmp.close();
      var imgData = ctx.getImageData(0, 0, W, H);
      var t2 = performance.now();
      var bytes;
      if (MODE === 'rgb') {
        var rgba = imgData.data, n = W * H;
        bytes = new Uint8Array(n * 3);
        for (var i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
          bytes[j] = rgba[i]; bytes[j+1] = rgba[i+1]; bytes[j+2] = rgba[i+2];
        }
      } else {
        bytes = imgData.data;
      }
      var s = b64(bytes);
      var t3 = performance.now();
      var tSentB64 = Date.now();
      if (window.TsFrameBench) window.TsFrameBench.postBase64(s, W, H, tSentB64);
      window.__TSFB.createMs.push(t1 - t0);
      window.__TSFB.drawMs.push(t2 - t1);
      window.__TSFB.encMs.push(t3 - t2);
      window.__TSFB.sent++;
      if (window.__tsFramePort) {
        var buf = new ArrayBuffer(8 + bytes.length);
        var dv = new DataView(buf);
        dv.setFloat64(0, Date.now(), false);
        new Uint8Array(buf, 8).set(bytes);
        window.__tsFramePort.postMessage(buf, [buf]);
        window.__TSFB.portSent++;
      }
    } catch (e) {
      window.__TSFB.err++;
    }
    setTimeout(tick, 250);
  }
  tick();
  return 'started:' + W + 'x' + H + ':' + MODE;
})()""" % (w, h, mode)


STOP_JS = "(function(){ window.__TSFB_running = false; return JSON.stringify(window.__TSFB || {}); })()"


def run_variant(t, label, w, h, mode, secs):
    # Isolate this variant's Kotlin-side samples from the previous
    # variant's -- decode-ms scales with byte count, so a cumulative
    # ring across three different frame sizes would blend three
    # distinct populations into one misleading p50/p95.
    t.eval("(function(){ if (window.TsFrameBench) window.TsFrameBench.reset(); return 1; })()")
    started = t.eval(BENCH_JS(w, h, mode))
    print("  bench start:", started)
    if not isinstance(started, str) or not started.startswith("started"):
        return {"label": label, "error": started}
    # rAF Hz while the bench is actively running (sampled partway through).
    time.sleep(max(0.5, secs * 0.3))
    raf_active = t.eval(RAF_HZ_JS)
    time.sleep(max(0.0, secs - secs * 0.3 - 3.0))
    page_stats_raw = t.eval(STOP_JS)
    page_stats = json.loads(page_stats_raw) if isinstance(page_stats_raw, str) else (page_stats_raw or {})
    kotlin_stats_raw = t.eval("(function(){ return window.TsFrameBench ? window.TsFrameBench.stats() : '{}'; })()")
    kotlin_stats = json.loads(kotlin_stats_raw) if isinstance(kotlin_stats_raw, str) else (kotlin_stats_raw or {})
    return {
        "label": label, "w": w, "h": h, "mode": mode, "secs": secs,
        "rafHzActive": raf_active,
        "pageSent": page_stats.get("sent"), "pagePortSent": page_stats.get("portSent"),
        "pageErr": page_stats.get("err"),
        "createBitmapMsP50": pct(page_stats.get("createMs", []), 0.5),
        "createBitmapMsP95": pct(page_stats.get("createMs", []), 0.95),
        "drawGetImageDataMsP50": pct(page_stats.get("drawMs", []), 0.5),
        "drawGetImageDataMsP95": pct(page_stats.get("drawMs", []), 0.95),
        "base64EncodeMsP50": pct(page_stats.get("encMs", []), 0.5),
        "base64EncodeMsP95": pct(page_stats.get("encMs", []), 0.95),
        "kotlin": kotlin_stats,
    }


def main():
    sh("shell", "am", "force-stop", "app.tamescroll.client")
    time.sleep(2)
    sh("shell", "am", "start", "-n", "app.tamescroll.client/.MainActivity")
    time.sleep(8)
    pid = sh("shell", "pidof", "app.tamescroll.client")
    print("pid", pid)
    sh("forward", "--remove", "tcp:%d" % PORT)
    sh("forward", "tcp:%d" % PORT, "localabstract:webview_devtools_remote_%s" % pid)

    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    # Registered once, on this CDP connection, BEFORE any navigation --
    # Page.addScriptToEvaluateOnNewDocument runs ahead of every page
    # script on every subsequent document (incl. the m.youtube.com nav),
    # so the 'message' listener exists before Kotlin's onPageFinished
    # ever posts the port -- a plain postMessage with no listener yet
    # registered would otherwise just be lost.
    t.cmd("Page.addScriptToEvaluateOnNewDocument", source=PORT_LISTENER_JS)

    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(6)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(6)

    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(22)

    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.eval("(function(){var v=document.querySelector('video'); if(v){v.currentTime=%f; v.play();} return 1;})()" % SEEK)
    time.sleep(3)

    pre = t.eval("""(function(){
      var v = document.querySelector('video');
      return JSON.stringify({
        video: v ? {paused: v.paused, t: v.currentTime, w: v.videoWidth, h: v.videoHeight} : null,
        hasBridge: !!window.TsFrameBench,
        portSupported: window.TsFrameBench ? window.TsFrameBench.portSupported() : null,
        portArrived: !!window.__tsFramePort,
      });
    })()""")
    print("pre", pre)

    # rAF idle control -- nothing of ours running, video already playing.
    raf_idle = t.eval(RAF_HZ_JS)
    print("rAF idle (control):", raf_idle)

    results = []
    for (label, w, h, mode) in [
        ("256x256-rgba", 256, 256, "rgba"),
        ("128x128-rgba", 128, 128, "rgba"),
        ("256x256-rgb", 256, 256, "rgb"),
    ]:
        print("variant", label)
        r = run_variant(t, label, w, h, mode, SECS)
        r["portArrivedBeforeVariant"] = json.loads(pre).get("portArrived") if isinstance(pre, str) else None
        results.append(r)
        print(json.dumps(r, indent=None)[:600])

    port_stats_final = t.eval("(function(){ return window.TsFrameBench ? window.TsFrameBench.stats() : '{}'; })()")

    out = {
        "label": LABEL, "device": DEV, "video": VIDEO, "seek": SEEK, "secsPerVariant": SECS,
        "pre": json.loads(pre) if isinstance(pre, str) else pre,
        "rafHzIdleControl": raf_idle,
        "variants": results,
        "finalKotlinStats": json.loads(port_stats_final) if isinstance(port_stats_final, str) else port_stats_final,
    }
    out_path = os.path.join(OUT_DIR, "bridge-%s.json" % LABEL)
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print("banked ->", out_path)

    sh("shell", "am", "force-stop", "app.tamescroll.client")
    print("done")


if __name__ == "__main__":
    main()
