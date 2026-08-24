# Adversarial critique #3 — "Linus is not clearing"

Date: 2026-08-25. Read-only review of `app/gaze/src/{init-entry.js,
person-track.mjs, person-gate.mjs, detector.js, gender-verdict.mjs,
video-region.mjs, scene-gate.mjs}` against the owner's standing complaint
and the CDP measurements supplied with the brief.

Verdict up front: **the current design cannot keep a correctly-read man
clear.** Not "does it badly" — cannot. There are three independent
mechanisms, each sufficient on its own, that re-blur a cleared adult male,
and they compound. Four rounds of tuning failed because every round tuned
a threshold downstream of a corrupted input and upstream of a state
machine that is reset from two directions on a ~2.8 s cycle.

Labels used below: **[PROVEN]** = derivable from the code as written,
**[MEASURED]** = follows from the supplied CDP numbers plus the code,
**[HYPOTHESIS]** = plausible, needs a bench run to confirm.

---

## Finding 1 — Identity memory force-blurs Linus on nearly every pass [PROVEN + MEASURED]

This is the one that makes the complaint *permanent* rather than periodic,
and it is the single most likely reason nothing the author tuned helped.

`person-track.mjs:271-275`, the **last** mutation in `matchedStep`, after
every clear path has run:

```js
if (obs.remembered === 'blurred') {
  state = 'blurred';
  clearMs = 0;
  clearStreak = 0;
}
```

It overrides an *earned* clear, an in-progress clear hold, and the fast
streak — unconditionally. `obs.remembered` comes from
`init-entry.js:1097` → `memoryLookup(obs.desc)` → `init-entry.js:558`:

```js
if (m.best && m.best.state === 'blurred' && m.sim >= MEM_SIM_FLAG) return 'blurred';
```

`MEM_SIM_FLAG = 0.85`. And `memBest` (`init-entry.js:529-543`) takes the
**max over every exemplar of every entry**:

```js
for (var i = 0; i < identityMemory.length; i++) {
  var descs = identityMemory[i].descs;
  for (var d = 0; d < descs.length; d++) { ... if (sim > bestSim) ... }
}
```

`MEM_MAX = 8` entries × up to 3 exemplars each = **up to 24 descriptors**,
and the test is `max(sims) >= 0.85`.

Now apply the measurement in the brief: descriptor cosine similarity
between **different people in the same frame** is `>= 0.9` in **17%** of
pairs and `>= 0.6` in 32%. Treating those as roughly independent draws (the
exemplars are different looks of the same person, so they are not perfectly
correlated), the probability that the max over even 3 exemplars clears 0.85
is on the order of `1 - (1-0.17)^3 ≈ 43%`; over a populated memory it
asymptotes toward 1. **The memory does not identify anyone. It is a
random blur generator that fires on a large fraction of every person's
reads, and it fires *last*, so it wins.**

The daughter reads certain-female (`female .27` clears
`GENDER_MIN_SCORE = 0.25`), so `memoryStore` (`init-entry.js:574`) writes
her descriptor with `state:'blurred'`. From that moment Linus is matching
against her exemplars on a large share of passes, each match zeroing the
very `clearStreak` that `CLEAR_STREAK_N = 2` requires to be **consecutive**.
Two consecutive certain reads with a ~40%+ per-read reset probability is a
coin flip at best, and any clear that does land is revoked on the next hit.

The header comment on `MEM_SIM_FLAG` (`person-track.mjs:55-62`) already
records the measurement that condemns this feature — "faceres' descriptor
does NOT separate identity at our crop quality, **at ANY threshold**" —
and then keeps the blur direction anyway, on the reasoning that a false
match there "costs over-blur, never exposure". That reasoning is wrong on
its own terms: over-blurring the owner is *the complaint being tracked*.
The author wrote down the disproof and shipped the feature.

**Fix: delete identity memory entirely** (both directions), or gate it
behind a descriptor that has been shown to separate identities. There is
no threshold that rescues it — 0.85 already sits inside the cross-person
band, and raising it makes the feature inert, which is the same as
deleting it, but slower.

---

## Finding 2 — The face crop handed to faceres is anisotropically stretched [PROVEN]

Answer to question 2: **yes, the box is squarified in model space, and the
distortion is exactly the source's aspect ratio.**

`detector.js:314-325`:

