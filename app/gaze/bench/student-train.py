# THE STUDENT. Distil dima806's gender accuracy into something an
# Adreno 613 can run per frame.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-train.py \
#       --size 112 --width 1.0 --input grey --epochs 30
#
# ---------------------------------------------------------------------
# WHAT THIS IS AND WHAT IT MUST BEAT
#
# faceres ships at 3.5M params and reads 18.2% of his men as needing
# cover, at matched exposure, with grey input (finding 47). dima806 reads
# 4.2% -- five times better -- and is 85.8M params of ViT-base, roughly
# 25x too slow on his phone. Everything cheap between the two is dead:
# finding 50's scale-augmented retrain LOST on his corpus, finding 51's
# pseudo-label arm lost worse, and truncating dima's own trunk collapsed
# it (women 93-100% wrong) with only a linear refit to save it.
#
# So the remaining route is a SMALL NETWORK TRAINED FROM SCRATCH on the
# teacher's continuous output. That is a different thing from every arm
# above: those all reused faceres' frozen 1024-d descriptor, and finding
# 46 measured that descriptor at pearson 0.893 with the head that ships
# -- one well, drawn from repeatedly. This draws from a different one.
#
# THE GO/NO-GO IS GREY'S 18.2%, NOT dima's 4.2%. A student that lands
# between them is worth shipping; one that cannot beat what ships is
# finding 51 again with a bigger net, and the answer would be identities
# rather than architecture.
#
# ---------------------------------------------------------------------
# THE SPLIT, and it is the whole difference between a result and a
# flattering number
#
# The in-domain training crops come from the SAME TEN VIDEOS as the
# labelled evaluation corpus. Training on all of them and scoring on
# bank/crops would be scoring on the same people in the same rooms.
# So: BY VIDEO. Five videos' in-domain crops train, the other five's
# labelled reads score, then swapped. FairFace is in both training halves
# -- it shares no identity with anything.
#
# ---------------------------------------------------------------------
# THE AUGMENTATION IS THE PLAYER'S OWN DEGRADATION
#
# His faces read px p50 76 and the crop bank's native sizes run p05 46 /
# p50 97 / p95 241. A student trained at one size and served another is
# the finding-49 collapse waiting to happen -- the shipped head loses
# 0.12 of AUC between 224px and 24px. Every crop is therefore downsampled
# to a random native size drawn from the corpus's own distribution and
# then upsampled to the network input, which is exactly what
# cropAndResize does at runtime.
import argparse
import json
import os
import sys
import time

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
import torch.nn as nn
from PIL import Image

CORPUS = 'Z:/tamescroll-corpus'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                '..', '..', '..', 'spikes', 'torch-keras-bridge'))

ap = argparse.ArgumentParser()
ap.add_argument('--size', type=int, default=112)
ap.add_argument('--width', type=float, default=1.0)
ap.add_argument('--input', choices=['grey', 'rgb'], default='grey')
ap.add_argument('--epochs', type=int, default=30)
ap.add_argument('--batch', type=int, default=128)
ap.add_argument('--lr', type=float, default=3e-3)
ap.add_argument('--temp', type=float, default=1.0)
# How many times the in-domain pool is repeated per epoch. FairFace
# outnumbers his own footage ~18:1 once the train split is in, and
# finding 50 is the standing warning about what a FairFace-tuned head
# does on his corpus -- it won on held-out FairFace at every size and
# LOST on his videos.
ap.add_argument('--domain-oversample', type=int, default=1)
ap.add_argument('--val-frac', type=float, default=0.10)
ap.add_argument('--out', default=None)
a = ap.parse_args()
TAG = 'w%g-s%d-%s' % (a.width, a.size, a.input)
OUT = a.out or (CORPUS + '/student/run-%s.json' % TAG)

dev = 'cuda' if torch.cuda.is_available() else 'cpu'
print('device %s   %s' % (dev, TAG))


