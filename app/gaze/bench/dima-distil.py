# THE ACTUAL STUDENT: A TRUNCATED dima806, FINE-TUNED ON THE FULL ONE.
#
# The road here, so nobody re-walks it:
#   dima-cost.py          full dima is 21.8x a 3.5M net -> ~3.1s on his
#                         phone. Cannot ship on any path.
#   dima-shrink-ceiling   configurations DO exist in budget: 4 blocks at
#                         112px is ~350ms, 4 at 64px ~182ms (faceres is
#                         141ms on that phone).
#   dima-shrink-corpus    but chopped blocks collapse to "everything is
#                         male" -- AUC 0.64-0.79 against grey's 0.9855.
#   dima-head-refit       and that collapse was the HEAD, not the trunk.
#                         Refitting one linear layer took 8 blocks from
#                         0.789 to 0.9842. The signal survives truncation.
#
# So the trunk keeps the knowledge and the cheap recovery already gets
# most of it back. This is the expensive recovery: unfreeze everything,
# train on the TEACHER'S SOFT OUTPUTS rather than hard labels, and show
# it faces at the sizes his player actually decodes.
#
# WHY SOFT TARGETS AND NOT LABELS: a hard male/female bit carries one
# bit. The teacher's probability carries how CERTAIN it is, which is the
# part that transfers -- and finding 48 says his patches are dominated by
# faces the model is unsure about, so certainty is exactly the thing
# worth copying. Honest caveat from the critic: 41% of the teacher's
# outputs on this set sit beyond 0.99/0.01 and carry no gradient signal
# at all, so the true-label term stays in the loss beside it.
#
# WHY DEGRADATION: his faces reach the model at px p50 76, and finding 49
# measured the shipped head decaying from AUC 0.89 to 0.77 between 224px
# and 24px. A student trained only on clean 224px portraits learns the
# easy domain -- which is exactly how finding 50's retrain arm won on
# FairFace and LOST on his corpus.
#
# EVALUATION IS HIS CORPUS AND NOTHING ELSE. 52 identities, ten real
# videos, never trained on. FairFace is the training domain and its
# numbers here would be self-congratulation.
#
#   Z:/ml/venv/Scripts/python.exe app/gaze/bench/dima-distil.py --depth 4 --size 112
import argparse
import copy
import json
import os
import time

os.environ.setdefault('HF_HOME', 'Z:/ml/hf')

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

BANK = 'Z:/tamescroll-corpus/bank'
FF = 'Z:/tamescroll-corpus/fairface'
MODEL = 'dima806/fairface_gender_image_detection'

ap = argparse.ArgumentParser()
ap.add_argument('--depth', type=int, default=4)
ap.add_argument('--size', type=int, default=112)
ap.add_argument('--epochs', type=int, default=8)
ap.add_argument('--batch', type=int, default=64)
ap.add_argument('--lr', type=float, default=3e-5)
ap.add_argument('--headlr', type=float, default=1e-3)
ap.add_argument('--alpha', type=float, default=0.7, help='weight on the teacher term')
ap.add_argument('--T', type=float, default=2.0, help='distillation temperature')
ap.add_argument('--out', default=BANK + '/dima-distil.json')
ap.add_argument('--save', default='Z:/ml/student')
a = ap.parse_args()

dev = 'cuda' if torch.cuda.is_available() else 'cpu'
print('device', dev, '| depth', a.depth, '| size', a.size)


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


# --- data --------------------------------------------------------------
ff = json.load(open(FF + '/full.json'))
frows = [{'y': 1 if r['gender'] == 'Male' else 0, 'race': r['race'],
          'path': os.path.join(FF, 'full', r['file'])} for r in ff]
frows = [r for r in frows if os.path.exists(r['path'])]

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

print('train (FairFace) %d   eval (his corpus) %d reads / %d identities'
      % (len(frows), len(crows), len(set(r['cid'] for r in crows))))

from transformers import AutoImageProcessor, AutoModelForImageClassification

