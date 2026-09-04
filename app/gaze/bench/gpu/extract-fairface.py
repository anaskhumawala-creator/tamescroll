# EXTRACT THE WHOLE FairFace VALIDATION SPLIT, NOT THE 1,400 WE HAVE BEEN
# LIVING ON.
#
# `val025.parquet` has been sitting on this disk with 10,954 labelled faces
# in it and every FairFace number this repo owns was measured on the 1,400
# in `sample/`. That was a CPU-era decision: at 0.15 crops/second a full
# pass was a night, so a 13% sample was the affordable choice. On the GPU
# a full pass is minutes, and the sample is now the binding constraint on
# every head-retraining question -- 1,024 free parameters fitted on 1,348
# rows is why the first ceiling probe overfit.
#
# LABELS ARE READ FROM THE FILE, NEVER ASSUMED. The class names come out of
# the parquet's own HuggingFace metadata block, and the mapping was checked
# against the existing sample/ by MD5 of decoded pixels: 60 of 60 agree on
# both race and gender. So the old bank and the new one are the same
# labelling and rows from each are comparable.
#
# WRITES A NEW DIRECTORY, does not touch sample/. The existing 1,400 stay
# exactly as they are so every published FairFace figure remains
# reproducible against the data it was measured on.
#
#   python app/gaze/bench/gpu/extract-fairface.py
#
# -> Z:/tamescroll-corpus/fairface/full/ff<row>.ppm   (P6, 224x224)
# -> Z:/tamescroll-corpus/fairface/full.json          (row, file, race,
#                                                      gender, age, w, h)
import io
import json
import os
import sys

import numpy as np
import pyarrow.parquet as pq
from PIL import Image

FAIR = 'Z:/tamescroll-corpus/fairface'
SRC = os.path.join(FAIR, 'val025.parquet')
OUT = os.path.join(FAIR, 'full')
META = os.path.join(FAIR, 'full.json')

table = pq.ParquetFile(SRC).read()
meta = json.loads(table.schema.metadata[b'huggingface'].decode('utf8'))
feats = meta['info']['features']
GENDER = feats['gender']['names']
RACE = feats['race']['names']
AGE = feats['age']['names']
print('label maps read from the parquet itself:')
print('  gender', GENDER)
print('  race  ', RACE)
print('  age   ', AGE)

os.makedirs(OUT, exist_ok=True)
imgs = table.column('image').to_pylist()
g = table.column('gender').to_pylist()
r = table.column('race').to_pylist()
a = table.column('age').to_pylist()

rows = []
sizes = set()
for i, d in enumerate(imgs):
    im = Image.open(io.BytesIO(d['bytes'])).convert('RGB')
    arr = np.asarray(im)
    h, w = arr.shape[0], arr.shape[1]
    sizes.add((w, h))
    name = 'ff%05d.ppm' % i
    with open(os.path.join(OUT, name), 'wb') as fh:
        fh.write(b'P6\n%d %d\n255\n' % (w, h))
        fh.write(arr.tobytes())
    rows.append({
        'row': i,
        'file': name,
        'race': RACE[r[i]],
        'gender': GENDER[g[i]],
        'age': AGE[a[i]],
        'w': w,
        'h': h,
    })
    if (i + 1) % 1000 == 0:
        sys.stderr.write('  %d/%d\n' % (i + 1, len(imgs)))

with open(META, 'w') as fh:
    json.dump(rows, fh)

from collections import Counter
print('wrote %d crops to %s' % (len(rows), OUT))
print('  sizes present', sorted(sizes))
print('  gender', dict(Counter(x['gender'] for x in rows)))
print('  race  ', dict(Counter(x['race'] for x in rows)))
