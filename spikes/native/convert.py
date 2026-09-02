"""convert.py -- tfjs graph model -> SavedModel -> .tflite (f32 + f16).

For each of blazeface / faceres / movenet-multipose:
  1. tfjs_graph_converter.api.load_graph_model() reads app/gaze/models/<name>.json
     (+ sibling .bin) straight off disk -- this is the SAME loader tfjs
     itself uses for a graph model's weightsManifest, so a `quantization`
     entry on a weight (faceres' f16 weights, movenet's uint8 weights)
     is dequantized to float32 by the loader before the graph ever sees
     it. No pre-requant original is needed.
  2. The resulting tf.Graph is wrapped and saved as a SavedModel.
  3. TFLiteConverter.from_saved_model() produces out/<name>.tflite (f32)
     and out/<name>-f16.tflite (float16 weight quantization).

Run: venv/Scripts/python convert.py
"""
import json
import os
import shutil
import sys
import traceback

# oneDNN's Grappler "remapper" pass fuses Conv2D+BiasAdd+Relu (and
# MatMul+BiasAdd+Relu) into _FusedConv2D / _FusedMatMul the moment a
# graph is retraced through a tf.function (which export_saved_model
# below does via wrap_function) -- and the fused op it emits carries a
# `TArgs` attr this TF build's op registry does not accept, so the
# SavedModel itself becomes unloadable/unconvertible downstream. Must
# be set before `import tensorflow`.
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import numpy as np
# oneDNN builds fuse MatMul/Conv2D+BiasAdd(+act) in grappler's remapper for
# EVERY node, placed or not (IsMKLEnabled short-circuits the on-CPU check),
# and the converter runs that remapper on the loaded SavedModel. Must be
# set before TensorFlow is imported.
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
import tensorflow as tf

# Grappler's "remapper" optimization fuses Conv2D+BiasAdd+(Relu) and
# MatMul+BiasAdd+(Relu) into _FusedConv2D / _FusedMatMul the moment the
# imported GraphDef is retraced through a tf.function (wrap_function
# below, and again at tf.saved_model.save). Those fused ops carry a
# `TArgs` attr the installed TF's op registry does not accept on this
# path (independent of TF_ENABLE_ONEDNN_OPTS -- tried, no effect), so
# the exported SavedModel becomes un-importable by the TFLite MLIR
# converter ("neither a custom op nor a flex op"). Disabling the
# remapper keeps the graph as plain Conv2D/MatMul/BiasAdd/Relu, which
# both TFLiteConverter and TFLITE_BUILTINS understand directly.
tf.config.optimizer.set_experimental_options({"remapper": False})

# THAT FLAG DOES NOT REACH TFLiteConverter. The converter runs its own
# Grappler pass (lite/python/util.py get_grappler_config -> RewriterConfig)
# and re-fuses MatMul+BiasAdd(+Relu) into _FusedMatMul, which the MLIR
# legalizer has no rule for -- so a hand-unfused faceres graph came back
# fused (spike 0a). Turn the remapper off in the config the converter
# builds for itself.
from tensorflow.core.protobuf import rewriter_config_pb2 as _rc
from tensorflow.lite.python import util as _lite_util
_orig_get_grappler_config = _lite_util.get_grappler_config
def _no_remap_grappler_config(*a, **kw):
    cfg = _orig_get_grappler_config(*a, **kw)
    cfg.graph_options.rewrite_options.remapping = _rc.RewriterConfig.OFF
    return cfg
_lite_util.get_grappler_config = _no_remap_grappler_config
# lite.py binds its OWN name to the function at import time
# (`from ...util import get_grappler_config as _get_grappler_config`), so
# patching util alone changes nothing the converter calls.
from tensorflow.lite.python import lite as _lite_mod
_lite_mod._get_grappler_config = _no_remap_grappler_config

import tfjs_graph_converter.api as tfjs_api
import tfjs_graph_converter.optimization as tfjs_opt
from tfjs_graph_converter.common import CompatMode