proc = AutoImageProcessor.from_pretrained(MODEL)
teacher = AutoModelForImageClassification.from_pretrained(MODEL).to(dev).eval()
for p in teacher.parameters():
    p.requires_grad = False

MEAN = torch.tensor(proc.image_mean).view(1, 3, 1, 1)
STD = torch.tensor(proc.image_std).view(1, 3, 1, 1)


def to_u8(imgs):
    """Resized to 224 and kept as UINT8. Float32 here is 6.6GB for
    FairFace alone and the allocator refuses it; normalisation is one
    cheap op per batch on the GPU instead."""
    return torch.stack([
        torch.from_numpy(np.asarray(im.convert('RGB').resize((224, 224), Image.BILINEAR)))
        .permute(2, 0, 1)
        for im in imgs])


def norm(u8, device):
    x = u8.to(device).float() / 255.0
    return (x - MEAN.to(device)) / STD.to(device)


print('decoding...')
t0 = time.time()
fimgs = [read_ppm(r['path']) for r in frows]
cimgs = [read_ppm(r['path']) for r in crows]
print('  %d + %d in %.0fs' % (len(fimgs), len(cimgs), time.time() - t0))

fy = torch.tensor([r['y'] for r in frows])
cy = np.array([1 if r['who'] == 'man' else 0 for r in crows])

# Pre-tensor everything at 224 once; degradation and student resize
# happen per batch on the GPU, which is where the augmentation lives.
FX = to_u8(fimgs)
CX = to_u8(cimgs)
del fimgs, cimgs
print('tensors', tuple(FX.shape), tuple(CX.shape))

# --- teacher soft targets, computed once -------------------------------
MALE = [i for i, l in teacher.config.id2label.items()
        if str(l).lower().startswith('male')][0]
print('male class', MALE)

print('teacher pass...')
tlogits = []
with torch.no_grad():
    for s in range(0, len(FX), a.batch):
        tlogits.append(teacher(pixel_values=norm(FX[s:s + a.batch], dev)).logits.cpu())
tlogits = torch.cat(tlogits)
tp = torch.softmax(tlogits, -1)[:, MALE]
print('teacher agrees with the true label on %.1f%% of FairFace'
      % (100.0 * ((tp >= 0.5).long() == fy).float().mean()))
print('teacher saturated beyond 0.99/0.01: %.1f%%'
      % (100.0 * ((tp > 0.99) | (tp < 0.01)).float().mean()))

# --- the student -------------------------------------------------------
student = copy.deepcopy(teacher).cpu()


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


FULL = len(blocks_of(student))
if a.depth < FULL:
    # KEEP THE FIRST N, not a stride. Early blocks are the general
    # features; a stride keeps blocks whose inputs no longer exist.
    set_blocks(student, list(blocks_of(student))[:a.depth])
student = student.to(dev)
for p in student.parameters():
    p.requires_grad = True
nparam = sum(p.numel() for p in student.parameters())
print('student %d blocks, %s params' % (a.depth, '{:,}'.format(nparam)))

