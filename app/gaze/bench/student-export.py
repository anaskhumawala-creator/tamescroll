# PORT A TRAINED STUDENT TO THE TWO FORMS THE APP CAN ACTUALLY LOAD,
# AND GATE THE PORT ON PARITY.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-export.py \
#       --model Z:/tamescroll-corpus/student/model-w1-s112-grey-foldA.pt \
#       --size 112 --width 1.0
#
# ---------------------------------------------------------------------
# WHY THIS ROUTE AND NOT ANY OF THE OBVIOUS ONES
#
# Every standard PyTorch -> TFLite path is blocked on this machine, and
# each was checked rather than assumed:
#
#   litert-torch (was ai-edge-torch)  Linux/macOS only; issue #968 open.
#   onnx2tf                           needs Python >= 3.12 and a pip
#                                     install; PyPI and files.pythonhosted
#                                     are both TCP-unreachable from here.
#   torch.onnx.export                 the `onnx` package is not installed
#                                     and cannot be.
#   tensorflow-directml               paused by Microsoft, caps at py<3.11.
#   local TF 2.15                     built_with_cuda False -- CPU only.
#
# So the student is AUTHORED IN KERAS and TRAINED IN PYTORCH, and only
# the weights cross. No graph conversion happens at all, which also side-
# steps the grappler war `spikes/native/convert.py` fights -- that war is
# an artifact of its source being a tfjs GraphDef, and a Keras model is
# not one.
#
# ---------------------------------------------------------------------
# THE PARITY GATE, AND WHY IT RUNS ON TRAINED WEIGHTS
#
# The first version of this bridge reported MAX ABS DELTA 6.4e-04 on
# random weights and was WRONG. The random model output 0.5799 for both
# probe inputs -- a spread of ~1e-5 -- so the delta was small because
# nothing was happening, not because the port was right. With trained
# weights the same code gave 3.6e-01 and anti-correlated outputs.
#
# The bug: TF 'SAME' padding on a stride-2 conv is (0,1) only when the
# input is EVEN; on an odd input it is (1,1). At 112px the net runs
# 112->56->28->14->7->4, and that last stride-2 layer sees an ODD 7.
# A hardcoded (0,1,0,1) misaligned every layer downstream of it.
#
# That is finding 43 on a new instrument: AN AGREEMENT METRIC WITH NO
# SPREAD BESIDE IT CANNOT TELL 'IDENTICAL' FROM 'DEAD'. So this file
# REFUSES to print a pass unless the probe outputs actually span.
import argparse
import os
import sys

os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ap = argparse.ArgumentParser()
ap.add_argument('--model', required=True)
ap.add_argument('--size', type=int, default=112)
ap.add_argument('--width', type=float, default=1.0)
ap.add_argument('--probe', type=int, default=32)
ap.add_argument('--outdir', default='Z:/tamescroll-corpus/student/export')
# TWO STAGES, TWO INTERPRETERS, AND THAT IS NOT A WORKAROUND -- IT IS THE
# MACHINE. torch+CUDA lives in Z:/ml/venv; tensorflow lives in
# spikes/native/venv; neither has the other and installing torch into the
# TF venv would put 200MB somewhere for one function call. The proven
# bridge in spikes/torch-keras-bridge already worked this way.
#
#   Z:/ml/venv/Scripts/python.exe        ... --stage torch
#   spikes/native/venv/Scripts/python.exe ... --stage keras
#
# The torch stage writes the weights AND the probe AND torch's own
# outputs; the keras stage reads all three and gates on them. The probe
# outputs cross the boundary deliberately: a gate that re-ran the torch
# model on the keras side would not be a cross-framework check at all.
ap.add_argument('--stage', choices=['torch', 'keras'], required=True)
a = ap.parse_args()
BRIDGE = os.path.join(a.outdir, os.path.basename(a.model).replace('.pt', '') + '.npz')

from student_spec import spec  # noqa: E402  (torch-free; both stages)

