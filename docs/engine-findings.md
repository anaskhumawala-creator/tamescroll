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
so skipping it should buy verdicts, and the corpus prices the clock at
81.0s of exposure at 1.5s/verdict against 8.0s at 0.5s. That is a
bigger lever than any threshold swept this month.

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

**NOT PUSHED.** `PERSON_SKIP_EVERY` stays 1 in `rules/tuning.json`. The
frame-rate win is real and the exposure win is absent, so the trade is
39% smoother rendering against ~0.5 extra phantom mints per second, and
phantom is the complaint he has repeated most. It stays on the channel
so it is one push away if his rings ever say the opposite.

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

### 10k. Two instruments disagree about 75, and the direct one decides

With the table corrected, cut recall reads like a cliff between 60 and 75
(92.8% -> 50.0% at scdet 25). The **labelled corpus measures the outcome
that recall is a proxy for**, and says the opposite:

| CUT_DELTA | cut frames | EXPOSURE | FALSE COVER | PHANTOM | births |
|---|---|---|---|---|---|
| 35 | 200 | 82.5s | 173.5s | 141.0s | 377 |
| 50 | 115 | 71.0s | 167.5s | 149.0s | 310 |
| **60** | 59 | **67.0s** | **163.5s** | **158.5s** | 270 |
| 75 | 12 | 57.0s | 157.0s | 162.0s | 230 |
| 90 | 2 | 55.5s | 155.0s | 163.0s | 222 |

Exposure falls monotonically all the way to 90. **Both can be true**: a
missed cut costs exposure only when a stale CLEARED track absorbs a
DIFFERENT person's observation. Recall prices the cut; the corpus prices
the conjunction; the conjunction is rare.

**WHERE A PROXY AND A DIRECT MEASUREMENT OF THE THING IT PROXIES
DISAGREE, THE DIRECT ONE DECIDES.** The critic's F1 concluded that
pushing 75 risks exposure. That is the proxy talking, and the corpus
refutes it. The real cost of 75 is **PHANTOM** (+3.5s over 60), which is
his loudest complaint -- so 60 ships and 75 stays reachable on the OTA
channel, on phantom evidence and never on the recall table.

The OTA ceiling stays 75 for that reason. It was briefly lowered to 60
while acting on the proxy; lowering it would have been the same error in
the opposite direction, and it is only recorded here because catching
myself doing it is the point of the loop.

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
- the verdict CLOCK moves 73s (81.0s at 1.5s/verdict, 8.0s at 0.5s);
- and **6% of people are never detected at all**, which is upstream of
  both and which no constant touches.

The clock is still the biggest lever and 10i just measured that skipping
MoveNet does not buy it. So the two things actually worth a night are
**(1) why a verdict pass costs what it costs on his device** -- the
~500ms MoveNet figure is unexplained and suspected to be shader
recompiles from varying crop shapes -- and **(2) the 6%**, which needs a
better detector rather than a better threshold.
