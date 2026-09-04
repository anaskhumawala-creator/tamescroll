# WHERE DOES INPUT RESOLUTION STOP BEING FREE?
#
# dima-shrink-corpus measured 224 and 112 only, and the gap is the whole
# story: on the 2,159 rows the shipped arms also cover, the UNTOUCHED
# 12-block teacher reads AUC 0.9974 at 224 and 0.9632 at 112, while
# grey (what ships) reads 0.9855. So the input shrink alone costs 0.0342
# and takes the teacher BELOW what ships -- before a single block is
# removed. Truncating 12 blocks to 4 and distilling costs only a further
# 0.0077 (0.9555).
#
# That means depth is cheap and RESOLUTION is the binding constraint,
# and 112 vs 224 is far too coarse a grid to choose on. This fills in
# 192/176/160/144/128 with NO training at all -- weights untouched, only
# the position embeddings interpolated -- so whatever it finds is
# available before any student is trained.
#
# Eval only. No gradients, batch 8 so it can share the GPU with a
# running training job.
import argparse, json, os, time
os.environ.setdefault('HF_HOME', 'Z:/ml/hf')
import numpy as np, torch
from PIL import Image

BANK='Z:/tamescroll-corpus/bank'; MODEL='dima806/fairface_gender_image_detection'
ap=argparse.ArgumentParser()
ap.add_argument('--batch',type=int,default=8)
ap.add_argument('--sizes',default='224,192,176,160,144,128,112')
ap.add_argument('--depths',default='12')
ap.add_argument('--out',default=BANK+'/dima-res-curve.json')
a=ap.parse_args()

def read_ppm(p):
    with open(p,'rb') as fh:
        assert fh.readline().strip()==b'P6'
        l=fh.readline()
        while l.startswith(b'#'): l=fh.readline()
        w,h=[int(x) for x in l.split()]; fh.readline()
        d=np.frombuffer(fh.read(w*h*3),dtype=np.uint8).reshape(h,w,3)
    return Image.fromarray(d)

labels=json.load(open(BANK+'/label/labels.json')); clusters=json.load(open(BANK+'/label/clusters.json'))
rows=[]
for c in clusters:
    who=labels.get(c['id'])
    if who not in ('woman','man'): continue
    for m in c['members']:
        p=os.path.join(BANK,'crops',m['crop'])
        if os.path.exists(p): rows.append({'who':who,'cid':c['id'],'vid':c['vid'],'crop':m['crop'],'px':m.get('px'),'path':p})
print('corpus %d reads / %d identities'%(len(rows),len(set(r['cid'] for r in rows))))

from transformers import AutoImageProcessor, AutoModelForImageClassification
proc=AutoImageProcessor.from_pretrained(MODEL)
base=AutoModelForImageClassification.from_pretrained(MODEL).eval()
MALE=[i for i,l in base.config.id2label.items() if str(l).lower().startswith('male')][0]
dev='cuda' if torch.cuda.is_available() else 'cpu'
print('device',dev,'male class',MALE)
imgs=[read_ppm(r['path']) for r in rows]
MEAN=torch.tensor(proc.image_mean).view(1,3,1,1); STD=torch.tensor(proc.image_std).view(1,3,1,1)
U8=torch.stack([torch.from_numpy(np.asarray(im.convert('RGB').resize((224,224),Image.BILINEAR))).permute(2,0,1) for im in imgs])
del imgs
def auc(p,n):
    v=np.concatenate([p,n]);o=v.argsort();rk=np.empty(len(v));rk[o]=np.arange(1,len(v)+1)
    _,inv,c=np.unique(v,return_inverse=True,return_counts=True);s=np.zeros(len(c));np.add.at(s,inv,rk);rk=(s/c)[inv]
    return (rk[:len(p)].sum()-len(p)*(len(p)+1)/2)/(len(p)*len(n))
import copy
def vit_of(m):
    for n in ('vit','base_model','model'):
        if hasattr(m,n): return getattr(m,n)
def blocks_of(m):
    v=vit_of(m); return v.layers if hasattr(v,'layers') else v.encoder.layer
def set_blocks(m,k):
    v=vit_of(m)
    if hasattr(v,'layers'): v.layers=torch.nn.ModuleList(k)
    else: v.encoder.layer=torch.nn.ModuleList(k)
y=np.array([1 if r['who']=='man' else 0 for r in rows]); px=np.array([r['px'] or 0 for r in rows])
res=[]
print('%-16s %8s %8s   %s'%('config','AUC','<48px','sec'))
for depth in [int(x) for x in a.depths.split(',')]:
    m=copy.deepcopy(base)
    if depth<12: set_blocks(m,list(blocks_of(m))[:depth])
    m=m.to(dev).eval()
    for size in [int(x) for x in a.sizes.split(',')]:
        kw={} if size==224 else {'interpolate_pos_encoding':True}
        out=np.zeros(len(U8),dtype=np.float32); t0=time.time()
        with torch.no_grad():
            for s in range(0,len(U8),a.batch):
                x=U8[s:s+a.batch].to(dev).float()/255.0
                x=(x-MEAN.to(dev))/STD.to(dev)
                if size!=224: x=torch.nn.functional.interpolate(x,size=(size,size),mode='bilinear',align_corners=False)
                out[s:s+x.shape[0]]=torch.softmax(m(pixel_values=x,**kw).logits,-1)[:,MALE].cpu().numpy()
        sm=px<48
        A=auc(out[y==1],out[y==0]); As=auc(out[sm&(y==1)],out[sm&(y==0)])
        print('%-16s %8.4f %8.4f   %.0f'%('%d blocks @%dpx'%(depth,size),A,As,time.time()-t0))
        res.append({'depth':depth,'size':size,'auc':float(A),'aucSmall':float(As),'raw':[float(v) for v in out]})
        json.dump({'rows':[{k:r[k] for k in ('who','cid','vid','crop','px')} for r in rows],'arms':res},open(a.out,'w'))
    m.to('cpu'); del m
    if dev=='cuda': torch.cuda.empty_cache()
print('banked',a.out)
print('grey (ships) on the 2,159 joined rows: 0.9855 overall / 0.9441 under 48px')
