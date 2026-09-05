import os,sys; os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np, tensorflow as tf
from tensorflow import keras; from tensorflow.keras import layers as L
from arch import spec
w=np.load("kprobe/w.npz"); keys=list(w.files)
i=keras.Input((112,112,3)); x=i; taps=[]
for kind,f,st in spec():
    if kind=='cbr':
        x=L.Conv2D(f,3,st,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
    else:
        x=L.DepthwiseConv2D(3,st,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
        x=L.Conv2D(f,1,1,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
    taps.append(x)
m=keras.Model(i,taps)
conv=[k for k in keys if k.endswith('.weight') and w[k].ndim==4]
bn=[k.rsplit('.',1)[0] for k in keys if k.endswith('.running_mean')]
ci=bi=0
for lyr in m.layers:
    if isinstance(lyr,(L.Conv2D,L.DepthwiseConv2D)): lyr.set_weights([w[conv[ci]]]); ci+=1
    elif isinstance(lyr,L.BatchNormalization):
        p=bn[bi]; lyr.set_weights([w[p+'.weight'],w[p+'.bias'],w[p+'.running_mean'],w[p+'.running_var']]); bi+=1
print("conv order:",conv); print("bn order:",bn)
xin=np.load("kprobe/x.npy"); ks=m.predict(xin,verbose=0)
ts=np.load("kprobe/acts_t.npz")
for j,k in enumerate(ks):
    t=ts[f"b{j}"]; print(f"block {j} keras{k.shape} torch{t.shape} maxdelta {np.abs(k-t).max():.3e} scale {np.abs(t).max():.3f}")
