# Engine findings and learnings

**Purpose: stop repeating mistakes.** Durable facts and retractions only —
not a session diary. CLAUDE.md carries the narrative; this carries what
survives it. Append; never silently rewrite an entry — if something is
overturned, strike it and say what overturned it.

Every entry states how it was measured. **A claim without a measurement
is a claim.**

---

## 0. The one number that reorders the whole roadmap

**An oracle gender classifier — a perfect read substituted for every
human-labelled crop, replayed through the shipped decision layer — buys
13.7% of scored error in man mode and 24.1% in woman mode.** Phantom
moves 3%. Exposure gets *worse* in woman mode.

**So 76-86% of the error is geometry, tracking and coasting, not the
classifier.** Every model-swap proposal is competing for the smaller
share. Spend effort on the decision layer first.

Corollary, measured on the same data: the classifier's residual problem
is **not resolution**. Man recall is 99-100% at every face size. **7 of
22 woman clusters are under 50% accurate at ALL sizes** — one of them at
98px with healthy descriptor magnitude. It is **per-subject female
recall**, and a resolution fix cannot touch it.

---

## 1. The instrument lies more often than the code does

Six separate confident-but-wrong numbers this month came from a broken
instrument, not broken behaviour. Before believing a result, ask what
would make the instrument produce it by accident.

- **`elementsFromPoint` cannot see a `pointer-events: none` element.**
  Every patch we draw is one. Three sessions of "cannot reproduce"
  followed. Any probe hit-testing our own overlay must set
  `pointerEvents='auto'` first.
- **A `display:none` overlay is still in the DOM with a 0x0 rect.**
  Counting patches without a visibility check *overstates* coverage, so
  an exposure gets under-reported. 67 probes had this bug.
- **A ring buffer saturates.** `player.passes` is a ring sliced to 40, so
  a b-minus-a diff measures the FILL, not the rate. Produced "one verdict
  every 5.8s" against a true 2.06s. Tag entries and count the tags.
- **A counter reading 0 after a WebView context reset is a fresh
  counter**, not a clean run. The pid changes; re-forward CDP.
- **A long-running emulator invents failures.** Worker timeouts, 50s
  model loads, stuck images — all vanish after a restart. Restart, then
  REPEAT, before believing any failure or timing number.
- **A probe that measures nothing reads exactly like a clean one.**
  Assert the state you are about to measure actually holds (patches
  present at BOTH ends of a window; the drag actually committed).
- **A flat sweep is a result about the instrument until proven
  otherwise.** Two "flat" results this month were arms calling
  module-level functions instead of the variant's.
- **A test can be unable to fail.** Break an assertion deliberately and
  watch the suite go red before trusting a new test. Found twice: a
  `#[test]` attribute missing from a Rust function with ten live
  assertions, and three JS tests that passed against the pre-fix source.

### RETRACTED 2026-09-02: "the corpus is a native-resolution instrument"

**False, and it cost three sweeps** that were written off as "the corpus
cannot see his regime". `corpus-lib.mjs` decodes at **640x360 — his exact
player size** — and `nativePx` is measured correctly. The gap was an
**averaging artifact**: the corpus mixes face sizes and nine of eighteen
windows are close-ups, up to px p50 210. Sliced by size (3,465 reads):

| px band | n | nm&lt;5 | male raw p50 | score p50 |
|---|---|---|---|---|
| 0-40 | 805 | 35% | 0.684 | 0.34 |
| **40-64 (his)** | **923** | **35%** | **0.667** | **0.32** |
| 64-100 | 929 | 8% | 0.843 | 0.64 |
| 100+ | 808 | 4% | 0.890 | 0.70 |

His phone reads male raw p50 **0.657** with **36-42%** signal-less. The
40-64 band is **0.667 / 35%**. The corpus reproduces his device closely
*in the right band*. Clear-bar signal-less rate is 3.0% over the whole
corpus but **10.3%** restricted to 38-64px.

Found twice independently the same night, from different directions —
which is why it is recorded as settled rather than suspected.

**Consequence:** `PXBAND=38-64` (`winFiles()` in `corpus-lib.mjs`) scores
only the 9 windows in his regime. It filters by **WINDOW, never by
read** — every metric is a duration, so dropping reads inside a window
breaks the tracking continuity being measured, and an empty band throws
rather than scoring a perfect 0.0s.

---

## 2. Cadence dominates every threshold, by an order of magnitude

`bench/cadence-ab.mjs`, everything else held. Man mode.

**SUPERSEDED, 2026-09-02.** This table came off the arm before §13, C4
and C6. Its RANKING survives -- the clock is the biggest single lever --
and every absolute value is wrong: 81.0s is 24.5s, 8.0s is 5.5s, and the
phantom column is inverted, because the coast was shortening alongside
the clock and paying it back (§13a). His regime reads
22.0 / 155.0 / 573.5. Kept for the shape only.

| verdict interval | exposure | false cover | phantom |
|---|---|---|---|
| **all 18 windows** | | | |
| 1.5s (his regime) | 81.0s | 216.5s | 144.0s |
| 1.0s | 43.5s | 192.5s | 160.0s |
| 0.5s | **8.0s** | 156.0s | 260.5s |
| **his band only (9 windows)** | | | |
| 1.5s | 47.0s | 85.5s | 86.5s |
| 1.0s | 29.5s | 73.0s | 104.0s |
| 0.5s | **7.0s** | 52.0s | 168.0s |

Every constant swept in August moves **1-3s**. The clock is worth **73s**
overall and **40s in his band**. Phantom is the price and roughly
doubles.

**Why:** clearing a man needs `CLEAR_STREAK_N`=2 verdicts, so at 1.5s the
floor is **3 seconds of blur on every track birth**, whatever the model
says.

### The person model *is* the clock

| device | MoveNet share of a verdict pass | persons admitted |
|---|---|---|
| 23122PCD1I (his daily) | ~504 of ~794ms (63%) | **0**, all 12 slots |
| M2010J19SI (old Redmi) | 3028 of 3872ms p50 (**78%**) | **0** in all 3 passes |

The old-Redmi run made **3 verdict passes in 120 seconds** — one per 40
seconds. n=3, indicative not settled. Frame upload is 7ms; gender crops
844ms.

---

## 3. False cover is a timing failure, not a model failure

Attributed, man mode, 216.5s total: ABSORBED 56.5s (26%), **MISREAD
149.0s (69%)**, STALE 11.0s (5%). Of the misread, **77% (115.0s)** is
male, carries descriptor signal, adult, **clears the bar at score p50
0.71 — and is covered anyway.** The correct verdict exists and arrives
too late. This is why swapping the detector cannot fix it, and why
coco-ssd could not touch it. It agrees with the oracle result in §0.

---

## 4. The person skip: shipped, reverted, and what was actually wrong

1068-1070 backed MoveNet off after three empty passes. The cadence gains
were real (2.09s to 1.21s per verdict). **He reported "it's not blurring
the female" and it was reverted whole.**

**The defect was one line, and it was never the skip itself:**
`emptyFrame = persons.length === 0 && faceEvidence === 0`. A skipped pass
contributed `length === 0`, `emptyStreak` climbed on passes that had
looked at nothing, `wipeIfEmpty` fired, and a covered woman went sharp.

Two things fixed since:
- **1078**: `faceEvidence = faces.length` (was `noShape ? 0 : faces.length`).
- **2026-09-02**: `persons.skipped` rides the array through both pass
  paths and `emptyFrame` requires `!persons.skipped`. **The eraser may
  only act on evidence a pass actually gathered.**

Rule: **a skipped pass must be readable as one all the way down.** An
empty list is not "nobody is there".

---

## 5. Licences — verified, and the traps

**Bar: permissive on CODE *and* WEIGHTS.** They are licensed separately
far more often than not. Never trust a repo badge over a model card.

### DISQUALIFIED, confirmed against primary sources

- **Ultralytics YOLOv8 / YOLO11 / their RT-DETR — AGPL-3.0.** Their own
  FAQ: the licence "covers the training code and the models produced by
  that training code", and embedding weights in a shipped product
  triggers it with no modification. There was never a permissive era.
- **`open-mmlab/mmyolo` — GPL-3.0 repo licence**, even though it
  repackages Apache code. RTMDet is clean **only** from `mmdetection`.
- **RT-DETR is two licences**: `lyuwenyu/RT-DETR` is Apache-2.0; the copy
  inside the `ultralytics` package is AGPL-3.0.
- **All InsightFace model-zoo weights** (buffalo_*, genderage, w600k_r50,
  and SCRFD through its annotations): their README states the models are
  "available for non-commercial research purposes only". MIT code,
  restricted weights.
- **EdgeFace** — code BSD-3-Clause, **weights CC BY-NC-SA 4.0** on
  Idiap's own model card. A third-party ONNX repo re-badges them MIT; a
  repackager cannot relicense someone else's weights. *(Two of our own
  surveys disagreed here — one read the code LICENSE, one read the model
  card. The model card governs the weights.)*
- **MobileFaceNet**, every reimplementation checked: trained on
  **MS-Celeb-1M**, which Microsoft took down in June 2019.
- **DEX / IMDB-WIKI** — "academic research purpose only".
- **Levi-Hassner (2015)** — no licence grant at all, only an AS-IS
  copyright notice. That is all-rights-reserved.
- **DukeMTMC-reID** — pulled by Duke in June 2019, still widely mirrored.
- **yolov5-face / yolov8-face** — both GPL-3.0.

### AMBIGUOUS — not usable until clarified

- **FairFace**: the only licence statement is "CC BY 4.0" under the
  **Data** heading; no terms for the checkpoints. arXiv 2509.09873
  documents this exact "licence drift" as endemic.
- **SFace (OpenCV Zoo)**: Apache-2.0, but the README never says which
  dataset the shipped checkpoint used.
- **GEAR** (human-models): no licence metadata anywhere.

### A shadow over almost everything

**WIDER FACE is CC BY-NC-ND.** Whether weights trained on it are a
derivative work is legally unsettled, but it touches YuNet, SCRFD,
RetinaFace, ULFD and the YOLO face variants. BlazeFace/MediaPipe
sidesteps it entirely — trained on Google's own consented data, which is
also why its card publishes no WIDER FACE numbers.

**Training datasets are worse than the models.** CelebA, UTKFace,
IMDB-WIKI, Adience, VGGFace2, AgeDB, FFHQ, WIDER FACE and CASIA-WebFace
are all non-commercial-research-only, and CelebA / AgeDB / VGGFace2
extend that to *derived data* or *redistribution in any form* — which
reads onto trained weights. MS-Celeb-1M and MegaFace are withdrawn.
DiveFace is NoDerivatives. FFHQ is NC-SA and its ShareAlike would try to
infect our weights. **Only FairFace's dataset (CC BY 4.0) and Open
Images / MIAP are permissive** — plus our own 3,465 labelled in-domain
crops, which we may train on but may **not** redistribute.

### CLEAN, verified on both halves

- **YuNet** — per-model MIT LICENSE file in opencv_zoo. 227KB *measured*
  (the git-lfs pointer reports a fake 131 bytes through the API —
  download and measure). WIDER hard **0.7503**. Designed for 10-300px
  faces. No proven browser build.
- **MediaPipe BlazeFace** — Apache-2.0 stated in the model card itself.
  224KB short-range / 1.0MB full-range, *measured*. Its card warns
  against "detecting people further than 2 meters" — our exact weakness.
  **Full-range is the untried variant.**
- **face-api.js** — MIT code; the `face_recognition_model` weights are
  **public domain** by Davis King's explicit grant. 128-dim, 6.2MB, LFW
  99.38%. `age_gender_model` MIT/MIT, **420KB**, gender 95%.
  TinyFaceDetector MIT, 190KB. All already TFJS.
- **OSNet** person re-ID — MIT code and MIT on the official weight card.
  512-dim, 0.2-2.2M params. MSMT17-trained (a research dataset — worth a
  sanity check). No browser build exists for any permissive re-ID model.
- **YOLOX**, **NanoDet-Plus** (ncnn+wasm demo exists), **PicoDet**,
  **RTMDet** via mmdetection, **D-FINE**, **EfficientDet-Lite0** and
  **coco-ssd** — all Apache-2.0.

**Nothing published in 2025/2026 does two or three of our jobs in one
forward pass, licence-clean and edge-deployable.** A multi-task net would
have to be ours.

### If we ever release a model standalone

The EU AI Act argument that protects the in-app blur — Art 3(40),
"ancillary to another service" — **does not travel with a standalone
released model.** Annex III(1)(b) makes biometric categorisation on
protected attributes high-risk, and sex is a protected attribute.
**Open-sourcing the gender model is a materially worse legal posture
than shipping it inside the app.** Releasing the *engine* is unaffected.

---

## 6. Runtime: there is no free win

- **`crossOriginIsolated` is structurally false for us** — COOP/COEP must
  be set by youtube.com, which we do not control. So **multithreaded WASM
  is unavailable** in both TF.js and ONNX Runtime Web; we are capped at
  single-thread SIMD (1.7-4.5x), not the marketed 3-13x.
- **WebGPU in Android *System WebView* is unconfirmed.** Chrome for
  Android shipped it in M121; no dated citation exists for WebView.
  WebView2 on Windows is safe (Edge 113). **Feature-detect
  `navigator.gpu.requestAdapter()` on the device — everything else is
  gated on that answer.**
- **WebNN excludes Android** from its 2026 origin trial. ~2027.
- **MediaPipe Tasks cannot run our custom models** — Model Maker is
  deprecated. It would replace our models, not accelerate them.
- **uint8 quantization is download-only** on these backends — TF.js's own
  docs say weights are dequantized before compute. This confirms our own
  measurement: a full-uint8 faceres requant changed **8 of 100 verdicts**
  (2 sign flips; descriptor cosine min 0.5962 against a 0.60 threshold)
  for zero runtime gain.
- **A main-thread MoveNet inference never returns on his phone** (stuck
  6 minutes, twice). **Build every bench worker-first.**
- The biggest plausible win is a **native bridge** (Kotlin LiteRT GPU
  delegate / Rust `ort`) because it sidesteps the WebView feature gate —
  but NNAPI is deprecated and **the frame-transfer cost is unmeasured.
  Measure the transfer before committing.**

---

## 7. Measured and refused — do not re-propose without new data

- **Track pooling of gender logits**: rescues 4 men, loses 75.
  Two-consecutive-over-the-bar is max-like and beats a mean.
- **coco-ssd person boxes** replacing the synthetic body: phantom -41%
  but exposure 82 to 89.5s. Four recovery attempts failed.
- **`GENDER_CLEAR_SCORE` below 0.36**: a real woman reads male raw
  0.58-0.66 at his face sizes.
- **`PFF_BODY_DOWN` 6.0 to 3.5**: the corpus said better; **rendering
  showed a speaker's legs fully sharp.** Some geometry can only be judged
  by looking.
- **Cross-image inference batching**: BlazeFace's graph fixes batch to
  [1,256,256,3].
- **SharedWorker**: absent in Android WebView.
- **Super-resolution / test-time adaptation before the classifier**:
  refused twice over — resolution is not the mechanism (§0), and
  PULSE-class SR *fabricates* apparent attributes in front of a gender
  classifier.
- **Memory trust 1**, **MEM_SIM 0.55**, **GENDER_INSTANT_CLEAR 0.60** —
  all measured, all worse.

---

## 8. The error class we have never measured

**BlazeFace detector recall.** The corpus scorer is blind to it *by
construction*: it scores the reads that exist, so a face the detector
never found is invisible to every arm and every sweep in this repo. It is
the only gate on training a detector for our own input distribution.

The experiment: sample ~200 corpus frames, stratified to over-sample
frames where the pipeline found nothing, hand-annotate every face,
compute recall sliced by native px. An afternoon, no GPU, no cost.

---

## 9. Owner rules that are not up for re-litigation

