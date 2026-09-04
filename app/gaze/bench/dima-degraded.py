# IS dima806 STILL GOOD WHEN THE FACE IS 40 PIXELS?
#
# HIS QUESTION, ASKED THREE TIMES: "why are we not using that other model
# Dima?" / "You sure we shouldn't use Dima or any sample from it if it's
# better?"
#
# It is a good instinct and finding 31 already found the model: dima806
# ViT-base reads FairFace gender at 93.4% against our faceres' 80.6%, and
# it is Apache-2.0 (verified from the repo's own metadata this session,
# not from memory -- the QNN licence in loop 47 was refused on exactly
# this kind of check).
#
# *** BUT 93.4% IS ON CLEAN 224px PORTRAITS, AND THAT IS NOT WHERE HIS
# FACES LIVE. Finding 48 measured his detections at px p50 76 off a
# 640x360 stream, and finding 49 showed what that costs OUR model: AUC
# 0.8913 at 224px falling to 0.7695 at 24px, with Black women going 53.6%
# -> 90.5% wrong. There is no reason to assume a ViT is immune. A big
# model can be MORE brittle to resolution, not less, because it was
# trained on clean crops and has more capacity to have memorised them.
#
# WHY THIS GATES EVERYTHING DOWNSTREAM. The plan for dima806 is NOT to
# ship it -- it is a ViT-base, far too heavy for the phone, and finding 43
# already refused a 1.96x speedup of a model a tenth its size. The plan is
# PSEUDO-LABELLING: use it to label real in-domain video faces
# automatically, fixing the label shortage that the FairFace-trained head
# just failed on (it wins on held-out FairFace at every size and LOSES on
# his corpus, because FairFace portraits are not video frames).
#
# A pseudo-label is only as good as the teacher AT THE SIZE IT LABELS. If
# dima806 decays like faceres does, every label it writes on a 40px video
# face is noise, and training on that noise would be worse than not
# training at all -- while looking like progress. So this runs FIRST.
#
# THE CONTROL THAT MAKES THE COMPARISON FAIR: the degradation here is
# PIL BOX-down then BILINEAR-up, which is what bench/gpu/arms.degrade does
# in JS. Those are two implementations of one transform, so the script
# MEASURES their agreement on a sample and prints it. If they disagree,
# the dima806 column and the faceres column are not describing the same
# images and the comparison is void -- that is the phase-g G1 failure in a
# new language.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-degraded.py
#   ... --limit=2000 --sizes=24,40,64,224
import argparse
import json
import os
import sys

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

FAIR = 'Z:/tamescroll-corpus/fairface'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--limit', type=int, default=0)
ap.add_argument('--sizes', default='24,32,40,48,64,96,224')
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--out', default='Z:/tamescroll-corpus/bank/dima-degraded.json')
a = ap.parse_args()
SIZES = [int(x) for x in a.sizes.split(',')]

meta = json.load(open(os.path.join(FAIR, 'full.json')))
# Interleave by (race, gender) so a --limit slice stays balanced -- the
# source is grouped and a head-N slice would be one race, which is the
# gotcha that has cost this repo a run before.
buckets = {}
for m in meta:
    buckets.setdefault((m['race'], m['gender']), []).append(m)
keys = sorted(buckets)
rows = []
i = 0
while True:
    any_ = False
    for k in keys:
        b = buckets[k]
        if i < len(b):
            rows.append(b[i])
            any_ = True
    if not any_:
        break
    i += 1
if a.limit:
    rows = rows[:a.limit]

print('rows %d   sizes %s' % (len(rows), SIZES))


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


def degrade(im, n):
    """Box-filter down to n x n, bilinear back up. Mirrors arms.degrade."""
    if not n or n >= min(im.size):
        return im
    w, h = im.size
    return im.resize((n, n), Image.BOX).resize((w, h), Image.BILINEAR)


# ---------------------------------------------------------------- model
from transformers import AutoImageProcessor, AutoModelForImageClassification

print('loading %s ...' % MODEL)
proc = AutoImageProcessor.from_pretrained(MODEL)
model = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(dev).eval()
id2label = model.config.id2label
print('  device %s   labels %s' % (dev, id2label))

# The label order is READ FROM THE MODEL, never assumed. A flipped
# gender mapping would invert every number below and still look
# plausible, and it is the single easiest way to publish a wrong table.
MALE_IDX = [i for i, l in id2label.items() if str(l).lower().startswith('male')]
assert len(MALE_IDX) == 1, 'cannot identify the male class in %s' % id2label
MALE_IDX = MALE_IDX[0]
print('  male class index %d (%s)' % (MALE_IDX, id2label[MALE_IDX]))

out = []
with torch.no_grad():
    for px in SIZES:
        preds = []
        for s in range(0, len(rows), a.batch):
            chunk = rows[s:s + a.batch]
            ims = [degrade(read_ppm(os.path.join(FAIR, 'full', r['file'])), px)
                   for r in chunk]
            inp = proc(images=ims, return_tensors='pt').to(dev)
            logits = model(**inp).logits
            p = torch.softmax(logits, -1)[:, MALE_IDX].cpu().numpy()
            preds.extend(p.tolist())
            if s and s % (a.batch * 40) == 0:
                sys.stderr.write('  %dpx  %d/%d\n' % (px, s, len(rows)))
        for r, p in zip(rows, preds):
            out.append({'row': r['row'], 'race': r['race'],
                        'who': 'man' if r['gender'] == 'Male' else 'woman',
                        'nativePx': px, 'raw': float(p)})
        # Per-size summary as we go, so a long run is readable while it runs.
        w = [x for x in out if x['nativePx'] == px and x['who'] == 'woman']
        m = [x for x in out if x['nativePx'] == px and x['who'] == 'man']
        ww = sum(1 for x in w if x['raw'] >= 0.5) / max(1, len(w))
        mw = sum(1 for x in m if x['raw'] < 0.5) / max(1, len(m))
        print('  %4dpx   women wrong %5.1f%%   men wrong %5.1f%%'
              % (px, 100 * ww, 100 * mw))

json.dump(out, open(a.out, 'w'))
print('banked %s  (%d rows)' % (a.out, len(out)))