# ---------------------------------------------------------------------
# ARCHITECTURE. MobileNetV1-shaped, because it is the one topology the
# torch->Keras->tflite bridge in spikes/torch-keras-bridge is already
# verified on end to end (5.96e-06 max abs delta on TRAINED weights).
# Authoring in a shape the converter is known to handle is not a detail:
# every other conversion route off this machine is blocked -- litert-torch
# is Linux-only, onnx2tf needs a pip install and PyPI is unreachable, and
# the local TF 2.15 is CPU-only.
def spec(w):
    base = [('cbr', 16, 2), ('dw', 32, 2), ('dw', 64, 2), ('dw', 64, 1),
            ('dw', 128, 2), ('dw', 128, 1), ('dw', 256, 2), ('dw', 256, 1)]
    return [(k, max(8, int(round(f * w / 8)) * 8), s) for k, f, s in base]


class TFPad(nn.Module):
    """TF 'SAME' padding computed from the ACTUAL input size.

    A fixed (0,1,0,1) is right only for an EVEN input; on an odd one TF
    pads (1,1). The bridge's first parity run reported 6.4e-04 -- which
    reads like success -- on RANDOM weights whose output spanned 1e-5.
    With trained weights the same bug gave 3.6e-01 and anti-correlated
    outputs. That is finding 43 exactly: an agreement metric with no
    spread beside it cannot tell 'identical' from 'dead'.
    """

    def __init__(self, stride, k=3):
        super().__init__()
        self.s = stride
        self.k = k

    def forward(self, x):
        out = []
        for d in (3, 2):                       # width then height -> (l,r,t,b)
            n = x.shape[d]
            o = -(-n // self.s)
            tot = max((o - 1) * self.s + self.k - n, 0)
            out += [tot // 2, tot - tot // 2]
        return nn.functional.pad(x, tuple(out))


def cbr(cin, f, st):
    return nn.Sequential(TFPad(st), nn.Conv2d(cin, f, 3, st, 0, bias=False),
                         nn.BatchNorm2d(f, eps=1e-3, momentum=0.01), nn.ReLU6())


def dw(cin, f, st):
    return nn.Sequential(
        TFPad(st), nn.Conv2d(cin, cin, 3, st, 0, groups=cin, bias=False),
        nn.BatchNorm2d(cin, eps=1e-3, momentum=0.01), nn.ReLU6(),
        nn.Conv2d(cin, f, 1, 1, 0, bias=False),
        nn.BatchNorm2d(f, eps=1e-3, momentum=0.01), nn.ReLU6())


class Student(nn.Module):
    def __init__(self, width):
        super().__init__()
        mods = []
        c = 3
        for kind, f, st in spec(width):
            mods.append(cbr(c, f, st) if kind == 'cbr' else dw(c, f, st))
            c = f
        self.body = nn.Sequential(*mods)
        self.head = nn.Linear(c, 1)

    def forward(self, x):
        x = self.body(x)
        x = x.mean((2, 3))
        return self.head(x)              # LOGIT; the loss applies sigmoid


# ---------------------------------------------------------------------
def read_ppm(path):
    with open(path, 'rb') as fh:
        assert fh.readline().strip() == b'P6'
        line = fh.readline()
        while line.startswith(b'#'):
            line = fh.readline()
        w, h = [int(x) for x in line.split()]
        fh.readline()
        return np.frombuffer(fh.read(w * h * 3), dtype=np.uint8).reshape(h, w, 3)


def load(path, size):
    """Decode and store at the NETWORK input size, as uint8.

    uint8 rather than float32 because a float32 tensor over 16,000 crops
    at 112px is 2.4GB and at 176px is 6GB -- the first version of this
    was refused an allocation. Normalisation happens per batch on the
    GPU, which is strictly cheaper anyway.
    """
    im = Image.fromarray(read_ppm(path)) if path.endswith('.ppm') \
        else Image.open(path).convert('RGB')
    return np.asarray(im.resize((size, size), Image.BILINEAR), dtype=np.uint8)


T0 = time.time()
rows = json.load(open(CORPUS + '/student/teacher.json'))
# FAIRFACE TRAIN, when it is on disk. 86,744 faces against the 10,954 of
# the validation split we lived on for the first two runs -- and those
# two runs pooled to AUC 0.657 and 0.646 against the shipped 0.9855,
# with training loss falling to 0.16 while held-out AUC decayed from
# epoch 15. That is a memorised training set, not a wrong idea, and 8x
# the data is the first thing to try against it.
FFT = CORPUS + '/student/teacher-fftrain.json'
if os.path.exists(FFT):
    rows += json.load(open(FFT))
    print('fairface TRAIN split present: +%d rows'
          % sum(r['pool'] == 'fftrain' for r in rows))
print('teacher rows %d  (domain %d, fairface %d)'
      % (len(rows), sum(r['pool'] == 'domain' for r in rows),
         sum(r['pool'] == 'fairface' for r in rows)))

paths, tgt, pool, vid = [], [], [], []
for r in rows:
    if r['pool'] == 'domain':
        paths.append(CORPUS + '/student/crops/' + r['crop'])
    elif r['pool'] == 'fftrain':
        paths.append(CORPUS + '/fairface-train/ppm/' + r['file'])
    else:
        paths.append(os.path.join(CORPUS, 'fairface', 'full', r['file']))
    tgt.append(r['t'])
    pool.append(r['pool'])
    vid.append(r['vid'])
tgt = np.array(tgt, dtype=np.float32)
pool = np.array(pool)
vid = np.array([v or '' for v in vid])

# DECODE ONCE, MEMMAP FOREVER. 103k crops at 112px is ~3.9GB of uint8 and
# several minutes of PPM reads; a width/resolution sweep would pay that on
# every arm. The cache is keyed by BOTH the size and the row count, so
# adding a pool invalidates it rather than silently training the next arm
# on the previous pool -- which is the "re-read a bank after a re-run"
# rule this repo learned the hard way.
CACHE = CORPUS + '/student/X-%d-%d.npy' % (a.size, len(paths))
if os.path.exists(CACHE):
    X = np.load(CACHE, mmap_mode='r')
    print('decoded cache %s  %.1f GB' % (os.path.basename(CACHE), X.nbytes / 1e9))
else:
    print('decoding %d crops at %d...' % (len(paths), a.size), flush=True)
    X = np.lib.format.open_memmap(CACHE, mode='w+', dtype=np.uint8,
                                  shape=(len(paths), a.size, a.size, 3))
    for i, pth in enumerate(paths):
        X[i] = load(pth, a.size)
        if i % 10000 == 0:
            print('  %d (%.0fs)' % (i, time.time() - T0), flush=True)
    X.flush()
    print('decoded in %.0fs, %.1f GB' % (time.time() - T0, X.nbytes / 1e9))

# --- the evaluation corpus: HIS labelled reads, never trained on -----
labels = json.load(open(CORPUS + '/bank/label/labels.json'))
clusters = json.load(open(CORPUS + '/bank/label/clusters.json'))
ev = []
for c in clusters:
    who = labels.get(c['id'])
    if who not in ('woman', 'man'):
        continue
    for m in c['members']:
        p = os.path.join(CORPUS, 'bank', 'crops', m['crop'])
        if os.path.exists(p):
            ev.append({'who': who, 'cid': c['id'], 'vid': c['vid'], 'path': p})
print('eval %d reads, %d identities, %d videos'
      % (len(ev), len({r['cid'] for r in ev}), len({r['vid'] for r in ev})))
EX = np.zeros((len(ev), a.size, a.size, 3), dtype=np.uint8)
for i, r in enumerate(ev):
    EX[i] = load(r['path'], a.size)
ey = np.array([1 if r['who'] == 'man' else 0 for r in ev])
evid = np.array([r['vid'] for r in ev])
ecid = np.array([r['cid'] for r in ev])

# --- FOLDS BY VIDEO ---------------------------------------------------
vids = sorted({v for v in vid if v})
FOLD = {v: i % 2 for i, v in enumerate(vids)}
print('fold A videos: %s' % ', '.join(v for v in vids if FOLD[v] == 0))
print('fold B videos: %s' % ', '.join(v for v in vids if FOLD[v] == 1))

# --- the scale distribution the augmentation samples from ------------
idx = json.load(open(CORPUS + '/student/index.json'))
NATIVE = np.array(sorted(max(r['w'], r['h']) for r in idx))
print('native crop size p05 %d p50 %d p95 %d'
      % (NATIVE[int(0.05 * len(NATIVE))], NATIVE[len(NATIVE) // 2],
         NATIVE[int(0.95 * len(NATIVE))]))

MEAN = torch.tensor([0.5, 0.5, 0.5], device=dev).view(1, 3, 1, 1)
STD = torch.tensor([0.5, 0.5, 0.5], device=dev).view(1, 3, 1, 1)
# Rec.601, the SHIPPED luma (detector.js, one line after cropAndResize).
LUMA = torch.tensor([0.299, 0.587, 0.114], device=dev).view(1, 3, 1, 1)


def prep(batch_u8, train, rng):
    """uint8 NHWC -> normalised NCHW, with the runtime's own degradation."""
    x = torch.from_numpy(batch_u8).to(dev).permute(0, 3, 1, 2).float() / 255.0
    if train:
        # DEGRADE THROUGH THE PLAYER'S PATH: drop to a real native size
        # drawn from his own distribution, then back up to the input --
        # which is what a 46px face meets at runtime.
        s = int(NATIVE[rng.integers(len(NATIVE))])
        s = max(16, min(a.size, s))
        if s < a.size:
            x = nn.functional.interpolate(x, size=(s, s), mode='bilinear',
                                          align_corners=False)
            x = nn.functional.interpolate(x, size=(a.size, a.size), mode='bilinear',
                                          align_corners=False)
        if rng.random() < 0.5:
            x = torch.flip(x, [3])
    if a.input == 'grey':
        y = (x * LUMA).sum(1, keepdim=True)
        x = y.repeat(1, 3, 1, 1)
    return (x - MEAN) / STD


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


@torch.no_grad()
def infer(model, Xu8):
    model.eval()
    out = np.zeros(len(Xu8), dtype=np.float32)
    rng = np.random.default_rng(0)
    for s in range(0, len(Xu8), 256):
        x = prep(Xu8[s:s + 256], False, rng)
        out[s:s + len(x)] = torch.sigmoid(model(x)).squeeze(1).cpu().numpy()
    return out


def matched(raw, y, cids, target_expo=0.016):
    """FALSE COVER ON MEN AT A COMMON WOMAN-EXPOSURE.

    THE ONE RULE THAT INVALIDATES MOST NAIVE BENCHES. The shipped clear
    bar sits far above the label boundary, and any arm wins an accuracy
    column by simply leaning female -- a threshold move in disguise. So
    each arm solves ITS OWN bar to the same exposure and only then is
    false cover read. Findings 29, 40, 41, 45, 47 and 50 each turned on
    exactly this.
    """
    women = raw[y == 0]
    men = raw[y == 1]
    if not len(women) or not len(men):
        return float('nan'), float('nan')
    # exposure = a woman cleared, i.e. read male ABOVE the bar
    bars = np.unique(np.round(raw, 4))
    best = None
    for b in bars:
        expo = (women >= b).mean()
        if expo <= target_expo:
            best = b
            break
    if best is None:
        best = bars[-1]
    return float(100 * (men < best).mean()), float(best)


# ---------------------------------------------------------------------
# THE BASELINE GATE, AND NOTHING BELOW MEANS ANYTHING WITHOUT IT.
#
# `matched()` and `auc()` above are new code scoring a new model on a
# population this repo has published numbers for. If they cannot
# reproduce the SHIPPED model's 18.2% / AUC 0.9855 from its own banked
# reads, then a bad student row is indistinguishable from a bad scorer --
# and this repo has retracted four tables for exactly that class of
# mistake. So the shipped reads go through the identical code path first.
BASE = json.load(open(CORPUS + '/bank/gpu-grey-mirror.json'))
_by = {r['crop']: r for r in BASE}


def _cropkey(path):
    return path.replace(os.sep, '/').split('/crops/')[-1]


bidx = [i for i, r in enumerate(ev) if _cropkey(r['path']) in _by]
braw = np.array([_by[_cropkey(ev[i]['path'])]['grey']['raw'] for i in bidx])
by = ey[np.array(bidx)]
bfc, bbar = matched(braw, by, ecid[np.array(bidx)])
bauc = auc(braw[by == 1], braw[by == 0])
print('')
print('BASELINE GATE -- the SHIPPED model (faceres + grey) through THIS scorer')
print('  %d of %d eval reads joined to the banked run' % (len(bidx), len(ev)))
print('  AUC %.4f  (published 0.9855)   false cover %.1f%% @bar %.3f  (published 18.2%%)'
      % (bauc, bfc, bbar))
if abs(bauc - 0.9855) > 0.005:
    raise SystemExit('*** THE SCORER DOES NOT REPRODUCE THE PUBLISHED AUC. Fix it '
                     'before reading a single student row.')
print('  gate passed: the scorer reproduces the published number.')

# The same baseline PER FOLD, because a student row is read per fold and
# the two halves of the videos are not equally hard -- fold B carries the
# crowded multi-person windows. Comparing a fold-B student against a
# whole-corpus baseline would charge it for the fold, not the model.
BFOLD = {}
for f in (0, 1):
    sel = np.array([i for i in bidx if FOLD.get(ev[i]['vid'], 1 - f) != f])
    if not len(sel):
        continue
    r = np.array([_by[_cropkey(ev[i]['path'])]['grey']['raw'] for i in sel])
    yy = ey[sel]
    BFOLD[f] = {'auc': auc(r[yy == 1], r[yy == 0]),
                'fc': matched(r, yy, ecid[sel])[0], 'n': len(sel)}
    print('  scored by fold %s student: shipped AUC %.4f  false cover %.1f%%  (n %d)'
          % ('AB'[f], BFOLD[f]['auc'], BFOLD[f]['fc'], BFOLD[f]['n']))

results = []
for fold in (0, 1):
    # TRAIN on FairFace + the in-domain crops of ONE half of the videos.
    tr = (pool == 'fairface') | np.array([v != '' and FOLD[v] == fold for v in vid])
    # SCORE on his labelled reads from the OTHER half.
    te = np.array([FOLD.get(v, 1 - fold) != fold for v in evid])
    Xtr = X[tr]
    Ttr = tgt[tr]
    print('')
    print('=== fold %s: train %d (%d domain), score %d reads / %d identities'
          % ('AB'[fold], tr.sum(), (tr & (pool == 'domain')).sum(),
             te.sum(), len(set(ecid[te]))))

    # A VALIDATION SPLIT OUT OF THE TRAINING POOL, and this is the fix
    # for the defect the first two runs shipped. They reported epoch 30
    # -- the WORST epoch -- because there was no stopping rule, and had
    # they reported the best one they would have been SELECTING ON THE
    # EVALUATION SET, which is the same defect this session already
    # caught once in `dima-distil.py` (it kept the best epoch by corpus
    # AUC and bought +0.009 of optimism, twice the size of the effect it
    # was measuring). So: hold out a slice of FAIRFACE, stop on that,
    # and let the corpus stay untouched until the run is over.
    #
    # The slice is FairFace only. Holding out in-domain crops instead
    # would validate on the same people the corpus scores on.
    trn_idx = np.where(tr)[0]
    ff_of = pool[trn_idx] != 'domain'
    vrng = np.random.default_rng(20260905)
    vmask = np.zeros(len(trn_idx), bool)
    ffpos = np.where(ff_of)[0]
    vmask[vrng.choice(ffpos, int(a.val_frac * len(ffpos)), replace=False)] = True
    va_idx = trn_idx[vmask]
    fit_idx = trn_idx[~vmask]
    # OVERSAMPLE THE IN-DOMAIN POOL. FairFace outnumbers his footage
    # heavily once the train split is in; finding 50 measured what a
    # FairFace-tuned head does on his videos and the answer was "loses".
    if a.domain_oversample > 1:
        dom = fit_idx[pool[fit_idx] == 'domain']
        fit_idx = np.concatenate([fit_idx] + [dom] * (a.domain_oversample - 1))
    # INDEX LAZILY. `X` is a memmap; `X[fit_idx]` would materialise 4GB
    # per fold. The batch loop below slices the memmap by the shuffled
    # indices instead, which touches only the pages it needs.
    Tfit = tgt[fit_idx]
    Xva = np.ascontiguousarray(X[va_idx])
    Tva = tgt[va_idx]
    print('  fit %d (%d domain, oversample x%d)   val %d fairface'
          % (len(fit_idx), (pool[fit_idx] == 'domain').sum(),
             a.domain_oversample, len(va_idx)))

    torch.manual_seed(20260905 + fold)
    model = Student(a.width).to(dev)
    nparam = sum(p.numel() for p in model.parameters())
    print('  params %d  (faceres 3.5M, dima 85.8M)' % nparam)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    steps = a.epochs * max(1, len(fit_idx) // a.batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=steps)
    rng = np.random.default_rng(7 + fold)
    Tt = torch.from_numpy(Tfit).to(dev)
    step = 0
    best = {'val': -1, 'ep': -1, 'state': None}
    for ep in range(a.epochs):
        model.train()
        perm = rng.permutation(len(fit_idx))
        tot = 0.0
        nb = 0
        for s_ in range(0, len(perm) - a.batch + 1, a.batch):
            sel = perm[s_:s_ + a.batch]
            # NOT SORTED. An earlier version sorted these indices to make
            # the memmap reads sequential, which silently REORDERED the
            # batch relative to `Tt[sel]` and paired every image with
            # another image's target. Random-order paging is slower and
            # correct.
            x = prep(np.ascontiguousarray(X[fit_idx[sel]]), True, rng)
            loss = nn.functional.binary_cross_entropy_with_logits(
                model(x).squeeze(1), Tt[torch.from_numpy(sel).to(dev)])
            opt.zero_grad()
            loss.backward()
            opt.step()
            if step < steps - 1:
                sched.step()
            step += 1
            tot += float(loss)
            nb += 1
        # VALIDATION AUC against the TEACHER's own ordering, which is what
        # the student is being asked to reproduce. Using the hard labels
        # here would score the student on the teacher's 6.5% error too.
        vr = infer(model, Xva)
        vlab = (Tva >= 0.5).astype(int)
        vA = auc(vr[vlab == 1], vr[vlab == 0])
        if vA > best['val']:
            best = {'val': float(vA), 'ep': ep + 1,
                    'state': {k: v.detach().clone() for k, v in model.state_dict().items()}}
        if ep % 5 == 4 or ep == a.epochs - 1:
            # The corpus number is PRINTED for the curve's shape and is
            # never selected on -- see the note above the split.
            r = infer(model, EX[te])
            A = auc(r[ey[te] == 1], r[ey[te] == 0])
            fc, bar = matched(r, ey[te], ecid[te])
            print('  ep %2d  loss %.4f   val AUC %.4f   [corpus AUC %.4f  fc %.1f%%]'
                  % (ep + 1, tot / max(1, nb), vA, A, fc), flush=True)
    print('  best validation epoch %d (val AUC %.4f) -- restoring it'
          % (best['ep'], best['val']))
    model.load_state_dict(best['state'])
    r = infer(model, EX[te])
    A = auc(r[ey[te] == 1], r[ey[te] == 0])
    fc, bar = matched(r, ey[te], ecid[te])
    # SPREAD, beside every agreement-shaped number. A saturated student
    # would print a clean-looking AUC of 0.5 and a false cover of 0 or
    # 100, and nothing else here would say why.
    print('  FINAL  AUC %.4f  false cover %.1f%%  spread %.3f'
          % (A, fc, float(r.max() - r.min())))
    results.append({'fold': 'AB'[fold], 'auc': float(A), 'falseCover': fc,
                    'bar': bar, 'spread': float(r.max() - r.min()),
                    'params': nparam, 'n': int(te.sum()),
                    'raw': [float(x) for x in r],
                    'who': [int(x) for x in ey[te]],
                    'cid': [str(x) for x in ecid[te]]})
    torch.save(model.state_dict(), CORPUS + '/student/model-%s-fold%s.pt' % (TAG, 'AB'[fold]))

print('')
print('=== %s   params %d' % (TAG, results[0]['params']))
w = sum(r['n'] for r in results)
print('pooled AUC (n-weighted)  %.4f'
      % (sum(r['auc'] * r['n'] for r in results) / w))
print('pooled false cover       %.1f%%'
      % (sum(r['falseCover'] * r['n'] for r in results) / w))
print('')
print('TO BEAT:  shipped faceres+grey 18.2%%   dima806 4.2%%   (finding 47 / 50)')
print('A student that cannot beat 18.2%% is finding 51 again with a bigger')
print('net, and the answer would be identities rather than architecture.')
json.dump({'tag': TAG, 'args': vars(a), 'folds': results}, open(OUT, 'w'))
print('')
print('banked %s' % OUT)
