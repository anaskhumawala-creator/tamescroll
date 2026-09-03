import json, base64, numpy as np, os, struct
J = json.load(open('stage/movenet-multipose/movenet-multipose.json'))
nodes = J['modelTopology']['node']
by = {n['name']: n for n in nodes}
HEADS = ["StatefulPartitionedCall/Sigmoid","StatefulPartitionedCall/Sigmoid_1",
 "StatefulPartitionedCall/kpt_regress_0/conv2d_8/BiasAdd",
 "StatefulPartitionedCall/kpt_offset_0/conv2d_9/BiasAdd",
 "StatefulPartitionedCall/box_scale_0/conv2d_5/BiasAdd",
 "StatefulPartitionedCall/box_offset_0/conv2d_6/BiasAdd"]
def inp(n):
    return [i.split(':')[0].lstrip('^') for i in n.get('input',[])]
# ancestors of heads
anc=set()
stack=list(HEADS)
while stack:
    x=stack.pop()
    if x in anc: continue
    anc.add(x)
    if x in by:
        stack.extend(inp(by[x]))
tail=[n for n in nodes if n['name'] not in anc]
print("tail nodes:", len(tail))
# load weights manifest for const values
man=J['weightsManifest']
buf=open('stage/movenet-multipose/weights.bin','rb').read()
DT={'float32':(np.float32,4),'int32':(np.int32,4),'bool':(np.bool_,1),'int64':(np.int64,8),'float16':(np.float16,2),'uint8':(np.uint8,1)}
vals={}
off=0
for g in man:
    for w in g['weights']:
        name=w['name']; dt=w['dtype']; shape=w['shape']
        q=w.get('quantization')
        n=int(np.prod(shape)) if shape else 1
        if q:
            qd=q['dtype']; npt,sz=DT[qd]
            raw=np.frombuffer(buf,dtype=npt,count=n,offset=off); off+=n*sz
            arr=raw.astype(np.float32)*q.get('scale',1)+q.get('min',0)
        else:
            npt,sz=DT[dt]
            arr=np.frombuffer(buf,dtype=npt,count=n,offset=off); off+=n*sz
        vals[name]=arr.reshape(shape) if shape else arr.reshape(())
print("weights loaded", len(vals), "offset", off, "of", len(buf))
out=open('tail_dump.txt','w')
for n in tail:
    line=f"{n['name']}  [{n['op']}]  <- {inp(n)}"
    if n['op']=='Const':
        v=vals.get(n['name'])
        if v is not None:
            fv=np.asarray(v).ravel()
            s=np.array2string(fv[:20],precision=6)
            line+=f"   VAL shape={np.asarray(v).shape} {s}"+("..." if fv.size>20 else "")
    else:
        a=n.get('attr',{})
        keep={k:v for k,v in a.items() if k in ('axis','num','T','Tidx','k','sorted','squeeze_dims','begin_mask','end_mask','shrink_axis_mask','new_axis_mask','ellipsis_mask','ksize','strides','padding','keep_dims','out_type','sorted')}
        if keep: line+=f"   attr={json.dumps(keep)}"
    out.write(line+"\n")
out.close()
print("wrote tail_dump.txt")