# --- torch side -------------------------------------------------------
if a.stage == 'torch':
  import torch  # noqa: E402
  from student_arch import Student  # noqa: E402

  model = Student(a.width)
  model.load_state_dict(torch.load(a.model, map_location='cpu'))
  model.eval()
  NP = sum(p.numel() for p in model.parameters())
  print('torch params %d   %s' % (NP, os.path.basename(a.model)))

  # THE PROBE IS REAL PIXELS, NOT NOISE. A random tensor lands nowhere near
  # the manifold the net was trained on, and a net evaluated off-manifold
  # can produce a narrow output range for reasons that have nothing to do
  # with the port. These are the first `--probe` crops of his own corpus.
  import json  # noqa: E402
  from PIL import Image  # noqa: E402

  CORPUS = 'Z:/tamescroll-corpus'
  idx = json.load(open(CORPUS + '/student/index.json'))[:a.probe]


  def read_ppm(path):
      with open(path, 'rb') as fh:
          assert fh.readline().strip() == b'P6'
          line = fh.readline()
          while line.startswith(b'#'):
              line = fh.readline()
          w, h = [int(x) for x in line.split()]
          fh.readline()
          return np.frombuffer(fh.read(w * h * 3), dtype=np.uint8).reshape(h, w, 3)


  X = np.stack([
      np.asarray(Image.fromarray(read_ppm(CORPUS + '/student/crops/' + r['crop']))
                 .resize((a.size, a.size), Image.BILINEAR), dtype=np.float32) / 255.0
      for r in idx])
  X = (X - 0.5) / 0.5
  X = X.astype(np.float32)

  with torch.no_grad():
      yt = torch.sigmoid(model(torch.from_numpy(X).permute(0, 3, 1, 2).contiguous())).numpy()

  spread_t = float(yt.max() - yt.min())
  print('torch output   min %.4f  max %.4f  SPREAD %.4f' % (yt.min(), yt.max(), spread_t))
  if spread_t < 0.05:
      raise SystemExit(
          '*** REFUSING TO GATE: the probe outputs span %.4f. A parity check on a\n'
          '*** model that answers the same thing to every input cannot fail, which\n'
          '*** is how this bridge shipped a broken padding rule that read as 6.4e-04.'
          % spread_t)

  # --- weights, in Keras order -----------------------------------------
  W = {}
  for k, v in model.state_dict().items():
      arr = v.detach().cpu().numpy()
      if arr.ndim == 4:
          # depthwise [C,1,kh,kw] -> [kh,kw,C,1]; conv [O,I,kh,kw] -> [kh,kw,I,O]
          arr = arr.transpose(2, 3, 0, 1) if arr.shape[1] == 1 else arr.transpose(2, 3, 1, 0)
      elif arr.ndim == 2:
          arr = arr.T
      W[k] = arr

  if a.stage == 'torch':
      os.makedirs(a.outdir, exist_ok=True)
      np.savez(BRIDGE, X=X, yt=yt, **{('w_' + k): v for k, v in W.items()})
      print('')
      print('stage 1 done: %s' % BRIDGE)
      print('now run the SAME command with spikes/native/venv and --stage keras')
      raise SystemExit(0)

# --- keras side -------------------------------------------------------
# NO TORCH BEYOND THIS LINE. Everything the gate compares against -- the
# probe pixels, torch's own outputs, and the weights already transposed
# into Keras order -- crossed the boundary as a .npz. Re-running the
# torch model here would not be a cross-framework check.
_b = np.load(BRIDGE)
X = _b['X']
yt = _b['yt']
W = {k[2:]: _b[k] for k in _b.files if k.startswith('w_')}
NP = int(sum(v.size for k, v in W.items() if not k.endswith(('running_mean', 'running_var', 'num_batches_tracked'))))
spread_t = float(yt.max() - yt.min())
print('bridge %s   probe %d   torch spread %.4f' % (os.path.basename(BRIDGE), len(X), spread_t))
if spread_t < 0.05:
    raise SystemExit('*** REFUSING TO GATE: probe spread %.4f -- a check that cannot fail.'
                     % spread_t)

import tensorflow as tf  # noqa: E402
from tensorflow import keras  # noqa: E402
from tensorflow.keras import layers as L  # noqa: E402


