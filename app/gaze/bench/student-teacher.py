# TEACHER PASS: dima806 soft targets over every training pixel we own.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-teacher.py
#
# TWO POOLS, and they do different jobs:
#
#   FAIRFACE (10,954 validation faces, CC BY 4.0 verified on the repo's
#       own README, under `### Data`). This is where IDENTITY DIVERSITY
#       comes from. Finding 51 is the reason it has to: his own corpus is
#       2,159 reads over ~46 distinct people, and a head fitted on that
#       many identities produced a result about n rather than about
#       labels -- the pseudo-label arm BEAT the true-label arm, which is
#       noise wearing a finding's clothes.
#
#   IN-DOMAIN (5,451 crops cut by student-crops.mjs from his own ten
#       videos at 640x360, through the shipped squareBox). This is where
#       DOMAIN comes from -- compression, motion blur, stage lighting,
#       broadcast colour. Finding 50's retrain arm died precisely here:
#       it won on held-out FairFace at every size and LOST on his corpus,
#       because FairFace portraits are not video frames.
#
# Neither pool alone has been enough in any previous round. This is the
# first time both are in one training set.
#
# NO LABELS ARE USED FROM EITHER POOL. Distillation trains on the
# teacher's continuous output, which is why the in-domain pool is usable
# at all -- nobody has hand-labelled those 5,451 crops and nobody needs
# to. FairFace's true labels ARE on disk and are banked here beside the
# soft targets, so a later arm can ask whether hard labels add anything;
# they are not used by the distillation itself.
#
# THE TEACHER READS COLOUR AT 224. `dima-grey.py` measured grey COSTING
# dima 0.0122 AUC (0 of 2000 identity bootstraps positive), so feeding it
# the pipeline's grey would hand the student a worse teacher for no
# reason. What INPUT the student gets is a separate question and is swept
# in training -- teacher and student do not have to see the same picture.
import argparse
import json
import os
import time

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

CORPUS = 'Z:/tamescroll-corpus'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--out', default=CORPUS + '/student/teacher.json')
a = ap.parse_args()


def read_ppm(path):
    with open(path, 'rb') as fh:
        assert fh.readline().strip() == b'P6'
        line = fh.readline()
        while line.startswith(b'#'):
            line = fh.readline()
        w, h = [int(x) for x in line.split()]
        fh.readline()
        d = np.frombuffer(fh.read(w * h * 3), dtype=np.uint8).reshape(h, w, 3)
    return Image.fromarray(d)


rows = []

# --- pool 1: his own frames, native resolution -----------------------
idx = json.load(open(CORPUS + '/student/index.json'))
for r in idx:
    rows.append({'pool': 'domain', 'path': CORPUS + '/student/crops/' + r['crop'],
                 # `crop` STAYS, not just `path`. The first run dropped it
                 # with the absolute path and the trainer could not find a
                 # single file -- a bank that cannot be joined back to its
                 # own pixels is not a bank.
                 'crop': r['crop'],
                 'vid': r['vid'], 'px': r['px'], 'y': None,
                 'faceresRaw': r['raw'], 'faceresAge': r['age'], 'faceresNm': r['nm']})

# --- pool 2: FairFace, identity diversity ----------------------------
ff = json.load(open(CORPUS + '/fairface/full.json'))
for r in ff:
    p = os.path.join(CORPUS, 'fairface', 'full', r['file'])
    if os.path.exists(p):
        rows.append({'pool': 'fairface', 'path': p, 'file': r['file'],
                     'vid': None, 'px': None,
                     'y': 1 if r['gender'] == 'Male' else 0,
                     'race': r.get('race'), 'faceresRaw': None,
                     'faceresAge': None, 'faceresNm': None})

nd = sum(r['pool'] == 'domain' for r in rows)
nf = len(rows) - nd
print('domain   %5d crops over %d videos' % (nd, len({r['vid'] for r in rows if r['vid']})))
print('fairface %5d faces' % nf)
print('total    %5d' % len(rows))

from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
model = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(dev).eval()
# READ THE MALE CLASS OFF THE MODEL. Assuming index 1 inverts every
# number below and still looks entirely plausible.
MALE = [i for i, l in model.config.id2label.items()
        if str(l).lower().startswith('male')]
assert len(MALE) == 1, model.config.id2label
MALE = MALE[0]
print('device %s   male class %d (%s)' % (dev, MALE, model.config.id2label[MALE]))

t0 = time.time()
out = np.zeros(len(rows), dtype=np.float32)
with torch.no_grad():
    for s in range(0, len(rows), a.batch):
        chunk = [read_ppm(r['path']) if r['path'].endswith('.ppm')
                 else Image.open(r['path']).convert('RGB')
                 for r in rows[s:s + a.batch]]
        pv = proc(images=chunk, return_tensors='pt')['pixel_values'].to(dev)
        out[s:s + len(chunk)] = torch.softmax(
            model(pixel_values=pv).logits, -1)[:, MALE].cpu().numpy()
        if (s // a.batch) % 40 == 0:
            print('  %5d / %d  (%.0fs)' % (s, len(rows), time.time() - t0), flush=True)
print('teacher pass %.0fs, %.0f crops/s' % (time.time() - t0, len(rows) / (time.time() - t0)))

# --- THE SPREAD CHECK, and it is not optional ------------------------
# This repo shipped a saturated gender model once (mini-Xception,
# 2026-08-23) and nearly published a size sweep that read 100.0%
# agreement beside 50.0% accuracy, because a constant output agrees with
# itself perfectly. A teacher whose targets do not span cannot teach.
spread = float(out.max() - out.min())
print('')
print('teacher output   min %.4f  p50 %.4f  max %.4f  SPREAD %.4f'
      % (out.min(), np.median(out), out.max(), spread))
if spread < 0.2:
    raise SystemExit('*** TEACHER SATURATED (spread %.4f). Every soft target is the '
                     'same number and distillation would teach a constant.' % spread)

for i, r in enumerate(rows):
    r['t'] = float(out[i])
    del r['path']

# Sanity, printed rather than asserted: on FairFace the teacher has TRUE
# labels to be checked against, and its error there bounds how good a
# student trained on its outputs can be.
fy = np.array([r['y'] for r in rows if r['pool'] == 'fairface'])
ft = np.array([r['t'] for r in rows if r['pool'] == 'fairface'])
print('teacher on FairFace true labels: %.1f%% wrong at 0.5  (women %.1f%%, men %.1f%%)'
      % (100 * ((ft >= 0.5) != (fy == 1)).mean(),
         100 * (ft[fy == 0] >= 0.5).mean(), 100 * (ft[fy == 1] < 0.5).mean()))
dt = np.array([r['t'] for r in rows if r['pool'] == 'domain'])
print('teacher on his own frames: %.1f%% read male, p50 %.3f' % (100 * (dt >= 0.5).mean(),
                                                                 np.median(dt)))

json.dump(rows, open(a.out, 'w'))
print('')
print('banked %s' % a.out)
