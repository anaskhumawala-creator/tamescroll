import os,sys,numpy as np,torch,torch.nn as nn
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from arch import spec
class TFPad(nn.Module):
    """TF 'SAME' padding, computed from the ACTUAL input size.
    pad_total = max((ceil(H/s)-1)*s + k - H, 0); before = pad_total//2.
    A fixed (0,1,0,1) is only correct for an EVEN input; on an ODD input
    (e.g. 7 -> 4 at stride 2) TF pads (1,1) and a fixed rule silently
    misaligns every downstream layer."""
    def __init__(s,stride,k=3): super().__init__(); s.s=stride; s.k=k
    def forward(s,x):
        out=[]
        for d in (3,2):                       # width then height -> F.pad order (l,r,t,b)
            n=x.shape[d]; o=-(-n//s.s); tot=max((o-1)*s.s+s.k-n,0); out += [tot//2, tot-tot//2]
        return nn.functional.pad(x,tuple(out))
def cbr(cin,f,st): return nn.Sequential(TFPad(st),nn.Conv2d(cin,f,3,st,0,bias=False),nn.BatchNorm2d(f,eps=1e-3,momentum=0.01),nn.ReLU6())
def dw(cin,f,st): return nn.Sequential(TFPad(st),nn.Conv2d(cin,cin,3,st,0,groups=cin,bias=False),nn.BatchNorm2d(cin,eps=1e-3,momentum=0.01),nn.ReLU6(),
                                       nn.Conv2d(cin,f,1,1,0,bias=False),nn.BatchNorm2d(f,eps=1e-3,momentum=0.01),nn.ReLU6())
class Student(nn.Module):
    def __init__(s):
        super().__init__(); mods=[]; c=3
        for kind,f,st in spec(): mods.append(cbr(c,f,st) if kind=='cbr' else dw(c,f,st)); c=f
        s.body=nn.Sequential(*mods); s.head=nn.Linear(c,1)
    def forward(s,x):
        x=s.body(x); x=x.mean((2,3)); return torch.sigmoid(s.head(x))
if __name__=="__main__":
    m=Student().eval()
    print("torch params",sum(p.numel() for p in m.parameters()))
    torch.manual_seed(0)
    for p in m.parameters(): nn.init.normal_(p,0,0.15)
    for mod in m.modules():
        if isinstance(mod,nn.BatchNorm2d):
            mod.running_mean.normal_(0,0.1); mod.running_var.uniform_(0.5,1.5); mod.weight.data.uniform_(0.7,1.3); mod.bias.data.normal_(0,0.1)
    x=np.load("kprobe/x.npy")
    with torch.no_grad(): y=m(torch.from_numpy(x).permute(0,3,1,2).contiguous())
    np.save("kprobe/y_torch.npy",y.numpy())
    # export weights in Keras order
    out={}
    for k,v in m.state_dict().items():
        a=v.detach().cpu().numpy()
        if a.ndim==4:
            a = a.transpose(2,3,0,1) if a.shape[1]==1 else a.transpose(2,3,1,0)   # depthwise [C,1,kh,kw]->[kh,kw,C,1]; conv [O,I,kh,kw]->[kh,kw,I,O]
        elif a.ndim==2: a=a.T
        out[k]=a
    np.savez("kprobe/w.npz",**out); print("saved",len(out),"tensors")