# THE fusion source, found by counting op names in the exported
# saved_model.pb (4 _FusedMatMul, 0 plain MatMul): tfjs-graph-converter's
# optimize_graph() runs grappler with an explicit optimizer list that
# includes 'remap', and the remapper re-fuses MatMul/Conv2D+BiasAdd(+act)
# into _Fused* on the CPU-placed graph -- AFTER CompatMode.TFLITE's
# split_all_fused_ops has un-fused them. Nothing downstream (oneDNN env,
# device placement, the converter's own grappler config) could undo that.
# Drop 'remap' from that list; the other passes are what we want.
_orig_set_opt = tfjs_opt._set_optimization_options
def _no_remap_options(config, options):
    _orig_set_opt(config, [o for o in options if o != "remap"])
tfjs_opt._set_optimization_options = _no_remap_options

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MODELS_DIR = os.path.join(REPO_ROOT, "app", "gaze", "models")
OUT_DIR = os.path.join(HERE, "out")
SAVEDMODEL_DIR = os.path.join(HERE, "savedmodel")
STAGE_DIR = os.path.join(HERE, "stage")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(SAVEDMODEL_DIR, exist_ok=True)
os.makedirs(STAGE_DIR, exist_ok=True)


import base64

_NHWC_B64 = base64.b64encode(b"NHWC").decode()


def unfuse_matmul(model_json):
    """faceres's `_FusedMatMul` nodes (feats/Relu, gender_pred/BiasAdd,
    age_pred/BiasAdd) hit a DIFFERENT wall than _FusedConv2D's missing
    TArgs: once TArgs is patched in they import and export to a
    SavedModel fine, but the TFLite MLIR converter refuses to legalize
    `_FusedMatMul` at all -- "neither a custom op nor a flex op" even
    under SELECT_TF_OPS. Underscore-prefixed TF ops are grappler-
    internal fusions, deliberately excluded from both the builtin and
    the Flex-delegate allowlists (confirmed: `_FusedConv2D` converts
    fine as a plain builtin once its NodeDef is valid, so this is not
    a general Flex-support gap -- MatMul's fused variant specifically
    has no legalization path).
    Fix: un-fuse it back into MatMul (+BiasAdd) (+Relu) node-by-node
    BEFORE import, matching the op order in `fused_ops`. The original
    fused node's own name is reused for the LAST op in the chain, so
    every other node's `input` reference to it still resolves with no
    rewiring needed."""
    nodes = model_json["modelTopology"]["node"]
    new_nodes = []
    unfused = 0
    for n in nodes:
        if n.get("op") != "_FusedMatMul":
            new_nodes.append(n)
            continue
        name = n["name"]
        x_in, w_in, b_in = n["input"]
        attr = n["attr"]
        t = attr.get("T", {}).get("type", "DT_FLOAT")
        transpose_a = attr.get("transpose_a", {}).get("b", False)
        transpose_b = attr.get("transpose_b", {}).get("b", False)
        fused_ops_b64 = attr.get("fused_ops", {}).get("list", {}).get("s", [])
        fused_ops = [base64.b64decode(s).decode() for s in fused_ops_b64]
        device = n.get("device", "")

        matmul_name = name + "/unfused_matmul"
        new_nodes.append({
            "name": matmul_name,
            "op": "MatMul",
            "input": [x_in, w_in],
            "device": device,
            "attr": {
                "T": {"type": t},
                "transpose_a": {"b": transpose_a},
                "transpose_b": {"b": transpose_b},
            },
        })
        prev = matmul_name
        for i, op_name in enumerate(fused_ops):
            is_last = i == len(fused_ops) - 1
            node_name = name if is_last else f"{name}/unfused_{op_name.lower()}_{i}"
            if op_name == "BiasAdd":
                node = {
                    "name": node_name,
                    "op": "BiasAdd",
                    "input": [prev, b_in],
                    "device": device,
                    "attr": {"T": {"type": t}, "data_format": {"s": _NHWC_B64}},
                }
            elif op_name == "Relu":
                node = {
                    "name": node_name,
                    "op": "Relu",
                    "input": [prev],
                    "device": device,
                    "attr": {"T": {"type": t}},
                }
            else:
                raise ValueError(f"unfuse_matmul: unsupported fused op {op_name!r} on {name}")
            new_nodes.append(node)
            prev = node_name
        assert prev == name, f"unfuse_matmul: chain for {name} did not end on the original name ({prev})"
        unfused += 1
    model_json["modelTopology"]["node"] = new_nodes
    if unfused:
        log(f"  unfused {unfused} _FusedMatMul node(s) into MatMul+BiasAdd(+Relu)")