```js
var cx = (boxesArr[j] + boxesArr[j + 2]) / 2;
var cy = (boxesArr[j + 1] + boxesArr[j + 3]) / 2;
var half = (Math.max(boxesArr[j+2]-boxesArr[j], boxesArr[j+3]-boxesArr[j+1]) / 2) * FACE_ENLARGE;
kept.push({ x1: (cx-half)/INPUT_SIZE, y1: (cy-half)/INPUT_SIZE, ... });
```

`boxesArr` is in the **256×256 resized** space produced by
`tf.image.resizeBilinear(input, [INPUT_SIZE, INPUT_SIZE])`
(`detector.js:273`), which is a **non-uniform** stretch of a non-square
source. `half` is a single scalar applied to both axes, so the box is
square *in model space*, then normalized by 256 and reused as a fraction of
the original source. The comment on line 314-315 — "fractions map back
correctly" — is true for the *centre* and false for the *extent*.

Arithmetic, source `sw × sh`:

- x scale to model space = `256/sw`, y scale = `256/sh`.
- A face of side `f` px becomes `f·256/sw` × `f·256/sh` in model space.
- For a taller-than-wide source (`sh > sw`, i.e. every person crop), the
  x dimension is the larger, so `half` is driven by width.
- Normalized box side = `f·1.4/sw` in both axes.
- Back in source pixels: width `f·1.4` (**correct**), height
  `f·1.4·(sh/sw)` (**over-extended by the source aspect ratio**).

A typical MoveNet person crop is roughly 1:2.5 (w:h) after
`personCropRegion` padding. So the "face" box is **2.5× too tall** and
contains the subject's neck, shoulders and chest.

It then gets worse, because the 2026-08-25 "native-res face crop" change
applies the distortion a second time. `init-entry.js:794-808`
`genderFromNativeFace` → `cropPersonPixels(fr)`, which is
**aspect-preserving** (`detector.js`-style scale by `max(sw,sh)`,
`init-entry.js:735-737`) — so it faithfully reproduces the wrong 1:2.5
bitmap. That bitmap is then fed to `classifyFaceGenders(..., fpix,
[{x1:0,y1:0,x2:1,y2:1}])`, whose `tf.image.cropAndResize(..., [224,224])`
(`detector.js:355`) **stretches it to square** — a 2.5× horizontal stretch
of the face.

Net: faceres receives a face that is horizontally stretched ~2.5×, sits in
the top ~40% of the frame, and is padded below with torso. Every downstream
number is computed from that image:

- **gender** — explains `male .49 / .51 / .55 / .00` mixed with `.90`;
- **age** — explains a child reading 26-35 (Finding 4);
- **descriptor** — explains the non-separable identity (Finding 1);
- **`ownFaceIndex` threshold** — `init-entry.js:835` uses
  `d <= Math.max(0.18, fw)` where `fw` is the box width in crop fractions;
  with `FACE_ENLARGE` and a tight crop that is routinely 0.4-0.6, so the
  "within one face-width of the head keypoint" guard is effectively
  "any face anywhere in the crop". Mis-attribution across a two-shot is
  therefore *possible by construction*, though I cannot prove it fired in
  the supplied run without per-track read labels.

Before the 2026-08-25 change the read went through
`classifyFaceGenders(genderModel, zpix, faces)` with the same bad box —
a `cropAndResize` of a 2.5×-too-tall rect onto a square, i.e. a *vertical*
squash. So the pre-change path was also distorted, just in the other
direction. **This defect predates every one of the four failed rounds and
has never been fixed.** It is the reason threshold tuning kept
"almost working": the input distribution is wrong, so every threshold is
fitted to noise.

**Fix:** `detectFaceBoxes` must take the source's pixel dimensions and
squarify in **source** space:
`halfX = half/sw_model_scale`, `halfY = half/sh_model_scale`, chosen so the
box is square in source pixels. Then crop the face with a true 1:1 aspect
(letterbox rather than stretch when the square runs off an edge) before
`cropAndResize`. This is a ~15-line change and it is the only one on this
list that can be validated offline against saved frames.

---

## Finding 3 — The clear state is destroyed every ~2.8 s by design [PROVEN + MEASURED]

Answer to question 1, the code path, end to end.

Scene gate, `init-entry.js:679-701`:

```js
if (sceneState === 'cut' && now - lastCutAt >= sceneGate.CUT_MIN_GAP_MS) {
  lastCutAt = now;
  lastSample = 0;
  lastZoomAt = 0;
  videoTracks = demoteTracks(videoTracks);
  passEpoch++;
}
```

`demoteTracks` (`person-track.mjs:349-372`) sets, for **every** track:
`state:'blurred'`, `clearMs:0`, `clearAge:0`, `clearStreak:0`,
`flagStreak:0`, `desc:null`, `lastVerdict:'uncertain'`.

