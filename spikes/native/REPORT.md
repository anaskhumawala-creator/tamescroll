# Native spike 0a: tfjs -> TFLite conversion (2026-09-02)

Toolchain: `spikes/native/venv` (TF 2.15.0, tensorflowjs 4.17.0 `--no-deps`
with stub packages for tensorflow_decision_forests and jax, tfjs-graph-converter
1.6.3). Run: `venv/Scripts/python convert.py` (`MODELS_ONLY=faceres` to restrict),
then `venv/Scripts/python flex_check.py out/*.tflite` and `venv/Scripts/python parity.py`.

## Result

| model | f32 | f16 | ops | Flex/custom | parity f32 (cosine / max abs) | parity f16 |
|---|---|---|---|---|---|---|
| blazeface | 580,224 B | 326,308 B | 109 / 218, 6-7 kinds | none | 1.000000 / 6.1e-5 | 1.000000 / 6.1e-5 |
| faceres | 13,956,708 B | 6,995,640 B | 60 / 120, 7-8 kinds | none | 1.000000 / 8.9e-7 (descriptor), 0 (gender) | descriptor 0.997289 / 0.016; gender 1.000000 / 6.0e-4; age 0.999999 |
| movenet-multipose | 19,016,912 B | 9,579,928 B | 237 / 407, 36-37 kinds | none | 1.000000 / 6.6e-7 | 0.999999 / 0.013 |

Parity is against the tfjs graph run in TF on ONE banked input per model
(`out/*-input.json`, `out/*-tfjs.json`). The f16 count is higher because every
f16 weight carries a Dequantize op; the GPU delegate consumes f16 natively, XNNPACK
pays the dequantize once at prepare time.

faceres f16 moves the 1024-d descriptor by cosine 0.9973 on one face. The identity
memory's clear threshold is `MEM_SIM_CLEAR 0.60`, so this is nowhere near the
uint8-requant failure (loop 34: min cosine 0.596), but it is one input -- Task 3's
parity gate runs the banked corpus before f16 faceres is trusted.

## What went wrong first, and the actual cause

The first run "converted" blazeface and movenet -- **through the SELECT_TF_OPS
fallback**. Both files carried `Flex_FusedConv2D` (37 in blazeface), which means
the Flex delegate (a ~10MB extra library, CPU only, not GPU-delegatable). The
in-app bench on the Redmi refused every one of them: *"Select TensorFlow op(s)
... not supported by this interpreter"*. faceres failed outright on
`_FusedMatMul`: *"neither a custom op nor a flex op"*.

Five hypotheses were tried and were wrong, each after a run: patching the
converter's `get_grappler_config` (two call sites), disabling oneDNN
(`TF_ENABLE_ONEDNN_OPTS=0`), stripping `/device:CPU:0` placement from every
node, lifting all float Consts into `tf.Variable`s (the one structural thing a
Keras model does differently, and a Keras Dense head DID convert clean under the
same converter -- `keras_probe`).

The cause was found by counting op names in the exported `saved_model.pb`:
**4 `_FusedMatMul`, 0 plain `MatMul`** -- the fusion happened in OUR export,
before the TFLite converter ever ran. tfjs-graph-converter's `optimize_graph()`
runs grappler with an explicit optimizer list
`['debug_stripper', 'remap', 'constfold', 'arithmetic', 'dependency']`, and
`remap` is the remapper that fuses MatMul/Conv2D+BiasAdd(+activation) into
`_Fused*` -- AFTER `CompatMode.TFLITE`'s `split_all_fused_ops` had un-fused
them. So the library's own "only TFLite builtins" mode was undone by its own
optimizer pass one call later.

Fix (in `convert.py`): monkeypatch
`tfjs_graph_converter.optimization._set_optimization_options` to drop `'remap'`.
Plus `compat_mode=CompatMode.TFLITE` on `load_graph_model`, `patch_fused_ops`
(TArgs op-def skew) and `unfuse_matmul` stay as belt and braces.

Two guards now exist so a Flex model can never again be mistaken for a
deployable one: a SELECT_TF_OPS fallback writes `<name>-flex.tflite`, and
`flex_check.py` exits 1 on any Flex/custom op.

## Model contracts (for Task 2)

- blazeface: input `input` [1,256,256,3] float32 **(x / 127.5) - 1** (detector.js `detectFaceBoxes`); outputs 4 tensors
  (scores [1,512,1] / [1,384,1], boxes [1,512,16] / [1,384,16]) -- the
  post-processing (anchors, NMS) stays in the page exactly as today.
- faceres: input `input_1` [1,224,224,3] float32 **0..255 raw** (detector.js: "cropAndResize interpolates from the 0..255 float source -- faceres wants exactly that range"); outputs
  `gender_pred/Sigmoid` [1,1], `age_pred/Softmax` [1,100],
  `global_pooling/Mean` [1,1024]. TFLite output ORDER is by signature key
  (`PartitionedCall:0/1/2` = gender / age / descriptor); read by name, never by index.
- movenet-multipose: input `input` [1,256,256,3] **int32 raw 0..255** (no normalisation); output [1,6,56].

nsfwjs is not converted: it runs on the thumbnail path, which is not in this
round's scope (the video path is the Redmi's problem).