def patch_fused_ops(model_json):
    """All three shipped graphs were frozen by a TF version that
    predates the `TArgs`/`host_args` attrs `_FusedConv2D`/`_FusedMatMul`
    later gained (op registry version skew, not a conversion bug of
    ours) -- the installed TFLite converter's op-def validation rejects
    the stored NodeDef for missing a REQUIRED attr (`TArgs`,
    list(type), min=1) that did not exist when these nodes were
    written. Every fused node here has `num_args:1`, `T:DT_FLOAT`
    (checked across all three models), i.e. one float32 fused bias
    input -- so TArgs is unambiguously `[DT_FLOAT]`. Patched at the
    JSON level before import_graph_def ever sees it."""
    nodes = model_json["modelTopology"]["node"]
    patched = 0
    for n in nodes:
        if n.get("op") in ("_FusedConv2D", "_FusedMatMul") and "TArgs" not in n.get("attr", {}):
            t = n["attr"].get("T", {}).get("type", "DT_FLOAT")
            n["attr"]["TArgs"] = {"list": {"type": [t]}}
            patched += 1
    if patched:
        log(f"  patched TArgs onto {patched} fused node(s) (op-def version skew)")


def stage_model_json(name):
    """tfjs_graph_converter reads weight bytes from
    weightsManifest[].paths, resolved relative to the .json's own
    directory. movenet-multipose.json's manifest says `weights.bin`
    (the name gen-embed.js's own tooling used) while the shipped
    sibling file was renamed to movenet-multipose.bin for delivery --
    a mismatch invisible to the app (which always reads the actual
    .bin by its own MODEL_ASSETS mapping, never the manifest's path
    string). Stage a copy where the manifest's path and the file on
    disk agree, for every model, rather than special-casing one."""
    src_json = os.path.join(MODELS_DIR, f"{name}.json")
    src_bin = os.path.join(MODELS_DIR, f"{name}.bin")
    with open(src_json, encoding="utf-8") as f:
        model_json = json.load(f)
    unfuse_matmul(model_json)
    patch_fused_ops(model_json)
    stage_dir = os.path.join(STAGE_DIR, name)
    os.makedirs(stage_dir, exist_ok=True)
    for g in model_json["weightsManifest"]:
        for p in g["paths"]:
            shutil.copyfile(src_bin, os.path.join(stage_dir, p))
    staged_json = os.path.join(stage_dir, f"{name}.json")
    with open(staged_json, "w", encoding="utf-8") as f:
        json.dump(model_json, f)
    return staged_json

MODELS = {
    "blazeface": {
        "input_name": "input",
        "input_shape": [1, 256, 256, 3],
        "input_dtype": tf.float32,
        "outputs": ["Identity:0", "Identity_1:0", "Identity_2:0", "Identity_3:0"],
    },
    "faceres": {
        "input_name": "input_1",
        "input_shape": [1, 224, 224, 3],
        "input_dtype": tf.float32,
        "outputs": ["gender_pred/Sigmoid:0", "age_pred/Softmax:0", "global_pooling/Mean:0"],
    },
    "movenet-multipose": {
        "input_name": "input",
        # dynamic H/W in the shipped json ([1,-1,-1,3]) -- fixed to
        # 256x256 here (the app's own fixed-square path, no letterbox)
        # so the SavedModel/tflite graphs have a static shape.
        "input_shape": [1, 256, 256, 3],
        "input_dtype": tf.int32,
        "outputs": ["Identity:0"],
    },
}


def log(msg):
    print(msg, flush=True)


