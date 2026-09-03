import json, numpy as np
J = json.load(open('stage/movenet-multipose/movenet-multipose.json'))
nodes = J['modelTopology']['node']
by = {n['name']: n for n in nodes}
HEADS = ["StatefulPartitionedCall/Sigmoid","StatefulPartitionedCall/Sigmoid_1",
 "StatefulPartitionedCall/kpt_regress_0/conv2d_8/BiasAdd",
 "StatefulPartitionedCall/kpt_offset_0/conv2d_9/BiasAdd",
 "StatefulPartitionedCall/box_scale_0/conv2d_5/BiasAdd",
 "StatefulPartitionedCall/box_offset_0/conv2d_6/BiasAdd"]
def base(i): return i.split(':')[0].lstrip('^')
anc=set(); st=list(HEADS)
while st:
    x=st.pop()
    if x in anc: continue
    anc.add(x)
    if x in by: st.extend(base(i) for i in by[x].get('input',[]))
tail=[n for n in nodes if n['name'] not in anc]
man=J['weightsManifest']; buf=open('stage/movenet-multipose/weights.bin','rb').read()
DT={'float32':(np.float32,4),'int32':(np.int32,4),'bool':(np.bool_,1),'int64':(np.int64,8),'float16':(np.float16,2),'uint8':(np.uint8,1)}
vals={}; off=0
for g in man:
    for w in g['weights']:
        shape=w['shape']; q=w.get('quantization'); n=int(np.prod(shape)) if shape else 1
        if q:
            npt,sz=DT[q['dtype']]; raw=np.frombuffer(buf,dtype=npt,count=n,offset=off); off+=n*sz
            arr=raw.astype(np.float32)*q.get('scale',1)+q.get('min',0)
        else:
            npt,sz=DT[w['dtype']]; arr=np.frombuffer(buf,dtype=npt,count=n,offset=off); off+=n*sz
        vals[w['name']]=arr.reshape(shape) if shape else arr.reshape(())
with open('tail_consts.txt','w') as f:
    for n in tail:
        if n['op']!='Const': continue
        v=vals.get(n['name'])
        if v is None: f.write(f"{n['name']}: MISSING\n"); continue
        a=np.asarray(v); r=a.ravel()
        f.write(f"{n['name']}  shape={a.shape} dt={a.dtype} {np.array2string(r[:24],precision=6)}{'...' if r.size>24 else ''}\n")
with open('tail_ops.txt','w') as f:
    for n in tail:
        if n['op']=='Const': continue
        f.write(f"{n['name']}  [{n['op']}]  <- {n.get('input',[])}\n")
print('ok')
