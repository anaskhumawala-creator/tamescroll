"""Refuse a .tflite that carries Flex (SELECT_TF_OPS) or custom ops.
Usage: python flex_check.py out/*.tflite -> prints ops per file, exit 1 if any Flex/custom."""
import sys, collections
import tensorflow as tf
bad = 0
for path in sys.argv[1:]:
    it = tf.lite.Interpreter(model_path=path)
    ops = collections.Counter(d["op_name"] for d in it._get_ops_details())
    flex = [o for o in ops if o.startswith("Flex") or o.startswith("TfLite") is False and o not in tf.lite.experimental.Analyzer.__dict__ and o.isupper() is False]
    flexops = {o: n for o, n in ops.items() if o.startswith("Flex") or o == "CUSTOM"}
    print(f"{path}: {len(it._get_ops_details())} ops, {len(ops)} kinds; flex/custom: {flexops or 'none'}")
    if flexops:
        bad += 1
sys.exit(1 if bad else 0)