- **Patches are SOLID rectangles.** No holes, windows, cut-outs, splits
  or silhouette-tight masks. Both forms have shipped and both were
  rejected. A cleared person inside someone else's patch is an
  **accepted cost** — fix it upstream, never by cutting the blur.
- **Blur-first.** Unknown covers. Failing closed is right; failing closed
  *forever* is a bug.
- **BLOCK-ONLY.** Never modify, repackage or impersonate a platform app.
- **No nags.** **Never copy HaramBlur** (AGPL-3.0).
- **Code may never travel over OTA** — only JSON constants, handed over
  JSON-escaped as a string, never as an object literal.
- **Non-fullscreen 360p is the target regime**, not a defect to design
  around. He watches that way and it is the harder case.
- **Mobile first, desktop second.** Both must be right eventually.
- **Verify shipped constants in the EMITTED bundle, never the source** —
  a constant has shipped dead here for six rounds.

## 10. Where a track comes from — E5, and a stale instrument found on the way

`app/gaze/bench/births.mjs`, 18 windows, 2160 frames. The birth counters
have existed since loop 25 and had never been read.

**FIRST: the corpus's `bank/cuts.json` was STALE, and everything that
read it was running a threshold the app no longer ships.** Loop 40 moved
`CUT_DELTA` 28 -> 50; the banked booleans were never regenerated.
Re-running `corpus-cuts.mjs` (which imports the constant from the built
bundle, so it cannot disagree with the app) gives **115 cut frames, not
221 — the old file nearly DOUBLED the cuts.** The new set is a strict
subset of the old (only-in-new **0**), which is what raising a threshold
must do and is the check that the regeneration is sound. Old file kept as
`bank/cuts-at-unknown.json`. **Any arm quoting cut behaviour before
2026-09-02 02:20 is quoting CUT_DELTA 28.**

**THE ANSWER, at the shipped CUT_DELTA 50** (man mode; woman mode is
within 4 births on every row, as it must be — a birth happens before the
verdict decides state):

| | births | fresh | nearMiss | contended |
|---|---|---|---|---|
| shipped arm (cut gate on) | **310** | 230 (74.2%) | 48 (15.5%) | 32 (10.3%) |
| same arm, cut gate off | 221 | 76 (34.4%) | 84 | 61 |

`birthFresh` means **no previous track overlapped the observation at
all**. But a cut WIPES every track, so every observation after one is
fresh BY CONSTRUCTION — reporting the top row alone attributes the scene
gate's churn to geometry. The difference in total births is the honest
attribution:

- **89 of 310 births (28.7%) exist only because the cut gate wiped the
  tracks.** 154 of the 230 "fresh" births are cuts.
- **76 (24.5%) are genuinely fresh** — a box that appeared from nowhere.
  Detector/geometry, and no association threshold can touch it (§8).
- **145 (46.8%) had an overlapping track** and were born anyway, on the
  threshold or on the assignment.

**This reverses the first reading of the same instrument.** Run against
the stale cuts file it read `birthFresh 89.1%, nearMiss 6.2%`, which says
"the association layer is unreachable, do not retune it". At the shipped
threshold, with cuts attributed, the association layer is the LARGEST
single share. Both numbers came out of the same script twenty minutes
apart; the only difference was one stale input file.

**So the plan's E5 decision is: the association layer is reachable, and
the cut gate is the second lever.** Do not rebuild the association key on
this alone — `birthNearMiss` vs `birthContended` is 145 births split
roughly 3:2, and which of those two dominates decides between moving
`PTRACK_IOU_MIN` and changing the assignment, which is a different fix.

**And do not read this as licence to delete the scene gate.** Loop 39's
caveat still binds: the corpus banks reads only at its own frames, so the
cut arm wipes WITHOUT the immediate full pass the app runs, and its
absolute numbers overstate. What is fair here is the DIFFERENCE between
two arms of the same shape, which is what 310 vs 221 is.

### 10a. RETRACTED, mine, same night: "false cover roughly halves"

The 1088 commit message says the birth-verdict change roughly HALVES
false cover. **That is wrong.** It was measured against the stale
`bank/cuts.json` above -- CUT_DELTA 28 booleans, 221 cut frames against
the true 115 -- and a cut wipes every track, so the stale file roughly
DOUBLED the number of births the change gets to act on. The error runs in
the direction that flatters the change.

Re-measured at the shipped CUT_DELTA 50 (`bench/birth-ab.mjs`, which
patches the shipped bundle back so the two arms differ in exactly one
expression, and refuses to run if that expression is not found -- a patch
that silently does nothing is how a null result gets reported as a win):

| mode | k | exposure | false cover | phantom |
|---|---|---|---|---|
| man | 3 (**his 1.5s**) | 70.0 -> **71.0** (+1.0) | 205.5 -> **167.5** (**-38.0**) | 152.5 -> **149.0** (-3.5) |
| man | 1 (0.5s) | 4.0 -> 4.0 (0.0) | 167.5 -> **151.0** (-16.5) | 302.5 -> 299.5 (-3.0) |
| woman | 3 | 59.5 -> 60.5 (+1.0) | 261.5 -> **250.0** (-11.5) | 180.0 -> 180.0 (0.0) |
| woman | 1 | 4.0 -> 4.5 (+0.5) | 263.5 -> 258.5 (-5.0) | 362.0 -> 360.5 (-1.5) |

So it is **-18.5% of false cover in his regime, not -50%**, for +1.0s of
exposure and a small phantom improvement. Still the best cost/benefit any
single change has shown on this corpus -- it is the change that stays,
only the size of it was overstated.

**The lesson is not "re-check the arithmetic".** Both numbers came out of
the same script; the input file was stale and nothing in the harness
could say so. `corpus-cuts.mjs` imports `CUT_DELTA` from the built
bundle, so it cannot disagree with the app -- but only when it is
RE-RUN. **Any bench reading a banked derivative of a shipped constant
must re-derive it, or assert the constant it was banked at.** No file in
`bank/` records the constants it was made with; that is the gap.

### 10b. The same defect, one layer down, caught by the guard on its first run

Stamping `bank/cuts.json` and refusing a stale one (`assertCutsFresh` in
arch-arms, which fires on a wrong stamp AND on a missing one -- both
proved by breaking the file) immediately failed `bar-ab`. The cause was
not the bank: **half the cached variant bundles under `bench/.cache/`
were carrying `CUT_DELTA = 28`**, written before loop 40 raised it, and
none of them carried the loop-41 birth verdict. An arm importing one was
comparing its variant against a shipped arm that differed by the named
constant **plus a fortnight of source changes**.

**It did NOT corrupt the cut axis**, and saying so matters more than the
scare: the replay wipes on `win.cuts[fi]` -- banked booleans -- and never
reads a module's `CUT_DELTA`, so a variant patching it is inert. That is
also why the guard compares the bank against the SHIPPED bundle and not
against the arm's variant; comparing against the variant refused
`cut40/50/60` for a difference the replay cannot see.

Fixed at the source of the class: `_mkesm.cjs` now deletes every
`.cache/*.mjs` except the one it writes, so **a variant is strictly
younger than the source or it does not exist and its arm fails loudly**.
`bar-ab` imports variants it does not build, so it now fails until it
does -- which is the correct state for an arm whose control was a
fortnight old. `matrix.mjs` was already dead for the same family of
reason (it patches `var GENDER_CLEAR_SCORE = 0.6;`, and the source has
shipped 0.45 since loop 39) and says so by throwing.

### 10c. VERIFIED ON A PHONE: the birth rung fires, 20% of births

M2010J19SI, 1088, watch page `NWoT1ZVd1Lo` (the video his report came
from), 120s, gender man, driven over CDP. Counters read off the LIVE
ring as a DELTA against a baseline taken first -- a zero after a context
reset is a fresh counter, not a clean run, and this harness has killed
the WebView mid-probe before.

**births 15 -- birthCleared 3, birthBlurred 12. 20.0% take the instant
rung.** So the change is not a corpus artifact: on his own footage, on
real hardware, one birth in five is now born sharp that was born covered.

On-device birth attribution in the same window: fresh 10, nearMiss 2,
contended 3 -- **33% had an overlapping track**, against the corpus's
46.8%. Same shape, smaller n.

Also in that window, unchased: `cutDetected` **34 in 120s** at the
shipped CUT_DELTA 50 -- one cut every 3.5s on this footage -- against
`coastExpired` 11, `faceNoShape` 59, `wipeErasedBlurred` 4,
`passDropped` 23 of the passes.

### 10d. The staleness went three layers deep, and the third was the worst

Found by the sweep in 10e reporting `birthCleared 0` in every row while
the counter printed beside it was rising: **`.cache/shipped.mjs` is an
esbuild of `src/` and NOTHING re-ran the build.** Every arm imported
whatever the source was the last time somebody ran `_mkesm` by hand. The
bundle in that sweep predated the counter by an hour.

That is worse than the other two layers, because it is not one constant:
an arm can score an entire fortnight of source and print a clean table.

`bench/_build.mjs` closes it, and **the fix is to THROW, not to
rebuild.** Node parses and LINKS every module before evaluating any, so
by the time any body runs, `.cache/shipped.mjs` has already been read off
disk -- rewriting it cannot change what this process imported. So
`_build` rebuilds, compares, and refuses if the bytes moved. The next run
is correct and no run is ever silently wrong. Import order is
load-bearing: `import './_build.mjs'` must sit above the bundle imports
in arch-arms. Proved by changing a real constant in `src/` and watching
an arm refuse, then self-heal on re-run.

The three layers, all one defect: a **banked derivative** (`cuts.json`),
a **patched derivative** (`.cache/*.mjs` variants), and the **build
itself**.

### 10e. Loosening the association threshold is REFUSED, on measurement

E5 left a fork: 145 of 310 births had an overlapping track, split 48
nearMiss (below `PTRACK_IOU_MIN`) and 32 contended. If the nearMiss half
were the same person re-minted, lowering the threshold is the cheapest
fix in the repo. `bench/iou-ab.mjs`, 18 windows, his 1.5s cadence:

| IOU_MIN | exposure | false cover | phantom | births |
|---|---|---|---|---|
| **0.20 shipped** | 71.0 | **167.5** | **149.0** | 310 |
| 0.15 | 71.0 | 164.5 | 154.0 | 301 |
| 0.10 | 71.0 | 165.0 | 154.0 | 299 |
| 0.05 | 70.5 | 166.0 | 153.5 | 295 |
| 0.02 | 71.0 | 166.0 | 154.0 | 293 |

Best case is **-3.0s of false cover for +5.0s of phantom**, non-monotone
in the dial, and woman mode is strictly worse at every step (false cover
250.0 -> 252.5, phantom 180.0 -> 191.0). Refused.

**And the mechanism says why, which is the part worth keeping.** Taking
the threshold from 0.20 to 0.02 -- effectively "associate on any overlap
at all" -- removes only **17 of 310 births**, while `birthNearMiss` falls
48 -> 4. So those observations do not become matches; they re-classify
as `birthFresh`. **The near-miss overlaps are not the same person
slightly moved.** The churn is not an association-threshold problem, and
no setting of this dial makes it one.

That leaves the assignment (32 contended) and the geometry that produces
a box with no overlap at all (§8, still the unmeasured class).

### 10f. CUT_DELTA swept at last -- and the sweep was OVERRULED by a test

