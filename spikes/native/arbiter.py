"""arbiter.py -- run the banked MoveNet .tflite on TFLite CPU (the reference
runtime none of the device paths use) over the 256x256 frames a device
probe dumped, and print maxKp / admitted persons per frame.

    venv/Scripts/python.exe arbiter.py ../gauntlet/native-frames-<ts>.json [f16]
"""
import base64
import json
import os
import sys

import numpy as np
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
PERSON_MIN_SCORE = 0.35  # person-gate.mjs:25


def run(interp, rgba, n):
    x = np.frombuffer(rgba, dtype=np.uint8).reshape(n, n, 4)[:, :, :3].astype(np.int32)[None]
    d = interp.get_input_details()[0]
    interp.set_tensor(d["index"], x.astype(d["dtype"]))
    interp.invoke()
    out = interp.get_tensor(interp.get_output_details()[0]["index"]).reshape(6, 56)
    kp = out[:, :51].reshape(6, 17, 3)
    return {
        "maxKp": float(kp[:, :, 2].max()),
        "slotScores": [round(float(s), 3) for s in out[:, 55]],
        "admitted": int((out[:, 55] >= PERSON_MIN_SCORE).sum()),
    }


def main():
    bank = json.load(open(sys.argv[1]))
    variant = "-f16" if len(sys.argv) > 2 and sys.argv[2] == "f16" else ""
    interp = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-multipose%s.tflite" % variant))
    interp.allocate_tensors()
    for fr in bank["frames"]:
        n = fr["N"]
        for key in ("plain", "shifted"):
            r = run(interp, base64.b64decode(fr[key]), n)
            print("t=%-6s %-8s tflite-cpu%s maxKp %.3f admitted %d slots %s" % (fr["target"], key, variant, r["maxKp"], r["admitted"], r["slotScores"]))


if __name__ == "__main__":
    main()
