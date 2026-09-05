# FAIRFACE TRAIN (86,744 faces) -> PPM ON DISK + dima806 SOFT TARGETS.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-fftrain.py
#
# WHY THIS EXISTS. The first student trained on 16,405 images -- 10,954
# FairFace VALIDATION faces plus 5,451 in-domain crops -- and pooled to
# AUC 0.6571 against the shipped model's 0.9855. Its training loss fell
# from 0.57 to 0.17 while held-out AUC PEAKED at epoch 15 and then
# decayed, which is not "the idea is wrong", it is "the net memorised the
# training set". faceres is 3.5M parameters trained on face recognition
# over millions of images; 16k is not a training set for a competitor.
#
# The train split is 8x the validation split we had been living on, and
# it was unobtainable for most of this session -- huggingface.co was
# TCP-blocked from this machine and from every subagent. It came back
# mid-run. `HuggingFaceM4/FairFace`, license cc-by-4.0 read off the
# repo's OWN card_data rather than a search result, which is the
# distinction finding 31 turned on when a README extended a data grant
# onto weights it did not cover.
#
# PADDING 0.25, not 1.25. The repo ships both. Our runtime crop is
# `squareBox` around the detector's box, which is tight; 1.25 is a wide
# context crop and would train the student on framing it never sees.
#
# LABEL MAPPING IS READ FROM THE CARD, NOT ASSUMED: gender '0': Male,
# '1': Female. Assuming index 1 is male inverts every number downstream
# and still looks entirely plausible -- the same trap `student-teacher.py`
# guards by reading dima's own id2label.
import argparse
import glob
import io
import json
import os
import time

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import pyarrow.parquet as pq
import torch
from PIL import Image

CORPUS = 'Z:/tamescroll-corpus'
SRC = CORPUS + '/fairface-train/0.25'
OUTDIR = CORPUS + '/fairface-train/ppm'
MODEL = 'dima806/fairface_gender_image_detection'
MALE_LABEL = 0        # from the dataset card's class_label names

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--size', type=int, default=224)
ap.add_argument('--out', default=CORPUS + '/student/teacher-fftrain.json')
a = ap.parse_args()

os.makedirs(OUTDIR, exist_ok=True)
files = sorted(glob.glob(SRC + '/*.parquet'))
assert files, 'no parquet in ' + SRC
print('parquet %d files' % len(files))

from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
model = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(dev).eval()
MALE = [i for i, l in model.config.id2label.items()
        if str(l).lower().startswith('male')]
assert len(MALE) == 1, model.config.id2label
MALE = MALE[0]
print('device %s   dima male class %d (%s)' % (dev, MALE, model.config.id2label[MALE]))


def write_ppm(path, im):
    arr = np.asarray(im.convert('RGB'), dtype=np.uint8)
    h, w = arr.shape[:2]
    with open(path, 'wb') as fh:
        fh.write(b'P6\n%d %d\n255\n' % (w, h))
        fh.write(arr.tobytes())


rows = []
t0 = time.time()
seen = 0
with torch.no_grad():
    for fi, f in enumerate(files):
        tbl = pq.read_table(f)
        imgs = tbl.column('image').to_pylist()
        gen = tbl.column('gender').to_pylist()
        race = tbl.column('race').to_pylist()
        age = tbl.column('age').to_pylist()
        buf, meta = [], []
        for k in range(len(imgs)):
            im = Image.open(io.BytesIO(imgs[k]['bytes'])).convert('RGB')
            # Stored at the network's largest likely input; the trainer
            # downsamples from here, and storing smaller would cap every
            # future resolution arm at whatever was chosen today.
            if max(im.size) != a.size:
                im = im.resize((a.size, a.size), Image.BILINEAR)
            name = 'p%d_%06d.ppm' % (fi, k)
            write_ppm(os.path.join(OUTDIR, name), im)
            buf.append(im)
            meta.append({'pool': 'fftrain', 'file': name,
                         'y': 1 if gen[k] == MALE_LABEL else 0,
                         'race': race[k], 'ageBin': age[k],
                         'vid': None, 'px': None,
                         'faceresRaw': None, 'faceresAge': None, 'faceresNm': None})
            if len(buf) == a.batch:
                pv = proc(images=buf, return_tensors='pt')['pixel_values'].to(dev)
                t = torch.softmax(model(pixel_values=pv).logits, -1)[:, MALE].cpu().numpy()
                for j, m in enumerate(meta):
                    m['t'] = float(t[j])
                rows += meta
                buf, meta = [], []
                seen += a.batch
                if seen % (a.batch * 60) == 0:
                    print('  %6d / 86744  (%.0fs)' % (seen, time.time() - t0), flush=True)
        if buf:
            pv = proc(images=buf, return_tensors='pt')['pixel_values'].to(dev)
            t = torch.softmax(model(pixel_values=pv).logits, -1)[:, MALE].cpu().numpy()
            for j, m in enumerate(meta):
                m['t'] = float(t[j])
            rows += meta

print('wrote %d ppm + soft targets in %.0fs (%.0f/s)'
      % (len(rows), time.time() - t0, len(rows) / (time.time() - t0)))

tt = np.array([r['t'] for r in rows])
yy = np.array([r['y'] for r in rows])
spread = float(tt.max() - tt.min())
print('')
print('teacher output  min %.4f  p50 %.4f  max %.4f  SPREAD %.4f'
      % (tt.min(), np.median(tt), tt.max(), spread))
if spread < 0.2:
    raise SystemExit('*** TEACHER SATURATED -- distillation would teach a constant.')

# THE LABEL MAPPING, CHECKED RATHER THAN TRUSTED. dima806 is ~93.5%
# correct on the validation split, so if `gender 0 = Male` were inverted
# this line would read ~93% wrong instead of ~7%. A silent inversion here
# would train the student to be confidently backwards and every
# downstream table would still look plausible.
wrong = 100 * ((tt >= 0.5) != (yy == 1)).mean()
print('teacher vs the parquet labels: %.1f%% disagree at 0.5' % wrong)
if wrong > 40:
    raise SystemExit('*** LABEL MAPPING LOOKS INVERTED (%.1f%% disagreement). The card '
                     'says gender 0 = Male; check before training on this.' % wrong)
print('  (women %.1f%% read male, men %.1f%% read female)'
      % (100 * (tt[yy == 0] >= 0.5).mean(), 100 * (tt[yy == 1] < 0.5).mean()))

json.dump(rows, open(a.out, 'w'))
print('')
print('banked %s  (%d rows)' % (a.out, len(rows)))
print('ppm in %s' % OUTDIR)
