# SCORE THE WHOLE CORPUS, not just the fold test sets.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/student-scoreall.py \
#       --tag w1-s112-grey-feat1
#
# The ensemble result -- false cover 9.5% -> 5.3% at matched exposure --
# was measured on 1,236 of the corpus's 2,159 reads, because each fold
# gave two of its five scoring videos to validation. On that subset
# faceres alone reads 9.5% where it reads 18.2% on the whole corpus, so
# the subset is EASIER than average and the magnitude is not the
# magnitude. This closes that gap.
#
# THE RULE THAT MAKES IT LEGITIMATE: every crop is scored by the fold
# model that never saw its video -- not in training, not in validation.
# Fold A trains on the fold-A videos, so it may score every fold-B video
# including the two fold B validated on, and the reverse. A crop scored
# by a model that watched its video during early stopping would be a
# quieter version of test-set selection.
import argparse
import json
import os

import numpy as np
import torch
from PIL import Image

CORPUS = 'Z:/tamescroll-corpus'
HERE = os.path.dirname(os.path.abspath(__file__))
import sys
sys.path.insert(0, HERE)
from student_arch import Student  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--tag', default='w1-s112-grey-feat1')
ap.add_argument('--width', type=float, default=1.0)
ap.add_argument('--size', type=int, default=112)
ap.add_argument('--input', choices=['grey', 'rgb'], default='grey')
ap.add_argument('--out', default=None)
a = ap.parse_args()
OUT = a.out or (CORPUS + '/student/scoreall-%s.json' % a.tag)

dev = 'cuda' if torch.cuda.is_available() else 'cpu'


def read_ppm(path):
    with open(path, 'rb') as fh:
        assert fh.readline().strip() == b'P6'
        line = fh.readline()
        while line.startswith(b'#'):
            line = fh.readline()
        w, h = [int(x) for x in line.split()]
        fh.readline()
        return np.frombuffer(fh.read(w * h * 3), dtype=np.uint8).reshape(h, w, 3)


# --- the labelled corpus ---------------------------------------------
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
            ev.append({'who': who, 'cid': c['id'], 'vid': c['vid'],
                       'crop': m['crop'], 'path': p, 'px': m.get('px')})
print('corpus %d reads, %d identities, %d videos'
      % (len(ev), len({r['cid'] for r in ev}), len({r['vid'] for r in ev})))

# THE FOLD MAP, rebuilt exactly as student-train.py builds it. If these
# ever drift, a crop gets scored by the model that trained on its video
# and the number silently becomes a training-set number.
idx = json.load(open(CORPUS + '/student-dense/index.json'))
vids = sorted({r['vid'] for r in idx})
FOLD = {v: i % 2 for i, v in enumerate(vids)}
print('fold A videos: %s' % ', '.join(v for v in vids if FOLD[v] == 0))

X = np.zeros((len(ev), a.size, a.size, 3), dtype=np.uint8)
for i, r in enumerate(ev):
    im = Image.fromarray(read_ppm(r['path']))
    X[i] = np.asarray(im.resize((a.size, a.size), Image.BILINEAR), dtype=np.uint8)

MEAN = torch.tensor([0.5, 0.5, 0.5], device=dev).view(1, 3, 1, 1)
STD = torch.tensor([0.5, 0.5, 0.5], device=dev).view(1, 3, 1, 1)
LUMA = torch.tensor([0.299, 0.587, 0.114], device=dev).view(1, 3, 1, 1)


def prep(batch):
    x = torch.from_numpy(batch).to(dev).permute(0, 3, 1, 2).float() / 255.0
    if a.input == 'grey':
        x = (x * LUMA).sum(1, keepdim=True).repeat(1, 3, 1, 1)
    return (x - MEAN) / STD


raw = np.full(len(ev), np.nan, dtype=np.float32)
by_model = {}
for fold in (0, 1):
    ck = CORPUS + '/student/model-%s-fold%s.pt' % (a.tag, 'AB'[fold])
    if not os.path.exists(ck):
        raise SystemExit('missing %s' % ck)
    m = Student(a.width).to(dev)
    m.load_state_dict(torch.load(ck, map_location=dev))
    m.eval()
    # A fold model trained on the videos of ITS OWN fold, so it may score
    # every video of the OTHER fold and nothing else.
    sel = np.array([i for i, r in enumerate(ev) if FOLD.get(r['vid'], 1 - fold) != fold])
    if not len(sel):
        continue
    with torch.no_grad():
        for s in range(0, len(sel), 256):
            part = sel[s:s + 256]
            raw[part] = torch.sigmoid(m(prep(X[part]))).squeeze(1).cpu().numpy()
    by_model['AB'[fold]] = len(sel)
    print('fold %s model scored %d reads' % ('AB'[fold], len(sel)))

missing = int(np.isnan(raw).sum())
print('scored %d of %d (%d unscored)' % (len(ev) - missing, len(ev), missing))
if missing:
    # A video in neither fold means the fold map drifted from the
    # trainer's. Loud, because a silent NaN would be dropped downstream
    # and the "full corpus" claim would quietly be a subset again.
    bad = sorted({ev[i]['vid'] for i in np.where(np.isnan(raw))[0]})
    print('*** UNSCORED VIDEOS: %s' % ', '.join(bad))
    print('*** the fold map here has drifted from student-train.py')

json.dump([{'crop': r['crop'], 'who': r['who'], 'cid': r['cid'], 'vid': r['vid'],
            'px': r['px'], 'raw': None if np.isnan(raw[i]) else float(raw[i])}
           for i, r in enumerate(ev)], open(OUT, 'w'))
print('banked %s' % OUT)