Measured cut rate on the test video: **~2.8 s**. Verdict cadence is
`effZoom = Math.max(ZOOM_INTERVAL_MS, lastVerdictMs*1.5)` with
`ZOOM_INTERVAL_MS = 400` (`init-entry.js:98, 1006`). So after each cut a
track needs `CLEAR_STREAK_N = 2` **consecutive** certain reads
(`person-track.mjs:243`) at ≥ 400 ms apart, plus one pass of detection
latency — a floor of ~0.9-1.4 s of guaranteed blur on a proven man, every
2.8 s. **That is a 32-50% duty cycle of "blurring a man", with zero bad
reads required.** With one sub-0.6 read in the window (the supplied data
shows ~4 of 22 male reads below 0.6, ~18%) the streak resets and he stays
covered for the rest of the shot.

`passEpoch++` compounds it: any pass already in flight at the cut is
discarded at `init-entry.js:1127` (`if (myEpoch !== passEpoch) return;`),
so the first post-cut verdict can be a full extra cadence away.

And there is no escape hatch, because identity memory is
**blur-direction-only by explicit design** (`init-entry.js:556-559`). So
the architecture states, in code: *after every cut, everyone is blurred
until they re-earn a clear from scratch, and nothing may ever shortcut
that.* On ordinary edited video that is the owner's complaint, verbatim,
as a specification.

Note also the interaction with `person-track.mjs:287-288`:

```js
clearStreak: !obs.flagged && obs.certain ? clearStreak : 0,
flagStreak: obs.flagged && obs.certain ? flagStreak : 0,
```

`clearStreak` is zeroed by *anything* that isn't a certain-clear read —
including an uncertain read, a `positionOnly`... (no: position passes take
the early-return branch at line 177 and preserve it, correctly) — but
including any pass where `ownFaceIndex` returned `-1`
(`init-entry.js:928-933`), any pass where the face detector missed, and
any memory hit. A **consecutive** requirement over a channel with a
~20-40% per-read failure rate essentially never completes.

`CLEARED_TTL_MS = 5000` is not implicated: at a 2.8 s cut rate it never
gets the chance to fire.

---

## Finding 4 — The child gate is dead, and it fails silently [MEASURED + HYPOTHESIS]

Answer to question 3. `GENDER_ADULT_AGE = 18`
(`gender-verdict.mjs:24`), consumed at `gender-verdict.mjs:84`:

```js
var adult = typeof f.age !== 'number' || f.age >= GENDER_ADULT_AGE;
```

Every read in the supplied 36-sample window carries `a` in 25-35. **The
gate has never fired on this video.** [MEASURED]

The tensor read is arithmetically correct — `detector.js:400`,
`for (var a=0;a<100;a++) age += a*ageData[k*100+a]`, i.e. expected value
over a 100-bin softmax, matching the `age_pred/Softmax` head selected at
`detector.js:363` by `shape[1] === 100`. So the bug is not indexing.

Two candidate causes, in my order of likelihood:

1. **Crop corruption (Finding 2).** A horizontally-stretched face padded
   with torso is out of distribution for an age head; out-of-distribution
   inputs collapse toward the training prior, and HSE-FaceRes' prior
   (IMDB-WIKI-family data) sits around 30. The reads clustering tightly in
   26-35 *for both a grown man and a small child* is exactly the signature
   of a model returning its prior. [HYPOTHESIS — testable]
2. **Expected value is the wrong estimator.** Even on a good crop, EV over
   a broad softmax with a fat adult tail pulls a confident child prediction
   upward. `argmax`, or an EV truncated to a window around the mode, is the
   standard read. [HYPOTHESIS — testable]

Test that separates them in ten minutes on the existing bench harness
(`spikes/perf-harness/bench.html`, `__TS_BENCH_API.genders`): feed a
correctly-cropped square child face and a correctly-cropped square adult
face, log both the EV and the argmax. If argmax separates them and EV does
not, it is (2). If neither separates, it is (1) — or faceres' age head is
simply unusable at this face size, which is also an answer.

**What the child gate should use instead, if age stays unreliable:** not
age. Use *geometry*, which we already have and which is robust:
MoveNet gives head size and shoulder span per person. Child-vs-adult in a
shared frame is well separated by **head-height to body-height ratio**
(children are ~1:5-6, adults ~1:7-8) and by absolute stature relative to
co-present persons. A relative test — "the shortest person in a frame
containing an adult, with a head:body ratio above X" — needs no model, no
licence, and no crop. It is a heuristic and will be wrong sometimes, but
its failure direction is over-blur, which is the cheap one.

