# DOES GREY HELP dima806, OR IS IT A faceres QUIRK?
#
# `GENDER_GREY` ships at 1 (1103), so every crop the shipped pipeline
# hands a gender model is ALREADY GREY. Any student trained on colour
# would meet grey at runtime -- a domain mismatch built in by accident,
# and the owner spotted it.
#
# But grey helping faceres is not a law. Finding 42 tested every proposed
# mechanism and refused them all: tone equalisation was worse, the
# between-group gap did not move (27.3 -> 27.2), and `blueOnly` -- which
# should strip tone best -- was the WORST arm while `redOnly` was the
# best single channel. `invert` collapses women to 84.5% wrong while
# preserving all structure, so faceres reads tone and polarity rather
# than geometry. That is a fact about faceres, not about gender models.
#
# So this measures it rather than assuming it, on his corpus, no
# training, using the SAME Rec.601 luma the shipped path applies
# (detector.js, one line after cropAndResize).
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-grey.py
import argparse
import json
import os

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
from PIL import Image

BANK = 'Z:/tamescroll-corpus/bank'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--out', default=BANK + '/dima-grey.json')
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


def cropkey(path):
    return path.replace(os.sep, '/').split('/crops/')[-1]


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

# Pin the population to the bank every baseline was measured on, or the
# comparison drifts by more than the effect being measured.
BASE = json.load(open(BANK + '/gpu-grey-mirror.json'))
by = {r['crop']: r for r in BASE}
crows = [r for r in crows if cropkey(r['path']) in by]
print('corpus %d reads (joined to the baseline bank), %d identities'
      % (len(crows), len(set(r['cid'] for r in crows))))

from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
model = AutoModelForImageClassification.from_pretrained(MODEL)
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.to(dev).eval()
MALE = [i for i, l in model.config.id2label.items()
        if str(l).lower().startswith('male')][0]
print('device %s  male class %d' % (dev, MALE))

imgs = [read_ppm(r['path']) for r in crows]
cy = np.array([1 if r['who'] == 'man' else 0 for r in crows])


def to_grey(im):
    """The SHIPPED transform: Rec.601 luma, tiled back to three channels.
    Not PIL's 'L' mode -- that is Rec.601 too but the model wants three
    channels, and matching the shipped constant matters more than
    matching a library default."""
    a_ = np.asarray(im).astype(np.float32)
    y = 0.299 * a_[..., 0] + 0.587 * a_[..., 1] + 0.114 * a_[..., 2]
    return Image.fromarray(np.repeat(y[..., None], 3, axis=2).astype(np.uint8))


def auc(pos, neg):
    allv = np.concatenate([pos, neg])
    order = allv.argsort()
    ranks = np.empty(len(allv), float)
    ranks[order] = np.arange(1, len(allv) + 1)
    _, inv, cnt = np.unique(allv, return_inverse=True, return_counts=True)
    sums = np.zeros(len(cnt))
    np.add.at(sums, inv, ranks)
    ranks = (sums / cnt)[inv]
    return (ranks[:len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg))


def score(transform, size=224):
    out = []
    with torch.no_grad():
        for s in range(0, len(imgs), a.batch):
            chunk = [transform(im) for im in imgs[s:s + a.batch]]
            pv = proc(images=chunk, return_tensors='pt')['pixel_values']
            if size != 224:
                pv = torch.nn.functional.interpolate(
                    pv, size=(size, size), mode='bilinear', align_corners=False)
            kw = {} if size == 224 else {'interpolate_pos_encoding': True}
            out.append(torch.softmax(model(pixel_values=pv.to(dev), **kw).logits,
                                     -1)[:, MALE].cpu().numpy())
    return np.concatenate(out)


# IDENTITY-LEVEL BOOTSTRAP, because 22 women identities is the unit of
# independence here and a read-level CI would be four times too narrow.
cids = np.array([r['cid'] for r in crows])
uniq = np.unique(cids)
idx_by_cid = {c: np.where(cids == c)[0] for c in uniq}


def boot_delta(a_raw, b_raw, n=2000, seed=7):
    rng = np.random.RandomState(seed)
    d = []
    for _ in range(n):
        pick = rng.choice(uniq, size=len(uniq), replace=True)
        sel = np.concatenate([idx_by_cid[c] for c in pick])
        yy = cy[sel]
        if yy.min() == yy.max():
            continue
        d.append(auc(a_raw[sel][yy == 1], a_raw[sel][yy == 0])
                 - auc(b_raw[sel][yy == 1], b_raw[sel][yy == 0]))
    d = np.array(d)
    return d.mean(), np.percentile(d, 2.5), np.percentile(d, 97.5), (d > 0).mean()


results = {}
print('')
print('%-22s %8s %10s' % ('arm', 'AUC', 'women wrong'))
for label, tf, size in [('rgb  @224', lambda im: im, 224),
                        ('GREY @224', to_grey, 224),
                        ('rgb  @176', lambda im: im, 176),
                        ('GREY @176', to_grey, 176)]:
    r = score(tf, size)
    A = auc(r[cy == 1], r[cy == 0])
    ww = 100.0 * (r[cy == 0] >= 0.5).mean()
    print('%-22s %8.4f %9.1f%%' % (label, A, ww))
    results[label] = r

print('')
for lo, hi in [('GREY @224', 'rgb  @224'), ('GREY @176', 'rgb  @176')]:
    m, l, h, f = boot_delta(results[lo], results[hi])
    print('%s minus %s : %+.4f AUC  95%% CI [%+.4f, %+.4f]  positive in %.1f%% of draws'
          % (lo, hi, m, l, h, 100 * f))

json.dump({'rows': [{'who': r['who'], 'cid': r['cid'], 'vid': r['vid'],
                     'crop': cropkey(r['path'])} for r in crows],
           'arms': {k: [float(x) for x in v] for k, v in results.items()}},
          open(a.out, 'w'))
print('')
print('banked %s' % a.out)
print('faceres gains +0.0047 AUC from grey on this population. If dima')
print('gains nothing, grey is a faceres quirk and the student should')
print('still train on grey -- because grey is what the pipeline feeds it.')
