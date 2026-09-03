"""heads_port_parity.py -- does the port-shaped decoder (box-restricted
search + separable exp) still match the full graph exactly?

Three arms against out/movenet-multipose.tflite on the frame bank:
  A  movenet_decode.decode                     (the literal graph)
  B  movenet_decode_port.decode(separable=False)  (box restriction only)
  C  movenet_decode_port.decode(separable=True)   (what Kotlin will do)
Also prints the box-area fraction, which is what the restriction buys.
"""
import os
import numpy as np
import tensorflow as tf
import movenet_decode as A
import movenet_decode_port as P

HERE = os.path.dirname(os.path.abspath(__file__))
frames = np.load(os.path.join(HERE, "frames.npy"))
full = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-multipose.tflite"), num_threads=4)
full.allocate_tensors()
fi, fo = full.get_input_details()[0], full.get_output_details()[0]
heads = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-heads.tflite"), num_threads=4)
heads.allocate_tensors()
hi = heads.get_input_details()[0]
hout = {d["name"].split(":")[-1]: d for d in heads.get_output_details()}
KEYS = ["center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset"]
ORDER = ["0", "1", "2", "3", "4", "5"]

arms = {"A literal": lambda h: A.decode(**h),
        "B box-restricted": lambda h: P.decode(**h, separable=False),
        "C box+separable": lambda h: P.decode(**h, separable=True)}
worst = {k: np.zeros(5) for k in arms}
mism = {k: 0 for k in arms}
areas = []
for img in frames:
    x = img[None].astype(np.int32)
    full.set_tensor(fi["index"], x); full.invoke()
    ref = full.get_tensor(fo["index"])[0].copy()
    heads.set_tensor(hi["index"], x); heads.invoke()
    h = {k: heads.get_tensor(hout[o]["index"]) for k, o in zip(KEYS, ORDER)}
    b = ref[:, 51:55]
    areas.extend(((b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])).tolist())
    for name, fn in arms.items():
        got = fn(h)[0]
        cur = np.array([np.abs(ref[:, 0:51:3] - got[:, 0:51:3]).max(),
                        np.abs(ref[:, 1:51:3] - got[:, 1:51:3]).max(),
                        np.abs(ref[:, 2:51:3] - got[:, 2:51:3]).max(),
                        np.abs(ref[:, 51:55] - got[:, 51:55]).max(),
                        np.abs(ref[:, 55] - got[:, 55]).max()])
        worst[name] = np.maximum(worst[name], cur)
        if list(ref[:, 55] > 0.2) != list(got[:, 55] > 0.2):
            mism[name] += 1

print(f"{len(frames)} frames, reference = out/movenet-multipose.tflite\n")
print("| arm | kp y | kp x | kp score | box | inst score | admitted-set mismatches |")
print("|---|---|---|---|---|---|---|")
for name in arms:
    w = worst[name]
    print(f"| {name} | {w[0]:.2e} | {w[1]:.2e} | {w[2]:.2e} | {w[3]:.2e} | {w[4]:.2e} | {mism[name]}/{len(frames)} |")
a = np.array(areas)
print(f"\nbox area as a fraction of the frame, all 6 slots x {len(frames)} frames: "
      f"p50 {np.percentile(a,50):.3f} p90 {np.percentile(a,90):.3f} mean {a.mean():.3f}")
