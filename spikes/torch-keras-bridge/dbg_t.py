import os,sys,numpy as np,torch
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from torch_side import Student
S=Student(); sd={k:torch.from_numpy(v) for k,v in np.load("kprobe/w_raw.npz").items()}
S.load_state_dict(sd); S.eval()
x=torch.from_numpy(np.load("kprobe/x.npy")).permute(0,3,1,2).contiguous()
acts=[]
h=x
with torch.no_grad():
    for i,blk in enumerate(S.body):
        h=blk(h); acts.append(h.permute(0,2,3,1).numpy())
np.savez("kprobe/acts_t.npz",**{f"b{i}":a for i,a in enumerate(acts)})
print("torch acts saved", [a.shape for a in acts][:3])
