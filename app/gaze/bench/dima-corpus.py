# dima806 ON HIS OWN FOOTAGE -- THE TEST THAT CANNOT FLATTER ITSELF.
#
# *** THE CONFOUND THIS EXISTS TO KILL, AND IT INVALIDATES EVERY FairFace
# NUMBER dima806 HAS PRODUCED HERE. The model is literally called
# `fairface_gender_image_detection`. FairFace is its TRAINING domain. If
# it was fitted on the train split and we scored the val split, the
# numbers are a fair held-out read; if it was fitted on all of FairFace,
# they are memorisation and the 16.2% on Black women is fiction. There is
# no way to tell from the repo, so the FairFace table must not be quoted
# on its own.
#
# His corpus settles it: 52 identities off ten real YouTube videos, hand-
# clustered and hand-labelled, at the resolutions his player decodes.
# Different people, different footage, a different decade of camera. No
# gender model in this comparison has ever seen it.
#
# SCORED THE ONLY WAY THIS REPO ALLOWS: each arm solves its OWN bar to a
# COMMON woman-exposure and then false cover on men is read. The clear bar
# sits far above the label boundary (GENDER_CLEAR_SCORE 0.45 male means
# raw >= 0.725), so a label flip between 0.50 and 0.725 changes nothing
# that ships, and any arm wins an accuracy column by leaning female --
# which is a threshold move in disguise. Findings 29, 40, 41, 45 and 47
# were each nearly reported wrong on exactly this.
#
# The control that says the instrument is sound: the SHIPPED head must
# reproduce finding 47 on this population -- 14.8 / 19.2 / 21.8 / 25.8 /
# 35.1 -- through code that shares nothing with the bench that produced
# it. If it does not, nothing else in the output means anything.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-corpus.py
import argparse
import json
import os
import sys

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

BANK = 'Z:/tamescroll-corpus/bank'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--out', default=BANK + '/dima-corpus.json')
a = ap.parse_args()

labels = json.load(open(BANK + '/label/labels.json'))
clusters = json.load(open(BANK + '/label/clusters.json'))
rows = []
for c in clusters:
    who = labels.get(c['id'])
    if who not in ('woman', 'man'):
        continue
    for m in c['members']:
        rows.append({'who': who, 'cid': c['id'], 'vid': c['vid'],
                     'crop': m['crop'], 'px': m.get('px')})
print('corpus reads %d   women %d / men %d'
      % (len(rows), sum(r['who'] == 'woman' for r in rows),
         sum(r['who'] == 'man' for r in rows)))


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


from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
model = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(dev).eval()
# Read the male class off the model. A flipped mapping inverts every
# number below and still looks plausible.
MALE = [i for i, l in model.config.id2label.items()
        if str(l).lower().startswith('male')]
assert len(MALE) == 1, model.config.id2label
MALE = MALE[0]
print('device %s   male class %d (%s)' % (dev, MALE, model.config.id2label[MALE]))

out = []
with torch.no_grad():
    for s in range(0, len(rows), a.batch):
        chunk = rows[s:s + a.batch]
        ims = []
        keep = []
        for r in chunk:
            p = os.path.join(BANK, 'crops', r['crop'])
            if not os.path.exists(p):
                continue
            ims.append(read_ppm(p))
            keep.append(r)
        if not ims:
            continue
        inp = proc(images=ims, return_tensors='pt').to(dev)
        pr = torch.softmax(model(**inp).logits, -1)[:, MALE].cpu().numpy()
        for r, p in zip(keep, pr):
            out.append(dict(r, raw=float(p)))
        if s and s % (a.batch * 20) == 0:
            sys.stderr.write('  %d/%d\n' % (s, len(rows)))

json.dump(out, open(a.out, 'w'))
print('banked %s  (%d rows)' % (a.out, len(out)))

w = [r for r in out if r['who'] == 'woman']
m = [r for r in out if r['who'] == 'man']
print('  at the raw label boundary: women wrong %.1f%%   men wrong %.1f%%'
      % (100 * sum(1 for r in w if r['raw'] >= 0.5) / len(w),
         100 * sum(1 for r in m if r['raw'] < 0.5) / len(m)))
print('  (matched-exposure table: node app/gaze/bench/dima-score.mjs)')