def load_and_freeze(name, cfg):
    staged_json = stage_model_json(name)
    # CompatMode.TFLITE: tfjs-graph-converter's own rewrite splits EVERY
    # fused op (_FusedConv2D / _FusedMatMul / FusedDepthwiseConv2dNative)
    # into plain builtins before the graph exists. Without it all three
    # models "converted" only through the SELECT_TF_OPS fallback -- Flex
    # models the GPU delegate cannot run (spike 1, first bench).
    graph = tfjs_api.load_graph_model(staged_json, compat_mode=CompatMode.TFLITE)
    return graph


def export_saved_model(name, cfg, graph):
    """Wrap the frozen tf.Graph in a tf.Module with a concrete
    signature at the FIXED input shape, then export as SavedModel."""
    out_dir = os.path.join(SAVEDMODEL_DIR, name)

    input_name = cfg["input_name"]
    input_shape = cfg["input_shape"]
    input_dtype = cfg["input_dtype"]
    output_names = cfg["outputs"]

    with graph.as_default():
        input_tensor = graph.get_tensor_by_name(input_name + ":0")
        output_tensors = [graph.get_tensor_by_name(o) for o in output_names]

    # Use v1-style wrap_function so the imported GraphDef's ops run as-is.
    graph_def = graph.as_graph_def()

    def _model_fn(x):
        out = tf.graph_util.import_graph_def(
            graph_def,
            input_map={input_name: x},
            return_elements=output_names,
            name="",
        )
        return out

    concrete = tf.compat.v1.wrap_function(_model_fn, [tf.TensorSpec(input_shape, input_dtype)])
    frozen = concrete.prune(
        concrete.inputs,
        [concrete.graph.get_tensor_by_name(o) for o in output_names],
    )

    class Wrapper(tf.Module):
        def __init__(self, fn):
            super().__init__()
            self._fn = fn

        @tf.function
        def __call__(self, x):
            return self._fn(x)

    module = Wrapper(frozen)
    spec = tf.TensorSpec(input_shape, input_dtype, name=input_name)
    concrete_fn = module.__call__.get_concrete_function(spec)
    tf.saved_model.save(module, out_dir, signatures={"serving_default": concrete_fn})
    log(f"  saved SavedModel -> {out_dir}")
    return out_dir, concrete_fn


def convert_tflite(name, saved_model_dir, f16=False):
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    flex = False
    try:
        if f16:
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.target_spec.supported_types = [tf.float16]
        tflite_model = converter.convert()
    except Exception as e:
        log(f"  builtins-only convert failed ({e!r}); retrying with SELECT_TF_OPS")
        converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
        converter.target_spec.supported_ops = [
            tf.lite.OpsSet.TFLITE_BUILTINS,
            tf.lite.OpsSet.SELECT_TF_OPS,
        ]
        if f16:
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
            converter.target_spec.supported_types = [tf.float16]
        tflite_model = converter.convert()
        flex = True
        log("  converted with SELECT_TF_OPS (note: matters for the GPU delegate -- Flex ops are not GPU-delegatable)")
    suffix = "-f16" if f16 else ""
    if flex:
        suffix += "-flex"  # NOT deployable: needs the Flex delegate, no GPU
    out_path = os.path.join(OUT_DIR, f"{name}{suffix}.tflite")
    with open(out_path, "wb") as f:
        f.write(tflite_model)
    size = os.path.getsize(out_path)
    log(f"  wrote {out_path} ({size} bytes)")
    return out_path, size


def main():
    report = {}
    only = [x for x in os.environ.get("MODELS_ONLY", "").split(",") if x]
    for name, cfg in MODELS.items():
        if only and name not in only:
            continue
        log(f"=== {name} ===")
        try:
            graph = load_and_freeze(name, cfg)
            saved_dir, _ = export_saved_model(name, cfg, graph)
            f32_path, f32_size = convert_tflite(name, saved_dir, f16=False)
            f16_path, f16_size = convert_tflite(name, saved_dir, f16=True)
            report[name] = {"ok": True, "f32_size": f32_size, "f16_size": f16_size}
        except Exception as e:
            log(f"  FAILED: {e!r}")
            traceback.print_exc()
            report[name] = {"ok": False, "error": repr(e)}
    log("\n=== summary ===")
    for name, r in report.items():
        log(f"{name}: {r}")


if __name__ == "__main__":
    main()
