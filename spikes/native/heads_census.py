"""heads_census.py -- how many people the bank actually contains, and how
the f16 heads model + numpy decode compares against the f32 FULL model.

A parity table over frames with nobody in them proves nothing, so this
prints the admitted-slot census first. `--f16` swaps the heads model for
out/movenet-heads-f16.tflite; the reference is always the f32 full graph.
"""
import json, os, sys, time
import numpy as np
import tensorflow as tf
import movenet_decode

HERE = os.path.dirname(os.path.abspath(__file__))
use_f16 = "--f16" in sys.argv
HEADS = os.path.join(HERE, "out", "movenet-heads-f16.tflite" if use_f16 else "movenet-heads.tflite")
FULL = os.path.join(HERE, "out", "movenet-multipose.tflite")

frames = np.load(os.path.join(HERE, "frames.npy"))
index = json.load(open(os.path.join(HERE, "frames-index.json")))

full = tf.lite.Interpreter(model_path=FULL, num_threads=4); full.allocate_tensors()
fin, fout = full.get_input_details()[0], full.get_output_details()[0]
heads = tf.lite.Interpreter(model_path=HEADS, num_threads=4); heads.allocate_tensors()
hin = heads.get_input_details()[0]
hout = {d["name"].split(":")[-1]: d for d in heads.get_output_details()}
KEYS = ["center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset"]
ORDER = ["0", "1", "2", "3", "4", "5"]

per_video = {}
n_admit = {0.12: 0, 0.2: 0, 0.35: 0}
frames_with_person = 0
dk_y = dk_x = dk_s = dbox = dsc = 0.0
ak_y = ak_x = ak_s = abox = asc = 0.0   # restricted to slots the gate admits
set_diff = {0.12: 0, 0.2: 0, 0.35: 0}
for i, img in enumerate(frames):
    x = img[None].astype(np.int32)
    full.set_tensor(fin["index"], x); full.invoke()
    ref = full.get_tensor(fout["index"])[0].copy()
    heads.set_tensor(hin["index"], x); heads.invoke()
    got = movenet_decode.decode(**{k: heads.get_tensor(hout[o]["index"])
                                   for k, o in zip(KEYS, ORDER)})[0]
    s = ref[:, 55]
    for th in n_admit:
        n_admit[th] += int((s > th).sum())
    if (s > 0.35).any():
        frames_with_person += 1
    v = index[i]["video"]
    per_video.setdefault(v, [0, 0])
    per_video[v][0] += 1
    per_video[v][1] += int((s > 0.35).sum())
    dk_y = max(dk_y, np.abs(ref[:, 0:51:3] - got[:, 0:51:3]).max())
    dk_x = max(dk_x, np.abs(ref[:, 1:51:3] - got[:, 1:51:3]).max())
    dk_s = max(dk_s, np.abs(ref[:, 2:51:3] - got[:, 2:51:3]).max())
    dbox = max(dbox, np.abs(ref[:, 51:55] - got[:, 51:55]).max())
    dsc = max(dsc, np.abs(ref[:, 55] - got[:, 55]).max())
    m = ref[:, 55] > 0.2
    if m.any():
        ak_y = max(ak_y, np.abs(ref[m][:, 0:51:3] - got[m][:, 0:51:3]).max())
        ak_x = max(ak_x, np.abs(ref[m][:, 1:51:3] - got[m][:, 1:51:3]).max())
        ak_s = max(ak_s, np.abs(ref[m][:, 2:51:3] - got[m][:, 2:51:3]).max())
        abox = max(abox, np.abs(ref[m][:, 51:55] - got[m][:, 51:55]).max())
        asc = max(asc, np.abs(ref[m][:, 55] - got[m][:, 55]).max())
    for th in set_diff:
        if list(ref[:, 55] > th) != list(got[:, 55] > th):
            set_diff[th] += 1

print(f"heads model: {os.path.basename(HEADS)}   reference: full f32")
print(f"frames {len(frames)}, frames with >=1 slot over PERSON_MIN_SCORE 0.35: {frames_with_person}")
print("admitted slot-instances summed over the bank: "
      + ", ".join(f">{th}: {n}" for th, n in sorted(n_admit.items())))
for v, (nf, na) in sorted(per_video.items()):
    print(f"  {v:22s} {nf:3d} frames  {na:3d} admitted (>0.35)")
print("\n| field | max abs diff |")
print("|---|---|")
print(f"| keypoint y | {dk_y:.3e} |")
print(f"| keypoint x | {dk_x:.3e} |")
print(f"| keypoint score | {dk_s:.3e} |")
print(f"| box | {dbox:.3e} |")
print(f"| instance score | {dsc:.3e} |")
print("")
print("| field (ADMITTED slots only, ref score > 0.2) | max abs diff |")
print("|---|---|")
print(f"| keypoint y | {ak_y:.3e} |")
print(f"| keypoint x | {ak_x:.3e} |")
print(f"| keypoint score | {ak_s:.3e} |")
print(f"| box | {abox:.3e} |")
print(f"| instance score | {asc:.3e} |")
print("admitted-set mismatches: "
      + ", ".join(f">{th}: {n}/{len(frames)}" for th, n in sorted(set_diff.items())))
