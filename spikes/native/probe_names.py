import os
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS","0")
import convert as C
graph = C.load_and_freeze("movenet-multipose", C.MODELS["movenet-multipose"])
names=[op.name for op in graph.get_operations()]
for n in names:
    if any(k in n for k in ("Sigmoid","kpt_regress_0/conv2d_8","kpt_offset_0/conv2d_9","box_scale_0/conv2d_5","box_offset_0/conv2d_6")):
        op=graph.get_operation_by_name(n)
        print(n, "|", op.type, "|", [o.shape.as_list() for o in op.outputs])
