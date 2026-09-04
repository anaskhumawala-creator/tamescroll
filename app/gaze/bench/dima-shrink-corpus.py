# WHAT DOES SHRINKING dima806 ACTUALLY COST IN ACCURACY, ON HIS FOOTAGE?
#
# `Z:/ml/dima-shrink-ceiling.py` measured SPEED only and found real
# configurations inside budget (4 blocks at 112px is ~350ms on his phone
# against faceres' 141ms; 2 blocks at 64px is ~96ms, cheaper than what
# ships). Speed alone decides nothing: a chopped transformer is broken
# until fine-tuned, and the whole point of the exercise is the accuracy.
#
# So this scores every shrink configuration on HIS OWN CORPUS -- 52
# identities off ten real videos, hand-clustered and hand-labelled, which
# nothing in the comparison has ever seen. Same loader, same labels and
# same crops as `dima-corpus.py`, so the numbers are comparable row for
# row with finding 50.
#
# TWO AXES, AND THEY ARE NOT THE SAME KIND OF CHANGE:
#
#   INPUT SIZE is free. The weights are untouched; ViT just sees fewer
#   patches, with the position embeddings interpolated. Whatever accuracy
#   survives here is available TODAY with no training at all.
#
#   DEPTH is destructive. Dropping blocks throws away learned
#   computation and the classifier head is left reading a representation
#   it was never fitted to. These numbers are expected to be bad; they
#   are here to say HOW bad, i.e. how much ground fine-tuning has to
#   recover, and whether the collapse is gradual (worth training) or
#   total (not worth it).
#
# READ AUC, NOT THE BOUNDARY. This repo's rule: an arm wins an accuracy
# column by leaning female, which is a threshold move in disguise. A bar
# solver can move a matched-exposure cell; nothing can move AUC. The
# boundary column is printed beside it only to show which way an arm
# leans.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-shrink-corpus.py
import argparse
import copy
import json
import os
import sys
import time

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

BANK = 'Z:/tamescroll-corpus/bank'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--out', default=BANK + '/dima-shrink-corpus.json')
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
print('corpus reads %d   women %d / men %d   identities %d'
      % (len(rows), sum(r['who'] == 'woman' for r in rows),
         sum(r['who'] == 'man' for r in rows),
         len(set(r['cid'] for r in rows))))


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
base = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
# Read the male class off the model rather than assuming index 1. A
# flipped mapping inverts every number below and still looks plausible.
MALE = [i for i, l in base.config.id2label.items()
        if str(l).lower().startswith('male')]
assert len(MALE) == 1, base.config.id2label
MALE = MALE[0]
print('device %s   male class %d (%s)' % (dev, MALE, base.config.id2label[MALE]))


def vit_of(model):
    for name in ('vit', 'base_model', 'model'):
        if hasattr(model, name):
            return getattr(model, name)
    raise SystemExit('cannot find the ViT trunk')


def blocks_of(model):
    v = vit_of(model)
    return v.layers if hasattr(v, 'layers') else v.encoder.layer


def set_blocks(model, kept):
    v = vit_of(model)
    if hasattr(v, 'layers'):
        v.layers = torch.nn.ModuleList(kept)
    else:
        v.encoder.layer = torch.nn.ModuleList(kept)


DEPTH_FULL = len(blocks_of(base))
print('dima depth %d blocks' % DEPTH_FULL)

# Decode every crop ONCE. The sweep runs a dozen configurations over the
# same 2,159 images and re-reading them each time would dominate the run.
print('decoding crops...')
imgs = []
keep = []
for r in rows:
    p = os.path.join(BANK, 'crops', r['crop'])
    if not os.path.exists(p):
        continue
    imgs.append(read_ppm(p))
    keep.append(r)
print('  %d crops decoded (%d rows had no file)' % (len(imgs), len(rows) - len(imgs)))


def auc(pos, neg):
    """P(a random positive scores above a random negative). Ties count a half."""
    if not len(pos) or not len(neg):
        return float('nan')
    allv = np.concatenate([pos, neg])
    order = allv.argsort()
    ranks = np.empty(len(allv), float)
    ranks[order] = np.arange(1, len(allv) + 1)
    # average ranks over ties, or a saturated arm scores wrong
    _, inv, cnt = np.unique(allv, return_inverse=True, return_counts=True)
    sums = np.zeros(len(cnt))
    np.add.at(sums, inv, ranks)
    ranks = (sums / cnt)[inv]
    rp = ranks[:len(pos)].sum()
    return (rp - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg))


def score(model, size):
    model = model.to(dev).eval()
    raws = np.zeros(len(imgs), dtype=np.float32)
    kw = {} if size == 224 else {'interpolate_pos_encoding': True}
    t0 = time.time()
    with torch.no_grad():
        for s in range(0, len(imgs), a.batch):
            chunk = imgs[s:s + a.batch]
            inp = proc(images=chunk, return_tensors='pt')
            pv = inp['pixel_values']
            if size != 224:
                pv = torch.nn.functional.interpolate(
                    pv, size=(size, size), mode='bilinear', align_corners=False)
            pv = pv.to(dev)
            logits = model(pixel_values=pv, **kw).logits
            raws[s:s + len(chunk)] = torch.softmax(logits, -1)[:, MALE].cpu().numpy()
    model.to('cpu')
    return raws, time.time() - t0


who = np.array([r['who'] for r in keep])
isw = who == 'woman'
ism = who == 'man'

results = []
CONFIGS = [(DEPTH_FULL, 224), (DEPTH_FULL, 112), (DEPTH_FULL, 64),
           (8, 224), (6, 224), (4, 224),
           (8, 112), (6, 112), (4, 112), (3, 112),
           (6, 64), (4, 64), (2, 64)]

print('')
print('%-18s %8s %8s %8s   %s' % ('config', 'AUC', 'women', 'men', 'sec'))
print('%-18s %8s %8s %8s' % ('', '', 'wrong', 'wrong'))
for depth, size in CONFIGS:
    m = copy.deepcopy(base)
    if depth < DEPTH_FULL:
        set_blocks(m, list(blocks_of(m))[:depth])
    raws, secs = score(m, size)
    del m
    if dev == 'cuda':
        torch.cuda.empty_cache()
    # men are the positive class: raw is P(male)
    A = auc(raws[ism], raws[isw])
    ww = 100.0 * (raws[isw] >= 0.5).mean()
    mw = 100.0 * (raws[ism] < 0.5).mean()
    label = '%d blocks @%dpx' % (depth, size)
    print('%-18s %8.4f %7.1f%% %7.1f%%   %.0f' % (label, A, ww, mw, secs))
    results.append({'depth': depth, 'size': size, 'auc': float(A),
                    'womenWrong': float(ww), 'menWrong': float(mw),
                    'raw': [float(x) for x in raws]})

json.dump({'rows': [{k: r[k] for k in ('who', 'cid', 'vid', 'crop', 'px')} for r in keep],
           'arms': results}, open(a.out, 'w'))
print('')
print('banked %s' % a.out)
print('')
print('AUC IS THE COLUMN THAT MEANS SOMETHING. The women/men columns are')
print('read at the raw 0.5 boundary, which no shipped decision uses, and')
print('an arm can win either by leaning. Matched-exposure comes next.')
