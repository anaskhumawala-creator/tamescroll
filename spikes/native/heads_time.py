"""heads_time.py -- where the numpy decode's milliseconds go, and how many
float ops the Kotlin port has to do. The per-stage split is what the port
plan is costed from: only stage 4 is O(H*W*N*K), everything else is O(N*K)
or O(H*W).
"""
import os, time
import numpy as np
import tensorflow as tf
import movenet_decode as D

HERE = os.path.dirname(os.path.abspath(__file__))
frames = np.load(os.path.join(HERE, "frames.npy"))
it = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-heads.tflite"), num_threads=4)
it.allocate_tensors()
inp = it.get_input_details()[0]
hout = {d["name"].split(":")[-1]: d for d in it.get_output_details()}
KEYS = ["center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset"]
ORDER = ["0", "1", "2", "3", "4", "5"]

bank = []
for img in frames[:40]:
    it.set_tensor(inp["index"], img[None].astype(np.int32)); it.invoke()
    bank.append({k: it.get_tensor(hout[o]["index"]).copy() for k, o in zip(KEYS, ORDER)})

for _ in range(3):
    D.decode(**bank[0])
t = []
for hs in bank:
    t0 = time.perf_counter(); D.decode(**hs); t.append((time.perf_counter() - t0) * 1000)
t = np.array(t)
print(f"decode total: p50 {np.percentile(t,50):.2f} ms  p95 {np.percentile(t,95):.2f}  "
      f"min {t.min():.2f}  max {t.max():.2f}  (n={len(t)})")

# stage split, by re-running the pieces
hs = bank[0]
H = W = 64; N = 6; K = 17


def timeit(fn, n=50):
    fn(); t0 = time.perf_counter()
    for _ in range(n):
        fn()
    return (time.perf_counter() - t0) * 1000 / n


c = np.asarray(hs["center"], np.float32)[0]
kh = np.asarray(hs["kpt_heat"], np.float32)[0]
print(f"  1 maxpool5x5 + peak + topk : {timeit(lambda: D._top_k((c*(np.abs(c-D._max_pool_same(c,5))<D.PEAK_EPS)).reshape(-1),6)):.3f} ms")
seed_y = np.random.rand(N, K).astype(np.float32) * 64
seed_x = np.random.rand(N, K).astype(np.float32) * 64
ys = np.arange(H, dtype=np.float32)[:, None, None, None]
xs = np.arange(W, dtype=np.float32)[None, :, None, None]
print(f"  4 d2 + exp [H,W,N,K]       : "
      f"{timeit(lambda: np.exp(-(((ys-seed_y[None,None])**2+(xs-seed_x[None,None])**2))/19.2)):.3f} ms")
w = np.exp(-(((ys - seed_y[None, None]) ** 2 + (xs - seed_x[None, None]) ** 2)) / 19.2)
print(f"  4 mul by heat + argmax     : "
      f"{timeit(lambda: np.argmax((kh[:,:,None,:]*w).reshape(H*W, N*K), 0)):.3f} ms")
print(f"\nfloat ops in stage 4: {H*W*N*K} cells x (2 sub, 2 mul, 1 add, 1 div, 1 exp, 2 mul, 1 cmp)"
      f" = ~{H*W*N*K*10/1e6:.1f}M, of which {H*W*N*K/1e6:.2f}M exp()")
print(f"stage 1 maxpool: {H*W*25} max ops = {H*W*25/1e3:.0f}k")

import movenet_decode_port as P
for _ in range(3):
    P.decode(**bank[0])
t2 = []
for hs in bank:
    t0 = time.perf_counter(); P.decode(**hs); t2.append((time.perf_counter() - t0) * 1000)
t2 = np.array(t2)
print(f"port-shaped decode (box-restricted + separable): p50 {np.percentile(t2,50):.2f} ms "
      f"p95 {np.percentile(t2,95):.2f} min {t2.min():.2f} max {t2.max():.2f}")
