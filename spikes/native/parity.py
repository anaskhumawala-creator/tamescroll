"""parity.py -- run each .tflite model on the SAME synthetic input
parity.mjs used, and compare against the tfjs dump (out/<name>-tfjs.json).

Prints max-abs-diff and cosine similarity per output tensor, for both
the f32 and f16 tflite variants.
"""
import json
import os
import sys

import numpy as np
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "out")

MODELS = ["blazeface", "faceres", "movenet-multipose"]

# tfjs output tensor name -> index into the tflite interpreter's
# output_details, resolved by matching on shape (tflite renames/
# reorders tensors under SavedModel export's autograph naming, so name
# matching is not reliable -- shape matching is, since every one of
# these three models has distinct output shapes per tensor).


def load_tfjs_dump(name):
    with open(os.path.join(OUT_DIR, f"{name}-tfjs.json")) as f:
        return json.load(f)


def load_input(name):
    with open(os.path.join(OUT_DIR, f"{name}-input.json")) as f:
        d = json.load(f)
    arr = np.array(d["data"], dtype=np.float32 if d["dtype"] == "float32" else np.int32)
    arr = arr.reshape(d["shape"])
    return arr


def run_tflite(tflite_path, input_arr):
    interp = tf.lite.Interpreter(model_path=tflite_path)
    interp.allocate_tensors()
    in_details = interp.get_input_details()
    out_details = interp.get_output_details()
    assert len(in_details) == 1, f"expected 1 input, got {len(in_details)}"
    in_dtype = in_details[0]["dtype"]
    x = input_arr.astype(in_dtype)
    interp.set_tensor(in_details[0]["index"], x)
    interp.invoke()
    outs = []
    for od in out_details:
        outs.append((od["name"], od["shape"].tolist(), interp.get_tensor(od["index"])))
    return outs


def match_by_shape(tflite_outs, tfjs_outputs):
    """Pair each tflite output to the tfjs output with the same shape.
    Falls back to positional pairing if shapes collide."""
    tfjs_items = list(tfjs_outputs.items())
    used = set()
    pairs = []
    for tname, tshape, tarr in tflite_outs:
        match = None
        for i, (jname, jval) in enumerate(tfjs_items):
            if i in used:
                continue
            if list(jval["shape"]) == list(tshape):
                match = i
                break
        if match is None:
            # fallback: first unused
            for i in range(len(tfjs_items)):
                if i not in used:
                    match = i
                    break
        used.add(match)
        jname, jval = tfjs_items[match]
        pairs.append((tname, jname, tarr, jval))
    return pairs


def compare(a, b_flat, b_shape):
    b = np.array(b_flat, dtype=np.float32).reshape(b_shape)
    a = a.astype(np.float32)
    if a.shape != b.shape:
        print(f"    SHAPE MISMATCH: tflite {a.shape} vs tfjs {b.shape}")
        return
    diff = np.abs(a - b)
    max_abs_diff = float(diff.max()) if diff.size else 0.0
    af = a.flatten()
    bf = b.flatten()
    denom = (np.linalg.norm(af) * np.linalg.norm(bf))
    cosine = float(np.dot(af, bf) / denom) if denom > 0 else float("nan")
    print(f"    max_abs_diff={max_abs_diff:.6g}  cosine={cosine:.6f}  shape={a.shape}")


def main():
    for name in MODELS:
        print(f"=== {name} ===")
        try:
            tfjs_outputs = load_tfjs_dump(name)
        except FileNotFoundError:
            print("  SKIP: no tfjs dump (run parity.mjs first)")
            continue
        input_arr = load_input(name)
        for variant, suffix in [("f32", ""), ("f16", "-f16")]:
            path = os.path.join(OUT_DIR, f"{name}{suffix}.tflite")
            if not os.path.exists(path):
                print(f"  [{variant}] SKIP: {path} not found (run convert.py first)")
                continue
            print(f"  [{variant}] {path}")
            try:
                outs = run_tflite(path, input_arr)
            except Exception as e:
                print(f"    FAILED to run: {e!r}")
                continue
            pairs = match_by_shape(outs, tfjs_outputs)
            for tname, jname, tarr, jval in pairs:
                print(f"    tflite '{tname}' vs tfjs '{jname}':")
                compare(tarr, jval["data"], jval["shape"])


if __name__ == "__main__":
    main()