def build(width, size):
    i = keras.Input((size, size, 3))
    x = i
    for kind, f, st in spec(width):
        if kind == 'cbr':
            x = L.Conv2D(f, 3, st, 'same', use_bias=False)(x)
            x = L.BatchNormalization(epsilon=1e-3)(x)
            x = L.ReLU(6.)(x)
        else:
            x = L.DepthwiseConv2D(3, st, 'same', use_bias=False)(x)
            x = L.BatchNormalization(epsilon=1e-3)(x)
            x = L.ReLU(6.)(x)
            x = L.Conv2D(f, 1, 1, 'same', use_bias=False)(x)
            x = L.BatchNormalization(epsilon=1e-3)(x)
            x = L.ReLU(6.)(x)
    x = L.GlobalAveragePooling2D()(x)
    return keras.Model(i, L.Dense(1, activation='sigmoid')(x))


km = build(a.width, a.size)
keys = list(W.keys())
conv = [k for k in keys if k.endswith('.weight') and W[k].ndim == 4]
bn = sorted({k.rsplit('.', 1)[0] for k in keys if k.endswith('.running_mean')},
            key=lambda s: keys.index(s + '.running_mean'))
ci = bi = 0
for lyr in km.layers:
    if isinstance(lyr, (L.Conv2D, L.DepthwiseConv2D)):
        lyr.set_weights([W[conv[ci]]])
        ci += 1
    elif isinstance(lyr, L.BatchNormalization):
        p = bn[bi]
        lyr.set_weights([W[p + '.weight'], W[p + '.bias'],
                         W[p + '.running_mean'], W[p + '.running_var']])
        bi += 1
    elif isinstance(lyr, L.Dense):
        lyr.set_weights([W['head.weight'], W['head.bias']])
print('ported  convs %d  batchnorms %d' % (ci, bi))
assert ci == len(conv), 'a conv layer went unported'
assert bi == len(bn), 'a batchnorm went unported'

yk = km.predict(X, verbose=0)
d_keras = float(np.abs(yk - yt).max())
print('keras vs torch   MAX ABS DELTA %.3e   (spread %.4f)'
      % (d_keras, float(yk.max() - yk.min())))

os.makedirs(a.outdir, exist_ok=True)
base = os.path.basename(a.model).replace('.pt', '')

conv_f16 = tf.lite.TFLiteConverter.from_keras_model(km)
conv_f16.optimizations = [tf.lite.Optimize.DEFAULT]
conv_f16.target_spec.supported_types = [tf.float16]
blob = conv_f16.convert()
open(os.path.join(a.outdir, base + '-f16.tflite'), 'wb').write(blob)

it = tf.lite.Interpreter(model_content=blob)
inp = it.get_input_details()[0]
out = it.get_output_details()[0]
it.resize_tensor_input(inp['index'], [len(X), a.size, a.size, 3])
it.allocate_tensors()
it.set_tensor(inp['index'], X)
it.invoke()
yl = it.get_tensor(out['index'])
d_lite = float(np.abs(yl - yt).max())
print('tflite-f16 vs torch  MAX ABS DELTA %.3e   %d bytes' % (d_lite, len(blob)))

# --- THE GATE ---------------------------------------------------------
# fp16 rounding alone lands near 1e-04 on this topology, measured. Keras
# in fp32 must be far tighter than that -- a delta at fp16's level in the
# fp32 leg means a transposed tensor, not rounding.
OK_KERAS = 1e-4
OK_LITE = 5e-3
bad = []
if d_keras > OK_KERAS:
    bad.append('keras %.3e > %.0e' % (d_keras, OK_KERAS))
if d_lite > OK_LITE:
    bad.append('tflite %.3e > %.0e' % (d_lite, OK_LITE))
print('')
if bad:
    raise SystemExit('*** PARITY FAILED: %s\n'
                     '*** Do not ship this export. On an odd feature-map size check\n'
                     '*** the TF SAME padding rule first -- that is what broke it before.'
                     % '; '.join(bad))
print('PARITY OK   torch == keras == tflite-f16 on %d real crops, spread %.4f'
      % (len(X), spread_t))
print('  %s  %d bytes  (%d params)'
      % (os.path.join(a.outdir, base + '-f16.tflite'), len(blob), NP))
print('  faceres ships at 13,956,708 bytes / 3.5M params for comparison.')
