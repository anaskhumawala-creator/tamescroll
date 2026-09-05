import os,sys,time,glob,numpy as np,torch,torch.nn as nn
os.environ["HF_HUB_OFFLINE"]="1"; os.environ["HF_HOME"]=r"Z:/ml/hf"
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from torch_side import Student
ROOT=r"Z:/tamescroll-corpus/bank/crops"
files=sorted(glob.glob(os.path.join(ROOT,"*","*.ppm")))
print("crops",len(files))
X=np.stack([np.asarray(Image.open(f).convert("RGB"),dtype=np.uint8) for f in files])  # N,112,112,3
print("pixels",X.shape, X.nbytes//1024//1024,"MB")
# ---- teacher: dima806 wants 224 + its own normalisation (mean/std 0.5)
from transformers import AutoModelForImageClassification
T=AutoModelForImageClassification.from_pretrained("dima806/fairface_gender_image_detection").eval().cuda().half()
soft=[]
t0=time.time()
with torch.no_grad():
    for i in range(0,len(X),128):
        b=torch.from_numpy(X[i:i+128]).cuda().permute(0,3,1,2).half().div_(255.)
        b=torch.nn.functional.interpolate(b,size=224,mode='bilinear',align_corners=False)
        b=(b-0.5)/0.5
        soft.append(T(b).logits.float().softmax(-1)[:,1].cpu())   # P(Male)
soft=torch.cat(soft); print("teacher %.1fs  P(male) mean %.3f"%(time.time()-t0, soft.mean()))
np.save("kprobe/teacher.npy",soft.numpy())
# ---- student: train on teacher soft targets (distillation, NO labels used)
S=Student().cuda(); opt=torch.optim.AdamW(S.parameters(),3e-3,weight_decay=1e-4)
Xg=torch.from_numpy(X).cuda().permute(0,3,1,2).float().div_(255.); Yg=soft.cuda()
n=len(Xg); idx=torch.randperm(n,device='cuda'); tr,va=idx[:int(n*.8)],idx[int(n*.8):]
t0=time.time()
for ep in range(25):
    S.train(); perm=tr[torch.randperm(len(tr),device='cuda')]
    for i in range(0,len(perm),128):
        j=perm[i:i+128]; p=S(Xg[j]).squeeze(1)
        loss=nn.functional.binary_cross_entropy(p.clamp(1e-6,1-1e-6),Yg[j])
        opt.zero_grad(); loss.backward(); opt.step()
    if ep%8==7 or ep==24:
        S.eval()
        with torch.no_grad(): pv=S(Xg[va]).squeeze(1)
        agree=((pv>.5)==(Yg[va]>.5)).float().mean().item()
        print(f"ep{ep+1:3d} loss {loss.item():.4f} val-agree-with-teacher {agree*100:.1f}% ({time.time()-t0:.0f}s)")
S.eval()
x=np.load("kprobe/x.npy")
with torch.no_grad(): y=S(torch.from_numpy(x).permute(0,3,1,2).cuda()).cpu().numpy()
np.save("kprobe/y_torch.npy",y)
np.savez("kprobe/w_raw.npz",**{k:v.detach().cpu().numpy() for k,v in S.state_dict().items()})
out={}
for k,v in S.state_dict().items():
    a=v.detach().cpu().numpy()
    if a.ndim==4: a=a.transpose(2,3,0,1) if a.shape[1]==1 else a.transpose(2,3,1,0)
    elif a.ndim==2: a=a.T
    out[k]=a
np.savez("kprobe/w.npz",**out); print("TRAINED WEIGHTS EXPORTED")
