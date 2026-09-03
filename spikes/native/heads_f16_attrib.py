"""heads_f16_attrib.py -- is the f16 divergence the WEIGHTS or the decoder?

heads_census.py --f16 changes two things at once (f16 weights AND the
numpy tail). This runs the FULL f16 graph against the FULL f32 graph, so
the decoder is identical on both sides and whatever moves is the weights.
"""
import os
import numpy as np
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
frames = np.load(os.path.join(HERE, "frames.npy"))
a = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-multipose.tflite"), num_threads=4)
b = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-multipose-f16.tflite"), num_threads=4)
a.allocate_tensors(); b.allocate_tensors()
ai, ao = a.get_input_details()[0], a.get_output_details()[0]
bi, bo = b.get_input_details()[0], b.get_output_details()[0]

d = np.zeros(5); ad = np.zeros(5); mism = 0
for img in frames:
    x = img[None].astype(np.int32)
    a.set_tensor(ai["index"], x); a.invoke(); ra = a.get_tensor(ao["index"])[0].copy()
    b.set_tensor(bi["index"], x); b.invoke(); rb = b.get_tensor(bo["index"])[0].copy()
    cur = np.array([np.abs(ra[:, 0:51:3] - rb[:, 0:51:3]).max(),
                    np.abs(ra[:, 1:51:3] - rb[:, 1:51:3]).max(),
                    np.abs(ra[:, 2:51:3] - rb[:, 2:51:3]).max(),
                    np.abs(ra[:, 51:55] - rb[:, 51:55]).max(),
                    np.abs(ra[:, 55] - rb[:, 55]).max()])
    d = np.maximum(d, cur)
    m = ra[:, 55] > 0.2
    if m.any():
        ad = np.maximum(ad, np.array([np.abs(ra[m][:, 0:51:3] - rb[m][:, 0:51:3]).max(),
                                      np.abs(ra[m][:, 1:51:3] - rb[m][:, 1:51:3]).max(),
                                      np.abs(ra[m][:, 2:51:3] - rb[m][:, 2:51:3]).max(),
                                      np.abs(ra[m][:, 51:55] - rb[m][:, 51:55]).max(),
                                      np.abs(ra[m][:, 55] - rb[m][:, 55]).max()]))
    if list(ra[:, 55] > 0.2) != list(rb[:, 55] > 0.2):
        mism += 1
names = ["kp y", "kp x", "kp score", "box", "instance score"]
print("FULL f16 vs FULL f32 (same decoder both sides), %d frames" % len(frames))
for n, v, w in zip(names, d, ad):
    print(f"  {n:15s} all slots {v:.3e}   admitted(>0.2) {w:.3e}")
print(f"  admitted-set mismatches (>0.2): {mism}/{len(frames)}")