**Separately, and urgently: the dead age gate is a live safety hole.** The
daughter is currently protected *only* by reading `female`. If a distorted
crop ever reads her `male` at ≥ `GENDER_CLEAR_SCORE` twice in a row, she is
cleared and exposed. The code comment at `gender-verdict.mjs:14-18` says
the age gate exists precisely to prevent this. It is not preventing it.

---

## Finding 5 — The patch is full-body because the MoveNet box is never trimmed [PROVEN]

Answer to question 4: it is **the MoveNet model box**, not the keypoint
union and not the head anchor.

`person-gate.mjs:82-94`:

```js
var y1 = data[o + 51];  // model box ymin
var x1 = data[o + 52];
var y2 = data[o + 53];  // model box ymax
var x2 = data[o + 54];
for (var u = 0; u < UNION_KEYPOINT_MAX; u++) {   // keypoints 0-12 only
  ...
  if (ku.y + KEYPOINT_MARGIN > y2) y2 = ku.y + KEYPOINT_MARGIN;
  ...
}
```

The header comment (lines 12-14) claims ankles and knees were excluded so
they cannot "drag the patch to the frame floor". **They were excluded from
the union only.** The seed value `y2` is MoveNet's own bounding box, which
is head-to-feet for a standing person by definition, and the union can only
grow it. Excluding keypoints 13-16 changed nothing for any person the model
boxed correctly. Add `PTRACK_PAD_TOP = 0.12` and `PTRACK_PAD = 0.05`
(`person-track.mjs:44-47`, applied in `blurredTracks`) and a standing adult
in a medium shot produces a patch spanning ~95-100% of frame height —
exactly the measured left patch.

Given the product goal (cover the person, not the room), the patch should
be **head through hips**: seed `y1`/`y2` from the keypoint union of 0-12
*only*, and intersect with the model box rather than union with it, so the
model box can only ever *shrink* the region. Keep the head anchor's
guaranteed margin (`person-gate.mjs:126-129`) — that part is correct and
is not the cause.

This also feeds back into Finding 2: a full-body crop is ~1:2.5-1:3 aspect,
which is precisely the multiplier by which the face box is over-extended.
Trimming to head+torso (~1:1.3) would shrink the crop distortion by half as
a side effect — but do not rely on that; fix the squarify properly.

Note `MERGE_IOU_MIN = 0.5` is doing its job — the measured two-patch result
is correct behaviour. Merge is not implicated any more.

---

## Question 5 — the architecture I would actually build

### What is structurally wrong

The current design binds **verdict state** to a **frame-to-frame IoU
tracker**, and then destroys that tracker's state on every discontinuity.
Identity — the thing the owner is asking for ("identify each person once")
— is not modelled at all; the closest thing, `identityMemory`, is a
descriptor bag that has been measured not to separate people and is wired
only to *add* blur.

The second structural error is that clearing is a **consecutive-event
predicate** over a noisy channel. Consecutive predicates have failure
probability that grows with noise rate *and* with observation frequency;
they are the wrong shape for evidence accumulation. Every "tuning" round so
far has adjusted constants inside this shape rather than changing it.

### The change I would make first, and why

**First: fix the crop geometry (Finding 2). Nothing else, until it is
benched.**

Rationale: it is upstream of gender, age, descriptor, and the
`ownFaceIndex` attribution threshold — four of the five findings above are
partially or wholly explained by it. It is a small, local, *offline
testable* change: save 20 frames from the test video, run the current and
fixed crops through `__TS_BENCH_API.genders`, and compare score
distributions and age spread for the same faces. No CDP session, no live
video, no guessing.

**Expected failure mode if I am wrong:** the fixed crop produces gender
scores that are still bimodal-but-noisy (say, a third of adult-male reads
still below 0.6) and ages still clustered at 30. That result is itself
decisive: it says faceres is the wrong model at this face size, and the
next move is a model swap (see below) rather than any further work on the
pipeline. Either way the experiment terminates a line of investigation,
which four rounds of threshold tuning never did.

**Second: replace the state machine with an evidence accumulator.**

Per track, hold a scalar log-odds `L` for "same-gender adult":

- certain same-gender read: `L += k · (score - 0.5)`
- certain opposite read: `L -= k' · (score - 0.5)`, with `k' > k`
  (fail-safe asymmetry preserved)
- uncertain / no face / attribution failure: `L` decays toward 0 with a
  half-life of ~2 s. **It is not reset.**
