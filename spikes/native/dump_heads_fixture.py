"""dump_heads_fixture.py -- bank the six raw movenet-heads tensors plus
the full model's [1,6,56] answer, for a handful of corpus frames, as a
binary fixture the Kotlin JVM parity test reads with no TFLite runtime
and no Python involved.

Frame selection: 12 frames evenly spaced across the 159-frame bank
(spikes/native/frames.npy, HEADS-REPORT.md section 3), so the fixture
touches multiple videos rather than one clip's warm-up frames.

Output, under out/heads-fixture/ (gitignored -- the whole of
spikes/native/out/ already is):
  index.json           frame count, H, W, K, N and the six head shapes,
                        in the exact order the Kotlin decoder binds them
  frame%03d_<head>.f32  each head's raw NHWC float32 tensor, native
                        (little-endian) byte order, batch dim stripped
  frame%03d_expected.f32  the full model's [6,56] answer, same order,
                        native little-endian float32

Run: venv/Scripts/python dump_heads_fixture.py
"""
import json
import os

import numpy as np
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "out", "heads-fixture")

# The exact order MoveNetHeadsDecoder.decode() takes its FloatBuffer
# arguments in (NativeInfer.kt / HEADS-REPORT.md section 5), keyed by
# the PartitionedCall:N output name each is bound from.
HEAD_ORDER = ["center", "kpt_heat", "kpt_regress", "kpt_offset", "box_scale", "box_offset"]
PARTITIONED_CALL_INDEX = {"center": 0, "kpt_heat": 1, "kpt_regress": 2,
                           "kpt_offset": 3, "box_scale": 4, "box_offset": 5}
NUM_FRAMES = 12


def log(msg):
    print(msg, flush=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    frames = np.load(os.path.join(HERE, "frames.npy"))
    idx = np.linspace(0, len(frames) - 1, NUM_FRAMES).round().astype(int)
    idx = sorted(set(idx.tolist()))

    full = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-multipose.tflite"), num_threads=4)
    full.allocate_tensors()
    fi, fo = full.get_input_details()[0], full.get_output_details()[0]

    heads = tf.lite.Interpreter(model_path=os.path.join(HERE, "out", "movenet-heads.tflite"), num_threads=4)
    heads.allocate_tensors()
    hi = heads.get_input_details()[0]
    # Output detail order is NOT signature order (measured: index 0 is
    # PartitionedCall:4) -- resolve by the ":N" suffix on the tensor
    # name, exactly what the Kotlin binder does.
    hout_by_slot = {}
    for d in heads.get_output_details():
        slot = int(d["name"].rsplit(":", 1)[-1])
        hout_by_slot[slot] = d

    head_shapes = {name: [int(s) for s in hout_by_slot[PARTITIONED_CALL_INDEX[name]]["shape"]]
                   for name in HEAD_ORDER}
    log(f"head shapes (batch included): {head_shapes}")

    manifest = {
        "numFrames": len(idx),
        "frameIndices": idx,
        "headOrder": HEAD_ORDER,
        "headShapes": head_shapes,  # [1, H, W, C] each
        "numKeypoints": 17,
        "maxInstances": 6,
        "expectedShape": [6, 56],
        "dtype": "float32",
        "byteOrder": "little",
        "note": ("frame%03d_<head>.f32 holds the head's NHWC tensor with the "
                 "batch dim stripped (H*W*C floats); frame%03d_expected.f32 "
                 "holds the full model's [6,56] output (336 floats), both "
                 "native little-endian float32."),
    }
    with open(os.path.join(OUT_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    for out_i, frame_i in enumerate(idx):
        x = frames[frame_i][None].astype(np.int32)

        full.set_tensor(fi["index"], x)
        full.invoke()
        expected = full.get_tensor(fo["index"])[0].astype(np.float32).copy()  # [6,56]
        assert expected.shape == (6, 56), expected.shape

        heads.set_tensor(hi["index"], x)
        heads.invoke()

        stem = f"frame{out_i:03d}"
        for name in HEAD_ORDER:
            d = hout_by_slot[PARTITIONED_CALL_INDEX[name]]
            t = heads.get_tensor(d["index"])[0].astype(np.float32).copy()  # batch dim stripped
            t.tofile(os.path.join(OUT_DIR, f"{stem}_{name}.f32"))
        expected.tofile(os.path.join(OUT_DIR, f"{stem}_expected.f32"))
        log(f"  {stem}: source frame {frame_i}, admitted (>0.2) "
            f"{int((expected[:, 55] > 0.2).sum())} of 6")

    log(f"wrote {len(idx)} frames to {OUT_DIR}")


if __name__ == "__main__":
    main()
