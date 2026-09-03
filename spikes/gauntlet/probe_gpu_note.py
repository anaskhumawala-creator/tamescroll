"""1101 GPU-arbiter smoke: does this device land on the GPU, and does the
report now SAY WHY.

    python probe_gpu_note.py <cdpPort> [secs]

Short on purpose (~40s): the two questions are answered the moment the
engine posts ready, not by watching a video for a minute. On the old
Redmi (listed device) the expected read is backend gpu x3 with
`gpu.listed` true, `tried` true and `ran` FALSE -- a listed device must
still take the fast load path and never pay for a trial. On a device the
compatibility list has never heard of, `listed` is false and `ran`/`won`
carry the measurement. Banks gpu-note-<ts>.json.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0
VIDEO = sys.argv[3] if len(sys.argv) > 3 else "NWoT1ZVd1Lo"

READ = """(function(){
  try {
    var r = window.__TS_DIAG_NOW ? window.__TS_DIAG_NOW() : null;
    if (typeof r === 'string') r = JSON.parse(r);
    if (!r) return JSON.stringify({err: 'no report'});
    return JSON.stringify({
      versionCode: r.app && r.app.versionCode,
      native: r.native,
      bundle: window.__TS_GAZE_BUNDLE__,
      nativeState: window.__TS_GAZE_NATIVE || null
    });
  } catch (e) { return JSON.stringify({err: String(e)}); }
})()"""


def main():
    t = Tab(page(port=PORT))
    t.cmd("Page.enable")
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="http://tauri.localhost/")
    time.sleep(5)
    t.eval("""(async function(){
      var inv=(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||
              (window.__TAURI__&&window.__TAURI__.invoke);
      await inv('open_platform',{id:'youtube',mode:'smart',strength:24,gender:'man',
                                 shown:['home','watch_recs']}); return 1;})()""")
    time.sleep(5)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    t.cmd("Page.navigate", url="https://m.youtube.com/watch?v=%s" % VIDEO)
    time.sleep(SECS)
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    raw = t.eval(READ)
    out = json.loads(raw) if isinstance(raw, str) else (raw or {})
    print(json.dumps(out, indent=1))
    n = out.get("native") or {}
    models = n.get("models") or {}
    backs = [(k, (v or {}).get("nativeBackend")) for k, v in models.items()]
    notes = {k: (v or {}).get("gpu") for k, v in models.items()}
    print("BACKENDS", backs)
    print("GPU NOTES", json.dumps(notes))
    name = "gpu-note-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump(out, f, indent=1)
    print("banked", name)


if __name__ == "__main__":
    main()
