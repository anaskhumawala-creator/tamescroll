import os,sys; os.environ["TF_ENABLE_ONEDNN_OPTS"]="0"; os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np, tensorflow as tf
from tensorflow import keras; from tensorflow.keras import layers as L
from arch import spec
def build():
    i=keras.Input((112,112,3)); x=i
    for kind,f,st in spec():
        if kind=='cbr':
            x=L.Conv2D(f,3,st,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
        else:
            x=L.DepthwiseConv2D(3,st,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
            x=L.Conv2D(f,1,1,'same',use_bias=False)(x); x=L.BatchNormalization(epsilon=1e-3)(x); x=L.ReLU(6.)(x)
    x=L.GlobalAveragePooling2D()(x); o=L.Dense(1,activation='sigmoid')(x)
    return keras.Model(i,o)
m=build(); w=np.load("kprobe/w.npz")
keys=[k for k in w.files]
conv=[k for k in keys if k.endswith('.weight') and w[k].ndim==4]
bn  =sorted(set(k.rsplit('.',1)[0] for k in keys if k.endswith('.running_mean')), key=lambda s:keys.index(s+'.running_mean'))
ci=bi=0
for lyr in m.layers:
    if isinstance(lyr,(L.Conv2D,L.DepthwiseConv2D)): lyr.set_weights([w[conv[ci]]]); ci+=1
    elif isinstance(lyr,L.BatchNormalization):
        p=bn[bi]; lyr.set_weights([w[p+'.weight'],w[p+'.bias'],w[p+'.running_mean'],w[p+'.running_var']]); bi+=1
    elif isinstance(lyr,L.Dense): lyr.set_weights([w['head.weight'],w['head.bias']])
print("ported convs",ci,"bns",bi)
x=np.load("kprobe/x.npy"); yk=m.predict(x,verbose=0); yt=np.load("kprobe/y_torch.npy")
print("torch",yt.ravel()); print("keras",yk.ravel())
print("MAX ABS DELTA %.3e"%np.abs(yk-yt).max())
c=tf.lite.TFLiteConverter.from_keras_model(m); c.optimizations=[tf.lite.Optimize.DEFAULT]; c.target_spec.supported_types=[tf.float16]
b=c.convert(); open("kprobe/ported-f16.tflite","wb").write(b)
it=tf.lite.Interpreter(model_content=b); it.allocate_tensors()
d=it.get_input_details()[0]; o=it.get_output_details()[0]
it.resize_tensor_input(d['index'],[2,112,112,3]); it.allocate_tensors()
it.set_tensor(d['index'],x); it.invoke(); yl=it.get_tensor(o['index'])
print("tflite-f16",yl.ravel(),"| delta vs torch %.3e"%np.abs(yl-yt).max(),"| bytes",len(b))