- render blurred when `L < T_blur`, clear when `L > T_clear`, hysteresis
  band between; new tracks start at `L = -∞`-equivalent (blurred).

This gets the owner's two demands simultaneously: one bad read moves the
needle a little instead of resetting everything (no flicker, no
"interchanging"), and a run of good reads still clears fast. It is ~30
lines, pure, and unit-testable against the exact 36-read sequence in the
brief — you can assert *from the supplied data* that Linus ends cleared.
Do this as a pure-module TDD exercise with the measured read sequence as
the fixture; it is the one part of this system that can be verified without
a browser.

**Third: stop resetting on cuts; reset *association*, not *belief*.**

A cut invalidates the IoU prior, not the fact that a man was in the video.
On a cut: keep boxes covered (blur-first), drop velocities, force a verdict
pass — but carry `L` forward on any track that re-associates, and let a
track that fails to re-associate expire normally. Cuts are ~2.8 s apart;
belief must outlive them or the system can never converge.

**Fourth (only if 1-3 do not close it): real identity.**

If cross-cut continuity genuinely needs re-identification, faceres'
`global_pooling/Mean` is not it — it is a shared trunk feature of a
multi-head age/gender net, not a verification embedding, and the
measurement proves it. Permissively-licensed options that can be embedded:

- **face-api.js** face-recognition model — MIT JS, weights derived from
  dlib's ResNet-34 (Boost licence). ~6 MB. Known-good verification
  embedding, already tfjs-graph format.
- **MobileFaceNet** tfjs conversions shipped in `vladmandic/human-models`
  (MIT, same source we already vendor faceres from). ~1-4 MB, designed for
  mobile, which matters for the Helio G88.

Both are compatible with the stated licence constraints (MIT/Apache/BSD;
no Ultralytics, no SORT, no HaramBlur). Both cost bundle size on a 22.7 MB
bundle and inference budget on the phone, which is exactly why this is
*fourth*, not first: do not pay it until 1-3 have been shown insufficient.

A cheaper alternative worth benching before adding a fourth model: **within
a shot**, re-identification by torso colour histogram + position is nearly
free and is what actually matters at a 2.8 s cut rate. Across cuts, a
"clothing signature" (mean Lab colour of the torso region, which we already
crop) is a surprisingly strong cue in a single video with a fixed cast, and
costs zero model bytes.

### What I would delete

- `identityMemory` and everything reachable from it (`memBest`,
  `memoryLookup`, `memoryStore`, `MEM_SIM_FLAG`, `MEM_SIM_UPDATE`,
  `obs.remembered`, the `person-track.mjs:271-275` override). It is
  net-negative today and the code already contains its own disproof.
- `CLEAR_STREAK_N` / `clearStreak` / `flagStreak` / `CLEAR_DECAY` /
  `CLEARED_TTL_MS` — all subsumed by the accumulator.

That removes roughly 120 lines and five tunable constants whose values were
each set in response to a different owner complaint. **The knob count is
itself a symptom**: `docs/detection-engine.md` now registers constants that
were fitted to a corrupted input distribution, so several of them are
measuring the bug rather than the world. Expect to re-derive most of them
after Finding 2 lands, and treat any pre-2026-08-25 "MEASURED" annotation
on a gender/age/descriptor threshold as void.

---

## Ranked summary

| # | Finding | Contribution to "Linus is not clearing" | Evidence |
|---|---|---|---|
| 1 | Identity memory force-blurs on a non-separable descriptor, last, overriding every clear | Very high — persistent, not periodic | PROVEN from code + MEASURED (17% of cross-person pairs ≥0.9, max over ≤24 exemplars at 0.85) |
| 2 | Face box squarified in stretched model space → faceres gets a ~2.5× horizontally stretched face plus torso | Very high — corrupts gender, age, descriptor, and the attribution threshold at once | PROVEN from code (arithmetic in Finding 2) |
| 3 | `demoteTracks` on every ~2.8 s cut + a 2-*consecutive*-certain clear predicate | High — 32-50% duty cycle of blur on a perfect subject, zero bad reads required | PROVEN from code + MEASURED cut rate |
| 4 | Age gate dead (child reads 26-35); child protection currently rests only on reading "female" | Low for Linus; **high as a safety hole** | MEASURED (gate never fires); cause HYPOTHESIS |
| 5 | Patch spans full frame height because MoveNet's full-body box seeds `y1/y2` and is only ever unioned | Zero for clearing; high for perceived severity ("Linus is *fully* covered") | PROVEN from code |
