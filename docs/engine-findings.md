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

**WHAT WOULD SETTLE IT, and it is cheap:** 54.9 is the p95 of ALL deltas
on one video, not a measurement of where cuts start. Label real cuts on
his footage and read the delta AT them. Until then the guard stands, and
it is the second time tonight a test written to pin a property has
stopped a change rather than rubber-stamped it.

