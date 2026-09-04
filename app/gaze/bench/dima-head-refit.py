# IS THE SIGNAL STILL IN A TRUNCATED dima806, OR IS IT GONE?
#
# `dima-shrink-corpus.py` chopped blocks off dima and every configuration
# collapsed -- women wrong 93-100%, men wrong 0%, i.e. the model answers
# "male" to everything. But AUC stayed at 0.64-0.79, well above the 0.50
# of a coin. Those two facts together are a specific claim: the shortened
# trunk still SEPARATES men from women, and the classifier -- fitted to
# the output of twelve blocks and handed eight -- cannot read it.
#
# If that is right, refitting one linear layer recovers most of it and
# shrinking is alive. If AUC does not move, the representation really is
# gone and no amount of fine-tuning saves the approach.
#
# WHAT IS TRAINED AND ON WHAT: the trunk is FROZEN. Only a new linear
# head is fitted, on FairFace's TRUE labels (10,954 faces on disk), and
# scored on HIS corpus -- different people, different footage, never seen
# in training. That is the split finding 50 established as the only one
# that cannot flatter itself.
#
# HONEST LIMIT, STATED UP FRONT: this is the CHEAPEST possible recovery.
# A real fine-tune would unfreeze the trunk and use the full teacher's
# soft outputs. So a good result here is a floor on what shrinking can
# do, and a bad result is not proof that shrinking is impossible -- only
# that it is not cheap.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-head-refit.py
import argparse
import copy
import json
import os

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

BANK = 'Z:/tamescroll-corpus/bank'
FF = 'Z:/tamescroll-corpus/fairface'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=96)
ap.add_argument('--out', default=BANK + '/dima-head-refit.json')
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


# --- his corpus: the evaluation set, and nothing is fitted on it -------
labels = json.load(open(BANK + '/label/labels.json'))
clusters = json.load(open(BANK + '/label/clusters.json'))
crows = []
for c in clusters:
    who = labels.get(c['id'])
    if who not in ('woman', 'man'):
        continue
    for m in c['members']:
        p = os.path.join(BANK, 'crops', m['crop'])
        if os.path.exists(p):
            crows.append({'who': who, 'cid': c['id'], 'vid': c['vid'], 'path': p})
print('corpus %d reads, %d identities' % (len(crows), len(set(r['cid'] for r in crows))))

# --- FairFace: the training set, true labels --------------------------
ff = json.load(open(FF + '/full.json'))
frows = [{'y': 1 if r['gender'] == 'Male' else 0,
          'path': os.path.join(FF, 'full', r['file'])} for r in ff]
frows = [r for r in frows if os.path.exists(r['path'])]
print('fairface %d faces, %d male' % (len(frows), sum(r['y'] for r in frows)))

from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
base = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
print('device', dev)


def vit_of(m):
    for n in ('vit', 'base_model', 'model'):
        if hasattr(m, n):
            return getattr(m, n)
    raise SystemExit('no trunk')


def blocks_of(m):
    v = vit_of(m)
    return v.layers if hasattr(v, 'layers') else v.encoder.layer


def set_blocks(m, kept):
    v = vit_of(m)
    if hasattr(v, 'layers'):
        v.layers = torch.nn.ModuleList(kept)
    else:
        v.encoder.layer = torch.nn.ModuleList(kept)


DEPTH = len(blocks_of(base))
print('depth', DEPTH)

print('decoding...')
cimgs = [read_ppm(r['path']) for r in crows]
fimgs = [read_ppm(r['path']) for r in frows]
print('  corpus %d, fairface %d' % (len(cimgs), len(fimgs)))

cy = np.array([1 if r['who'] == 'man' else 0 for r in crows])
fy = np.array([r['y'] for r in frows])


def features(trunk, imgs, size):
    """Pooled trunk output, which is what the classifier reads."""
    out = []
    kw = {} if size == 224 else {'interpolate_pos_encoding': True}
    with torch.no_grad():
        for s in range(0, len(imgs), a.batch):
            pv = proc(images=imgs[s:s + a.batch], return_tensors='pt')['pixel_values']
            if size != 224:
                pv = torch.nn.functional.interpolate(
                    pv, size=(size, size), mode='bilinear', align_corners=False)
            h = trunk(pixel_values=pv.to(dev), **kw).last_hidden_state
            # the CLS token, which is the vector the shipped head reads
            out.append(h[:, 0].float().cpu().numpy())
    return np.concatenate(out)


def auc(pos, neg):
    if not len(pos) or not len(neg):
        return float('nan')
    allv = np.concatenate([pos, neg])
    order = allv.argsort()
    ranks = np.empty(len(allv), float)
    ranks[order] = np.arange(1, len(allv) + 1)
    _, inv, cnt = np.unique(allv, return_inverse=True, return_counts=True)
    sums = np.zeros(len(cnt))
    np.add.at(sums, inv, ranks)
    ranks = (sums / cnt)[inv]
    return (ranks[:len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg))


from sklearn.linear_model import LogisticRegression

CONFIGS = [(DEPTH, 224), (DEPTH, 112), (8, 224), (6, 224), (4, 224),
           (8, 112), (6, 112), (4, 112), (6, 64), (4, 64)]

print('')
print('%-18s %10s %10s   %s' % ('config', 'AUC before', 'AUC after', 'women wrong after'))
res = []
for depth, size in CONFIGS:
    m = copy.deepcopy(base)
    if depth < DEPTH:
        set_blocks(m, list(blocks_of(m))[:depth])
    trunk = vit_of(m).to(dev).eval()

    fX = features(trunk, fimgs, size)
    cX = features(trunk, cimgs, size)

    # BEFORE: the shipped classifier reading the shortened trunk.
    head = m.classifier.to(dev).eval()
    with torch.no_grad():
        before = torch.softmax(head(torch.from_numpy(cX).to(dev)), -1)[:, 1].cpu().numpy()

    # AFTER: one linear layer refitted on FairFace true labels.
    clf = LogisticRegression(max_iter=2000, C=1.0)
    clf.fit(fX, fy)
    after = clf.predict_proba(cX)[:, 1]

    ab = auc(before[cy == 1], before[cy == 0])
    aa = auc(after[cy == 1], after[cy == 0])
    ww = 100.0 * (after[cy == 0] >= 0.5).mean()
    print('%-18s %10.4f %10.4f   %6.1f%%' % ('%d blocks @%dpx' % (depth, size), ab, aa, ww))
    res.append({'depth': depth, 'size': size, 'aucBefore': float(ab),
                'aucAfter': float(aa), 'womenWrongAfter': float(ww),
                'raw': [float(x) for x in after]})

    trunk.to('cpu')
    del m, trunk, fX, cX
    if dev == 'cuda':
        torch.cuda.empty_cache()

json.dump({'rows': [{'who': r['who'], 'cid': r['cid'], 'vid': r['vid']} for r in crows],
           'arms': res}, open(a.out, 'w'))
print('')
print('banked %s' % a.out)
print('shipped grey AUC on this population is 0.9855; full dima is 0.9960.')