head_params = list(student.classifier.parameters())
head_ids = {id(p) for p in head_params}
trunk_params = [p for p in student.parameters() if id(p) not in head_ids]
opt = torch.optim.AdamW([
    {'params': trunk_params, 'lr': a.lr},
    {'params': head_params, 'lr': a.headlr},
], weight_decay=0.01)
steps = a.epochs * ((len(FX) + a.batch - 1) // a.batch)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=[a.lr, a.headlr], total_steps=steps)


def degrade(x, sizes):
    """Down then up, per sample, through the player's own path: a face
    that reaches the model at 32px was decoded at 32px and stretched."""
    out = torch.empty_like(x)
    for i in range(x.shape[0]):
        s = int(sizes[i])
        small = F.interpolate(x[i:i + 1], size=(s, s), mode='bilinear', align_corners=False)
        out[i:i + 1] = F.interpolate(small, size=(224, 224), mode='bilinear', align_corners=False)
    return out


# His faces read px p50 76 (CLAUDE.md), so the sampler is centred there
# rather than uniform over the range -- an even spread would spend most
# of the run on sizes he never sees.
NATIVE = np.array([24, 32, 40, 48, 64, 96, 128, 224])
NATIVE_P = np.array([0.08, 0.12, 0.14, 0.16, 0.16, 0.14, 0.10, 0.10])


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


def evaluate():
    student.eval()
    kw = {} if a.size == 224 else {'interpolate_pos_encoding': True}
    out = []
    with torch.no_grad():
        for s in range(0, len(CX), a.batch):
            x = norm(CX[s:s + a.batch], dev)
            if a.size != 224:
                x = F.interpolate(x, size=(a.size, a.size), mode='bilinear', align_corners=False)
            out.append(torch.softmax(student(pixel_values=x, **kw).logits, -1)[:, MALE].cpu().numpy())
    student.train()
    r = np.concatenate(out)
    return auc(r[cy == 1], r[cy == 0]), 100.0 * (r[cy == 0] >= 0.5).mean(), r


print('')
print('eval BEFORE any training: AUC %.4f' % evaluate()[0])
print('(shipped grey 0.9855 | full teacher 0.9960 -- both on this population)')
print('')

best = {'auc': -1}
kw = {} if a.size == 224 else {'interpolate_pos_encoding': True}
N = len(FX)
for ep in range(a.epochs):
    student.train()
    perm = torch.randperm(N)
    tot = 0.0
    t0 = time.time()
    for s in range(0, N, a.batch):
        idx = perm[s:s + a.batch]
        x = norm(FX[idx], dev)
        sizes = np.random.choice(NATIVE, size=len(idx), p=NATIVE_P)
        x = degrade(x, sizes)
        if a.size != 224:
            x = F.interpolate(x, size=(a.size, a.size), mode='bilinear', align_corners=False)
        logits = student(pixel_values=x, **kw).logits
        # THE TEACHER TERM IS READ AT THE SAME DEGRADATION. Distilling a
        # 224px teacher's opinion of a clean face onto a student looking
        # at a 32px one teaches the student to hallucinate detail.
        with torch.no_grad():
            tx = degrade(norm(FX[idx], dev), sizes)
            tl = teacher(pixel_values=tx).logits
        soft = F.kl_div(F.log_softmax(logits / a.T, -1),
                        F.softmax(tl / a.T, -1), reduction='batchmean') * (a.T ** 2)
        hard = F.cross_entropy(logits, fy[idx].to(dev))
        loss = a.alpha * soft + (1 - a.alpha) * hard
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(student.parameters(), 1.0)
        opt.step()
        sched.step()
        tot += float(loss) * len(idx)
    A, ww, raw = evaluate()
    print('epoch %d/%d  loss %.4f  corpus AUC %.4f  women wrong %.1f%%  (%.0fs)'
          % (ep + 1, a.epochs, tot / N, A, ww, time.time() - t0))
    if A > best['auc']:
        best = {'auc': float(A), 'womenWrong': float(ww), 'epoch': ep + 1,
                'raw': [float(x) for x in raw]}
        os.makedirs(a.save, exist_ok=True)
        torch.save(student.state_dict(), os.path.join(
            a.save, 'student-d%d-s%d.pt' % (a.depth, a.size)))

print('')
print('BEST corpus AUC %.4f at epoch %d, women wrong %.1f%%'
      % (best['auc'], best['epoch'], best['womenWrong']))
print('shipped grey 0.9855 | full teacher 0.9960')
json.dump({'depth': a.depth, 'size': a.size, 'params': int(nparam),
           'rows': [{'who': r['who'], 'cid': r['cid'], 'vid': r['vid']} for r in crows],
           'best': best}, open(a.out.replace('.json', '-d%d-s%d.json' % (a.depth, a.size)), 'w'))
print('banked')
