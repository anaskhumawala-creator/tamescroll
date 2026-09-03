import sys, numpy as np, tensorflow as tf
from collections import Counter
for path in sys.argv[1:]:
    print("=== ", path)
    it = tf.lite.Interpreter(model_path=path)
    it.allocate_tensors()
    for d in it.get_input_details():
        print(f"  IN  {d['name']!r} {d['shape']} {np.dtype(d['dtype']).name}")
    for d in it.get_output_details():
        print(f"  OUT idx={d['index']} {d['name']!r} {d['shape']} {np.dtype(d['dtype']).name}")
    # op histogram from the flatbuffer
    try:
        from tensorflow.lite.python import schema_py_generated as schema
    except Exception:
        import tflite.Model as schema
    buf = open(path,'rb').read()
    m = schema.Model.GetRootAsModel(bytearray(buf), 0)
    bmap = {}
    for i in range(m.OperatorCodesLength()):
        oc = m.OperatorCodes(i)
        code = oc.BuiltinCode() or oc.DeprecatedBuiltinCode()
        cust = oc.CustomCode()
        bmap[i] = cust.decode() if cust else code
    names = {v:k for k,v in vars(schema.BuiltinOperator).items() if isinstance(v,int)}
    c = Counter()
    for si in range(m.SubgraphsLength()):
        sg = m.Subgraphs(si)
        for oi in range(sg.OperatorsLength()):
            oc = bmap[sg.Operators(oi).OpcodeIndex()]
            c[names.get(oc, str(oc)) if isinstance(oc,int) else "CUSTOM:"+oc] += 1
    print("  ops:", sum(c.values()), dict(sorted(c.items(), key=lambda kv:-kv[1])))
