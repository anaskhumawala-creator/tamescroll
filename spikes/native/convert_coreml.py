"""iOS groundwork (direction memo, 2026-09-05): convert the three shipped
models from the SavedModels convert.py already writes into Core ML
models (neuralnetwork format: the mlprogram BlobWriter is macOS-only), and record what converted and what did not.

Run: venv/Scripts/python convert_coreml.py

HONEST LIMIT: coremltools on Windows can CONVERT but cannot PREDICT --
the Core ML runtime is macOS-only. So this proves the graphs are
expressible in Core ML and writes the packages; the output-parity check
against TFLite (the part that actually matters, cf. the GPU arbiter's
2% agreement bar) has to run on a Mac. `parity_inputs.npz` is written
here so that check needs no reconversion.
"""
import json
import os
import sys
import time
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SAVED = os.path.join(HERE, "savedmodel")
OUT = os.path.join(HERE, "coreml")
os.makedirs(OUT, exist_ok=True)

import coremltools as ct  # noqa: E402

MODELS = ["blazeface", "faceres", "movenet-heads"]
report = {"coremltools": ct.__version__, "models": {}}

for name in MODELS:
    src = os.path.join(SAVED, name)
    rec = {"ok": False}
    t0 = time.time()
    try:
        m = ct.convert(
            src,
            source="tensorflow",
            convert_to="neuralnetwork",
            minimum_deployment_target=ct.target.iOS14,
        )
        dst = os.path.join(OUT, name + ".mlmodel")
        m.save(dst)
        spec = m.get_spec()
        rec.update({
            "ok": True,
            "path": dst,
            "inputs": [(i.name, str(i.type.WhichOneof("Type"))) for i in spec.description.input],
            "outputs": [(o.name, str(o.type.WhichOneof("Type"))) for o in spec.description.output],
            "seconds": round(time.time() - t0, 1),
        })
        print("%-14s ok  %.1fs  in=%s out=%s" % (name, rec["seconds"], [i[0] for i in rec["inputs"]], [o[0] for o in rec["outputs"]]))
    except Exception as e:  # noqa: BLE001
        rec["error"] = "".join(traceback.format_exception_only(type(e), e)).strip()[:600]
        print("%-14s FAILED  %s" % (name, rec["error"].splitlines()[-1][:200]))
    report["models"][name] = rec

# Fixed inputs for the Mac-side parity run: one random crop per model at
# the input shape the TFLite files use (blazeface 256, faceres 224,
# movenet-heads 256), 0..255 floats like the app feeds.
rng = np.random.default_rng(7)
np.savez(os.path.join(OUT, "parity_inputs.npz"),
         blazeface=rng.uniform(0, 255, (1, 256, 256, 3)).astype(np.float32),
         faceres=rng.uniform(0, 255, (1, 224, 224, 3)).astype(np.float32),
         movenet_heads=rng.uniform(0, 255, (1, 256, 256, 3)).astype(np.float32))

with open(os.path.join(OUT, "report.json"), "w") as f:
    json.dump(report, f, indent=2)
print("wrote", os.path.join(OUT, "report.json"))
sys.exit(0 if all(r["ok"] for r in report["models"].values()) else 1)
