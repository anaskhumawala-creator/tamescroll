"""Native inference, Task 3c: bank the 256x256 MoveNet input off the device.

    python probe_native_framedump.py <cdpPort> [t1,t2,...]

On the current watch page, per timestamp (paused, seeked): the same
frame squashed to 256 two ways -- the plain canvas drawImage (what
native-client drawTo did before 2026-09-02 16:30) and the shifted
source-rect draw that reproduces tf.image.resizeBilinear (what it does
now) -- as base64 raw RGBA. spikes/native/arbiter.{py,mjs} run the
banked MoveNet on both offline (TFLite CPU, tfjs CPU) so the three
device runtimes (tfjs WebGL, TFLite GPU fp16, TFLite GPU fp32) can be
judged against a reference that is not one of them.
Banks native-frames-<ts>.json. Nothing renders on the owner's desktop.
"""
import json
import sys
import time

from emu_cdp import Tab, page

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 9227
TS = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [60, 217, 300]

JS = r"""(function(){ return (async function(){
  var v = document.querySelector('video'); if (!v) return {err:'no video'};
  var W = v.videoWidth, H = v.videoHeight, N = 256;
  var bmp = await createImageBitmap(v);
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  var c = document.createElement('canvas'); c.width = N; c.height = N; var cx = c.getContext('2d');
  cx.drawImage(bmp, 0, 0, N, N); var plain = cx.getImageData(0, 0, N, N).data;
  cx.clearRect(0, 0, N, N); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'low';
  var kx = W / N, ky = H / N;
  cx.drawImage(bmp, -(kx - 1) / 2, -(ky - 1) / 2, W, H, 0, 0, N, N); var shifted = cx.getImageData(0, 0, N, N).data;
  bmp.close();
  return {t: v.currentTime, W: W, H: H, N: N, plain: b64(new Uint8Array(plain.buffer)), shifted: b64(new Uint8Array(shifted.buffer))};
})(); })()"""


def main():
    t = Tab(page(port=PORT))
    t.cmd("Runtime.enable")
    frames = []
    for ts in TS:
        t.eval("(function(){var v=document.querySelector('video'); if(v){v.pause(); v.currentTime=%f;} return 1;})()" % ts)
        time.sleep(2.5)
        r = t.cmd("Runtime.evaluate", expression=JS, awaitPromise=True, returnByValue=True)
        val = ((r.get("result") or {}).get("result") or {}).get("value")
        if not isinstance(val, dict) or val.get("err"):
            print("t=%s ERR %s" % (ts, val))
            continue
        print("t=%.1f %dx%d dumped" % (val["t"], val["W"], val["H"]))
        val["target"] = ts
        frames.append(val)
    name = "native-frames-%d.json" % int(time.time())
    with open(name, "w") as f:
        json.dump({"port": PORT, "frames": frames}, f)
    print("banked", name)


if __name__ == "__main__":
    main()
