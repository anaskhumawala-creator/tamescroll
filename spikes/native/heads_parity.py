"""heads_parity.py -- out/movenet-multipose.tflite (full graph)
vs out/movenet-heads.tflite + movenet_decode.decode, on the corpus bank.

Run: venv/Scripts/python extract_frames.py   (writes frames.npy)
     venv/Scripts/python heads_parity.py [heads.tflite] [full.tflite]

Reports max abs diff per FIELD (keypoint y, keypoint x, keypoint score,
box coords, instance score) and, because a coordinate diff is not what
the app cares about, the number of frames where the ADMITTED SET differs
-- admitted meaning slot score over a threshold, at the three the shipped
person-gate uses (PERSON_LOW_SCORE 0.12, the brief's 0.2, and
PERSON_MIN_SCORE 0.35).
"""
import json, os, sys, time
import numpy as np
import tensorflow as tf

import movenet_decode

HERE = os.path.dirname(os.path.abspath(__file__))
HEADS = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "out", "movenet-heads.tflite")
FULL = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out", "movenet-multipose.tflite")

frames = np.load(os.path.join(HERE, "frames.npy"))
index = json.load(open(os.path.join(HERE, "frames-index.json")))
print(f"{HEADS}\n{FULL}\nframes {frames.shape}")

full = tf.lite.Interpreter(model_path=FULL, num_threads=4)
full.allocate_tensors()
fin = full.get_input_details()[0]
fout = full.get_output_details()[0]

heads = tf.lite.Interpreter(model_path=HEADS, num_threads=4)
heads.allocate_tensors()
hin = heads.get_input_details()[0]
# Map each head output by its channel count; the two 34s and the two 2s
# are told apart by their signature-key order (PartitionedCall:N), which
# is the SAME order convert.py lists them in.
hout = {d["name"].split(":")[-1]: d for d in heads.get_output_details()}
ORDER = ["0", "1", "2", "3", "4", "5"]  # center, kpt_heat, regress, offset, scale, offset
KEYS = ["center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset"]
for k, o in zip(KEYS, ORDER):
    print(f"  head {k:12s} <- PartitionedCall:{o} {list(hout[o]['shape'])}")

N = len(frames)
dk_y = dk_x = dk_s = dbox = dsc = 0.0
set_diff = {0.12: 0, 0.2: 0, 0.35: 0}
order_diff = 0
worst = None
t_head = t_dec = t_full = 0.0
for i in range(N):
    img = frames[i][None].astype(np.int32)

    t0 = time.perf_counter()
    full.set_tensor(fin["index"], img)
    full.invoke()
    ref = full.get_tensor(fout["index"]).copy()
    t1 = time.perf_counter()

    heads.set_tensor(hin["index"], img)
    heads.invoke()
    hs = {k: heads.get_tensor(hout[o]["index"]) for k, o in zip(KEYS, ORDER)}
    t2 = time.perf_counter()
    got = movenet_decode.decode(**hs)
    t3 = time.perf_counter()
    t_full += t1 - t0
    t_head += t2 - t1
    t_dec += t3 - t2

    a, b = ref[0], got[0]
    ky = np.abs(a[:, 0:51:3] - b[:, 0:51:3]).max()
    kx = np.abs(a[:, 1:51:3] - b[:, 1:51:3]).max()
    ks = np.abs(a[:, 2:51:3] - b[:, 2:51:3]).max()
    bx = np.abs(a[:, 51:55] - b[:, 51:55]).max()
    sc = np.abs(a[:, 55] - b[:, 55]).max()
    dk_y, dk_x, dk_s = max(dk_y, ky), max(dk_x, kx), max(dk_s, ks)
    if bx > dbox:
        dbox = bx
    if sc > dsc:
        dsc = sc
        worst = (i, index[i], float(sc), a[:, 55].tolist(), b[:, 55].tolist())
    for th in set_diff:
        if list(a[:, 55] > th) != list(b[:, 55] > th):
            set_diff[th] += 1
    # slot ORDER: top-k is score-sorted, so a swap would reorder people
    if np.abs(a[:, 55] - b[:, 55]).max() > 1e-3:
        order_diff += 1

print(f"\nframes: {N}")
print("| field | max abs diff |")
print("|---|---|")
print(f"| keypoint y (norm) | {dk_y:.3e} |")
print(f"| keypoint x (norm) | {dk_x:.3e} |")
print(f"| keypoint score | {dk_s:.3e} |")
print(f"| box ymin/xmin/ymax/xmax (norm) | {dbox:.3e} |")
print(f"| instance score | {dsc:.3e} |")
print(f"\nframes with a different admitted set: "
      + ", ".join(f"score>{th}: {n}/{N}" for th, n in sorted(set_diff.items())))
print(f"frames with any instance-score diff > 1e-3: {order_diff}/{N}")
if worst:
    i, meta, sc, ra, rb = worst
    print(f"\nworst instance-score frame: #{i} {meta} diff {sc:.3e}")
    print("  ref:", [round(v, 5) for v in ra])
    print("  got:", [round(v, 5) for v in rb])
print(f"\ntiming (desktop, {N} frames): full tflite {1000*t_full/N:.1f} ms/frame, "
      f"heads tflite {1000*t_head/N:.1f} ms/frame, numpy decode {1000*t_dec/N:.2f} ms/frame")