Loop 40 recorded "CUT_DELTA cannot be swept on the corpus at all"
because `bank/cuts.json` holds booleans. **That was true of the BANK and
never of the corpus** -- the deltas come from the video, so the bank
re-derives per value. `corpus-cuts.mjs <delta> <out>` now takes the
value as an argument and `bench/cut-sweep.mjs` swaps banks (the replay
wipes on `win.cuts[fi]` and never reads a module's CUT_DELTA, so
swapping the bank is the only correct way to sweep it; `setCutBank`
asserts each bank's own stamp so a sweep cannot mislabel its own rows).

18 windows, his 1.5s cadence:

| CUT_DELTA | cut frames | man exposure | man false cover | man phantom | births |
|---|---|---|---|---|---|
| 35 | 200 | 82.5 | 173.5 | 141.0 | 377 |
| 40 | 184 | 82.5 | 173.0 | 145.5 | 370 |
| **50 shipped** | 115 | **71.0** | **167.5** | **149.0** | 310 |
| 60 | 59 | 67.0 | 163.5 | 158.5 | 270 |
| 75 | 12 | 57.0 | 157.0 | 162.0 | 230 |
| 90 | 2 | 55.5 | 155.0 | 163.0 | 222 |

**Exposure falls monotonically in BOTH modes** all the way to 90, where
the gate is effectively off -- loop 39's finding, quantified. Woman mode:
exposure 60.5 -> 42.5, but false cover turns the other way (250.0 ->
265.5) and phantom rises hard (180.0 -> 213.5).

**60 WAS BUILT AND THEN REVERTED BY THIS REPO'S OWN TEST.**
`scene-gate.test.mjs` pins `CUT_DELTA <= 54.9`, the p95 of 600 live luma
deltas off his phone, on the reasoning that above it real cuts get
missed. So the corpus and the device disagree: the corpus says missing
cuts is cheap, his own footage says 60 is above where real cuts start.
Both can be true -- a missed cut costs exposure only when a stale CLEARED
track absorbs a new person, and the corpus prices that below the churn a
FALSE cut causes -- but that is corpus evidence against a device
measurement, on a protection constant, with the cost landing on PHANTOM,
his loudest complaint. Not a trade to take on one arm.

**IT WAS SETTLED AN HOUR LATER -- see 10g.** 54.9 was never a measurement
of where cuts start, and the change was taken.

**AND 10g's OWN TABLE WAS THEN RETRACTED -- see 10j.** The instrument
that settled it was misaligned by one sample and hid its ground-truth
threshold. The change survives; the numbers that justified it do not.

### 10g. Where real cuts actually start, measured -- and CUT_DELTA 60 ships

> **EVERY NUMBER IN THIS SECTION IS RETRACTED. See 10j for the corrected
> table.** The conclusion (60 ships) survives and is better supported than
> this section claimed; the recall figures, the knee-at-75, and the
> independent-instrument framing are all wrong. Left in place rather than
> deleted so the shape of the error stays legible.

`bench/cut-truth.mjs`. Ground truth from an INDEPENDENT instrument:
ffmpeg's `scdet` filter, its own colour space and its own algorithm,
knowing nothing about our 16x16 luma grid. All ten corpus videos at the
app's own 10Hz -- 152,376 samples. Two instruments that agree is
evidence; our gate agreeing with itself is not.

| | p05 | p25 | p50 | p95 |
|---|---|---|---|---|
| **at a real cut** | 0.0 | 2.4 | **50.1** | 138.7 |
| everywhere else | -- | -- | 0.8 (p90 6.9, p95 13.4, p99 51.4) | |

| threshold | real cuts caught | ordinary frames wiped |
|---|---|---|
| 28 | 52.8% | 4088 |
| 50 (was shipped) | 50.4% | 1678 |
| **60 (now shipped)** | **45.5%** | **739** |
| 75 | 42.3% | 190 |
| 90 | 26.0% | 60 |

**THE GATE CATCHES ABOUT HALF OF REAL CUTS AT ANY THRESHOLD.** A cut
between two similarly-lit shots is invisible to a 16x16 luma grid and
always was -- at a real cut our delta reads p05 **0.0**. Recall barely
moves between 28 and 75 (52.8% -> 42.3%) while false wipes fall **21x**.
There is no cliff up there, which is exactly what the old `<= 54.9`
bound claimed there was.

So 10f's revert was correct given what was known and wrong given what is
now measured. **50 -> 60 costs five points of a recall that was never
good and removes 56% of the false wipes**, and the corpus sweep agrees
independently (man exposure 71.0 -> 67.0, false cover 167.5 -> 163.5,
births 310 -> 270).

**It stops at 60, not at the measured knee of 75**, because the cost is
phantom -- his loudest complaint -- and 75 costs +13.0s man / +29.5s
woman against 60's +9.5s / +16.5s. 75 is the next step if his rings say
phantom did not move, and that is one OTA push, not a release.

The test was **rewritten from the measurement, not deleted**: the motion
floor stands, the false upper bound becomes the measured knee, and both
guards were proved to fire (20 and 28 fail the floor, 76 and 100 fail the
knee). The tuning whitelist range moves 30..90 -> 30..75 for the same
reason.

**THE TRANSFERABLE LESSON:** the old bound read the p95 of a mixed
distribution as a class boundary. 5% of ORDINARY samples sit above 54.9,
so it never described cuts at all. This repo has been caught by that
shape before (loop 38's circular score comparison). **A threshold
between two classes has to be derived from the two classes, separately
labelled -- not from a quantile of everything.**

### 10h. CUT_DELTA 60 on the phone, and two gaps the A/B walked into

**Device, n=1 per arm.** M2010J19SI, same video and timestamp, 120s:
`cutDetected` **34 -> 29** at CUT_DELTA 50 -> 60, `wipeErasedBlurred`
**4 -> 2**, births 15 -> 14, `birthCleared` 3 -> 4. Direction agrees with
the corpus. One window per arm on one video is not a result -- it is a
liveness check that the constant reached the device and moved the thing
it is supposed to move.

**GAP 1: nothing recorded which tuned numbers a phone is running.**
The OTA channel exists so a threshold moves without an install, and the
artifact he sends back could not say whether a pushed number REACHED his
device, was CLAMPED to a range edge, or was REFUSED. **A tuned phone and
an untuned one produced identical reports**, so every ring read since the
channel shipped is unattributable to a set of constants. Now
`engine.tuning = { applied, refused, clamped }`, filtered to finite
numbers key by key -- the report's guarantee is its shape check, never an
assumption about who wrote the object. A non-number becomes **null, not
0**: "refused 0" is a fact about a healthy run and must not be
manufactured out of a malformed one, which is the confusion the 1070
regression hid behind.

**GAP 2: the app's own write clobbers an injected dial**, so the first
person-skip A/B ran the shipped value in BOTH arms and reported flat.
lib.rs sets `window.__TS_GAZE_TUNING__` at `on_page_load`, which lands
after `Page.addScriptToEvaluateOnNewDocument`. `probe_skip_ab.py` now
COMPOSES over it -- an accessor whose setter merges the app's payload and
re-applies the override, the same shape the repo's scriptlets use to
compose over a page's -- **and refuses to run if the dial did not take**.
It was caught only because the probe asserts the dial instead of assuming
it; without that assertion it would have published "the person skip buys
nothing" as a null result.


## §10i — SKIPPING THE PERSON MODEL BUYS FRAMES, NOT VERDICTS

The hypothesis was cadence: MoveNet is 63-78% of a verdict pass on
measured hardware and admits ZERO persons in every one of those passes,
so skipping it should buy verdicts, and the corpus priced the clock at
81.0s of exposure at 1.5s/verdict against 8.0s at 0.5s -- **24.5s
against 5.5s on the corrected instrument (§13), and the conclusion below
does not depend on which**. That is a bigger lever than any threshold
swept this month.

**IT DOES NOT BUY VERDICTS.** Redmi M2010J19SI, `NWoT1ZVd1Lo` seeked to
t=55, both arms in ONE invocation on the same video (pass cost on this
device varies by more between sessions than the effect), 100s windows,
`probe_skip_ab.py`:

| | SKIP 1 (shipped) | SKIP 3 |
|---|---|---|
| reads | 63 | 63 |
| **reads/s** | **0.627** | **0.629 (1.00x)** |
| rAF | 2424 (24.1 Hz) | **3368 (33.6 Hz)** |
| covered | 61.6% | 62.0% |
| passDropped | 20 | **11** |
| births (cleared) | 10 (2) | 12 (5) |
| coastExpired | 9 | 12 |
| faceNoShape | 48 | **0** |

So the freed GPU time went to the RENDER LOOP, not to more passes:
**+39% frame rate** for the same verdict rate. That is a real win — the
render loop is what keeps a patch stuck to a moving subject between
verdicts, and it is the quantity his "jittery / low quality" reports
have always been about — but it is NOT the exposure lever the corpus
priced, because exposure is set by the verdict clock and the verdict
clock did not move.

**WHY THE CADENCE DID NOT MOVE IS UNMEASURED**, and saying so matters
more than the number: the pass is cheaper and the cadence is
cost-proportional (`effZoom = lastVerdictMs * 4`), so more passes were
the prediction. Candidates, none tested: the verdict interval is
clamped by `VERDICT_MAX_INTERVAL_MS` 2000 rather than by cost on this
device; or the saved MoveNet time is not on the critical path of the
next pass at all. Do not push this dial for cadence until that is
answered.

**AND THE COST IS VISIBLE IN THE SAME TABLE: `faceNoShape` 48 -> 0.**
The ghost gate cannot fire on a pass that ran no model, by design
(`persons.skipped`) — so every uncorroborated face that the gate was
refusing now mints a patch. That is the phantom direction, which is
what he calls "random blur marks here and there". 48 refusals in 100s
is not a rounding error.

**BUT THE STATED MECHANISM DOES NOT PREDICT ZERO, AND NOTHING IN THE
PAGE COULD TELL (critic B3).** `PERSON_SKIP_EVERY 3` does not stop the
model. `wantPersons` returns true when `skipsSince >= PERSON_SKIP_EVERY
- 1`, so it runs **one pass in three** -- this repo's own test is named
*"backed off, it still runs one pass in three -- never none"*. The gate
is disarmed on the two skipped passes and armed on the third, so
"skipping disarms the gate" predicts roughly **16**, not 0. Something
else took the remaining refusals: plausibly the run simply had fewer
uncorroborated faces, which would make the whole 48 an artefact of
comparing two 100s windows rather than a cost of the dial at all. The
derived figure **"~0.5 extra phantom mints per second" assumes all 48
newly mint**, and on the stated mechanism it is at most ~0.32/s.

**There was no counter anywhere in `app/gaze/src` for a skipped pass**,
so the arithmetic above could not be checked from a report --
`personPassSkipped` now exists on both pass paths for exactly that.
`skipped` against `passes` in one ring settles it: if two thirds of
passes skipped with `faceNoShape` still 0, the stated mechanism is
refuted and the 48 was window-to-window variance.

**NOT PUSHED.** `PERSON_SKIP_EVERY` stays 1 in `rules/tuning.json`. The
frame-rate win is real and the exposure win is absent, so the trade is
39% smoother rendering against ~0.5 extra phantom mints per second, and
phantom is the complaint he has repeated most. It stays on the channel
so it is one push away if his rings ever say the opposite.

**THE WHOLE TABLE ABOVE IS n=1 PER ARM, AND THE ARMS WERE NOT ORDER-
BALANCED (critic B7).** Both ran in one process with arm 1 first, so a
warm HTTP/GPU cache is an unexcluded explanation for rAF 24.1 -> 33.6 Hz
in the second arm. "reads/s flat at 1.00x" rests on 63 events per arm,
a Poisson band of about +/-25%, which is wider than several of the
differences read off it -- so "covered 61.6% vs 62.0%" is not a
distinction this run can make. `probe_skip_ab.py` now banks its result
to `spikes/gauntlet/skip-ab-<video>.json` and takes `REVERSED=1`; a real
effect survives the swap, and until it has been run both ways every
number in this section is a single sample.

### The instrument had a floor of 1 under its own refusal counter

`engine.tuning` shipped in the same round and read `refused: 1` in BOTH
arms on a healthy device. The cause: `rules/tuning.json` carries a
`_comment` explaining the channel, and `applyTuning` counted it as a
key it did not know.

That is not cosmetic. `TUNE_REFUSED` exists to say *this build does not
know a key the pushed file contains* — which is exactly what an old app
fetching a newer tuning.json looks like, and the only warning that a
device is silently running different numbers than intended. With a
floor of 1, the signal was invisible. Keys starting with `_` are
documentation and skipped; a genuinely unknown key still counts. Two
tests, both proved to fail against the pre-fix source (14 pass / 2 fail
-> 16 / 0), and the second loads the SHIPPED `rules/tuning.json`
through the real path and asserts 0 refused and 0 clamped.


### 10j. The cut-truth instrument was wrong in three ways at once, and the critic found all three

An adversarial critic run (`docs/critic/phase-a-2026-09-02.md`, findings
F1/F2/F6) took apart the instrument that settled CUT_DELTA in 10g. It was
right on all three, and the corpus half of the argument it checked was
clean. **The conclusion survives and is better supported than 10g
claimed. Nothing else in 10g does.**

**1. IT PAIRED EACH CUT WITH THE WRONG SAMPLE.** A cut at time `t` was
matched to the 10Hz delta at `ceil(t*10)`; the correct sample is
`round(t*10)`. They differ whenever `frac(t*10) < 0.5`, so roughly half
the at-a-cut rows were the post-cut STEADY frame.

This is not an alignment argument any more -- the pairing is a free
parameter and it is now SWEPT, which settles it without appealing to how
ffmpeg's `fps` resampler works:

| offset | p05 | p25 | **p50** | p75 |
|---|---|---|---|---|
| -1 | 0.1 | 0.7 | **1.7** | 3.8 |
| **0 (round)** | **46.6** | **53.7** | **59.8** | **68.1** |
| +1 | 0.2 | 0.9 | **2.4** | 5.4 |

A 25x separation. `bench/cut-truth.mjs` runs this sweep first and
**throws** if offset 0 does not win, so the instrument can no longer
print a number measured against the wrong sample.

**THE TELL WAS IN THE COMMITTED TABLE AND I EXPLAINED IT AWAY.** It read
`p05 0.0 at a real cut` -- a labelled shot change where the picture did
not move at all -- and I wrote that up as "a cut between two similarly-lit
shots is invisible to a 16x16 luma grid and always was". It was an
off-by-one. **A physical story that rationalises an impossible reading is
the most dangerous thing this repo produces**, because it closes the
question. Corrected, p05 at a cut is 25.9 (scdet 8) rising to 58.5
(scdet 25).

**2. THE GROUND-TRUTH THRESHOLD WAS A HIDDEN DIAL.** The committed
default was `SCDET=8`; the committed table only reproduces at 30. They
disagree by a factor of four on the number that decided a shipped
constant, and nobody could have reproduced the table from the repo. It is
swept now, never chosen -- scdet emits a score per event, so one
permissive run yields every stricter threshold by filtering.

Corrected, aligned and swept:

| scdet >= | cuts | @28 | @50 | **@60** | @75 |
|---|---|---|---|---|---|
| 8 | 3599 | 93.9% | 45.7% | **20.9%** | 6.4% |
| 15 | 2765 | 99.9% | 57.4% | **26.3%** | 7.9% |
| 20 | 1414 | 100.0% | 87.8% | **49.3%** | 15.0% |
| 25 | 402 | 100.0% | 99.5% | **92.8%** | 50.0% |
| 30 | 121 | 100.0% | 98.3% | **95.9%** | 90.9% |

**HOW TO READ THE scdet AXIS, because the row you pick IS the answer you
get:** low-score events are gradual changes and camera motion, which do
NOT invalidate identity association -- the tracker follows them and
should. High-score events are hard shot changes, the only thing this gate
exists to catch. So the rows that bear on CUT_DELTA are the HIGH ones,
where **60 catches 92.8-95.9%** -- not the 45.5% the bad table reported.

**THAT FIGURE MAY NOT TRAVEL WITHOUT ITS ROW (critic B6), because the
row is a selection on a correlated quantity.** scdet and our delta are
both luma statistics at pearson 0.498 (A6), so filtering to scdet >= 25
also filters toward cuts OUR OWN statistic already scores high: the
median our-delta of the selected population rises 48.7 (>= 8) to 75.0
(>= 25) to 93.5 (>= 30). At the >= 30 row the population median sits
ABOVE the gate, so "60 catches 95.9%" is partly a restatement of the
selection. The comparison that survives is BETWEEN COLUMNS on one row --
60 against 75 at a fixed population -- never the percentage on its own.

**3. scdet IS NOT AN INDEPENDENT INSTRUMENT, and 10g leaned on that
word.** It scores the LUMA plane, which is the same quantity our 16x16
grid measures. Executed: a hard **red -> green cut at matched luma scores
0.391**; red -> white scores **60.156**.

So it is an independent *implementation* of a similar measurement, not an
independent *instrument*, and it is blind to exactly the class of cut
10g blamed our gate for missing. **The direction of that error is known
and it is unflattering: true recall is LOWER than every number above**,
because the ground truth cannot see the cuts we cannot see either.
Pricing the chroma-only class needs a third instrument that is not
luma-based.

### 10k. RETRACTED IN FULL: the "direct" instrument did not model the app

**Everything this section concluded came from an arm that wipes tracks at
a cut. The app has never wiped.** `init-entry` is
`videoTracks = demoteTracks(videoTracks)`, and that function's own call
site says why: *"DEMOTE, don't wipe (review C2): boxes persist so
coverage holds through the pass gap."* `arch-arms.mjs` did `tracks = []`,
under a comment asserting the opposite. A wipe leaves **nobody covered**
until the next verdict frame -- 1.5s at his cadence -- so the arm
manufactured one exposure gap per cut.

**And the defence written directly above that line was exactly backwards.**
It said to read only the DIFFERENCE between two cut arms because "the
same handicap applies to both". The handicap is paid ONCE PER WIPE, and
`cutFrames` is the swept axis: 200 at CUT_DELTA 35 against 2 at 90. So
the difference between two rows was mostly the difference in how many
gaps each row invented.

Both arms, same instrument, same banks, `CUT_MODEL=wipe|demote`:

| CUT_DELTA | cuts | EXPOSURE wipe / **demote** | FALSE COVER | PHANTOM |
|---|---|---|---|---|
| 35 | 200 | 82.5s / **53.5s** | 173.5 / 198.0 | 141.0 / 202.5 |
| 40 | 184 | 82.5s / **53.5s** | 173.0 / 194.5 | 145.5 / 203.5 |
| 50 | 115 | 71.0s / **50.5s** | 167.5 / 183.0 | 149.0 / 191.5 |
| 60 | 59 | 67.0s / **55.5s** | 163.5 / 170.5 | 158.5 / 182.0 |
| 75 | 12 | 57.0s / **55.0s** | 157.0 / 158.0 | 162.0 / 166.5 |
| 90 | 2 | 55.5s / **55.5s** | 155.0 / 155.5 | 163.0 / 163.5 |

**"Exposure falls monotonically all the way to 90" was 95% instrument.**
Under the shipped handler the column is FLAT and non-monotone -- 53.5,
53.5, 50.5, 55.5, 55.0, 55.5 -- across a **100x** change in how often the
gate fires. The published 67.0 -> 57.0 across 60 -> 75 is really
55.5 -> 55.0.

**And the sign of the stated cost inverts.** 10k said "the real cost of
75 is PHANTOM (+3.5s over 60)" and shipped 60 on that basis. Under the
shipped handler 60 -> 75 is phantom **-15.5s** and false cover
**-12.5s**, with exposure -0.5s: 75 is better in every column, including
the one the decision was justified by.

**What survives, and it is not the rule I wrote.** "Where a proxy and a
direct measurement disagree, the direct one decides" is fine as far as it
goes, and it is not what failed. What failed is that I never asked
whether the direct instrument models the shipped behaviour before letting
it overrule the proxy. **A direct measurement earns its authority from
fidelity, not from being direct** -- and this one contradicted a comment
in the file it was modelling, which is a difference anybody could have
read in ten seconds.

**Where that leaves the number: see 10m, because the demote arm was
still biased and it was biased toward raising it.** The corrected arm
above models demotion but not the app's forced verdict pass, which is
what makes a cut CHEAP -- and that residue overstates the cost of firing
one. Modelling it flips the exposure column a third time, back to what
the recall proxy said. **CUT_DELTA stays 60**, and the value was never
moved on either intermediate arm.


### 10l. What went wrong underneath all of it: derivatives that do not declare themselves

Five separate defects this round were one shape -- **a derived artefact
that does not state what it was derived from**:

- `bank/cuts.json` banked at 50, scored against a bundle shipping 60
  (10a). Fixed by a `__meta` stamp plus `assertCutsFresh`.
- `.cache/shipped.mjs` an hour stale (10d). Fixed by `_build.mjs`.
- `birth-ab.mjs` printing `CUT_DELTA 50` as a **literal** while scoring
  whatever bank was on disk. That literal is how "-38.0s false cover at
  near-zero exposure cost" reached shipped source and a test comment; the
  real number at the shipped 60 is **-30.5s of false cover for +5.0s of
  EXPOSURE**, and "false cover roughly HALVES" was false at every bank
  (-25.3% at 28, -18.5% at 50, -15.7% at 60). The label reads the bank's
  own stamp now.
- `corpus-cuts.mjs` defaulting every delta to `bank/cuts.json`, so
  `for v in 35 50 75 90` -- which is how a sweep is actually run -- left
  the DEFAULT bank holding whichever value ran last. It did. The default
  path is self-naming for any non-shipped value now.
- `cut-sweep.mjs` hardcoding `v === 50 ? cuts.json : ...`, silently
  encoding "the default bank holds 50". Stamp-driven now.

**THE RULE, and it is cheap: an artefact derived from a constant must
carry the constant, and whatever PRINTS a number must read it from the
artefact rather than restate it.** A comment saying which value a table
came from is worth nothing -- it is the first thing to go stale, and it
went stale here in the flattering direction twice.

**AND A GUARD MUST NOT REFUSE ITS OWN FIX.** `assertCutsFresh` ran from a
top-level `makeArms(SHIPPED)`, so it threw during module EVALUATION --
and `cut-sweep`, whose entire job is to swap the bank, could not import
the function it needed to call. Every corpus arm was dead at HEAD behind
a guard that was correct about a bank nobody had re-derived. The arms are
lazy now: importing is side-effect-free and the first USE still asserts.

**A THIRD INSTANCE OF THE SAME SHAPE, IN MY OWN SHELL.** Two edits this
round were silently reverted by `cp /tmp/sg.bak` and `cp /tmp/ie.bak`
restoring backups written by an EARLIER command -- one of them putting
back a version from before a committed change. A fixed backup path is a
derivative that does not declare which run it came from. Use `mktemp`.


### 10m. Model the forced pass too, and the exposure column flips a THIRD time -- onto the proxy

The demote arm still did not model the whole handler. `init-entry` also
sets `lastSample = 0; lastZoomAt = 0` at a cut, so the very next pass
re-reads gender rather than only positions. **That forced pass is what
makes a cut cheap**: demotion resets the clear ladder, and the immediate
re-read is what lets a wrongly-demoted man pay it back at once.

The corpus thins to k=3 to model his 1.5s cadence, which parks the real
banked reads on `_labelFaces` -- so on a cut frame they can be handed
straight back as INPUT. Same reads a verdict frame gets, nothing
synthetic. `CUT_MODEL=full|demote|wipe`, all three reproducible:

| CUT_DELTA | cuts | wipe | demote only | **full (shipped)** | FALSE COVER | PHANTOM |
|---|---|---|---|---|---|---|
| 35 | 200 | 82.5s | 53.5s | **33.0s** | 174.0s | 253.0s |
| 40 | 184 | 82.5s | 53.5s | **33.0s** | 174.5s | 251.5s |
| 50 | 115 | 71.0s | 50.5s | **35.5s** | 166.5s | 211.5s |
| **60** | 59 | 67.0s | 55.5s | **46.0s** | **159.0s** | **199.5s** |
| 75 | 12 | 57.0s | 55.0s | **52.5s** | 155.0s | 171.0s |
| 90 | 2 | 55.5s | 55.5s | **55.5s** | 153.5s | 163.5s |

**At 90 all three arms agree to the decimal (55.5s).** The gate fires
twice in the entire corpus there, so the handler cannot matter -- the
arms differ only where cuts fire, which is the sanity check that this is
one instrument with three handlers and not three instruments.

**EXPOSURE NOW RISES MONOTONICALLY WITH CUT_DELTA: 33.0 -> 55.5.** Every
earlier reading of this column was an artefact of a handler that was not
the app's:

| arm | exposure vs CUT_DELTA | what it implied |
|---|---|---|
| wipe (published, retracted) | falls 82.5 -> 55.5 | raise it, exposure improves |
| demote only | flat 53.5 -> 55.5 | raise it, exposure is free |
| **full (shipped)** | **rises 33.0 -> 55.5** | **raising it costs protection** |

**AND THAT IS THE RECALL PROXY'S ANSWER.** 11/A1 measured 60 catching
92.8-95.9% of hard cuts against 75's 50-90.9%, and phase A's F1
concluded from it that pushing 75 risks exposure. I reversed that on the
wipe arm. Corrected, **the proxy and the direct measurement now agree**
-- a missed cut leaves a stale CLEARED track, and that is exposure. Two
instruments that share no code and no input converging is much stronger
evidence than either alone, and it is only available because the direct
one was made to model the app.

**F1 WAS RIGHT AND I OVERRULED IT TWICE**, once by lowering the OTA
ceiling on the proxy (wrong reasoning, right direction) and once by
restoring it on a broken direct measurement (right reasoning, wrong
instrument). The lesson is not "trust the critic" -- it is that **an
instrument's fidelity to the shipped code is a precondition for its
authority, and it must be checked BEFORE the instrument is used to
overrule something, not after it disagrees.**

**The bias had a direction and it was the direction of the pending
decision.** The demote arm was about to be used to push CUT_DELTA to 75
over the OTA channel. It overstates what a cut costs, which is exactly
the bias that makes firing fewer cuts look free. An instrument may not
be left biased toward the change it is being asked to price.

**WHAT SHIPS: 60, unchanged, and now for a reason rather than by
default.** Against 75 it costs 6.5s exposure and buys 28.5s phantom;
against 50 it buys 10.5s exposure and costs 12.0s phantom. 60 is not
optimal on either column alone -- 35 minimises exposure at 33.0s and 90
minimises phantom at 163.5s -- and the corpus cannot pick between his two
loudest complaints for him. What it can say is that the axis is a
genuine trade with no free direction, which is the thing all three
earlier readings denied.

**The OTA ceiling stays 75, as a BOUND and not a recommendation.** It is
now measured to cost exposure against the shipped value, so a push to it
is a protection decision, not a tuning one.

**RE-DERIVED AFTER 13** (the arm was telling the tracker a 500ms cadence
in every arm here too). The DIRECTION of everything above survives --
exposure still rises with CUT_DELTA, there is still no free direction --
and every magnitude moves:

| CUT_DELTA | cuts | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|---|
| 35 | 200 | 16.0s | 211.0s | **770.0s** |
| 50 | 115 | 17.5s | 188.0s | 518.0s |
| **60** | 59 | **24.5s** | **186.0s** | **482.5s** |
| 75 | 12 | 29.0s | 178.5s | 394.5s |
| 90 | 2 | 31.5s | 172.0s | 386.5s |

60 -> 75 is +4.5s exposure for -88.0s phantom; 60 -> 50 is -7.0s exposure
for +35.5s phantom. **60 stays**, and the phantom column at the low end
(770s at 35) is far steeper than the pre-13 arm could see.

**THE ARM DEFAULTS TO THE APP, AND THAT REBASES 29 BENCH FILES.**
`cutNoPass` is an opt-OUT, named for what it removes. Making the forced
pass an opt-IN would have left every other arm in `bench/` -- birth-ab,
cut-value, matrix, churn, and 25 more that pass `cut: true` -- silently
running a handler the app does not, which is the defect this whole
section exists to fix. **Every number any of those arms has produced is
on the old model.** The one that was quoted in shipped source has been
re-run:

| birth rung, man, k=3 | exposure | false cover | phantom |
|---|---|---|---|
| as committed (wipe arm) | +5.0s | **-30.5s** | -6.0s |
| shipped cut handler | +5.0s | **-25.5s** | -6.0s |
| **+ the forced pass (current)** | **+1.0s** | **-19.5s** | -6.0s |

**The third row is what `person-track.mjs` and `bench/birth-ab.mjs` both
say, and this section said -25.5s for a day after they moved** (critic
C7). It is the same staleness this section is about, in the section
about it: a derivative that does not declare what it was derived from.

The direction and the sign of the exposure cost are identical
throughout; only the size moved. That figure has now been wrong THREE
times in the same direction for three different instrument reasons
(-38.0s from a bank derived at the wrong CUT_DELTA, -30.5s from the wipe
arm, -25.5s from an arm with no forced pass), and `person-track.mjs`
records the whole chain rather than just the current value -- a number
that has moved three times is worth less than the fact that it keeps
moving one way.

### 10n. A cut buys TWO different goods, and CUT_DELTA is charged for both

The shipped handler DEMOTES (association hygiene) and FORCES A VERDICT
(`lastSample = 0`). 10m's sweep cannot tell them apart -- lowering
CUT_DELTA buys more of both at once. They have very different prices on
his phone: a demotion is arithmetic on a list, a forced verdict is
730-1250ms of GPU (12a).

`bench/cut-vs-random.mjs` splits them with five arms, the control being
the SAME NUMBER of forced verdicts scattered to deterministic-random
frames (per window, seeded by window index, drawn without replacement --
cuts cluster, and a global count would hand the control's verdicts to
windows that never earned them). CUT_DELTA 60, 59 cut frames, k=3:

| difference | isolates | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|---|
| 2-1 | N verdicts ANYWHERE | +1.0 / -7.0 | -1.0 / +2.0 | **+49.5 / +67.0** |
| 3-2 | ...placed AT cuts | -7.0 / +1.5 | -2.0 / +3.5 | **-32.5 / -37.0** |
| 4-1 | demotion alone | **-6.5 / -7.5** | +17.0 / +7.5 | +75.5 / +33.5 |
| 5-3 | demotion on top | -1.0 / -4.0 | +17.0 / -1.5 | +80.5 / +29.5 |

*(man / woman; re-derived after 13)*

**WHAT SURVIVES BOTH GENDERS, and it is the phantom column:**

1. **Extra verdicts are far cheaper AT CUTS than anywhere else**:
   -14.5s and -15.5s of phantom for the identical verdict count. A
   verdict spent where the picture actually changed produces fewer
   spurious patches than one spent mid-shot.
2. **Verdict COUNT is what drives phantom**, not demotion: +28.0s and
   +31.5s for 59 extra verdicts scattered at random -- an 8% increase in
   verdicts costing 15-19% more phantom. Phantom is his loudest
   complaint, so this is the constraint on every cadence lever.
3. **Demotion costs phantom in both directions** (+19.0/+8.0 alone,
   +23.0/+14.5 on top) while buying at most 3.0s of exposure.

**THE GENDER DISAGREEMENT WAS THE INSTRUMENT.** Before 13 this section
read "in man mode demotion buys 0.0s of exposure, in woman mode 1.5-3.0s"
and concluded that the two arms disagreed about which half of the handler
protects. Corrected, **they agree**: demotion buys **6.5s (man) and 7.5s
(woman)** of exposure, and costs false cover and phantom in both. The
disagreement was tracks expiring between verdicts, which swamps whatever
the demotion does. **The cut handler is still not changed** -- but the
reason is now that both halves earn their keep, not that the evidence
contradicts itself.

The one thing the arms still split on is whether PLACEMENT buys exposure
(man -7.0s, woman +1.5s). The phantom half of that is consistent and
large in both (-32.5s, -37.0s), and 13b takes it up properly.

**AND IT RECONCILES A DISCREPANCY IN 12a.** That section measured
`effZoom = min(2000, cost * 4) = 2000ms` on his Redmi while the same
window shows 58 verdicts in 90s = **1.55s** per verdict. The gap is
these forced passes: a cut drags the next verdict forward, so his
OBSERVED cadence is faster than his nominal one and **the scene gate has
been an unpriced cadence mechanism all along**. The corpus's k=3 label
("his 1.5s regime") is therefore correct as a description of what he
gets, and 12b's arithmetic is not: pushing
`VERDICT_MAX_INTERVAL_MS` 2000 -> 1200 cannot buy 1.67x, because the
starting point is 1.55s and not 2.0s. **The ceiling on that push is
1.55/1.2 = 1.29x**, and only on footage that cuts as often as the window
it was measured in.

## 11. DETECTOR RECALL -- the error class every other sweep is downstream of

Every threshold this repo has swept prices a DECISION. All of them are
downstream of a DETECTION, and if BlazeFace and MoveNet both come back
empty on a frame containing a person, no constant anywhere can cover
her. Worse, she is invisible to every arm we own: the corpus banks
READS, so a frame with no read contributes nothing and quietly scores as
a frame with nobody in it.

`bench/detector-recall.mjs`. The instrument is **coco-ssd**, already
banked per frame at the same frame times -- a genuinely independent
detector: different architecture, different training set, whole-person
boxes, and crucially neither face-based nor luma-based. That last point
is not decoration; 10j is the record of what happens when ground truth
turns out to share the blind spot it was brought in to measure.

**2,131 person-instances over 18 windows**, coco-ssd score >= 0.5,
height >= 0.15 of frame:

| | count | share |
|---|---|---|
| seen by a FACE | 1706 | **80.1%** |
| seen by a POSE only | 306 | **14.4%** |
| **MISSED ENTIRELY** | **119** | **5.6%** |

**THE INSTRUMENT SURVIVES ITS OWN SENSITIVITY CHECK.** A bare
containment test would credit us with seeing person B when we only saw
person A's face inside B's box -- inflating recall in the flattering
direction. Requiring the face centre in the top HALF of the body box
moves the miss rate 5.6% -> 6.2%; the headline is robust. (At the top
0.35 it reads 10.5%, but that band wrongly rejects head-and-shoulders
framings, where the ssd box is mostly head.) A first run of this sweep
read IDENTICAL at all three bands -- the patch had not applied. **A flat
sweep is a broken instrument until proven otherwise**, for the fourth
time in this repo.

### 11a. MoveNet finds one person in seven that the face model does not

**306 person-instances -- 14.4% -- are seen by POSE ONLY.** That is the
single most useful number here, and it lands on a live decision: the
`PERSON_SKIP_EVERY` dial on the OTA channel turns MoveNet down. 10i
measured what skipping BUYS on his phone (+39% render frame rate, zero
verdict cadence); this measures what it COSTS, on different evidence
entirely, and the answer is up to one person in seven.

**RETRACTED WITHIN THE HOUR, BY ME, AND THE CORRECTION MAKES THE
FINDING STRONGER.** This section first carried a caveat saying the 14.4%
was a NATIVE-RESOLUTION number that might not transfer, because his
player decodes 640x360 and on his phone MoveNet admits nobody. **The
corpus is not native resolution.** `corpus-lib.mjs:8` reads
`W = 640, H = 360; // his measured decode, itag 134`, and ffprobe on all
ten videos confirms it: 640x360 h264 at 101-595 kbps, which is his
stream class exactly.

So the 14.4% IS measured at his resolution and his bitrate, and the
argument against pushing `PERSON_SKIP_EVERY` is stronger than stated,
not weaker: the dial gives up the only detector that sees one person in
seven, at the decode he actually watches.

**AND IT RE-FRAMES THE n:0 OBSERVATION RATHER THAN CONTRADICTING IT.**
MoveNet reading all twelve slots empty on his phone is real and was
measured repeatedly across loops 35-40. It is not resolution -- loop 36
already established that, driving the emulator to HIS timestamps and
reproducing the n:0 regime exactly, and concluding "it is FOOTAGE, not
hardware". Both hold: MoveNet finds people on typical 640x360 footage,
and found nobody in the specific moments he happened to be watching.

**THE LESSON IS THE ONE FROM 10j AGAIN, one section later.** I wrote a
plausible physical caveat about an instrument without reading the eight
lines at the top of the file that define it. A story that sounds right
about a measurement is not a fact about the measurement, and it is
cheapest to check before it is written down.

### 11b. The misses are not small, and PERSON_MIN_SCORE is not the lever

The obvious hypothesis was that misses are distant background people the
detectors legitimately drop. **They are not: missed persons run p50
0.38 of frame height, p95 0.99.** These are large, foreground people.

The next hypothesis was a threshold: MoveNet nearly saw her and
`PERSON_MIN_SCORE` 0.35 refused it. Measured against the shipped slot
diagnostic (`lastSlotDiag`, which the gate itself fills in):

- a REJECTED slot sat on her: **82 of 119 (68.9%)**
- no slot there at all: **37 (31.1%)**
- those slots score **p05 0.011, p50 0.110, p95 0.264**

| PERSON_MIN_SCORE | misses it would recover |
|---|---|
| 0.30 | 2 of 119 (1.7%) |
| 0.25 | 7 (5.9%) |
| 0.20 | 16 (13.4%) |
| 0.10 | 44 (37.0%) |

**SO THE FLOOR IS NOT THE LEVER.** Recovering even a third of the misses
means 0.10, which is indistinguishable from admitting every noise slot,
and PERSON_MIN_SCORE was raised 0.25 -> 0.35 deliberately. The rejected
slots on missed people sit at NOISE level, not just under the bar. This
is genuine detector blindness, and the fix is a different model, not a
different number. **That is worth more than a tuning win: it says a
night spent on this constant would have bought 5.9%.**

### 11c. How long is she unseen

55 contiguous miss runs. **p50 1 frame** -- a detector blink the tracker
coasts straight through, and not an exposure. But **p95 4 frames and max
14**, and 7 runs (12.7%) last 3+ frames. At the corpus 0.5s spacing that
longest run is **seven seconds of a large, foreground person with
nothing over her**, which no threshold in this repo can reach.

Weak attribution on who those people are (nearest labelled face at the
same spot in the same window): mixed 39, **woman 37**, other 26, man 14.
So roughly a third of the misses are where a woman stands.

**EVERY NUMBER ABOVE IS AN UPPER BOUND ON US.** coco-ssd has its own
misses, and a person neither detector finds appears in neither column.
It cannot be run the other way round to clear us.

### 11d. What this changes about where to spend the next night

The ranked open list had thresholds near the top. It should not. On this
corpus:

- a threshold sweep moves 1-3s of exposure (every sweep this month);
- the verdict CLOCK moves 19s (24.5s at 1.5s/verdict, 5.5s at 0.5s -- was
  quoted as 73s from a mis-instrumented arm, see 13);
- and **6% of people are never detected at all**, which is upstream of
  both and which no constant touches.

The clock is still the biggest lever and 10i just measured that skipping
MoveNet does not buy it. So the two things actually worth a night are
**(1) why a verdict pass costs what it costs on his device** -- the
~500ms MoveNet figure is unexplained and suspected to be shader
recompiles from varying crop shapes -- and **(2) the 6%**, which needs a
better detector rather than a better threshold.


## 13. THE ARM TOLD THE TRACKER A CADENCE IT WAS NOT RUNNING, and every corpus number in this repo is on it

`arch-arms.mjs` called `setVerdictCadence(dt)` where `dt = 1000 / win.fps`
= **500ms**, in every arm -- including the k=3 and k=4 arms where a
verdict actually lands every 1500ms or 2000ms. That is not a label.
`person-track` SIZES ITS COAST WINDOWS from that number:

```
cap          = max(PTRACK_MAX_COAST_MS 2000, 2 * effZoom)
blurredCoast = min(cap, max(900, 2.5 * effZoom))
```

| effZoom told | coast | real gap at that k | track survives the gap? |
|---|---|---|---|
| 500 | **1250ms** | 1500ms (k=3) | **no** |
| 500 | **1250ms** | 2000ms (k=4) | **no** |
| 1500 (correct) | 3000ms | 1500ms | yes |
| 2000 (correct) | 4000ms | 2000ms | yes |

**So every k=3 number this repo has ever produced -- which is every
corpus number, since k=3 is "his regime" -- ran with tracks expiring
between every pair of verdicts.** `PTRACK_MIN_COAST_PASSES`, the constant
whose entire stated job is *"the window may never be too short to reach
the next pass"*, was floored at `2 x 500` instead of `2 x 1500` and could
not do it. Same shape as 10k/10m: **the arm contradicted the module it
was replaying.** Third time tonight.

The stride is INFERRED, not passed in -- `thin` marks every frame it
silences by moving the reads to `_labelFaces`, so the cadence is a
property of the window the arm was handed and cannot disagree with it. A
caller-supplied option is a thing 30 bench files can forget. It is the
MEDIAN gap, because an irregular policy (13a) can open with two adjacent
verdict frames and would otherwise be handed a stride of 1 -- the same
defect, in the arm built to test against it.

**k=1 IS THE CONTROL AND IT DID NOT MOVE.** At k=1 the stride is 1, so
the fix is arithmetically a no-op there, and the arm reads 5.5s / 146.5s
/ 371.0s before and after. Every thinned arm moved; the unthinned one
did not.

### 13a. Corrected, the cadence dial has NO trade -- all three columns improve

| cadence | verdicts | EXPOSURE | FALSE COVER | PHANTOM | births |
|---|---|---|---|---|---|
| k=4 (2.0s) | 540 | 29.5s | 204.0s | 551.5s | 160 |
| **k=3 (1.5s, his)** | 720 | **24.5s** | **186.0s** | **482.5s** | 174 |
| k=2 (1.0s) | 1080 | 16.5s | 159.0s | 383.0s | 221 |
| k=1 (0.5s) | 2160 | **5.5s** | **146.5s** | **371.0s** | 307 |

**RETRACTED IN PART, 2026-09-02 (critic C1, reproduced independently).**
This table is real and it is the honest model of moving
`VERDICT_MAX_INTERVAL_MS` on a device. What was wrong is reading it as a
DECOMPOSITION and drawing a mechanism out of it.

Every row moves **two** variables. `person-track.setVerdictCadence(ms)`
derives `blurredCoastMs` and `clearedCoastMs` from the number it is
handed, so k=4 coasts 4000ms and k=1 coasts 1250ms. "The clock got
faster" and "the coast got shorter" arrive in the same row, and the
second is the one that moves phantom. On a device the two really are
coupled -- `effZoom` feeds `setVerdictCadence` -- which is why the table
stands as a model of the dial and falls as an explanation of it.

**WITHDRAWN:** "there is no exposure/phantom trade along this dial at
all", "the only cost is GPU duty", and "that makes
`VERDICT_MAX_INTERVAL_MS` the cleanest lever in the system". Pin the
coast at the k=3 control and only exposure still responds to the clock;
phantom moves the OTHER way, hard (`bench/cadence-ab.mjs`, which prints
both families side by side now):

| coast PINNED at 3000ms | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|
| k=4 (2.0s) | 33.5s | 150.5s | 382.0s |
| **k=3 (1.5s, his)** | **27.5s** | **137.0s** | **460.5s** |
| k=2 (1.0s) | 14.0s | 121.0s | 496.0s |
| k=1 (0.5s) | **9.0s** | 141.0s | **784.0s (+70%)** |

That agrees with §10n, measured independently in this same document
("**verdict COUNT is what drives phantom**"), which the withdrawn
sentence contradicted. More verdicts buy exposure and cost phantom; the
diagonal hid the second half because the shortening coast was paying it
back.

**AND THE HEADLINE ROWS CANNOT BE BOUGHT.** `tuning.mjs:118` clamps
`VERDICT_MAX_INTERVAL_MS` to **[1200, 4000]**, so the k=2 (1000ms) and
k=1 (500ms) rows are unreachable by the constant this section is about.
What IS reachable is 2000 -> 1200-1500, i.e. the k=4 -> k=3 step, and on
the DIAL family that step buys 5.0s exposure, 28.5s false cover and
71.5s phantom. Still worth doing, for a different reason than the one
published.

It also corrects the headline this repo has quoted all week. **"Man
exposure 81.0s at 1.5s against 8.0s at 0.5s" is 24.5s against 5.5s.**
The clock is still the biggest single lever -- 19s across that range,
against 1-3s for any threshold -- but it is a quarter of the advertised
size, and the old figure was measured with tracks that could not coast.

### 13b. Event-driven placement, priced honestly at last

> **CORRECTED 2026-09-02 (phase-D D5).** The baseline row printed here as
> "UNIFORM k=3 (today)" was built WITHOUT the identity memory the app has
> shipped since 1084, while §15a's "SHIPPED" row was built with it — two
> rows described as the current app, in one document, **42.0s of false
> cover apart**, with their numbers subtracted across in the closing
> sentence. That mattered most here of anywhere: re-birth suppression is
> exactly the mechanism placement acts on. Re-derived in **15b**. The
> conclusion — placement costs more than it buys — survives.


`bench/cadence-place.mjs` holds the verdict budget EXACTLY and chooses
the frames, with a causal rule the app could run (`verdict if starved
past MAXGAP, or if the gate's own delta clears a solved threshold T`).
T is bisected until the arm spends the uniform budget, so the comparison
is placement against placement and never budget against budget.

**CORRECTED, 2026-09-02 (critic C3). The budget was held exactly, as
advertised. The COAST was not.** The stride inference takes the MEDIAN
gap between verdict frames, and in a starvation-dominated policy most
gaps ARE `MAXGAP` -- so the median is the WORST gap, not the typical
one, and it varies per window. Thirteen of eighteen windows were handed
a 4000ms coast at max gap 4 against the control's 3000ms, and nine got
**6000ms** at max gap 6, while every arm had the IDENTICAL mean gap of
3.00 frames. §15 has since established that the coast is what moves two
of the three columns, so the placement arms were being scored partly on
a longer coast they were never granted by the policy.

Every arm is told `HIS_EFFZOOM` now, which is what makes this a
comparison of placement:

| arm (720 verdicts each) | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|
| UNIFORM k=3 (today) | 20.5s | **197.0s** | **592.0s** |
| PLACED, max gap 4 (2.0s), T=13.2 | **13.5s** | 229.5s | 672.5s |
| PLACED, max gap 6 (3.0s), T=7.1 | 30.0s | 226.0s | 648.5s |

**THE CONCLUSION FLIPS.** The published version said placement buys
"8.5s of exposure AND 16.0s of phantom for 31.5s of false cover" -- a
lever that improved two columns at once, which is what made it look
worth a round. With the coast held it buys **7.0s of exposure and costs
32.5s of false cover and 80.5s of phantom**. The phantom benefit was the
coast.

That leaves placement behaving exactly like more verdicts do (§10n): it
buys exposure and it costs phantom. It is not a free lunch and it is not
a third kind of lever. At max gap 3.0s it still loses on every column,
so the max gap remains the load-bearing half of the policy.

**NOT PROPOSED, and the reason is now the measurement rather than
caution about the measurement.** It would be a new cadence architecture
in the player -- the highest-risk place in the app -- to buy 7.0s of
exposure at a cost of 80.5s of phantom, when the coast dial (15a) buys
149.5s of phantom for 4.5s of exposure by changing one number over the
air. If the exposure column is what he wants bought, placement is a
candidate; nothing else about it is special.

The original "NOT PROPOSED" note said the idea was worth a proper round
because it was "the only cadence lever measured that does not spend more
GPU". That was true and it is no longer the interesting property: the
coast dial does not spend more GPU either, and it wins.

## 12. THE VERDICT CLOCK IS SET BY A CONSTANT, NOT BY COST -- and that constant could not travel

The corpus prices the clock far above any threshold: man exposure 24.5s
at 1.5s per verdict against 5.5s at 0.5s (RESTATED, see 13 -- the 81.0s /
8.0s this said was measured with a tracker told the wrong cadence), where every gender, clear-bar,
cut and birth constant swept this month moves 1-3s. 10i then measured
that halving the pass cost on his device bought NOTHING in verdict rate,
and left the reason unexplained. This is the reason.

`init-entry.js:3382`:

    effZoom = min(VERDICT_MAX_INTERVAL_MS,
                  max(ZOOM_INTERVAL_MS, lastVerdictMs * VERDICT_DUTY))
            = min(2000, max(400, lastVerdictMs * 4))

Three regimes, and only two respond to a cheaper pass:

| verdict cost | regime | cadence | does cheaper help? |
|---|---|---|---|
| < 500ms | duty-limited | cost x 4 | yes |
| **500-2000ms** | **CAP-limited** | **2000ms** | **no** |
| > 2000ms | busy-limited | ~cost | yes |

**EVERY VERDICT COST THIS REPO HAS EVER MEASURED ON A DEVICE IS IN THE
MIDDLE ROW** -- 794ms (loop 27), 618-639 (loop 29), 745-746 (loop 35),
1250 tonight. So the clock has been a CONSTANT on his hardware the whole
time, and every optimisation aimed at pass cost was aimed downstream of
the thing that decides.

### 12a. The pass, decomposed on his Redmi

`spikes/gauntlet/probe_pass_cost.py`, 90s windows on his own watch page,
reading the per-pass mark ring the player already keeps:

| | SKIP 1 (shipped) | SKIP 3 |
|---|---|---|
| verdict pass p50 | **1250 ms** | **728 ms** |
| persons (MoveNet) | 814 (65%) | 300 (41%) |
| crops (face + gender) | 362 (29%) | 358 (49%) |
| upload / tracks / end | ~2 / 0 / 1 | ~2 / 0 / 1 |
| verdict passes | 58 | **62** |
| position passes | 42 | **97** |
| effZoom | min(2000, 5000) = **2000** | min(2000, 2912) = **2000** |

**BOTH ARMS ARE CAP-LIMITED.** Halving the pass bought FOUR extra
verdicts in ninety seconds, which is 10i's null result with a mechanism
under it. The 2.3x rise in POSITION passes is where 10i's +39% render
frame rate came from -- the freed time went to tracking, which is real
and is not the clock.

**MoveNet is 65% of a verdict and admits nobody in his regime.** That has
been recorded since loop 27; what is new is that removing it still does
not move the clock, because the cap is what binds.

### 12b. So the constant travels now

`VERDICT_MAX_INTERVAL_MS` lived in a per-video closure, where changing it
meant a 56MB install -- and he has said plainly he is tired of installing
versions. It is `app/gaze/src/cadence.mjs` now, on the OTA whitelist,
**shipping at exactly the value it had**, so nothing changes until a
number is deliberately pushed.

It is READ at every use rather than copied into the closure: a copy taken
at attachVideo time would freeze whatever the value was when that video
attached, so a pushed number would apply to the next video and not this
one -- the silent half-applied state the channel must never produce.
Verified in the EMITTED bundle, not the source: `Xh=2e3`, setter
`function d2(t){Xh=t}` wired as `VERDICT_MAX_INTERVAL_MS:[1200,4e3,...]`,
and both effZoom sites read `Math.min(Xh,...)`.

**THE RANGE IS A DUTY DECISION.** Duty is cost/interval, and starving the
main thread is his "the page loads a lot ... just the loading icon"
complaint:

| interval | duty at 1250ms (no skip) | duty at 728ms (skip 3) |
|---|---|---|
| 2000 | 62% (today) | 36% |
| 1500 | 83% | 49% |
| 1200 | 104% saturated | 61% (= today's duty) |

At 1200 with no skip the pass is longer than its own interval. That
cannot build a backlog -- `verdictBusy` forbids a second pass while one
runs -- but it leaves the page almost nothing. **Below ~1500 is only safe
with PERSON_SKIP_EVERY above 1, and the two must be pushed together.**

The interesting cell is the last one: **skip 3 at interval 1200 runs the
same 61% duty the shipped build already runs at, for a 1.67x verdict
rate.** That is the first credible route at the biggest lever, and it is
now two numbers over the air rather than a release.

### 12c. And the test map was hand-maintained, which is 10l again

`tuning.test.mjs` checks that `rules/tuning.json` agrees with the code
for every entry in a SHIPPED map -- written by hand. Adding a dial
without adding it there leaves the new constant unchecked while the test
still reports green, and an unchecked constant **reverts on every device
the moment the OTA lands**. The test now fails if a tunable name is
missing from its own map; proved red before green, as was the
source/json mismatch it exists to catch.

## 14. THE A-SERIES LADDER WAS FIVE LABELS ON ONE ARM

> **CORRECTED 2026-09-02 by the phase-D critic — read 14c below before
> quoting any number in 14 or 14a.** Both sections ran **unthinned**
> (stride 1, told 500ms, coast 1250ms) while being published as "same
> k=3", and 14a swept two constants together, one of them provably inert
> in the arm it ran. The conclusions survive and two published sentences
> do not. The corrected tables are in **14c**; the tables below are left
> as written so the retraction is legible.


`arch-ab.mjs` printed six rows. Five of them were the same arm.

```
A0 shipped (per-frame verdict)         7.5s      188.5s    282.5s
A1 per-subject window + hold           5.5s      210.0s    314.0s
A2 A1 + nm-weighted pool               5.5s      210.0s    314.0s
A3 A2 + per-subject ghost drop         5.5s      210.0s    314.0s
A4 A3, pooled bar floor .40            5.5s      210.0s    314.0s
A5 pooled bar .40, NO ghost drop       5.5s      210.0s    314.0s
```

`armSubject(opts)` is `ARM({ pool: true, ...opts })`, and `ARM` reads
**none** of `nmWeight`, `ghost` or `poolBar`. Eight call sites across six
files passed them. The pooled decision ran at the module constant
`POOL_BAR = 0.40` in every arm, in every file, always.

**What that invalidates, precisely.** Not the numbers -- 5.5 / 210.0 /
314.0 is a real measurement of a real arm (the per-subject pool at bar
0.40). What it invalidates is every DECOMPOSITION claim built on
differences between those rows, and this file's own header carried one:
*"pooling alone cost 0.5s, the drop cost 3.0s more."* A2 − A1 is zero by
construction. That sentence could never have been measured here.

**The fix, and what was deliberately not done.** `poolBar` is threaded
into the pooled decision, because the label names a number and a label
that names a number must be honoured. `nmWeight` and `ghost` are read
nowhere at all, so they were DELETED from the call sites rather than
given behaviour: an arm invented to justify a label is worse than a
missing arm, and neither of those options has a specification anywhere
in the repo to implement against.

**The dimension is real now, and it is a hard trade.** Sweeping the one
option that survived, same corpus, same k=3, man mode:

| pooled bar | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|
| A0 shipped (no pool) | 7.5s | **188.5s** | **282.5s** |
| 0.25 | 15.5s | 205.5s | 299.0s |
| 0.40 (what every "A5" ran at) | 5.5s | 210.0s | 314.0s |
| 0.60 | 2.0s | 251.5s | 349.0s |
| 0.80 | **1.5s** | 430.0s | 408.5s |

**SO THE PER-SUBJECT POOL IS REFUSED AGAIN, now on a curve instead of on
five identical rows.** At its best exposure point it buys **2.0s** over
A0 and pays **21.5s of false cover and 31.5s of phantom** for it. A0
dominates on both of the numbers he actually complains about, at every
bar where exposure is comparable. Raising the bar to 0.80 nearly closes
exposure and more than doubles false cover -- it is covering everyone.

**How it was found:** by running the arm and looking at the rows, not by
reading the source. Five identical lines in a printed table is the
signature; `grep -c "o\.poolBar" arch-arms.mjs` returning **0** is the
confirmation. Any future arm that takes an options object should be
checked the same way -- an unread option is silent, and it always fails
in the direction of "the change did nothing".

### 14a. The clear bar is already at the right place, and lower is worse

Same run (`critic-lowbar.mjs`, which had been exiting on its own guard
since loop 39 moved the constant it patched by literal text):

| clear bar male/female | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|
| **0.45 / 0.35 (SHIPPED)** | **7.5s** | 188.5s | 282.5s |
| 0.40 / 0.30 | 10.5s | 187.0s | 276.0s |
| 0.30 / 0.25 | 13.0s | 185.5s | 272.5s |
| 0.25 / 0.25 | 13.0s | 181.0s | 271.5s |

Every step down costs exposure and buys almost nothing: −0.20 on the bar
moves false cover by **7.5s** and phantom by **11.0s** while exposure
**rises 73%**. So `GENDER_CLEAR_SCORE` should not be pushed lower over
the OTA channel, and the floor of 0.36 in `tuning.mjs` is not the
binding constraint -- the corpus refuses the move well above it.

The first row is also this file's self-check: it is produced by patching
the bundle to the values it already ships, and it reproduces the
untouched `ARM_A0` row **line for line**. A variant builder that cannot
reproduce its own control is not measuring the constant it names.

### 14b. Patch a constant by NAME, never by literal text

Three benches built their variant with
`src.replace('var GENDER_CLEAR_SCORE = 0.6;', ...)`, and loop 39 shipped
that constant at 0.45. Credit where due: all three carried an
`if (patched === src) throw` guard and it WORKED -- they exited rather
than printing a table of one arm against itself, which is more than the
A-series managed. What it cost was three copies of one literal to edit
in lockstep on every constant move, and a failure message
("the bundle changed shape") that sends the next reader to esbuild
instead of to `git log`.

`bench/_patch.mjs` reads the constant by name out of the built bundle
and throws if the declaration is gone. A value equal to the shipped one
is allowed on purpose: that is the control point of a sweep and it must
produce a byte-identical bundle.

Two further defects fixed on the way, both of which made an arm
unrunnable rather than wrong: `critic-lowbar.mjs` wrote its variant to a
**cwd-relative** path, so it only ran from inside `bench/`; and the
first draft of `_patch.mjs` itself matched nothing, because a heredoc
eats one backslash and `\s` inside a template literal is just `s`. The
pattern uses character classes only, and says why.

### 14c. Re-derived in his regime — the conclusions hold, two sentences do not

Phase-D D2 and D3. `arch-ab.mjs` and `critic-lowbar.mjs` had no `thin()`
at all: every window went in whole, `inferCadence` returned stride 1 on
all eighteen, the tracker was told **500ms** and coasted **1250ms** —
which is the exact row §13's own table names as the broken one, printed
in the tables beside it. §15 has since established that the coast is what
moves two of the three columns, so those tables were priced in the one
regime this document exists to retract.

Both files thin at `K_HIS` and take their option set from
`arch-arms.hisRegimeOpts` now, which is also the fix for §13b (see 15b).

**THE POOL, re-derived at k=3 / told 2000, both arms:**

| arm | man exp/fc/phantom | woman exp/fc/phantom |
|---|---|---|
| **A0 shipped** | **22.0 / 155.0 / 573.5** | **25.5 / 201.0 / 679.5** |
| pool, bar 0.25 | 23.5 / 212.0 / 628.0 | 31.5 / 211.0 / 675.5 |
| pool, bar 0.40 | 20.5 / 212.5 / 632.0 | 31.0 / 213.0 / 681.5 |
| pool, bar 0.60 | 19.5 / 214.0 / 636.0 | 26.5 / 218.0 / 686.0 |
| pool, bar 0.80 | 19.5 / 218.5 / 644.5 | 23.5 / 218.5 / 687.5 |

**A0 dominates false cover and phantom at every bar, in both arms.** The
refusal of the per-subject pool survives its own regime error and gets
stronger — the woman arm, never published before, has A0 winning on
exposure too at three of four bars.

**WITHDRAWN:** *"Raising the bar to 0.80 nearly closes exposure and more
than doubles false cover — it is covering everyone."* That was
1.5 / 430.0 at k=1. At k=3 the same arm reads **19.5 / 218.5**. Phantom
was understated throughout by roughly 2x.

**ALSO WITHDRAWN:** the row printed as "A0 shipped" was `ARM({})`, which
`arch-arms` labels **1078** — no hold, no cut, no adjacency clamp, no
identity memory, none of which the app has been without since loop 39.
The baseline is `ARM(hisRegimeOpts(g))` now.

#### Each clear-bar constant is live in exactly ONE gender mode

The bar is chosen by the READ's own label (`t === "female" ? vfe : yfe`,
loop 39), so §14a's man-mode sweep of the *pair* never tested
`GENDER_CLEAR_SCORE_FEMALE` at all — and that is a separate OTA key with
its own clamp `[0.30, 0.90]`. Swept alone, at k=3 / told 2000:

```
MAN MODE                                  EXPOSURE  FALSECOVER  PHANTOM
  GENDER_CLEAR_SCORE 0.45 (SHIPPED)           22.0       155.0    573.5
  GENDER_CLEAR_SCORE 0.40                     29.0       152.0    565.5
  GENDER_CLEAR_SCORE 0.30                     29.0       150.5    565.5
  GENDER_CLEAR_SCORE 0.60                     19.5       197.0    639.5
  GENDER_CLEAR_SCORE 0.90                     15.0       475.5    725.0
  _FEMALE 0.30 / 0.45 / 0.60 / 0.90     ALL IDENTICAL TO SHIPPED  <- inert

WOMAN MODE
  GENDER_CLEAR_SCORE 0.25 .. 0.90       ALL IDENTICAL TO SHIPPED  <- inert
  _FEMALE 0.35 (SHIPPED)                      25.5       201.0    679.5
  _FEMALE 0.30                                25.5       199.0    666.0
  _FEMALE 0.45                                25.5       235.0    692.5
  _FEMALE 0.60                                22.5       268.0    728.0
  _FEMALE 0.90                                14.5       421.0    769.5
```

Seven identical rows in one column and seven in the other: **each mode
reads exactly one of the two constants.** Any future sweep of these must
name the mode or it is measuring a constant that cannot fire.

**THE RECOMMENDATION, RESTATED WITH THE MODE NAMED.** §14a said
*"`GENDER_CLEAR_SCORE` should not be pushed lower over the OTA channel"*
without qualification, and that is **false of the other key**:

- **`GENDER_CLEAR_SCORE` — do not push lower.** It lives in man mode,
  which is his setting, and 0.45 -> 0.40 costs **+7.0s of exposure** for
  3.0s of false cover and 8.0s of phantom. Upward is worse still.
- **`GENDER_CLEAR_SCORE_FEMALE` 0.35 -> 0.30 is free on this corpus.**
  Woman mode: exposure **identical** (25.5), false cover −2.0s, phantom
  −13.5s. Man mode: completely inert. Strictly better or equal on all
  three columns in both arms, and 0.30 is exactly the clamp floor.

**NOT PUSHED, and the reason is not caution about the number.** He runs
**man** mode, where the key is inert — so pushing it changes nothing on
his device and would only help a woman-mode user. It is also still a
protection-adjacent direction (a lower bar clears more easily), and
"exposure identical on 18 windows" is evidence, not proof. Recorded as a
free improvement whenever the woman arm matters; the key is already on
the channel and 1086 would accept it without an install.

## 15. THE COAST WINDOW IS THE BIGGEST LEVER IN THE SYSTEM, AND IT COSTS NO GPU

Found by decomposing the confound in §13a rather than by looking for it.
If the coast is what was paying phantom back along the cadence dial,
then move the coast **on its own** and spend nothing.

**QUOTED IN THE WRONG REGIME BELOW, AND CORRECTED IN 15a.** The table
that follows was measured with the tracker told a cadence of 1500ms --
his ACHIEVED verdict gap -- when his device tells it **2000** (critic C4:
`init-entry.js:4036` hands `setVerdictCadence` the cap-pinned `effZoom`,
not the gap). The direction and the size of the lever survive; the
winning value does not. Read 15a for the numbers to act on.

`bench/cadence-ab.mjs`, third family. Verdict count PINNED at k=3 -- his
verdict arrival -- and only the coast window varied:

| blurredCoast | EXPOSURE | FALSE COVER | PHANTOM |
|---|---|---|---|
| 1000ms | 50.0s | **110.0s** | **163.0s** |
| 1500ms | 48.0s | 115.5s | 240.0s |
| 2000ms | 40.5s | 124.5s | 305.5s |
| **3000ms (SHIPPED at his cadence)** | **27.5s** | **137.0s** | **460.5s** |
| 4000ms | **23.5s** | 152.0s | 568.0s |

**Phantom moves 3.5x across this dial and false cover 1.4x, for zero
extra GPU.** 3000 -> 2000ms alone cuts phantom **155.0s (-34%)** and
false cover 12.5s. Compare the cadence dial, which is the lever this
repo has been treating as the important one: k=3 -> k=2 buys 101.5s of
phantom and needs **50% more inference on a device that measured
cap-limited** (12a), and is barely inside the OTA clamp.

**SO THE DECOMPOSITION IS: verdicts buy EXPOSURE, the coast buys PHANTOM
AND FALSE COVER.** They were tied together in one function and the tie
is what made the dial look free.

**THIS IS A PROTECTION TRADE AND IT IS HIS CALL, NOT MINE.** Exposure
nearly doubles at 2000ms (27.5 -> 40.5s) and is 82% worse at 1000ms.
Exposure is the number that means a person the user asked to cover was
left sharp, and §9 says protection decisions are the owner's. What can
be said without him: phantom is the complaint he has repeated most
("random blur marks here and there"), and 34% of it is available for
one number.

**AND THE LEVER CANNOT TRAVEL.** None of `PTRACK_MAX_COAST_MS`,
`PTRACK_MIN_COAST_PASSES`, `PTRACK_MAX_MISS_BLURRED_MS` or
`PTRACK_MAX_MISS_MS` is on the OTA channel, and the `2.5 *` inside
`setVerdictCadence` is a bare literal that is not a named constant at
all. That is exactly the §12 finding again in a new place: the biggest
dial in the system is reachable only by shipping a build.

**HONEST LIMITS.** (1) The corpus is 18 windows of his footage class at
640x360, and coast is the constant most sensitive to how often the
detector drops a subject -- a device whose MoveNet admits people will
coast less often than his, where all twelve slots read n:0. (2) The
scoring counts a phantom second and an exposure second as one second
each; he does not weigh them equally and has never been asked to.
(3) Every row here is `cut: true` with the shipped demote-and-force
handler, so the coast is already being cut short at every scene change.

### 15a. The same dial, swept as the constant, in the regime his phone is in

> **AMENDED 2026-09-02 (phase-D D1, D10, D12).** The table below is
> correct and reproduces exactly. Three things around it were not: the
> clamp floor it justifies is **non-protective at every cadence at or
> below told ~1504** (15c), the test written beside it quoted the
> superseded 23.5/40.5 pair, and the "cross-check" it claims was a
> replication whose instrument no longer exists (15d).


Two corrections at once, and each moved the answer:

1. §15's decomposition varied the coast by lying to the tracker about
   the clock, which also moves `cutCoastMs`. `bench/coast-ab.mjs` sweeps
   `PTRACK_MIN_COAST_PASSES` -- the constant an OTA push really moves.
2. It sweeps it at `told = 2000`, his device's `effZoom`, not at his
   1.5s arrival gap.

| passes | coast | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|---|
| 1.0 | 2000ms | 38.0 / 134.0 / 365.0 | 35.5 / 186.0 / 419.0 |
| **1.33** | 2660ms | **26.5 / 136.5 / 424.0** | **29.5 / 193.5 / 494.5** |
| 1.5 | 3000ms | 25.5 / 140.5 / 488.5 | 29.0 / 196.0 / 568.0 |
| **2 (SHIPPED)** | 4000ms | **22.0 / 155.0 / 573.5** | **25.5 / 201.0 / 679.5** |
| 2.5 | 5000ms | 21.0 / 165.0 / 624.5 | 25.5 / 204.5 / 746.0 |

**2 -> 1.33 costs +4.5s of exposure (man) and +4.0s (woman), and buys
149.5s and 185.0s of phantom -- 26% and 27% -- plus 18.5s and 7.5s of
false cover. No extra inference at all.** Both arms agree on direction
and on the winner.

**THREE NUMBERS DESCRIBE HIS REGIME, AND THE ARM HAD ONE OF THEM.**
Verdict ARRIVAL (k=3), the cadence TOLD (2000, his cap-pinned effZoom),
and `verdictDt` -- which `person-track` credits a clear by
(`clearMs += obs.verdictDt`) and the app computes as
`min(1000, now - lastZoomAt)`. The arm passed the 500ms BANK interval,
so a man needed THREE verdicts here to earn the hold his device earns in
two (critic C6). Fixing it moved the shipped row to exactly the value
the critic predicted independently, **22.0 / 155.0 / 573.5**, which is
the closest thing to a cross-check this instrument has had.

**The value §15 named is a no-op here.** At told 2000, passes 1.67 and
1.5 produce the identical row -- the cap steps in 500ms because `missMs`
accrues in 500ms frames -- so the "1.67 buys 59-69s of phantom" from the
wrong regime is withdrawn. That is the second time in this section that
an arm which did not model the app named the wrong number, and both were
found by asking the same question: *what does the app actually hand this
function?*

**THE CLAMP FLOOR'S JUSTIFICATION WAS ALSO WRONG, in the same way.**
`tuning.mjs` first said 1.33 was safe because "below that the cap floors
at `PTRACK_MAX_COAST_MS` 2000 anyway, so nothing lower can reach". True
at told 1500; false at his 2000, where 1.33 gives 2660ms and passes 1.0
really does reach 2000ms -- at a cost of **+16.0s (man) and +10.0s
(woman)** of exposure. The floor stays at 1.33, now for the measured
reason instead of an arithmetic one that did not hold.

**STILL HIS CALL.** Exposure is the number that means a person he asked
to cover was left sharp. The constant ships at 2, a test pins that
`rules/tuning.json` agrees with the code, and 1.33 is one push away with
no install.

### 15b. Placement, re-derived against the arm that actually ships

Same corpus, same held budget, `hisRegimeOpts` on both sides now:

```
arm                    verdicts  T     EXPOSURE  FALSECOVER   PHANTOM  births
UNIFORM k=4 (2.0s)         540  --       30.0s      169.5s    533.0s     160
UNIFORM k=3 (today)        720  --       22.0s      155.0s    573.5s     160
UNIFORM k=2 (1.0s)        1080  --       12.0s      131.5s    698.5s     189
UNIFORM k=1 (0.5s)        2160  --        8.5s      151.0s    977.0s     226
PLACED, max gap 4          720   13.2     15.0s      175.5s    640.5s     173
PLACED, max gap 5          720    8.8     17.5s      167.0s    636.5s     186
PLACED, max gap 6          720    7.1     32.0s      191.0s    627.5s     178
PLACED, max gap 8          718    6.1     28.5s      199.5s    639.0s     180
```

**The verdict is unchanged and the numbers moved.** Placement's best row
(max gap 4) buys **7.0s of exposure** for **20.5s of false cover and
67.0s of phantom** — §13b published that cost as 32.5s and 80.5s off a
baseline that was missing the identity memory. Against the coast dial,
which buys 149.5s of phantom for 4.5s of exposure at zero GPU, placement
is still the worse trade.

Worth noting from the uniform family, which is the shipped dial's own
price list: **k=2 is better than k=3 on exposure AND false cover** (12.0
/ 131.5 against 22.0 / 155.0) and pays 125.0s of phantom for it. That is
the §13a shape, and §12a's cap-limited device is why it is not free.

### 15c. The coast clamp floor is non-protective below told 1504 — the phase-D exposure row

`tuning.mjs` and `setCoastPasses` both justified `PTRACK_MIN_COAST_PASSES
>= 1.33` as a measured protection decision: *"1.0 really does reach
2000ms, costing +16.0s (man) and +10.0s (woman) of exposure … THAT is
what the floor refuses."*

**It refuses it at told 2000 and nowhere below ~1504**, because the
protected quantity is the coast in MILLISECONDS and the clamp is written
in PASSES:

```
coast = min(max(PTRACK_MAX_COAST_MS 2000, passes * told),
            max(PTRACK_MAX_MISS_BLURRED_MS 900, 2.5 * told))
```

The `passes` term only reaches the answer while `passes * told > 2000`.
Read off the live module, not the formula:

| told | shipped 2 | OTA floor 1.33 | raw 1.0 |
|---|---|---|---|
| 1200 | 2400 | **2000** | **2000** |
| 1500 | 3000 | **2000** | **2000** |
| 1600 | 3200 | 2128 | 2000 |
| 2000 | 4000 | 2660 | 2000 |
| 3000 | 6000 | 3990 | 3000 |

And the corpus prices it. At told 1500, k=3, the value the clamp calls
safe produces the identical row to the value it exists to refuse, in both
arms — man **38.0 / 132.5 / 346.0** against the shipped **25.5 / 139.0 /
465.0**; woman **36.5 / 185.0 / 399.0** against **30.0 / 194.5 / 545.5**.
**+12.5s (man) and +6.5s (woman) of exposure from a value `tuning.mjs`
called safe.**

**THE REGIME IS REACHED BY THE MOVE THIS DOCUMENT RECOMMENDS.**
`VERDICT_MAX_INTERVAL_MS` is on the **same OTA channel**, clamped
`[1200, 4000]`, and §13a says the 2000 -> 1200-1500 move is "still worth
doing". One `tuning.json` carrying
`{"VERDICT_MAX_INTERVAL_MS": 1200, "PTRACK_MIN_COAST_PASSES": 1.33}` has
both values inside both clamps and lands the coast at 2000ms. A device
whose verdict costs 250-375ms gets there with nothing pushed at all.

**WHY IT IS DOCUMENTED RATHER THAN CLAMPED HARDER.** A uniform
millisecond guarantee cannot exist through this dial: holding the coast
at 2660ms at told 1200 needs `passes` 2.22, which is **above the shipped
2** — the clamp would have to refuse the value the app already runs. What
*does* hold at every cadence is `PTRACK_MAX_COAST_MS`: no push can take
the coast below 2000ms. That is the real guarantee, it is now what the
test asserts, and the cadence-dependence of the extra protection is
written into `tuning.mjs` beside the joint-push warning.

**PUSH ONE OF THESE TWO AT A TIME, and re-read his rings between.**

Two smaller corrections in the same neighbourhood. The clamp's ceiling of
3.0 has an inert top: past `passes` 2.5 the `2.5 * told` term wins, so
2.5 and 3.0 give the identical 5000ms coast and the identical corpus row
— `person-track`'s docstring said the cap "never" loses, which is false
at its own ceiling. And the report now carries the **derived** coast
(`tuning.coastMs`, `tuning.toldMs`) alongside the pushed value, because
the same pushed number means two different coasts at two different
cadences — which is this whole section.

### 15d. The "cross-check" was a replication, and its instrument is gone

§15a called the shipped row landing on 22.0 / 155.0 / 573.5, exactly as
the phase-C critic predicted, *"the closest thing to a cross-check this
instrument has had"*. It was not one. The phase-C number came from
`bench/_critic-cadsep-full.mjs`, which is **not in git and not on disk**,
so it cannot be re-run; and both computations used the same corpus, the
same `corpus-score.mjs`, the same `ARM`, the same 500ms bank grid and the
same option set, differing only in the two corrections. That is a
replication — it confirms the implementation matches the patch and shares
every assumption underneath it.

**The real cross-checks this repo has** are §10n (two instruments, no
shared code, no shared input) and §15a's own **woman arm**, which is a
genuinely second population and agrees on direction and winner.

**AND TWO QUALIFICATIONS ON THE COAST FINDING ITSELF**, from the critic's
own leave-one-out, worth more than the retraction:

- **Direction is robust, magnitude is not.** Leave-one-window-out on the
  2 -> 1.33 step (man, k=3, told 2000): **0 of 18 sign flips**, phantom
  improves in **16 of 18** windows. But `KAWvDsghyc8_w152` alone carries
  **47.0s of the 149.5s (31%)**, and false cover improves in only **5 of
  18** — the −18.5s is four windows.
- **The +4.5s of exposure is not one long uncovered stretch.** Per window
  it is 0.5 / 0.5 / 1.0 / 1.0 / 1.5s across five windows — one to three
  frames each at the corpus's 0.5s grid. §15 lists the equal weighting of
  a phantom second and an exposure second as an honest limit; this is the
  argument that limit invites, and it favours the push.

## 16. THE ENTIRE PER-PERSON PIPELINE IS YOUTUBE-ONLY, GATED ON A LITERAL `#movie_player`

Read from source 2026-09-02, all four sites cited. **Not a measurement --
this is a reachability argument, and every step of it is one line.**

The standing instruction is that this technique is for all the platforms.
It reaches exactly one.

### The two gates, both keyed on a YouTube-only id

`dom.js:54`

```js
export function hasPlayerAncestor(el) {
  if (el.closest) return !!el.closest('#movie_player');
```

`video-region.mjs:214`, inside `resolveHost`, which is the whole of
`canRegionVideo`:

```js
  return video.closest('#movie_player') || null;
```

`init-entry.js:1612` and `:1686`:

```js
var isPlayer = dom.hasPlayerAncestor(video);
...
var useRegionVideo = isPlayer && regionBlur && videoRegion.canRegionVideo(video);
```

`#movie_player` is YouTube's element. Reddit, X, Instagram and Facebook
have no node with that id, so on those four platforms **`isPlayer` is
`false` for every video that has ever played**, and `useRegionVideo` is
false twice over. These are two INDEPENDENT gates on the same literal --
removing one changes nothing.

### What that switches off, by line

| line | guarded by | what the other platforms therefore never get |
|---|---|---|
| `:3298` | `if (isPlayer) gateTick(now)` | the **scene gate** -- no cut detection, no `CUT_DELTA`, no static-shot 1Hz floor |
| `:3311` | `isPlayer ? ... : sampleInterval` | the **adaptive cadence** -- fixed 500ms, no `effZoom`, no `POSITION_DUTY` |
| `:3323` | `if (isPlayer && scrolling(now))` | the scroll slow-lane |
| `:3337` | `if (isPlayer && overBudget(now))` | the main-thread budget |
| `:3382` | `if (useRegionVideo && ...)` | **the whole person-primary path**: MoveNet, person tracks, coast, identity memory, the null-mint hold, the body clamp, patches at all |
| `:1657` | `if (isPlayer && 'disablePictureInPicture')` | the PiP hole stays open |
| `:1683` | `isPlayer ? 2 : VIDEO_CLEAN_STREAK_TO_UNBLUR` | unblur takes 4 clean samples (2.0s) instead of 2 |

**So every number tuned in §13, §14 and §15 -- the coast window, the
verdict cadence, `CUT_DELTA`, the clear bar's video branch,
`NULL_MINT_NM_FLOOR` on the video path -- describes behaviour that only
ever runs on YouTube.** `rules/tuning.json` travels to those platforms
and is read there; almost nothing it sets is consulted.

### What they get instead: `wholeFrameFlagged`, and it is a boolean

`init-entry.js:4334-4353` is the fall-through. Per sample:

```js
ctx2d.drawImage(video, 0, 0, detector.INPUT_SIZE, detector.INPUT_SIZE);
var pixels = ctx2d.getImageData(0, 0, ...);
wholeFrameFlagged(pixels).then(function (anyFlagged) { ... })
```

`wholeFrameFlagged` (`:1918`) returns **one boolean for the frame** --
`faceMeta(...)` then `if (meta[mi].flagged) return true`. No boxes, no
tracks, no temporal state of any kind. Flagged applies a CSS `filter` to
the video element; four consecutive clean samples remove it.

**This is not an exposure bug and should not be reported as one.** The
predicate is monotone toward covering: a weak read, a null read and a
failed read all flag (`.catch(function () { return true; })` at `:1938`
-- "a read we could not get is a face we cannot clear"). Off YouTube the
app over-covers. The gap is quality, not safety.

### AND THE FRAME IS STRETCHED BEFORE ANYONE LOOKS AT IT

`drawImage(video, 0, 0, 256, 256)` is the four-argument form: no source
rectangle, no aspect preservation. A 640x360 stream is squashed to a
square, so **every face reaches BlazeFace and faceres 1.78x taller than
wide**.

That is the identical distortion fixed on the IMAGE path on 2026-08-28,
where it made "a clear front-facing man read `male` at 0.06" and cost
four days. The repair became `crop-geometry.mjs`, with a test that fails
if an inline copy of the arithmetic reappears -- and that test does not
cover this call site, because this one never crops at all.

**MEASURED -- see 16a below. The squash is real and it costs signal on
17 faces in 18.**

### The comment at `:1680` is about a different question

```
// Owner ask 2026-08-24: the watch player blurs just the face regions,
// not the whole video (feed videos keep whole blur — too small/fast
// to track).
```

That reasoning is sound and is about **m.youtube feed previews** -- small,
transient, and on that site they play through the shared `#movie_player`
anyway, so they are `isPlayer` TRUE and are handled separately by
`feedPreview()` (`:1616`, a `location.pathname` test) and by the scroll
branch at `:3287`. The preview case never needed `isPlayer` to exclude
it.

So `isPlayer` is doing a **second, undocumented job**: excluding every
non-YouTube platform. Nothing recorded anywhere decided that. It is what
`closest('#movie_player')` happens to do.

### NOT SHIPPED, AND THE REASON IS THE REASON

Widening the selector is a five-word change and it must not be made
blind:

1. **The emulator cannot test it.** Loop 8 measured the emulator process
   *dying* on `reddit.com/r/pics` three times, once with gaze OFF -- so
   the one surface most affected is the one this harness cannot reach.
   X and Instagram signed out are login walls (loops 25-26).
2. **`resolveHost` is not merely an id test.** It returns the element the
   patch layer is appended to, and every geometry assumption in
   `video-region.mjs` -- host scale, clip bounds, the isolate write, the
   occluder clamp -- was calibrated against YouTube's player tree. Reddit's
   player is inside an **open shadow root** (loop 2026-08-19, `shreddit`),
   which is a different containing block and a different stacking story.
3. **It would spend MoveNet on every video on four more sites**, on a
   device §12a measured as already cap-limited.

The honest next step is a `PLAYER_HOSTS` table read from the live DOM of
each platform, one platform at a time, verified visually -- which is the
`grill-with-docs` path, not a momentum edit.

**Recorded so the scope is not mistaken for a decision.**

## 16a. THE SQUASH COSTS SIGNAL ON 17 FACES IN 18, AND IT IS THE SIGNAL `NULL_MINT_NM_FLOOR` GATES ON

Measured 2026-09-02 on the emulator. Bench `app/gaze/bench/stretch-arm.js`,
probe `spikes/gauntlet/probe_stretch.py`, raw
`spikes/gauntlet/stretch-arms.json`. **15 native 640x360 frames** from five
videos already banked under `spikes/faceres-parity/vframes/`, each run
twice through the SHIPPING `detectFaceBoxes` / `classifyFaceGenders` /
`faceMeta`:

| arm | how the 256 square is made |
|---|---|
| **A, SHIPPED** | `drawImage(img, 0, 0, 256, 256)` -- squashed, 1.78x taller than wide |
| **B, LETTERBOX** | aspect preserved, centred, black bars |

Arm B gives every face **fewer pixels** than arm A (0.40x in both
dimensions, against A's 0.40x wide by 0.711x tall), so anything B wins, it
wins on geometry and not on resolution.

### The result that does not depend on a label

`nm` -- faceres' descriptor magnitude before L2-normalisation, "how much
the network extracted" -- across the 18 faces both arms found:

| | value |
|---|---|
| HIGHER in the letterboxed arm | **17 of 18** |
| delta p50 / mean / max | **+1.08 / +1.06 / +2.45** |
| restricted to nm >= 5 in both arms (n=13) | p50 **+0.91**, higher in 12 |
| sign test, all pairs | **p = 1.45e-4** |

**This is not a cosmetic quality metric. `nm` is the exact axis
`NULL_MINT_NM_FLOOR` gates on** (loop 38: floor 5, calibrated so 0 of 125
real faces are refused). Four of the eighteen pairs cross that floor when
the aspect is corrected:

```
H14bBuluwB8_t252   nm 2.68 -> 5.13
z86LGEFyQpo_t2     nm 4.79 -> 5.59
z86LGEFyQpo_t2     nm 4.97 -> 6.05
z86LGEFyQpo_t902   nm 5.02 -> 5.93
```

So the squash pushes real faces into the population this repo has
classified as "the model said nothing".

### Two gender labels flip, both on faces with solid signal

Of 13 pairs where BOTH arms carried real signal (nm >= 5 each side),
**2 flip (15%)**:

```
NWoT1ZVd1Lo_t752   stretched male 0.601 (nm 9.53) -> letterboxed female 0.377 (nm 10.29)
NWoT1ZVd1Lo_t402   stretched male 0.502 (nm 7.33) -> letterboxed female 0.473 (nm  8.44)
```

The first is a 0.224 move straight across the boundary on a face with
strong signal on both sides, in his own reference footage. Raw |diff|
over those 13 is p50 0.023, max 0.224 -- so the squash is usually small
and occasionally decisive, which is the shape a distortion has.

### THE RECALL GAP IS JUNK ON BOTH SIDES -- do not quote it

The raw counts look damning and are not: stretched 21 detections,
letterboxed 24, with 3 only-in-A and 6 only-in-B. **All nine unmatched
detections are null reads**, nm 1.71-5.47, five of the six only-in-B
below the floor of 5. Neither arm is finding faces the other misses; both
are producing detector noise, and B produces a little more of it.

I nearly wrote that 6-face gap up as an exposure finding. It is not one.

### AND THE ONE FRAME THAT FLIPS, FLIPS TOWARD PHANTOM

`anyFlagged` -- the single boolean this path ships -- differs on **1 of 15
frames in man mode (0 of 15 in woman mode)**, and it is
`z86LGEFyQpo_t2.png` reading **stretched 0, letterboxed 1**: the
letterboxed arm flags because of the two junk null reads listed above.

So **16's claim survives its own test**: on this path the visible
behaviour is monotone toward covering, and correcting the aspect does not
uncover anybody in this sample. The cost of the squash is carried in the
READ quality -- signal, and therefore who is eligible to be cleared --
not in the frame boolean.

### FIXED, and the fix is now the bench's own winning arm

`crop-geometry.fitBox(srcW, srcH, size)` -- next to `squareBox`, which is
the same defect one stage later and could not reach this one -- and
`init-entry`'s whole-frame path paints black bars and calls it. **No
coordinate mapping was needed anywhere**, because nothing downstream
reads a box out of that buffer: `wholeFrameFlagged` returns ONE BOOLEAN
and the caller applies whole-video blur. The bars are painted rather than
left, because the canvas is reused and an unpainted margin still holds
the previous frame.

Verified in the EMITTED bundle: `fillRect(0,0,un,un)` and
`drawImage(R,wp.dx,wp.dy,wp.dw,wp.dh)`. Two four-argument draws remain
and both are correct -- the scene gate at `:2081` (a luma delta between
two frames squashed identically) and the MoveNet canvas fallback at
`:1912`, which is 16b's question.

The bench's letterbox arm calls the shipped `fitBox` now, so the A/B is
old code against new code rather than against a bench idea of it.

### HONEST LIMITS

- 15 frames, five videos, all YouTube footage at one resolution.
- **The detection count is not deterministic on this harness.** Two runs
  of the identical bench gave 21/24 and 21/25 detections and 1 then 2
  differing frame booleans, so the frame-level difference is inside the
  wobble and must not be quoted as an effect. The matched-pair reads ARE
  deterministic: 18 pairs, the same two label flips, raw |diff| p50
  0.0286 and max 0.2236 both times. The `nm` result rests on the
  deterministic half.
- The change is justified on **read quality**, not on a visible
  behaviour improvement -- no measurement here shows a person being
  covered who was not before.
- swiftshader ran both arms, so this is a parity result and not a timing
  one.
- **It is still unverified on Reddit, X or Instagram**, which is where it
  matters most and where the emulator dies (loop 8). Widening `isPlayer`
  is a separate decision and comes after a live DOM census, not before
  -- **that census is section 16c, and its answer is that widening the
  selector cannot work at all on Reddit.**

**Next: the MoveNet half (16b), then a live player-host census per
platform -- in that order, because a wider selector on a distorted path
spreads the distortion.**

## 16b. THE SAME SQUASH BLINDS MoveNet ON ONE FRAME IN SEVEN, AND THIS ONE IS NOT A ONE-LINE FIX

`detector.js:591` is the person half of the same defect:

```js
var resized = tf.image.resizeBilinear(tf.expandDims(img, 0), [PERSON_INPUT_SIZE, PERSON_INPUT_SIZE]);
```

Unconditional, and it does not matter whether the caller handed over a
canvas or the video element -- `directPersonOk` only decides who pays
for the upload, not what shape the model sees. So MoveNet reads every
person on a 16:9 stream at **0.5625 of natural width**, and MoveNet
MultiPose is COCO-trained on natural-aspect photographs.

### The measurement

`bench/movenet-aspect.mjs`, two arms on the SAME decoded bytes, so the
only variable is the resize. Both arms are raw tensor work through the
shipping graph -- no canvas, no browser, no gate -- and the metric is
the model's own output, because a gate calibrated on a dead signal only
restates itself. **241 frames, 5 videos, every frame containing at
least one detected face.**

| | squash (SHIPPED) | letterbox |
|---|---|---|
| maxKp p50 | 0.810 | 0.825 |
| maxKp max | 0.922 | 0.934 |
| **persons admitted** (score >= 0.35) | **219** | **269** |
| frames admitting NOBODY | **67 of 241** | **36 of 241** |

- **Admissions +22.8%**, and the per-frame direction is lopsided: 53
  frames admit more under the letterbox against 11 the other way
  (sign test p < 1e-5).
- **35 frames where the squash admits NOBODY and the letterbox admits
  someone, against 4 the reverse** (p < 1e-5). Every one of those 35 has
  1-4 faces detected in it, so they are not empty frames.
- **maxKp barely moves and that is the honest half**: p50 delta +0.010,
  130 frames higher under the letterbox against 94 lower (p = 0.019),
  and the effect is entirely absent on one video. What the squash costs
  is not keypoint confidence -- it is the **slot score**, which is the
  admission.

### It survives clustering, which is the check the N=72 run failed

Adjacent frames of one shot are not independent, so the frame-level p
values above are anti-conservative on their own. Blocked on the VIDEO
and bootstrapped 4,000 times, the relative gain in admissions is
**p05 +8.7% / p50 +23.5% / p95 +42.0%**, with 0.3% of resamples putting
the letterbox at or below the squash. And the blind-frame split runs one
way in **all five** videos (9/0, 5/1, 12/3, 7/0, 2/0).

**This is the loop-40 rule firing twice in one file.** At N=72 the same
bench read "maxKp flat, admissions suggestive" and would have been
recorded as a null result; raising N separated the two questions and
turned the second one significant. A flat sweep is a claim about the
instrument until the instrument has the frames to say otherwise.

### What this does NOT explain

**His phone.** In the failing regime his device reads all twelve slots
`n:0` at **maxKp p50 0.049, max 0.098** -- an order of magnitude below
either arm here (p50 0.81 / 0.83), and both arms clear
`PFF_FRAME_KP_FLOOR` (0.10) on **all 241 frames**. Whatever is emptying
MoveNet on the 23122PCD1I, it is not this. Do not let this section be
read as the fix for loop 36.

### And unlike 16a, the fix is not a one-liner

The whole-frame face path could be corrected in place because
`fitBox` + a black fill changes nothing downstream: BlazeFace's boxes
come back normalized to the 256 square and `crop-geometry` was already
mapping them.

MoveNet's outputs are normalized to **its own input**, and today that is
safe only *because* the squash is a uniform per-axis scale of the whole
frame -- normalized-in maps 1:1 to normalized-of-frame, which is why
`parsePersons` takes `aspect` only for margin isotropy (`headH = headW *
ar`) and never to un-distort a coordinate. Letterbox the input and every
keypoint and every box needs mapping back through the pad
(`y_frame = (y * S - pad) / lh`) before anything reads it, or every
person box lands compressed and offset -- which is an EXPOSURE, in the
one place the corpus is tuned.

So the change is: letterbox in `detectPersons`, un-letterbox in
`parsePersons`, and **re-derive the corpus** -- because the person boxes
are the extent source that `body-clamp`, `personFromFace` and the whole
placement layer sit on top of, and every number in sections 10-15 was
measured with them squashed. That is a round, not an edit, and doing it
blind tonight would move the tuned path on an unverified geometry.

**Reported, specified, deliberately NOT shipped.** `crop`
and `zoomL` were refused at N=72 on their own numbers (55 and 46
admissions against the squash's 67) and are not candidates.

## 16c. WIDENING `isPlayer` IS THREE GATES, NOT ONE -- AND ON REDDIT ALL THREE ARE UNREACHABLE BY CONSTRUCTION

Section 16 named one gate. There are three, they are the SAME literal,
and **widening any one alone is silently inert** -- the failure class
this repo has shipped twice (the dead `#tamescroll-gaze-regions` id;
`var IY;` alive for six rounds):

| | site | what it decides |
|---|---|---|
| 1 | `init-entry.js:4610` `video.closest('#movie_player')` | person-primary path vs `wholeFrameFlagged` |
| 2 | `video-region.mjs:214` `resolveHost` | whether a patch can be **placed** at all -- `setTracks` returns false and calls `clear(video)` without a host |
| 3 | `region-blur.mjs:635` `PLAYER_SUBTREE_SELECTOR` | refuses an IMAGE host inside the player (a guard -- widening it does the opposite thing and must be reasoned about separately) |

`dom.js:54` `hasPlayerAncestor` is a fourth use of the literal, and it
is the VISION red line ("never add a class inside the player"), not a
capability gate. It must widen with them or gaze starts writing classes
inside another platform's player.

### And on Reddit none of them can ever match

Live census on the arm64 device through the app's own launcher path
(`spikes/gauntlet/probe_player_hosts.py`), reddit.com `/r/aww/`:

```
video 0   inShadowRoot 1   closest('#movie_player') False
  <video.ts-gaze-pending        static   ov:clip     z:auto  iso:auto
  ---- SHADOW BOUNDARY (host <shreddit-player>) -- closest() STOPS HERE ----
  <shreddit-player.block        relative ov:visible  z:auto  iso:isolate  [shadow host]
  <shreddit-async-loader        static                               [shadow host]
  <div#t3_..-aspect-ratio       relative ov:hidden
  <shreddit-post#t3_..          relative ov:visible                  [shadow host]
  <shreddit-feed                static                               [shadow host]
  <main#main-content
```

Two facts, both structural and neither dependent on layout:

- **`closest()` stops at a shadow boundary.** So `video.closest(<any
  light-DOM Reddit selector>)` is null no matter what selector is
  written. Gates 1 and 2 cannot be widened by adding a name to them.
- **`video.parentElement` is `null`**, because the video is a DIRECT
  child of the ShadowRoot and `ShadowRoot` is not an `Element`. The
  shadow root's children are exactly `video`, `shreddit-media-ui`, two
  `slot`s and our own `#tamescroll-gaze-style`. `region-blur.resolveHost`
  bails on its **second line** (`var host = el.parentElement; if (!host)
  return null;`), independently of every selector in the file.

So on Reddit the whole-frame path is not a policy choice that a selector
can revisit -- it is what the DOM permits today.

### What a real fix looks like, and the model is already in that root

The root is **OPEN** (`element.shadowRoot` is non-null), which is why
the 2026-08-19 per-root stylesheet work already put
`#tamescroll-gaze-style` inside it. So the host must be found by
`video.getRootNode().host` rather than by `closest`, and the patch
placed either inside that root or into one of its slots.

`shreddit-media-ui` is the existing pattern to copy: same shadow root,
`position: absolute`, `z-index: 2`, `pointer-events-none`, sized exactly
to the video box -- which is `video-region`'s overlay contract already,
one boundary in. And `shreddit-player` itself reads `position: relative`
**and already `isolation: isolate`**, so the two page mutations
`resolveHost` performs would both be no-ops there.

### HONEST LIMITS -- what this census does NOT establish

- **No geometry.** The device locked its own screen mid-run and
  `innerWidth` read **0**, so every width and rect in that pass is
  worthless (`shreddit-player` "0x220", the player centre at y = -1171).
  Computed `position` / `overflow` / `z-index` / `isolation` and DOM
  structure do not depend on layout and are the only numbers quoted
  above. **Re-measure the rects with the screen unlocked before building
  anything on them.**
- **The video never loaded.** Signed out it is
  `shreddit-preview-video-lazy`: `readyState 0`, `videoWidth 0`,
  `currentSrc ""` even after a direct `play()`. So it was never
  established that a Reddit video reaching our pipeline has a decodable
  frame at all -- and our tag is on it (`ts-gaze-pending`), so
  blur-first is holding over a stub.
- **Reddit's POST DETAIL page did not render** on this device signed
  out -- 148 elements, `body.scrollHeight` 56, no `<main>`, no
  `shreddit-post`. The LISTING renders (3 posts, 5,492px). Not our rules:
  there is nothing there to hide.
- **X and Facebook are login walls** and are still unaudited (loop
  25-26), so this covers one of the four platforms.
- **Instagram was not reached this round.**

### And the other three platforms cannot be audited at all without a login

Same probe, same night, emulator (which survives Instagram; only Reddit
kills it -- loop 8):

| platform | signed-out state | player census |
|---|---|---|
| **YouTube** | full | `#movie_player`, the tuned path |
| **Reddit** | listing renders, post detail does not | **done -- 16c above** |
| **Instagram** | `/explore/` renders, **0 videos**; `/reels/` 302s to `/accounts/login/` | **BLOCKED** |
| **X** | `/explore` 302s to `/i/jf/onboarding/web` (loop 25-26) | **BLOCKED** |
| **Facebook** | login wall, 0 links, 0 articles (2026-08-28) | **BLOCKED** |

**RETRACTION, and it is this repo's own note being overtaken:** loop
25-26 recorded "Instagram /explore/ renders signed out" and audited an
Explore GRID and a Reels shelf there. It still renders -- 12 images, 31
links, `body.scrollHeight` 884 -- but it is a **topic-links page** now
(`Ber Months - 227K posts`, `First Of The Month - 917K posts`), with 24
of its 31 links pointing at `/popular` and **not one `<video>`**. The
media grid that census described is gone from the signed-out page. The
two rules that matched then still match now (`a[href^="/reels"]` 1,
`a[href^="/explore"]` 1) because they are NAV links; the two that need
media (`article:has(> div a[href^="/reel/"])`, the appsflyer banner)
match **0**, exactly as loop 25-26 also found.

So the honest scope of "this technique is going to be used for all the
platforms too" is:

1. **Reddit needs an architecture change** -- a shadow-aware host
   resolver -- not a wider selector. That work is fully specified above
   and needs no login.
2. **Instagram, X and Facebook need a one-time sign-in** before anyone
   can even say what their player tree looks like. That is already the
   open item in CLAUDE.md's Next list, and it is now the thing three of
   four platforms are blocked on.
