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
- **coco-ssd person boxes** replacing the synthetic body: this line's
  original "phantom -41% but exposure 82 to 89.5s" predates the current
  cadence-pinned corpus and does not reproduce here. **Re-measured
  H1-clean (phase-h critic) on `his regime`, man `ssdMin 0.5`: exposure
  22.5 -> 27.0 (+4.5), false cover 136.5 -> 147.5 (+11.0), phantom
  547.5 -> 551.0 (+3.5, i.e. WORSE, not -41%).** The old headline
  described a bench defect (`bodyFromSsd` carried no head anchor, so
  `sameHuman` merged distinct people on containment alone) rather than
  the coco-ssd source; with the anchor restored the phantom "win"
  is gone in both genders. Four recovery attempts still failed, on the
  right numbers now.
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

> **RETRACTED 2026-09-02 -- BOTH THE TABLE AND THE MECHANISM. See 10g.**
> `iou-ab.mjs` carried the phase-D D2 defect: its options object had
> three entries where `hisRegimeOpts` has seven, and without
> `fixedCadence` the tracker was told the 500ms BANK interval and
> coasted 1250ms instead of his cap-pinned 2000/4000. Re-run in his
> regime the dial is a REAL lever and the numbers below are wrong in
> every column. The mechanism sentence -- "the near-miss overlaps are
> not the same person slightly moved" -- is wrong too: more than half of
> them re-associate. Kept in full because the refusal was quoted twice.


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

> **TABLE RETRACTED 2026-09-02 -- see 10h.** `cut-sweep.mjs` carried the
> same D2 defect as `iou-ab.mjs`: three options where `hisRegimeOpts`
> has seven, so it ran at a 1250ms coast instead of his 4000ms. The
> METHOD below (swap the bank, never the constant; `setCutBank` asserts
> each bank's stamp) is sound and unchanged -- only the numbers are on
> the wrong regime. The shipped value has also moved to **60** since.


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

> **THAT LAST SENTENCE IS CONTRADICTED BY 10p AND 10p WINS** (phase-E
> critic, E11). 10p refuses 75 on a measurement this section did not
> have: at 75 the cut gate fires on **12 of 2,160** corpus frames while
> **his phone's ordinary motion reaches p95 54.9**, so pushing it would
> start missing REAL cuts on his own footage. Both sentences are about
> the same dial, the OTA ceiling is exactly 75, and a missed cut is the
> largest exposure this corpus has traced. **Do not push 75 without a
> fresh read of HIS luma deltas.**

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
real faces are refused). **THREE** of the eighteen pairs cross that floor
when the aspect is corrected:

```
H14bBuluwB8_t252   nm 2.68 -> 5.13
z86LGEFyQpo_t2     nm 4.79 -> 5.59
z86LGEFyQpo_t2     nm 4.97 -> 6.05
```

**CORRECTED 2026-09-02 (phase-E critic, E14): this said FOUR.** The
fourth pair was `z86LGEFyQpo_t902  nm 5.02 -> 5.93`, and 5.02 is already
ABOVE a floor of 5 -- it does not cross anything. Counted off the banked
raw rather than off the table, it is three.

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
- **AND IT IS NOT COST-FREE ON DETECTION, WHICH THIS SECTION SAID IT
  WAS.** Phase-E critic, E3, executed on the SAME 241-frame set 16b
  uses rather than on these 15:

  | | squash (pre-1089) | letterbox (1089) |
  |---|---|---|
  | detections | 372 | 396 |
  | **frames with NO detection** | **0** | **3** |
  | detections lost | -- | 33, of which **26 (79%) under 64px native** |
  | detections gained | -- | 57 |

  Net positive on detections, and it is NOT being reverted. But the
  frame-blind direction is **one-way and no longer zero**, and the
  arithmetic says why: the letterbox gives a 640x360 face `0.4x` on both
  axes where the squash gave `0.4 x 0.711`, so a 40px native face is
  **16px tall in the tensor instead of 28px** -- and the losses
  concentrate in exactly his 38-64px band. On the four platforms where
  the whole-frame path is the ONLY path, a blind frame means
  `wholeFrameFlagged` returns false, `cleanStreak++`, and four of them
  reach `clearEl`.
  HONEST LIMIT OF THE CRITIC'S ARM IN TURN: it does not run the gender
  read, so a lost DETECTION is not automatically an uncovered person --
  16a's own three lost detections were all null reads. A blind FRAME is
  a different quantity and it is gender-independent.
- **THERE WAS NO COUNTER ON THAT BRANCH AT ALL**, which is why a
  one-way change could be called zero. `wholeFrameNoFaces` and
  `wholeFrameCleared` now count it, so the next artifact off any of the
  four platforms says how often the only evidence there is comes back
  empty. Fix the exposure only against that number -- the candidate is a
  letterbox floor that falls back to the squash below a face size, and
  choosing it blind would be the third guess in this file.
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
`position: absolute`, `z-index: 2`, `pointer-events-none`.

> **RETRACTED 2026-09-02, phase-e E12: "sized exactly to the video box"
> was never measured and cannot be.** It is a GEOMETRY claim, and this
> section's own HONEST LIMITS say the device locked its screen mid-run
> and `innerWidth` read **0**, so every rect in that pass is worthless.
> Quoting a rect three paragraphs above the sentence that voids it is
> the failure, not the rect.
>
> **And the committed probe could not have produced it either.**
> `probe_player_hosts.py` walks ANCESTORS (`el.parentElement` upward);
> `shreddit-media-ui` is a SIBLING of the video inside the shadow root,
> so it is not on any ancestor chain and appears in no committed raw. A
> census of that root needs `[...v.getRootNode().children]`, which
> nothing in `spikes/gauntlet` runs.
>
> What survives is the part that does not depend on layout, and it is
> the part the fix rests on: **the root is open, `shreddit-media-ui`
> lives in it, and it is absolutely positioned and pointer-transparent.**
> Whether it is sized to the video box has to be read off an UNLOCKED
> arm64 device before anyone builds against it.

`shreddit-player` itself reads `position: relative` **and already
`isolation: isolate`**, so the two page mutations `resolveHost` performs
would both be no-ops there. (Computed style, not geometry -- so the
locked screen does not touch it.)

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

## 10o. THE ASSOCIATION THRESHOLD IS A LEVER AFTER ALL -- 10e REFUSED IT IN A REGIME HIS PHONE IS NOT IN

Same defect as the cadence table (13a) and the clear bar (critic-lowbar),
in the third bench: `iou-ab.mjs` built its options by hand --
`{ hold, clampPad, cut }` -- where `hisRegimeOpts` carries seven, and
the missing one is `fixedCadence`. Without it the tracker is told the
500ms **bank interval** and derives a 1250ms coast; his phone is told
**2000** (cap-pinned effZoom) and coasts **4000**. Every row of 10e was
measured somewhere he does not live.

**Both control rows reproduce the shipped arm exactly** -- man
`22.0 / 155.0 / 573.5`, woman `25.5 / 201.0 / 679.5` -- the same triples
the coast sweep and critic-lowbar arrive at independently. That is the
self-check, and it passed in both genders.

| IOU_MIN | man exp / fc / phantom | woman exp / fc / phantom | births m/w | nearMiss m/w |
|---|---|---|---|---|
| **0.20 SHIPPED** | **22.0 / 155.0 / 573.5** | **25.5 / 201.0 / 679.5** | 160 / 163 | 67 / 61 |
| **0.15** | **23.0 / 139.0 / 561.0** | **24.5 / 200.5 / 663.0** | 147 / 147 | 42 / 33 |
| 0.10 | 24.0 / 138.5 / 553.0 | 27.0 / 200.5 / 644.0 | 142 / 140 | 26 / 21 |
| 0.05 | 26.0 / 139.5 / 541.5 | 26.5 / 202.0 / 632.5 | 139 / 137 | 13 / 11 |
| 0.02 | 27.5 / 139.5 / 532.5 | 26.0 / 200.5 / 621.5 | 138 / 133 | 6 / 7 |

### 0.20 -> 0.15 is close to free, and the two arms disagree in the safe direction

- **man: +1.0s exposure, -16.0s false cover, -12.5s phantom**
- **woman: -1.0s EXPOSURE (better), -0.5s false cover, -16.5s phantom**

So across the two arms the exposure change nets to **zero** while false
cover falls 16.5s and phantom 29.0s. Almost all of the false-cover gain
is bought in that first step (139.0 at 0.15 against 138.5 at 0.10 and
139.5 at 0.05 -- flat thereafter), so the rest of the ladder buys
phantom only, and buys it with man-mode exposure.

**Exposure is monotone in man mode** (22.0 -> 23.0 -> 24.0 -> 26.0 ->
27.5), which is 10e's own warning coming true: a looser threshold
associates an observation onto a track that is not its person, and when
that track is a man's CLEARED one the woman goes sharp. The mechanism
was right; only the conclusion that it costs nothing to avoid was wrong.

### And the mechanism sentence is refuted too

10e said the near-misses "do not become matches; they re-classify as
`birthFresh`", from births 310 -> 299 against nearMiss 48 -> 4. In his
regime: **0.20 -> 0.15 removes 25 near-misses and 13 births** (man), 28
and 16 (woman) -- so **roughly half of them ARE the same person slightly
moved** and do re-associate. At 0.10 it is 41 near-misses for 18 births.

`birthCleared` stays flat throughout (24 -> 21 man, 11 -> 9 woman), so
the extra associations are not being handed to cleared tracks in bulk --
the exposure that does appear is a handful of individual re-associations,
not a class change.

### PUSHED IN 1090, AND EVERY SENTENCE THAT USED TO BE HERE WAS FALSE

**RETRACTED 2026-09-02 (phase-E critic, E9).** This section ended:
*"`PTRACK_IOU_MIN` is not on the OTA whitelist, so unlike the coast dial
this cannot be tried on his phone without a release ... shipped at
0.20."* All three claims are false, and they were false at the moment
they were written: **1090 shipped 0.15, added the key to the whitelist
clamped [0.10, 0.35], and published it.** Read out of the RELEASED APK
whose sha matches the manifest -- `wv=.15`,
`PTRACK_IOU_MIN:[.1,.35,...]`, and `"PTRACK_IOU_MIN": 0.15` in the
embedded tuning.json.

The cost of leaving it was specific: the constitution told the next
session that **the only lever which can roll 1090 back without an
install does not exist.**

**IT IS AN EXPOSURE TRADE IN MAN MODE, WHICH IS HIS SETTING AND HIS
CALL** -- that half was right, and it is why the range reaches 0.35 in
BOTH directions. See 17b: under 1091's optimal assignment the ladder was
re-read upward for the first time and 0.15 is close to the WORST
exposure point reachable over the air.

**Raw: `spikes/gauntlet/iou-ab-hisregime.txt`.**

## 10p. CUT_DELTA RE-DERIVED IN HIS REGIME -- the cut gate is the biggest phantom dial there is, and it is bought with exposure

> **SUPERSEDED 2026-09-02 (phase-E critic, E7). The table below was
> measured at `PTRACK_IOU_MIN` 0.20 and is quoted throughout as if it
> described the shipped configuration.** At the shipped 0.15 the headline
> is wrong in the direction that matters: *"60 -> 75 buys 14.0s of false
> cover"* is **6.0s**. Re-read under 1091 in 17c; raw in
> `spikes/gauntlet/cut-under-optimal.txt`. **The CONCLUSION survives** --
> the dial is monotone, enormous, and paid for in exposure -- and 75 is
> still refused for a reason that has nothing to do with the corpus.

Same fix, same file class. Both control rows land on the shipped triple
of that configuration (man `22.0 / 155.0 / 573.5`, woman
`25.5 / 201.0 / 679.5`), which was the third independent bench to arrive
at them. **See `bench/arch-arms.mjs` `CONTROL` for the LIVE triple** --
quoting one without its configuration is what put three of them in
circulation at once (E6).

| CUT_DELTA | cut frames | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|---|
| 35 | 200 | 14.0 / 180.5 / 976.5 | 11.5 / 212.0 / 1050.0 |
| 40 | 184 | 14.0 / 180.0 / 911.0 | 11.5 / 209.0 / 1011.0 |
| 50 | 115 | 16.5 / 156.0 / 660.0 | 18.5 / 198.5 / 737.5 |
| **60 SHIPPED** | 59 | **22.0 / 155.0 / 573.5** | **25.5 / 201.0 / 679.5** |
| 75 | 12 | 25.5 / 141.0 / 476.5 | 29.5 / 198.0 / 629.0 |
| 90 | 2 | 27.0 / 141.5 / 470.0 | 33.5 / 198.5 / 623.5 |

**The dial is monotone and it is enormous.** 35 -> 90 moves phantom
976.5 -> 470.0 (man) and 1050.0 -> 623.5 (woman) -- larger than the coast
window, larger than the clear bar, larger than the association
threshold. Every step is paid for in exposure: 14.0 -> 27.0 (man),
11.5 -> 33.5 (woman).

**Loop 40's 50 -> 60 is priced here for the first time**: it cost
**+5.5s** of man exposure and **+7.0s** of woman exposure, and bought
**86.5s** and **58.0s** of phantom. Loop 40 justified it on his phone's
own motion distribution (600 live luma deltas: p50 8.7, p75 16.3, **p90
28.2**, p95 54.9) rather than on the corpus, which could not price it
then; the corpus now agrees the trade was in the right direction.

### 75 is reachable over OTA and is NOT recommended without a device read

The clamp is `[30, 75]`, so 75 is exactly the ceiling. On the corpus
60 -> 75 buys **97.0s** of man phantom and **14.0s** of false cover for
**+3.5s** of exposure -- the best ratio in the table.

**It is refused anyway, and the reason is not on the corpus.** At 75 the
gate fires on **12 of 2,160 frames**. His phone's ordinary camera motion
reaches p95 **54.9** and its real cuts sit above that; a gate at 75
starts missing REAL cuts, and a missed cut is a stale track surviving a
shot change -- which is loop 39's traced mechanism for this corpus's
single largest exposure (a woman's observation re-associating onto a man's
cleared track from the previous shot). The corpus prices the +3.5s it can
see; it cannot price the ones it never banked, because
`bank/cuts-75.json` was derived from the SAME corpus footage and not
from his.

So: **push CUT_DELTA only against a fresh read of his own luma deltas**,
never off this table alone. The number that would justify 75 is his p95,
and the last one measured was 54.9.

**Raw: `spikes/gauntlet/cut-sweep-hisregime.txt`.**

## 17. THE ASSIGNMENT WAS THE LARGEST CLASS OF BIRTH ALL ALONG, AND E5 SAID THE OPPOSITE BECAUSE IT RAN AT THE WRONG COAST

`births.mjs` was the fourth file in the D2 class. It built its options by
hand -- `{ hold, clampPad, cut }` where `hisRegimeOpts` carries seven --
and hand-rolled its own `thin`, so it told the tracker the 500ms BANK
interval and derived a **1000ms coast** where his phone is told 2000 and
coasts 4000.

**That defect lands harder here than anywhere else it has been found.** A
short coast expires a track between every pair of verdicts, and an
expired track is a **BIRTH** on the next observation. So the one file
whose entire subject is *why tracks are born* was the file the defect
distorted most.

### The corrected table

CUT_DELTA 60, PTRACK_IOU_MIN 0.15, his regime, 18 windows / 2160 frames.
**Both assignments, because the first version of this table printed the
GREEDY arm under the heading "shipped bundle"** and the assignment
shipped in the same session (phase-f F5):

| | | births | fresh | nearMiss | contended | sizeRejected |
|---|---|---|---|---|---|---|
| **man** | greedy (1090) | 147 | 39 (26.5%) | 42 (28.6%) | **65 (44.2%)** | 1 |
| | **optimal, SHIPPED 1091** | **141** | 38 (27.0%) | 43 (30.5%) | **60 (42.6%)** | 0 |
| **woman** | greedy (1090) | 147 | 37 (25.2%) | 33 (22.4%) | **75 (51.0%)** | 2 |
| | **optimal, SHIPPED 1091** | **136** | 38 (27.9%) | 34 (25.0%) | **62 (45.6%)** | 2 |

E5 published **310 births, fresh 230 (74.2%), contended 32 (10.3%)** and
concluded that geometry dominated and the association layer was the
second lever. Corrected, **`birthFresh` is the SMALLEST class in both
arms and `birthContended` is the largest** -- which is an ASSIGNMENT
problem, and that is a different fix from the threshold one E5 pointed
at. **That conclusion is unchanged by the mislabelling**: it holds on
both assignments and in both genders.

**Decomposed, so the reversal is attributed rather than asserted:** told
500 -> 2000 alone moves births **214 -> 147** and coastExpired **184 ->
102** (greedy, the arm that measurement was taken on). The remaining gap
to E5's 310 is `CUT_DELTA` 50 -> 60 (115 cut frames -> 59). **Neither
half is geometry.**

**Cross-check, and the first version of it was wrong too.** It read "147
births in both genders", which `iou-ladder-ceiling.txt` in the same
session contradicts -- that file reports 141 man and 136 woman. The
error was in the instrument, not the sweep: **`births.mjs` ignored
`GENDER` entirely** and printed `mode man` whatever it was handed, so
its "woman" row was the man arm relabelled. That is the A-series ladder
failure -- one arm printed under two labels -- in a bench that had it
for as long as it has existed. `GENDER` is read now and an unrecognised
mode exits 2 rather than defaulting. With it honoured, **births.mjs and
the IOU ladder agree exactly: 141 man, 136 woman.**

**Raw: `spikes/gauntlet/births-1091.txt` (`births-hisregime.txt` is the
greedy arm and the mislabelled woman row -- kept, not corrected, because
it is what the retraction is about).

## 17a. GREEDY'S FAILURE MODE *IS* A CONTENDED BIRTH, AND FIXING IT BUYS PHANTOM ON BOTH ARMS

`updatePersonTracks` claimed greedily down an IoU-sorted pair list. Its
failure mode is exactly the thing 17 counts:

```
track A overlaps obs2 at 0.52 and obs1 at 0.39
track B overlaps obs2 at 0.33 and obs1 not at all
```

Greedy takes A-obs2 -- the single largest number on the list -- which
leaves B with no partner and obs1 with none either. B coasts toward
death and **obs1 is BORN, contended**, so a subject who already had a
track is re-minted, born BLURRED, with no accumulated clear. The pairing
A-obs1 + B-obs2 matches both and gives up 0.13 of overlap doing it.

`src/assign.mjs` holds both: `greedyAssign` is that loop moved verbatim,
`optimalAssign` is Hungarian.

**THE OBJECTIVE IS CARDINALITY FIRST, THEN OVERLAP -- and getting that
wrong would have made the number worse.** A pure max-WEIGHT matching
takes a single 0.90 edge over two 0.20 edges, which *raises* the birth
count. Lexicographic order is bought by weighting each eligible edge
`1e3 + iou`: with the cardinality term three orders above any total a
frame can carry, one extra match always beats any redistribution of
overlap. A test pins that case.

### The measurement

His regime, both control rows reproducing the post-1090 shipped triples
exactly:

| arm | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|
| greedy | 23.0 / 139.0 / 561.0 | 24.5 / 200.5 / 663.0 |
| **optimal SHIPPED 1091** | **22.5 / 136.5 / 547.5** | **25.5 / 201.5 / 628.0** |

- **man -- his setting -- is better on all three numbers.**
- woman pays **1.0s of exposure across eighteen windows for 35.0s of
  phantom**.
- contended births **65 -> 60** and **75 -> 62**; coastExpired **102 ->
  96** and **102 -> 92**.

**Per window, because a total can hide one subject going sharp:** 8 of 18
windows move at all. The woman-mode exposure is **two windows at +1.0s
against one at -1.0s**, and those two buy 3.0s and 14.5s of phantom.

**Cost: 8 microseconds per pass** at 12 tracks against 12 observations
(25.98us optimal against 17.72us greedy, 20,000 synthetic frames), once
per 1.5-2s, against a verdict that costs 730-1250ms on his phone.

**NOT on the OTA channel.** An algorithm is not a number, and code may
never travel here. Verified R15-style in the EMITTED bundle:
`Lde="optimal"` and the Hungarian body is present rather than
tree-shaken.

## 17b. THE ASSIGNMENT AND THE ASSOCIATION THRESHOLD WERE BUYING THE SAME THING

Re-reading the IOU ladder under the new assignment (`iou-ab` now walks
BOTH ways around the shipped value; it stopped at it and walked down,
which was right while 0.20 shipped and hides the tightening direction
now that 0.15 does):

| IOU_MIN | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|
| **0.35 OTA CEILING** | 16.0 / 168.5 / 606.5 | 21.0 / 210.0 / 725.0 |
| 0.30 | 17.0 / 160.0 / 581.0 | 20.0 / 204.5 / 702.5 |
| 0.25 | 19.5 / 147.0 / 563.0 | 21.5 / 197.0 / 681.0 |
| 0.20 | 21.5 / 139.5 / 566.5 | 23.0 / 199.0 / 659.0 |
| **0.15 SHIPPED** | **22.5 / 136.5 / 547.5** | **25.5 / 201.5 / 628.0** |
| 0.10 | 24.5 / 137.5 / 543.0 | 27.0 / 200.5 / 613.0 |
| 0.05 | 28.0 / 135.0 / 528.0 | 28.5 / 202.0 / 607.5 |
| 0.02 | 32.5 / 134.5 / 518.5 | 28.0 / 199.5 / 601.0 |

**Under greedy, 0.20 -> 0.15 bought 16.0s of false cover (man). Under
optimal it buys 3.0s** -- because `optimal@0.20` already reads fc 139.5,
which is what `greedy@0.15` reached. Both levers were removing the same
re-associations.

**CONSEQUENCE, AND IT WEAKENS A SENTENCE 1090 SHIPPED ON.** 10g justified
0.15 with *"across the two arms the exposure change nets to zero"*. That
was true under greedy (man +1.0, woman -1.0). Under optimal it is **+1.0s
man and +2.5s woman**, bought with 50.0s of phantom. Still a trade worth
having on his loudest complaint, and **0.20 is reachable over OTA without
an install** (clamp [0.10, 0.35]) if he would rather have the 3.5s back.

**AND THE OTA CEILING IS PRICED NOW, WHICH IT NEVER WAS.** The ladder used
to stop at 0.30 while the clamp allows 0.35, so the endpoint of a range
that can reach his phone *without an install* had never been measured --
a bound nobody has priced is not a bound. At the ceiling, against the
shipped 0.15: **man -6.5s exposure for +32.0s false cover and +59.0s
phantom; woman -4.5s for +8.5s and +97.0s.** Both arms agree on the sign
of all three.

So the whole clamp range is a single monotone protection trade, and the
mechanism is visible in the birth counts: **tightening the association
raises births (141 -> 184 man, 136 -> 184 woman)** because a subject who
fails to re-associate is re-minted, and a re-minted track is born
**blurred**. That is why the tight end buys exposure and pays phantom.
**The ceiling is a shippable state**, not a guard rail -- if he ever says
the misses matter more than the marks, 0.35 is one OTA push and the cost
above is what he is buying.

**Raw: `spikes/gauntlet/iou-under-optimal.txt`,
`spikes/gauntlet/iou-ladder-ceiling.txt`.**

## 17c. THE OTHER TWO DIALS DID NOT MOVE, AND FOUR BENCHES NOW AGREE ON THE CONTROL

`assign-ab`, `iou-ab`, `coast-ab` and `cut-sweep` all reproduce the 1091
control triples (man **22.5 / 136.5 / 547.5**, woman **25.5 / 201.5 /
628.0**) from four independent files. That is the self-check that says
the regime is pinned in all four, and it is the strongest this instrument
has had.

**The coast dial, re-priced so the question he is being asked carries the
number his phone would get:**

| passes | coast | man exp / fc / phantom | woman exp / fc / phantom |
|---|---|---|---|
| 1 | 2000ms | 39.5 / 127.0 / 352.0 | 36.5 / 189.0 / 398.5 |
| **1.33** | 2660ms | **27.5 / 126.0 / 406.5** | **29.5 / 193.5 / 471.5** |
| 1.5 | 3000ms | 26.5 / 130.0 / 463.0 | 29.0 / 195.5 / 537.5 |
| **2 SHIPPED** | 4000ms | **22.5 / 136.5 / 547.5** | **25.5 / 201.5 / 628.0** |
| 3 | 5000ms | 21.5 / 145.0 / 595.0 | 25.5 / 204.5 / 679.0 |

2 -> 1.33 is **+5.0s man / +4.0s woman of exposure for 141.0s and 156.5s
of phantom** (-25.7% and -24.9%). Under greedy it read +4.5/+4.0 for
-149.5/-185.0. **Same shape, same winner, same trade -- the standing
question stands as asked and only its digits move.** It still travels
over OTA without an install.

**`CUT_DELTA` is unchanged in shape and 75 stays refused.** 60 -> 75 is
man +5.0 / -5.0 / -93.0 and woman +1.5 / -3.0 / -37.0, against greedy's
+3.5 / -14.0 / -97.0. The refusal is not about the corpus: his phone's
ordinary motion reaches **p95 54.9**, and at 75 the gate fires on 12 of
2160 frames, so it would start missing REAL cuts on HIS footage.

**Raw: `spikes/gauntlet/coast-under-optimal.txt`,
`spikes/gauntlet/cut-under-optimal.txt`.**

## 17d. THE TWO GUARDS AGAINST THE D2 DEFECT CLASS WERE THEMSELVES COIN FLIPS

Both found by the evidence packet's own oracle, which is the first time
the critic loop has caught something before the critic read it.

**1. `capture()` swapped the process-wide `process.stderr.write`.**
`cadence-pinned.test.mjs` asserted `assert.equal(out, '')` for the
second call, so any unrelated line on stderr inside that window -- a node
warning, the runner's own diagnostics under load -- failed a test about
our warning. The property is that OUR warning does not re-print, so that
is what it asserts now. Proved red by making `warnDerivedCadence` always
print.

**2. `_build.mjs` raced with itself, and failed ONE arbitrary test file
with no message.** Two test files import `arch-arms`, which imports
`_build`, and `node --test` runs them in separate concurrent processes.
Both read the bundle and both ran esbuild; whichever happened to read
`before` *after* the other had already written got `before === after` and
did **not** throw -- so exactly one of the two failed, nondeterministically,
reported by the runner as `'test failed'` with no assertion named.

**That is the worst possible shape for a failure to take**, and it cost
the evidence packet's oracle a false alarm: a packet whose test output
shows an unexplained failure reads exactly like a regression, which is
the one thing the oracle exists to distinguish.

Three changes: **no write when nothing changed** (the build runs only if
an input is newer than the bundle, so every run after the first touches
nothing and there is no window to race in); **one writer** (a `wx` lock
elects a builder, the others wait rather than reading a file being
written); and **it says why on stderr before it throws**, so the reason
lands in any captured output. Verified both directions -- up to date is
silent, stale fails BOTH files with the reason printed, second pass green.

## 18. THE MoveNet LETTERBOX BUYS NOTHING THROUGH THE SHIPPED GATE, AND MY OWN N=30 HEADLINE WAS THE THING THAT SAID OTHERWISE

**RETRACTED, MINE, WITHIN AN HOUR OF WRITING IT.** `bench/movenet-gated.mjs`
at **N=30** read persons admitted **45 -> 58, +28.9%**, and that number
went into a commit message as the headline for the round. At **N=225**,
same bench, same arms, same five videos:

| | squash | letterbox |
|---|---|---|
| **persons admitted (SHIPPED gate)** | **373** | **373** |
| frames where one arm admits MORE | 47 | 44 |
| frames where only ONE arm admits ANYBODY | 1 | **8** |

**Exactly zero.** Not "small", not "within noise" -- 373 against 373, and
the more/less split is **47 to 44, a two-sided sign test p = 0.83**, which
is a coin flip.

**This is loop 40's rule running the other way.** That rule says a FLAT
sweep is a claim about the instrument until the instrument has the
frames. The mirror is just as true and it is the one that bit here: **a
LARGE effect at a small N is a claim about the sample.** N=30 was eight
frames per video on a corpus whose per-frame person count is 0, 1 or 2.

### What 16b measured, and why it is not refuted

16b's **+22.8% (219 -> 269)** was measured at a **flat 0.35 slot-score
threshold on the raw model output**. That claim stands. What does not
survive is the CONSEQUENCE drawn from it -- that the letterbox is "the
largest unclaimed accuracy win left".

**The shipped gate absorbs the entire raw gain.** `parsePersons` is not a
threshold: it runs an anchor gate, a keypoint-evidence gate, a size gate,
a keypoint union and admission hysteresis. `movenet-aspect.mjs`'s own
header warned that "a gate calibrated on a dead signal would only restate
itself"; the same caution run forwards says a raw-score win is not a
shipped win until it is measured through the gate. **It took a bench to
find that out and it should have been the first bench, not the second.**

### What DOES survive, and it is the half that matters for exposure

**8 frames where only the letterbox admits anybody, against 1 the other
way** -- 9 discordant frames, **two-sided sign test p = 0.039**.

That is a different and better quantity than the total. On this path a
frame where NOBODY is admitted does not get a smaller patch, it gets **no
measured body at all**: the extent falls back to a synthetic body
projected from the face (`personFromFace`, `cy + 6.0h`, uncapped), which
is the one dimension of the geometry this repo has never been able to
price. So the letterbox is not "more people, more often" -- it is
**fewer frames with no measurement at all**, on eight frames in 225.

### The inverse map is correct, and that is the strongest result here

For the 315 people BOTH arms admit:

- box IoU between the arms **p05 0.553, p50 0.918, p95 0.978**
- top edge, bottom edge and height deltas all **p50 exactly +0.000**
- **0 boxes outside 0..1**

**A wrong inverse map would show here first and it would show as a
SYSTEMATIC SHIFT.** There is none, and the reason is worth writing down
because it is not obvious: **the squash does not misplace anything.** It
is a uniform per-axis scale of the whole frame, so model-normalized 0..1
and frame-normalized 0..1 coincide on both axes. The squash distorts
what the model SEES, not where it says things are. The letterbox changes
the coordinate frame -- which is why it needs `unpadPersons` at all --
and after the map the two frames coincide again, which is exactly what a
median edge delta of 0.000 across 315 people says.

**So the whole change is admission, and none of it is displacement.**

### It stays OFF, on much better evidence than before

The flag was written to ship OFF because the labelled corpus was banked
against squashed extents. That was a *sequencing* argument. The reason
now is a *result*: **through the gate the benefit is a null on totals**,
and the residual is eight frames. Re-scoring the entire corpus -- and
moving the placement layer under every exposure, false-cover and phantom
number the repo owns -- to buy eight frames in 225 is not a trade worth
making yet.

**WHAT WOULD MAKE IT REAL, and it is one bench away.** Both arms ran with
`held: null`, so admission HYSTERESIS was off on both sides. That is
symmetric and therefore fair, but it is not the shipped regime, and it is
the mechanism that would AMPLIFY the residual specifically: a frame the
letterbox admits somebody on hands the next frame a held person, and
hysteresis is what turns one admission into a run of them. Eight
discordant frames under no hysteresis could be considerably more under
it. **Run the bench with `held` threaded before writing this off.**

**Raw: `spikes/gauntlet/movenet-gated-n225.txt`.**



## 18a -- THE LETTERBOX WITH HYSTERESIS ON: 5 OF 5 RUNS WITH HEADROOM MOVE THE SAME WAY, AND 65% OF THE MAGNITUDE IS ONE RUN

18 retracted the letterbox on the headline metric (persons admitted 373
against 373 at N=225) and named the one thing that could revive it:
both arms had run with `held: null`, so admission HYSTERESIS was off on
both sides -- symmetric and therefore fair, but not the shipped regime,
and hysteresis is exactly the mechanism that turns one admission into a
RUN of them. `bench/movenet-held.mjs` is that arm: 15 contiguous runs of
24 frames at 2fps, each arm carrying its OWN `held`, scored on COVERED
FRAMES rather than on totals.

| | frames | covered | persons | covered runs | mean run |
|---|---|---|---|---|---|
| squash | 360 | **292 (81.1%)** | 563 | 18 | 16.22 |
| letterbox | 360 | **312 (86.7%)** | 571 | 21 | 14.86 |

**+20 covered frames of 360.** And the distribution is the whole
finding:

| run | squash | letterbox | delta |
|---|---|---|---|
| NWoT1ZVd1Lo t=2 | 23 | 24 | +1 |
| H14bBuluwB8 t=2 | 4 | 5 | +1 |
| RcGyVTAoXEU t=2 | 4 | 7 | +3 |
| RcGyVTAoXEU t=332 | 13 | 15 | +2 |
| **RcGyVTAoXEU t=602** | **11** | **24** | **+13** |
| the other TEN runs | 24 | 24 | 0 |

- **TWELVE OF FIFTEEN RUNS ARE AT THE CEILING**, 24 of 24 in both arms.
  A run where the control already covers every frame cannot show a gain,
  so **this instrument has headroom in five runs and measures nothing in
  ten.** Reporting "12 of 15 tied" as a null would be the loop-40 error:
  a flat sweep is a claim about the instrument until the instrument has
  the frames.
- **WITHIN THE FIVE THAT CAN MOVE, THE LETTERBOX WINS 5 FOR 5**, with
  no reversals in either direction (sign test p = 0.031, one-tailed).
  That is a cleaner signal than the N=225 admission test produced.
- **AND 13 OF THE 20 FRAMES ARE ONE RUN.** `RcGyVTAoXEU t=602` goes
  11 -> 24, and without it the result is +7 across four runs. This is
  21a's failure mode exactly, one section apart -- **with the one
  difference that matters: in 21a the columns had signs going BOTH
  ways, and here every moving run moves the same way.** A concentrated
  gain with no counter-examples is weaker than a spread one and much
  stronger than a mixed one.
- **STILL NOT SHIPPED, AND THE FLAG STAYS `pde=!1`.** Five runs with
  headroom is not a corpus, `persons` totals are known FLAT at N=225 so
  the 563/571 difference here is the sampling and not the arms, and the
  covered-run count moving 18 -> 21 while MEAN RUN LENGTH FALLS
  16.22 -> 14.86 says the letterbox is starting more, shorter covered
  runs -- which is what more admissions look like, and also what
  FLICKER looks like. Nothing here distinguishes them.
- **THE INSTRUMENT FIX IS THE NEXT STEP AND IT IS OBVIOUS:** select
  runs for LOW CONTROL COVERAGE rather than sampling the corpus
  uniformly. Ten runs measuring nothing is ten runs of budget spent
  proving the easy case is easy. Until that runs, 18's retraction
  stands as written and this section is a lead, not a result.

**Raw: `spikes/gauntlet/movenet-held-15runs.txt`.**

## 19 -- PHASE F: FOUR OF THE EIGHT FINDINGS ARE CHECKS THAT COULD NOT FAIL, AND ONE IS AN EXPOSURE IN THE FIX I HAD JUST WRITTEN

8 rows, 8 CONFIRMED, none refuted. The shape of the round is the
finding: **half of it is DEAD-CHECK.** A session that added three
counters while quoting "a counter that does not exist reads exactly like
a counter at zero" shipped, in the same range, a silent fallback, a
sanity check reading clamped output, a collision sweep scoped to one
file, and a test header claiming coverage it does not have.

- **F2 IS AN EXPOSURE AND IT WAS IN `unpadPersons`, THE FUNCTION I WROTE
  TO FIX AN EXPOSURE.** The inverse map clamped keypoints to [0,1].
  `parsePersons` consumes keypoints as DIFFERENCES -- `headW =
  |lEar.x - rEar.x|`, `headH = headW * ar`, and `HEAD_ANCHOR_UP` sets
  the patch top from that -- so a difference of clamped values is
  monotonically SMALLER, the head anchor SHRINKS and the top edge RISES.
  Measured on the critic's fixture: **headW 0.5133 -> 0.1600, patch top
  0.0000 -> 0.3209.** A third of the frame height of scalp left sharp,
  by a clamp added for safety. Keypoints are unclamped now; the four BOX
  floats still clamp, because those are absolute positions and an
  out-of-frame box is meaningless. **The clamp was defensible on the
  quantity it was written for and wrong on the quantity it was applied
  to** -- and no amount of testing the map in isolation would have found
  it, because the map is correct. The consumer is what makes it an
  exposure.
- **F4: THE CHECK GUARDING AGAINST "THE FAILURE WORSE THAN THE DEFECT"
  READ CLAMPED OUTPUT.** `movenet-gated`'s out-of-range row asked
  whether the boxes `parsePersons` EMITS sit inside 0..1, and both
  `parsePersons` and `unpadPersons` clamp every box they emit. A map
  wrong by 3x printed **"the inverse map holds"**. It reads the
  UNCLAMPED inverse now, and as a **magnitude rather than a count**,
  because a hard count cries wolf on a CORRECT map: MoveNet's box
  regression reaches ~3.5px into its own black bar and the inverse
  divides the padded axis by sy = 0.5625, amplifying it to **0.024**.
  Both examples found are y-only; x never overshoots because sx is 1.0
  and there is nothing to amplify. **Model noise is hundredths, a wrong
  map is 1.938** -- red-proven at `sx/3`.
- **F6: THE HUNGARIAN ASSIGNMENT FALLS BACK TO GREEDY ABOVE 32x32 AND
  SAID NOTHING.** Above the ceiling every number this repo has quoted on
  "the optimal arm" is describing the greedy one, indistinguishably from
  outside. `assignFellBackGreedy` counts it; the test asserts it fires
  above the ceiling AND stays silent at the ceiling exactly, because a
  counter that ticks on ordinary frames means nothing.
- **F7: THE COLLISION SWEEP WAS SCOPED TO ONE FILE AND THE COLLISION IT
  NAMES WAS BETWEEN TWO.** `clampFired` (loop 39) was region-blur's
  patch clamp against body-clamp's. The sweep is the whole `src/` tree
  now, asserting exactly one owner per name, and a second test uses
  `clampFired` -- still two-owner -- as a live fixture so the sweep
  cannot silently go vacuous again.
- **F3: A TEST HEADER CLAIMED MORE THAN THE INSTRUMENT CAN DELIVER, AND
  THE HONEST FIX WAS TO NARROW THE CLAIM.** `control-triple` says it
  "fails when ANY shipped constant in the decision layer moves";
  `PATCH_MARGIN` 0.045 -> 0.500, `PERSON_MIN_SCORE` -> 0.99 and
  `HEAD_ANCHOR_UP` -> 0.0 all leave it green. **The corpus banks PARSED
  PERSONS -- boxes -- so it sits DOWNSTREAM of `parsePersons`**, and a
  constant whose only effect is inside that function cannot move an arm
  that never calls it. It covers the ASSOCIATION AND DECISION layer (red
  on `PTRACK_ASSIGN`) and is blind to the EXTENT layer above it. **A
  claim narrowed beats an assertion widened until it is vacuous** --
  which is the move that produced F4 and F7.
- **F5: `births.mjs` IGNORED `GENDER` AND PRINTED ONE ARM UNDER TWO
  LABELS.** It read `process.argv[2] || 'man'` and every other bench in
  the directory takes `GENDER=`. So findings 17's "woman" row was the
  man arm relabelled, and its cross-check ("147 in both genders") was a
  tautology contradicted by an independent sweep in the same session
  (141 / 136). **This is the A-series ladder failure**, in a bench that
  had it for as long as it has existed. Fixed; an unrecognised mode
  exits 2 rather than defaulting, and the two instruments now agree
  exactly.
- **AND THE SUITE WAS FLAKY FOR A REASON WORTH WRITING DOWN.** Three
  test files import `bench/.cache/shipped.mjs`, and when a source
  constant moves they race to rebuild it -- one writer truncating the
  file another is importing. All three fail together under the default
  concurrency and every one passes alone. `--test-concurrency=1`. **A
  suite that fails on a CORRECT change teaches people to re-run it until
  it goes green**, which is worse than a slow suite.
- gaze **576/576**, cargo **60/60**, critic-gate **58/58 CONFIRMED**.


## 20 -- EVERY CORPUS NUMBER THIS REPO HAS EVER PRODUCED WAS MEASURED ON THE FACE **FALLBACK** PATH, AND ON THIS FOOTAGE THE SHIPPED APP WOULD NOT BE ON IT

Phase-f F3 established that `control-triple.test.mjs` cannot see
`PATCH_MARGIN`, `PERSON_MIN_SCORE` or `HEAD_ANCHOR_UP`, and the reason
given was that the corpus banks parsed boxes. **That reason was
incomplete and the complete one is much bigger.**

**THE APP'S PRIMARY OBSERVATION SOURCE IS THE ADMITTED MoveNet PERSON.**
`init-entry.js:3922` pushes `{ box: p, positionOnly: true }` for every
un-cropped person and `observePerson(p)` for every budgeted one -- `box`
IS the person. `personFromFace` is the CLOSE-UP FALLBACK, for a face
that lands inside no person box (findings from 2026-08-24: it exists
because MoveNet returned 0 persons on a child close-up and she was
fully sharp).

**THE CORPUS ARM IS THE FALLBACK, ALWAYS.** `arch-arms.mjs:731` opens
every observation with `let box = null`, and only the OPT-IN arms
(`ssdEdge`, `slotBound`) ever set it. The banked face record carries
`x1..y2, conf, px, gender, score, raw, age, childP, nm, shape, descIdx,
crop` -- **and no body box at all**. So the control arm paints
`personFromFace`'s synthetic body for 100% of observations.

**AND THE FOOTAGE IS NOT IN THAT REGIME.** The raw `[1,6,56]` tensors
have been banked all along (`bank/persons/*.f32`, 2.9MB). Run through
the SHIPPED `parsePersons` (`bench/extent-reach.mjs`), 18 windows,
2,160 frames, his k=3:

| | |
|---|---|
| frames where `parsePersons` ADMITS anybody | **1,900 of 2,160 (88.0%)** |
| persons admitted, total | **3,940** |
| best slot score in frame | p05 0.125 / p50 0.382 / p95 0.522 / max 0.618 |
| banked faces | 1,153 |
| **faces that CLAIM an admitted person's box** | **836 (72.5%)** |
| faces falling through to `personFromFace` | 317 (27.5%) |

Per window, the ADMIT-FRAME rate above -- the share of FRAMES where
`parsePersons` admits anybody, not the share of FACES that claim a
box -- runs **45.0% to 100.0% of frames**, five windows at 100%, only
one under 70%. (H8, phase-h critic: this sentence sat directly under
the two claim-rate rows and read as a per-window bound on THEM; it is a
different quantity with a different denominator, and `extent-reach.mjs`
never computes a per-window claim rate at all -- only the two corpus
totals above.) So on this corpus the shipped app would take a MEASURED
body for roughly three faces in four, and the instrument takes a guess
for four in four.

**THOSE TWO ROWS WERE 959/194 (83.2%/16.8%) WHEN THIS SECTION WAS
WRITTEN, AND THAT WAS MY OWN RE-IMPLEMENTATION OF A SHIPPED RULE**
(phase-g G1). `extent-reach.mjs` used a private containment test:
unpadded, and with no one-face-per-person rule. Both halves are wrong
and they pull opposite ways -- the shipped `faceInsideIndex` pads the
person box by **10% on each axis** (MoveNet draws it round the
KEYPOINTS, so a leaning head sits just outside the person it plainly
belongs to), and the shipped `claimed` loop gives one box to ONE face,
largest first, so **every second face inside a box gets a synthetic body
anyway**. Netted, the synthetic share is **317 of 1,153 (27.5%)**, half
again as large as the number this section first reported. The rule now
lives in `person-gate.mjs` and both the app and the bench call it --
same remedy as `crop-geometry.fitBox`, and the same defect class as G5
one finding earlier.

**WHAT THIS DOES AND DOES NOT INVALIDATE.** It does NOT invalidate the
DECISION-layer work -- cadence, the coast, the clear bars, the
assignment, `CUT_DELTA` -- because those act on tracks and verdicts and
were swept with both arms on the identical body source, so the
DIFFERENCES stand. What it bounds is every ABSOLUTE number, and every
claim about EXTENT: `PATCH_MARGIN`, the head anchor, the body ladder,
the adjacency clamp and the whole "the fat guess covers people by
accident" argument are all statements about a path the app would be on
for 27.5% of these faces, not 100%.

**AND IT IS HIS REGIME BY ACCIDENT, NOT BY CONSTRUCTION.** Findings 36
measured his phone at all twelve slots `n:0` with `faceNoShape` 121 of
184 passes -- MoveNet admits nobody there, so the fallback IS what he
runs, and the corpus happens to model it. **AND THE PARITY IS REAL, NOT
AN ACCIDENT OF ARITHMETIC:** `bench/corpus-persons.mjs:27` banks at
`S = 256`, which is `PERSON_INPUT_SIZE`, so the tensors `parsePersons`
reads here are the shape his phone's worker produces -- what differs is
the FOOTAGE, not the graph.

**AND HIS 0.049 IS NOT COMPARABLE TO THE 0.382 ABOVE.** His figure is
the **keypoint** maximum, gated by `PFF_FRAME_KP_FLOOR` (0.1); the
corpus p50 0.382 is the **slot score**, gated by `PERSON_MIN_SCORE`
(0.35). Two different heads of one tensor with two different gates, so
"his phone reads 0.049 where the corpus reads 0.382" is not a
contradiction and is not evidence that this footage is an easier
population. It is two rows of a table read as one.

**Nothing in the tree says so**, and the moment his device starts admitting persons (better
hardware, whatever fixes the `n:0` regime, the letterbox if it is ever
revived) every absolute corpus number stops describing his screen. A
regime an instrument occupies by accident is one it can leave without
anyone noticing -- which is the D2 cadence defect restated one layer up.

**NOT MEASURED, AND IT IS THE NEXT ROUND:** what the corpus scores with
admitted MoveNet persons as the body where one is available. The
tensors are banked and `parsePersons` is already called from this
directory, so it is an arm, not a round -- but it is a change of body
source on 72.5% of observations, so it will move all three columns and
must be run as a matched A/B in both genders before a single sentence is
written about it.

**Raw: `spikes/gauntlet/extent-reach.txt`.**


## 21 -- SUPERSEDED BY PHASE-H's H1: the measured body's cost was a bench defect, not the box

**Every table and bullet in this section below was measured through
`bodyFromSsd` (bench/arch-arms.mjs) while it emitted a box with no
`headX`/`headY`/`headW`/`headH` -- the four fields `personFromFace` and
`boundBodyToSlot` both carry. `sameHuman` (person-track.mjs) treats a
box with no head anchor as having nothing else to separate on and
merges it on containment alone, so EVERY `mnBody`/`ssd` observation ran
with that guard switched off, deleting real observations rather than
"associating better". H1 (phase-h critic) found it; the head fields are
now restored at source and every number below is corrected. The title
is also wrong at the corrected numbers: the measured body recovers
**2.7% (man) / 3.2% (woman) of the phantom**, not a third.**

Findings 20 established that the corpus arm paints a synthetic body for
100% of observations while the app takes the admitted MoveNet person on
72.5% of these faces (83.2% before phase-g G1 corrected the rule). `bench/mnbody-ab.mjs` prices the difference. Both
arms byte-identical downstream of the box; only the source changes.
`ssdMin` is a floor on the slot confidence, `faceW` refuses to shrink
the body below N face widths, EDGE ONLY keeps the guess and lets the
measurement pull back only the side facing a cleared face.

**MAN (his setting), against the 1091 control 22.5 / 136.5 / 547.5 -- CORRECTED:**

| arm | exposure | false cover | phantom |
|---|---|---|---|
| CONTROL synthetic guess | 22.5 | 136.5 | 547.5 |
| mnBody s>=0.00 | 24.0 (+1.5) | 159.0 (+22.5) | 532.5 (-15.0) |
| mnBody s>=0.00 faceW 2.0 | 23.5 (+1.0) | 159.5 (+23.0) | 523.5 (-24.0) |
| mnBody s>=0.00 faceW 3.0 | 25.0 (+2.5) | 160.5 (+24.0) | 534.0 (-13.5) |
| mnBody s>=0.40 | 26.0 (+3.5) | 145.0 (+8.5) | 566.0 (**+18.5**) |
| **mnBody EDGE ONLY** | **22.0 (-0.5)** | **135.5 (-1.0)** | **536.0 (-11.5)** |
| mnBody s>=0.00 unionH | 22.5 (+0.0) | 161.0 (+24.5) | 530.0 (-17.5) |
| mnBody s>=0.00 faceW 6.0 | 20.0 (-2.5) | 156.0 (+19.5) | 552.0 (+4.5) |

**WOMAN, against 25.5 / 201.5 / 628.0 -- CORRECTED:**

| arm | exposure | false cover | phantom |
|---|---|---|---|
| mnBody s>=0.00 | 27.5 (+2.0) | 213.0 (+11.5) | 608.0 (-20.0) |
| mnBody s>=0.00 faceW 2.0 | 26.5 (+1.0) | 214.5 (+13.0) | 606.0 (-22.0) |
| mnBody s>=0.00 faceW 3.0 | 24.0 (-1.5) | 222.0 (+20.5) | 631.5 (+3.5) |
| mnBody s>=0.40 | 26.5 (+1.0) | 214.5 (+13.0) | 626.5 (-1.5) |
| **mnBody EDGE ONLY** | **27.0 (+1.5)** | 201.0 (-0.5) | 627.0 (-1.0) |
| mnBody s>=0.00 unionH | 27.5 (+2.0) | 213.0 (+11.5) | 607.5 (-20.5) |
| mnBody s>=0.00 faceW 6.0 | 12.0 (-13.5) | 232.0 (+30.5) | 735.0 (**+107.0**) |

- **THE FULL SWAP IS NOT THE CATASTROPHE IT WAS MEASURED AS, BUT IT IS
  STILL A LOSING TRADE.** Corrected, `mnBody s>=0.00` costs **+1.5s
  (man) / +2.0s (woman)** of exposure -- roughly 1.07x the control, not
  2.36x -- for **+22.5s (man) / +11.5s (woman) of FALSE COVER**, not a
  fall. It buys 15.0s / 20.0s of phantom (2.7% / 3.2%), not 176.0s /
  161.5s. The direction the old text argued from (large exposure cost,
  large phantom win, false cover falling) is wrong on every axis except
  the sign of exposure.
- **THE FACE-WIDTH FLOOR STILL DOES NOT RESCUE ANYTHING, because there
  is almost nothing left to rescue.** faceW 2.0/3.0 move exposure
  24.0 -> 23.5 -> 25.0 (man), 27.5 -> 26.5 -> 24.0 (woman) -- noise
  around a ~1.5-2.0s excess, not a 30.5s one. **"IT IS HEIGHT AND IT IS
  OCCLUSION" STAYS WITHDRAWN (phase-g G2), for a different reason now:**
  `ssdUnionH` recovers the man arm's entire (much smaller) excess (+1.5
  -> +0.0) and none of the woman arm's (+2.0 -> +2.0). Neither reading
  supports a height mechanism at this scale. **`s >= 0.40` IS NO LONGER
  DEFENSIBLE AT ALL: 26.0 / 145.0 / 566.0 is WORSE than control on all
  three columns** in his mode (exposure +3.5, false cover +8.5, phantom
  **+18.5** -- it no longer buys any phantom reduction). And
  **`faceW 6.0` REDUCES exposure now (-2.5 man / -13.5 woman)** rather
  than costing 119.5s of it -- the "swallows the neighbour's track"
  mechanism was the missing head anchor, not the width, which G2's
  ledger row corrects in place.
- **EDGE ONLY IS UNCHANGED, because it already carried head fields.**
  EDGE ONLY builds its box as `{...guess, x1, x2, faceBox}`, inheriting
  `personFromFace`'s head anchor directly, so H1 does not touch it: man
  -0.5s exposure / -1.0s false cover / -11.5s phantom, woman +1.5s /
  -0.5s / -1.0s, byte-identical to the published rows. **21a's
  per-window refusal of EDGE ONLY stands as written.**

- **AND THE WHOLE SECTION IS SCOPED TO A REGIME HIS PHONE IS NOT IN
  (phase-g G3).** Every `mnBody` arm needs `parsePersons` to admit
  somebody; where it admits nobody `ssdBoxes` is null and each arm is
  **byte-identical to CONTROL**. On this corpus that is 260 of 2,160
  frames (12.0%). **On his phone it is every frame** -- findings 36
  measured all twelve slots `n:0` with `faceNoShape` 121 of 184 passes.
  So none of the rows above describe what he runs today: the body-source
  question only becomes his question if the `n:0` regime is ever fixed.
  Worse, the CONTROL guard both raws print (the 1091 triple) is
  **structurally blind to this** -- CONTROL never builds `ssdBoxes` at
  all, so the triple reproduces identically whether the body source
  works, is inert, or is broken. It proves the DOWNSTREAM constants, and
  nothing about the arm it is printed beside.

**Raw: `spikes/gauntlet/mnbody-ab.txt`. New: `bench/mnbody-ab.mjs`,
`bench/extent-reach.mjs`, the `mnBody` arm in `arch-arms.mjs`.**


## 21a -- AND THE PER-WINDOW TRACE REFUSES IT: 285 EDGE MOVES, SIX WINDOWS CHANGED, AND 70% OF THE HEADLINE IS ONE OF THEM

21 said the measured edge was better on all three columns in his mode
and named the gate before shipping: a per-window trace and a counter,
because "11.5s of phantom across 2,160 frames could be one window doing
all the work". `bench/mnedge-where.mjs` ran that gate and **it is one
window doing most of the work.**

**MAN (his setting):** the edge moves in 13 of 18 windows, **285 times
against 729 where the branch ran and changed nothing (28.1%)** -- and
only **6 windows' scores changed at all**:

| window | dExposure | dFalseCover | dPhantom | moved | inert |
|---|---|---|---|---|---|
| **KAWvDsghyc8_w552** | 0.0 | **-1.5** | **-8.0** | 43 | 53 |
| 4u3jS_cTHH0_w252 | 0.0 | **+0.5** | -3.0 | 15 | 59 |
| 4u3jS_cTHH0_w1602 | 0.0 | **+1.5** | -0.5 | 30 | 40 |
| KAWvDsghyc8_w152 | -0.5 | 0.0 | 0.0 | 22 | 37 |
| NWoT1ZVd1Lo_w292 | 0.0 | -0.5 | 0.0 | 25 | 39 |
| NWoT1ZVd1Lo_w702 | 0.0 | -1.0 | 0.0 | 37 | 48 |
| **total** | **-0.5** | **-1.0** | **-11.5** | 285 | 729 |

**8.0 of the 11.5 seconds is `KAWvDsghyc8_w552` alone**, and the false
cover column has TWO windows going the WRONG way (+0.5, +1.5) offset by
**three** going the right way (-1.5, -0.5, -1.0). Seven further windows
move an edge 1 to 43 times and change nothing at all. *(That "three"
read "two" when this section was written -- phase-g G10, a miscount of
its own raw, which is why the raw is banked beside it.)*

**WOMAN:** the arm is nearly inert -- **67 moves against 947 (6.6%)**,
4 windows changed, net **+1.5s exposure** for -0.5s and -1.0s, with two
windows paying exposure and **two** windows' phantom going UP (+0.5 and
+1.0). *(Also a miscount when written -- G10.)*

- **SO 21'S "FREE IN HIS MODE" WAS THE TOTAL HIDING THE
  DISTRIBUTION**, which is the exact failure `iou-where.mjs` was built
  for and the exact failure this bullet was written to catch. Recorded
  here rather than edited away, because a refusal that took a purpose-
  built instrument to reach is worth more than the arm was.
- **REFUSED.** A change whose score effect appears in 6 of 18 windows,
  is 70% one window, carries mixed signs in both arms, and costs the
  woman arm exposure, is a coincidence with a mechanism attached -- not
  a mechanism. It ships nothing.
- **THE GENDER ASYMMETRY IS REAL AND THE SENTENCE I HUNG ON IT WAS
  WRONG (phase-g G7).** 28.1% against 6.6% is not noise, and the
  mechanism named above is right: the edge only pulls back where a
  **CLEARED** face with descriptor signal stands beside the subject, and
  in MAN mode men clear. But `mnEdgeInert` fired whether the branch
  found such a neighbour and declined to move, or **found none at all**
  -- and the second dominates, so that ratio was measuring how often men
  clear on this footage, which was already known. Counted apart
  (`mnEdgeOpportunity` / `mnEdgeNoNeighbour`), the branch ran 1,014
  times in both arms:

  | | man | woman |
  |---|---|---|
  | with an eligible cleared neighbour | 348 | 84 |
  | with NONE | 666 (65.7%) | 930 (91.7%) |
  | **edge moves, per OPPORTUNITY** | **81.9%** | **79.8%** |

  **So the arm is NOT "structurally four times more active in his
  mode".** Given a neighbour it behaves identically in both -- 81.9%
  against 79.8%, two points apart. What differs by four times is the
  FOOTAGE-and-mode rate at which a cleared neighbour exists at all.
  **The consequence for future adjacency work reverses**: a woman-mode
  measurement is not "nearly a control", it is the same arm on a
  four-times-smaller sample, so it is under-powered rather than
  structurally inert, and the fix is more woman-mode frames with
  neighbours -- not discounting the arm.
- **WHAT SURVIVES FROM 21, UNCHANGED:** the full swap is refused at
  +30.5s exposure, the face-width floor does not rescue it, and
  `s >= 0.40` remains the only defensible body-source row at -46.0s /
  -25.0s phantom for +6.0s / +5.0s exposure -- strictly the worse buy
  than the coast dial on the same exposure budget, but on a different
  mechanism, so they compose. It is untraced per window and inherits
  this section's warning until it is.

**Raw: `spikes/gauntlet/mnedge-where.txt`. New: `bench/mnedge-where.mjs`,
`mnEdgeMoved`/`mnEdgeInert`/`mnEdgeOpportunity`/`mnEdgeNoNeighbour` in
`arch-arms.mjs`.**


## 22 -- PHASE G: SIX OF TWELVE FINDINGS ARE CHECKS OR INSTRUMENTS THAT COULD NOT SEE WHAT THEY CLAIMED, AND THREE REVERSE A CONCLUSION

Twelve rows, twelve CONFIRMED, none refuted, **no EXPOSURE**. Every one
fixed at source rather than annotated. The shape of the round is the
same as phase F's and worse in one respect: **five of the twelve are
defects in instruments or checks I built IN PHASE F**, one finding
after the critic had already caught the same class.

**THE THREE THAT CHANGE A CONCLUSION, not a number:**

- **G1 -- the synthetic share is 27.5%, not 16.8%.** `extent-reach.mjs`
  re-implemented the face-in-person test: unpadded, and with no
  one-face-per-person rule. The shipped `faceInsideIndex` pads the box
  **10% per axis** and the shipped `claimed` loop gives one box to ONE
  face, largest first -- so a SECOND face inside a box falls through to
  `personFromFace` anyway. Netted, **317 of 1,153 faces (27.5%)**, half
  again the figure section 20 was written on. This is the same defect
  class as G5 one finding earlier: a bench modelling a shipped rule
  instead of calling it. `faceInsideIndex` and `synthFaceIndices` now
  live in `person-gate.mjs`; the app imports them and the bench imports
  them out of the emitted bundle.
- **G2 -- "it is height and it is occlusion" is withdrawn.**
  `ssdUnionH` floors the measured body's vertical extent with the
  guess's and recovers **0.5s of the 30.5s (1.6%)**. And width past a
  point runs the OTHER way: `faceW 6.0` costs **142.0s of exposure
  (+119.5)**, six times the control. So neither axis of the extent is
  the residual, and the sentence that named a mechanism was a guess
  written in the voice of a measurement.
- **G7 -- the edge arm is NOT four times more active in his mode.**
  `mnEdgeInert` fired whether the branch found a cleared neighbour and
  declined, or **found none at all**, and the second dominates. Split
  (`mnEdgeOpportunity` / `mnEdgeNoNeighbour`): the branch runs 1,014
  times in both arms, with a neighbour **348 man / 84 woman**, and per
  OPPORTUNITY the edge moves **81.9% against 79.8%** -- two points
  apart. The 28.1%/6.6% was measuring how often men clear on this
  footage. The consequence reverses: a woman-mode measurement is
  under-powered, not structurally inert.

**THE SCOPE FINDING (G3), which bounds all of 21 and 21a:** every
`mnBody` arm needs an admitted person, so where MoveNet admits nobody
each arm is **byte-identical to CONTROL** -- 12.0% of corpus frames and
**100% of his phone** (findings 36: twelve slots `n:0`). And the CONTROL
triple both raws print is structurally blind to it, because CONTROL
never builds `ssdBoxes`: the guard proves the downstream constants and
nothing about the arm beside it.

**THE CHECKS THAT COULD NOT FAIL, or could fail wrongly:**

- **G4 -- `--test-concurrency=1` was the wrong fix and I wrote down that
  it worked.** Serialising turns THREE stale-cache failures into ONE
  (565 tests, 1 fail), not zero, because the first process to notice
  still throws by design -- and it costs ~30% of every run (16.584s
  against 12.782s). The real fix is a `pretest` that rebuilds ahead of
  every test process; `_build.mjs` now exits 0 when it IS the entry
  point and throws only when imported. **576/576 first run, 13.593s.**
- **G5 -- F4's fix was itself a dead check.** It re-implemented the
  inverse map and never called `unpadPersons`, and it was one-sided. Now
  it compares the shipped output against an independent inverse in both
  directions; red-proved by growing (6.48e-1) and shrinking (6.53e-1)
  the map, green at 2.65e-8.
- **G6 -- the same bench exited 0 while printing "THE INVERSE MAP IS
  WRONG".** Both failure modes exit 2 now, vacuity included.
- **G9 -- the counter-collision sweep matched TEXT, not writes.** Three
  comment lines in `init-entry.js` explaining that `clampFired` was
  taken counted as ownership, and the red-proof fixture demonstrated
  only that a twice-MENTIONED name trips it. Comments are stripped and
  only a bump SITE counts; the rule is structural (a `life` property, a
  quoted literal on a bump-shaped call, or a seed to 0) because
  enumerating helper names is how a check like this goes stale -- the
  first two attempts reported ZERO owners for `clampFired` itself, which
  bumps out of a ternary.
- **G8 -- `assignFellBackGreedy` could not be told from never-hooked.**
  Seeded to 0 at the one call site that knows the optimal assignment is
  about to run, and only in that mode, so a constant 0 in greedy mode
  cannot read as a measurement.

**G10 and G11 are miscounts of my own banked raws** (21a's false-cover
column reads three windows improving, not two; the woman arm has two
windows' phantom rising, not one; the G5 red-proof reads 1.938, not
0.699). **G12** narrows F2's justification: keypoints ARE also read as
absolute positions, and unclamped is still right -- but because every
consumer is monotone toward COVERING, not because no consumer reads a
position.

**THE PATTERN WORTH CARRYING:** phase F's lesson was "a check that
cannot fail is worse than no check". Phase G's is one layer up -- **an
instrument that re-derives a shipped rule is a check that cannot fail,
and I built three of them in one session** (G1, G5, G9), each after
writing down the rule that forbids it. The remedy that worked all three
times is the same: move the rule into a module, call it from both
sides, and delete the copy.

**Raw: `spikes/gauntlet/extent-reach.txt`, `mnbody-ab.txt`,
`mnedge-where.txt`. Critique: `docs/critic/phase-g.md`.**


## 23 -- CORRECTED (phase-h H1): the deleted observations were the mechanism, and the measured body does not track better

**This section originally read "the measured body tracks better on
every count and is 2.4x worse on exposure". That headline is
WITHDRAWN. `bodyFromSsd` (bench/arch-arms.mjs) emitted a box with no
head anchor, so `sameHuman` merged distinct people 60%-contained on
each other's boxes -- the observations reaching `updatePersonTracks`
fell 1,218 -> 1,101 (-9.6%) on the man arm. Fewer observations is not
better association; it is fewer people being tracked at all. H1
(phase-h critic) found it, the head fields are restored at source
(`bench/arch-arms.mjs`'s `bodyFromSsd`), and the table below is the
re-run.**

G2 left 83% of the (since-corrected) body source's exposure cost with
no geometric explanation. The obvious remaining suspect was the
decision layer, and it is the one the standing brief points at first:
IoU is computed between observation boxes and track boxes, so changing
the body source changes every IoU in the system, and a subject whose
box changes shape mid-shot fails to re-associate.

**THE PREDICTION WAS WRITTEN INTO THE BENCH BEFORE THE RUN** -- if this
is an association problem `birthNearMiss` rises sharply and `birthFresh`
does not -- **and, corrected, it is CONFIRMED, not falsified.**

| | man CONTROL | man `s>=0.00` | woman CONTROL | woman `s>=0.00` |
|---|---|---|---|---|
| exposure | 22.5 | 24.0 (+1.5) | 25.5 | 27.5 (+2.0) |
| births | 141 | 139 (-2) | 136 | 133 (-3) |
| `birthFresh` | 38 | 43 (+5) | 38 | 40 (+2) |
| `birthNearMiss` | 43 | **30 (-13)** | 34 | **27 (-7)** |
| `birthContended` | 60 | **66 (+6)** | 62 | **66 (+4)** |
| `coastExpired` | 96 | 96 (+0) | 92 | 88 (-4) |

**The measured body does NOT associate better on every count.**
`birthNearMiss` falls, as the association hypothesis predicted -- but
`birthContended` RISES (+6 man, +4 woman) and `coastExpired` is flat
(man) or falls slightly (woman), not "far fewer". The cost is
**+1.5s (man) / +2.0s (woman) of exposure**, roughly 1.07x the control,
not 2.4x.

- **THE FALSE COVER COLUMN MOVES THE OTHER WAY FROM WHAT WAS
  PUBLISHED, and this reverses the mechanism sentence rather than just
  its numbers.** False cover RISES **+22.5s (man) / +11.5s (woman)**
  (`bench/mnbody-ab.mjs`), not falls. So "strip the fat and some of what
  it was covering was people who should not be" is backwards: with the
  deleted observations restored, a measured body covers MORE, not less
  -- findings 20's "the fat guess covers people by accident" is not
  what this arm shows once it is measuring itself correctly.
- **"1091's ASSIGNMENT LOOK CHEAPER THAN IT IS" IS WITHDRAWN.**
  `birthContended` is **47.5% (man, 66/139) / 49.6% (woman, 66/133)**
  of births on the measured body -- HIGHER than the synthetic guess's
  42.6% / 45.6% (findings 17), not lower, and no longer supports "37%
  (man) / 42% (woman) of it is manufactured by the guess overlapping
  itself". A measured body source gives the Hungarian assignment MORE
  to contend over, not less; 17's numbers stand uncorrected.
- **WHAT SURVIVES.** The direction of the exposure/false-cover trade is
  unchanged -- a measured body still costs exposure and still is not
  free -- and it is still an EXPOSURE trade and HIS call, like every
  other one in this file. What does not survive is the scale (a
  rounding error, not "more exposure than this repo has ever spent")
  and the claimed mechanism (deleted observations, not a cleaner box).
- **SCOPE, inherited from G3 and restated because it is easy to lose:**
  every row above is byte-identical to CONTROL where MoveNet admits
  nobody, which is **100% of his phone today**.

**Raw: `spikes/gauntlet/mnbody-births.txt`. New: `bench/mnbody-births.mjs`.**


## 24 -- THE ERROR CLASS NOBODY HAD EVER MEASURED IS SMALL, AND THE INSTRUMENT SAID 31% BEFORE IT SAID 93%

Findings 8 has stood since this file began: **BlazeFace detector recall
is invisible to the corpus scorer by construction** -- it scores the
reads that exist, so a face the detector never found cannot appear in
any arm or any sweep here. Every exposure number in this repo is a lower
bound and nobody knew by how much. §8 proposed an afternoon of hand
annotation.

**IT DID NOT NEED THE AFTERNOON.** A second, independent model is
already banked over all 2,160 frames: MoveNet's facial keypoints. COCO
slots 0-4 are nose, left eye, right eye, left ear, right ear, so a
person whose nose and both eyes are confidently placed is a head facing
the camera at a known point -- produced by a different architecture on
different training data. `bench/face-recall.mjs` asks, for every such
head, whether BlazeFace found a face there.

| kp bar | 0-24px | 24-40px | 40-64px | 64-96px | 96px+ | all |
|---|---|---|---|---|---|---|
| 0.20 | 68.0% (231) | 92.1% (393) | 91.9% (197) | 99.8% (482) | 100.0% (417) | **92.9% (1720)** |
| 0.30 | 71.2% (205) | 92.2% (374) | 94.4% (162) | 100.0% (444) | 100.0% (347) | 93.7% (1532) |
| 0.40 | 74.8% (123) | 94.7% (188) | 96.6% (89) | 100.0% (313) | 100.0% (226) | 95.3% (939) |
| 0.50 | 90.6% (53) | 95.1% (41) | 100.0% (22) | 100.0% (130) | 100.0% (96) | **98.0% (342)** |

- **ABOVE 64px THE TWO MODELS AGREE ESSENTIALLY PERFECTLY** -- 99.8% and
  100.0% at every bar, on 899 heads. There is no missing-face problem at
  native resolution, and the corpus's absolute numbers are not hiding
  one.
- **THE FAILURE IS SIZE-DEPENDENT AND IT LIVES UNDER 40px**, worst in
  0-24px at 68.0%. That is the expected shape for a detector and it is
  the first direct evidence in this repo that BlazeFace's small-face
  behaviour is a real edge rather than an assumption.
- **AND IN HIS OWN BAND IT IS 92-94%.** His player decodes 640x360 and
  faces reach faceres at **px p50 38-62** (loop 38), which straddles the
  24-40 and 40-64 rows. So on the order of **6-8% of frontal heads in
  his regime are not found**, and every exposure figure quoted for his
  regime is understated by at most about that.
- **THE TREND ACROSS THE BAR IS THE MOST INFORMATIVE COLUMN, and it
  argues the residual is mostly NOT BlazeFace.** Agreement rises
  monotonically as MoveNet is asked to be more certain the head faces
  the camera: **92.9% -> 93.7% -> 95.3% -> 98.0%**. If BlazeFace were
  the weak half the rate would be flat in the bar and steep in px; it is
  steep in px only in the 0-24 band, where MoveNet's own eye-distance
  estimate (which is what sets the px band) is noisiest. The reading:
  most disagreements are MoveNet unsure -- a turned head, a low-quality
  slot -- rather than a face BlazeFace walked past.
- **SO FINDINGS 8's AFTERNOON IS DEPRIORITISED, not cancelled.** The
  never-measured class is bounded small and concentrated below his own
  `FACE_MIN_NATIVE_PX` floor of 40. Hand annotation remains the only way
  to say which model is wrong in a disagreement, and it is the gate on
  ever training a detector for our input distribution -- but it is no
  longer plausibly the largest unclaimed win, and the cadence and extent
  layers keep their priority.

**THE INSTRUMENT REPORTED 31% FIRST, AND 31% IS 1/3.** The first version
passed the frames through `thinFrames(w, K_HIS)` out of habit -- which
is correct for every arm in this directory and wrong for this question.
Thinning moves a non-verdict frame's faces to `_labelFaces` and leaves
`faces` EMPTY, so two frames in three compared MoveNet's heads against
nothing. It printed "68% of frontal heads are missed" and every one of
its twelve disagreement examples said `faces in frame 0`. **Recall is a
property of the detector on a frame, not of the cadence the app runs it
at.** Caught by the ratio being suspiciously exactly the thinning ratio,
which is loop 40's rule running in the third direction: a CATASTROPHIC
result at a familiar-looking number is a claim about the instrument.

**HONEST LIMITS, and they are the whole of what this bench cannot say.**
This is a CROSS-CHECK, not ground truth: a disagreement is one of two
models being wrong and nothing here says which. The frontal gate is a
proxy -- MoveNet emits moderate keypoint confidence on turned heads too
(87.6% of admitted slots clear bar 0.30), which is why the bar sweep
matters more than any single row. And it is scoped to slots MoveNet
ADMITS at `PERSON_MIN_SCORE`: a face in a frame where MoveNet admits
nobody -- **100% of his phone today**, findings 36 -- is outside this
instrument entirely, and that population is unmeasured.

**Raw: `spikes/gauntlet/face-recall.txt`. New: `bench/face-recall.mjs`.**

## 25 -- THE PHONE'S MoveNet WAS NEVER BLIND TO PEOPLE. ITS WebGL RUNTIME WAS.

Every "MoveNet admits nobody on his phone" row this file carries (36, and
everything priced on top of it: 21, 21a, 23, the `CUT_PERSON_LOOK`
ruling, the `PERSON_LETTERBOX` refusal, `frameHasNoHumanShape` firing on
"a blinded model") described the tfjs WebGL runtime on the Adreno 610,
not the model and not the footage.

The measurement, 2026-09-02 (native-inference round, phase-j J16). The
256x256 MoveNet input was dumped OFF THE DEVICE at three timestamps of
NWoT1ZVd1Lo (`spikes/gauntlet/probe_native_framedump.py`, banked
`native-frames-1788346009.json`, 1280x720 source, both the plain canvas
squash and the resizeBilinear-aligned one), and the SAME model was run on
three runtimes none of the device paths use:

| t | tflite CPU f32 | tflite CPU f16 | tfjs CPU | native GPU fp32 (device) | tfjs WebGL (device worker) | native GPU fp16 (device) |
|---|---|---|---|---|---|---|
| 60 | 0.768 / 2 | 0.769 / 2 | 0.768 / 2 | 0.768 / 2 | **0.187 / 0** | lower than the worker |
| 217 | 0.822 / 1 | 0.822 / 1 | 0.822 / 1 | 0.822 / 2 | **0.033 / 0** | lower than the worker |
| 300 | 0.170 / 0 | 0.170 / 0 | 0.170 / 0 | 0.170 / 0 | 0.073 / 0 | -- |

(maxKp / persons admitted at `PERSON_MIN_SCORE` 0.35; `arbiter.py`,
`arbiter.mjs`; the native GPU fp32 column is `native-parity-1788345674.json`;
the worker column is the same file's worker arm; the fp16 column is
`native-parity-1788345089.json`, maxKp p50 0.056 UNDER the worker.)

Four runtimes agree to three decimals. The phone's WebGL worker disagrees
with all of them by an order of magnitude, on frames with two visible
people whose faces BlazeFace finds at IoU 0.93-0.97 in both arms. The
resize convention (phase-j J15) moves maxKp by 0.01 and is NOT the cause.
The uint8 requant is NOT the cause -- every arbiter ran the requant
weights. Adreno 610's reported fp32 shader precision (loop 38's
`probe_glprec.py`) does not save it: whatever tfjs-webgl does with
MoveNet's depthwise convolutions on this GPU loses the keypoint scores,
and the TFLite GPU delegate at fp16 (`setPrecisionLossAllowed(true)`) has
the same disease. fp32 on the delegate does not.

Loop 36's "the model is fine on his phone" (fixed-input worker bench,
20 thumbnails, maxKp p50 0.779 identical to the emulator) is not
contradicted -- that bench read THUMBNAILS through the worker, and it is
possible the failure is specific to the video-frame path (a 1280x720
ImageBitmap through `fromPixels` and resize on the GPU) rather than to
the model graph. It is not resolved either; what is resolved is that the
NATIVE engine at fp32 reads what the reference runtimes read, and it is
the engine the phone will run.

What this re-opens, without re-pricing any of it here:

- **Findings 36 / the R21 regime.** "100% of his phone" was 100% of a
  broken runtime. With native fp32 the phone is in the MoveNet-admitting
  regime the corpus benches model with `mode: 'position'` rather than
  `coast`, and every `hisRegimeOpts` flag chosen to model a MoveNet-blind
  phone (`slots n:0`, face-only bodies) describes 1092, not 1093.
- **21 / 21a / 23 / G3.** Scoped by "byte-identical to CONTROL where
  MoveNet admits nobody -- 100% of his phone". That scope is gone.
- **`CUT_PERSON_LOOK` 0 (I10).** Priced on footage where "every look
  admitted nobody" -- through the blind runtime. Re-price on native.
- **`PERSON_LETTERBOX` OFF (18a, phase-G item 4).** The `movenet-held`
  arm was measuring headroom on a blind arm.
- **`frameHasNoHumanShape` / `PFF_FRAME_KP_FLOOR` 0.1 / `faceNoShape`
  127 per 250s.** The gate refused three faces in four on his phone (loop
  36) because the number it compared against was noise from a runtime
  that could not see the people the faces belonged to. Expect
  `faceNoShape` to collapse on 1093; that is a prediction to read off
  the device, not a claim.
- **The thumbnail path is untouched**: it runs in the worker, and the
  worker's MoveNet is not used there. Nothing in this section changes an
  image verdict.

The cost of fp32 on the delegate: MoveNet+BlazeFace frame 288 -> 350ms
p50, gender per face 176 -> 226ms (parity files above), against the
worker's 743 / 501 on the same frames. Still 2.1x faster, and correct.

## 26 -- THE NATIVE COVERAGE DROP IS PHANTOM LEAVING, NOT PEOPLE UNCOVERED

`probe_latency_ab.py` reads `coverage` as the fraction of rAF frames on
which ANY video patch is visible. On the Redmi the native engine read
0.55-0.58 where the WebGL worker read 0.60-0.64 (1092, and the kill-
switch arm of 1093), in the exposure direction, and the plan log carried
it as a hypothesis: MoveNet's measured body is tighter than the face-
derived synthetic one. Two instruments now answer it, and the hypothesis
is REFUTED while the drop is EXPLAINED.

**Geometry, offline, same frames through both engines**
(`bench/native-body-vs-synth.mjs` over `native-parity-1788354123.json`,
shipped `personFromFace` / `synthFaceIndices` out of the emitted
bundle): worker set = synthetic bodies over the WORKER's own faces;
native set = MoveNet boxes plus synthetic bodies over the faces
`synthFaceIndices` leaves unclaimed, from NATIVE's own faces. 16 frames,
MoveNet admits on 12:

  worker faces 24   native faces 24   frames where they disagree 0
  mean covered area   worker 0.569   native 0.624   (native/worker 1.098)
  worker set NOT covered by native   0.038 of frame, of which inside a
                                     face box 0.0000
  WORKER faces with any sharp pixel on native   0 of 24

The measured body covers MORE, not less, and never leaves a face sharp.

**EACH SET MUST COME FROM ITS OWN ENGINE'S FACES, and until 2026-09-02
this bench built BOTH from `native.faces` (phase-k K13).** That makes it
structurally blind to a face native does not detect at all: the missing
face leaves the worker set, the native set AND the sharp-face
denominator together, so an engine that found nothing would score
perfectly. It is not hypothetical -- on the fp16 dump the same round's
K1 found exactly that frame, and the old bench printed `faces 23` and
`0 of 23 sharp` while t=90 had a close-up with NO patch at all.
Corrected, the fp16 dump reads `worker 24 / native 23 / disagree 1`,
ratio **1.022** (not 1.106), uncovered **0.081** of frame of which
**0.0231 inside a face box**, and **1 of 24** worker faces sharp. The
numbers above are the SHIPPED build (fp32 BlazeFace), where the two
engines agree on all 24 faces; quote them only with that qualifier. The
bench also now takes `_build.mjs`, the freshness guard every other
corpus bench takes -- it FIRED on its first corrected run, so the
previously published figures were scored against a stale
`.cache/shipped.mjs`.

**Track snapshots, on device, both arms of the same build**
(`probe_latency_ab.py` now banks the per-verdict snapshots -- the
`snaps` field -- `latency-ab-native-fp16{,-off}.json`). The per-verdict
table first written here (native: no-blurred-track 0.363, 0.77 tracks
per snapshot, area p50 0.328; worker: 0.421 / 0.72 / 0.282) is a
SAMPLING ARTIFACT (phase-k K2): the two arms snapshot at gap p50 0.80s
against 2.03s, so an unweighted count over-represents the arm that
snapshots more. Weighted by the media time each snapshot stands for:

  | arm | share of media time with a blurred track |
  |---|---|
  | native | **0.643** |
  | worker (NATIVE_INFER 0) | 0.673 |

Native covers LESS, by 0.030 -- the same direction and about the same
size as the frame-level `coverage` difference in the same two files
(0.583 against 0.604). So the snapshot instrument does NOT show the drop
living between verdicts; it shows the drop. What still separates
"phantom leaving" from "people uncovered" is the geometry bench above
(0 of 24 WORKER faces sharp on the shipped build, native area 1.098x) and the exit hang: after a
track dies, the worker arm's patch hangs **30-60 frames** (p50, 1092 and
both kill-switch arms) where the native arm's hangs **0-3**. The worker
arm is told a 2000ms cadence and coasts 4000; native is told ~860-1010
and coasts 2000. A patch that outlives its subject by two extra
seconds, twenty-odd times in 150s, is 0.05-0.06 of `coverage` -- the
size of the drop. That is ONE instrument's account, not two; `coverage`
counts phantom as cover, and nothing measured so far shows a face
uncovered on native that the worker covered.

HONEST RESIDUAL: `toldMs` is a single end-of-run read (the 1093 kill-
switch arm banked 793 with a 2000ms gap), so the coast attribution rests
on the exit-hang p50s, one run per arm.

**And the verdict gap had a floor nobody had priced.** `VERDICT_DUTY`
2 -> 1.5 moved the gap 1213 -> 1180 (3%) because a verdict could only
START at a position-pass slot: `effZoom` was computed BELOW the `now -
lastSample < effInterval` gate, so a due verdict waited for the next
slot (~540ms apart, `lastPassMs * POSITION_DUTY`). Hoisted; a due
verdict starts on the first 120ms sampler tick it is not busy. The
first attempt (a position pass yielding when the verdict would fall due
before it finished) moved the gap 24ms (1213 -> 1189, 1.9%) and cost
26-32% of the position passes (78 -> 53 / 58); it was REMOVED (phase-k
K3/K8). The hoist alone is the fix. What the hoist does not buy: verdict
COST fell 474 -> 355-381ms between the same arms, so ~190ms of the 413ms
is `effZoom = cost * VERDICT_DUTY` shrinking on its own (K7) -- on the
hoisted clock the duty dial is BINDING (slack above effZoom 40ms), and
the share of verdicts dropped by a cut landing mid-pass doubled, 4.7% ->
9.5-10.1% (K6), because a verdict may now start on any 120ms tick.
Numbers in the plan log.


## 27 -- THE DETECTOR-RECALL CLASS IS PRICED AT LAST, AND IT CLOSES THE MODEL QUESTION

`track-accuracy.md` s6.2 named one measurement as the gate on the entire
model programme: the 119 person-instances seen by NEITHER model
(finding 24 / s11) had only ever been counted as INSTANCES, and the unit
the owner experiences is SECONDS. Every model-vs-pipeline argument this
repo has had was conducted on the set where a detection already
happened, because `corpus-score.mjs` says so in its own header: *"labels
cover faces the DETECTOR FOUND. A person BlazeFace never detected is
invisible here."*

`bench/recall-seconds.mjs` converts one into the other. It replays the
SHIPPED decision layer through `corpus-score.replay` -- not a
re-derivation, because this repo has re-implemented a shipped rule and
published the wrong number for it three times (phase-g G1/G5/G9) -- and
charges EXPOSURE only for an ssd person-instance with **no face
evidence and no pose evidence**, so nothing already scored is charged
twice.

**IT RECONCILES WITH THE EXISTING INSTRUMENT EXACTLY**: 2,131
instances, 1,706 by face (80.1%), 306 pose-only (14.4%), 119 missed
(5.6%) -- the same three numbers `detector-recall.mjs` publishes.

### The price, man mode (his setting)

| attribution arm | BOX cover | HEAD-band cover |
|---|---|---|
| LABELLED only (floor) | 3.5s | 4.0s |
| **PRIOR-weighted (best)** | **18.3s** | **19.5s** |
| ALL misses cover-worthy (ceiling) | 28.5s | 31.5s |

Woman mode: 1.0 / **5.7** / 22.0s (BOX). Attribution is weak by
construction -- a missed person has no face crop, so she has no label;
the nearest labelled face in the window says who tends to stand there.
So the answer is a RANGE and is reported as one. The PRIOR arm charges
unattributed and `mixed` misses at the corpus's own cover-worthy share
among labelled misses (70.4% man / 27.8% woman).

### Sensitivity: every arm lands in the same place

| arm | missed | man PRIOR (BOX) | ceiling |
|---|---|---|---|
| default | 119 (5.6%) | 18.3s | 28.5s |
| `HEAD_BAND` 0.35 (stricter containment) | 223 (10.5%) | 19.6s | 44.5s |
| `SSD_MIN` 0.7 (higher-confidence ground truth) | 21 (1.5%) | 3.1s | 4.2s |

**No arm reaches 60s, and the most pessimistic reasonable one -- strict
containment, every miss counted cover-worthy, head-band coverage --
tops out at 48.5s.** The gate's own words: *"X < 20s -> the model
question is closed for good. Every remaining accuracy day belongs to
the decision layer."* The best estimate is 18.3-19.5s and the whole
distribution sits under the 60s that would have justified a detector
project.

**READ IT WITH THE CEILING BESIDE IT.** Against man-mode scored error of
491.5s, this class adds ~19s -- about 3.7%. A perfect gender model is
worth 67.5s (13.7%) and a perfect model plus a perfect face/non-face
gate 95.5s (19.4%). Adding the miss class to the oracle's blind spot
does not change the conclusion it was raised against: **the decision
layer and the clock still own 70-85% of the error.**

### The finding nobody was looking for, and it is the useful one

**52-63% of missed people are ALREADY under somebody else's patch**
(man 62 of 119 by box / 56 by head band; woman 75 / 70). The
solid-patch rule -- his own ruling, and the one this repo keeps paying
false cover for -- is silently covering half of the class a detector
project would have been built to fix. That is why the seconds are small
while the instance count is not, and it is invisible to any
instrument that counts detections.

At `SSD_MIN` 0.7 the miss class nearly vanishes (119 -> 21, 5.6% ->
1.5%), so most misses sit on coco-ssd's own marginal detections. Its
header caveat -- *"coco-ssd has its own misses"* -- cuts in both
directions and is the reason this stays a LOWER bound on the seconds
and an UPPER bound on our recall.

### What this closes and what it does not

CLOSED: BlazeFace/MoveNet recall is not what stands between this product
and "much nicer". A student, a new detector and a teacher ensemble are
all now competing against ~19s of a 491.5s total.

NOT CLOSED, and unchanged by this: the 92-94% face recall in his own
38-62px band (finding 24), which is a recall number on faces coco-ssd
also declines to call people; and the whole-frame path on the four
non-YouTube platforms (s16), which this corpus cannot see.

## 28 -- THE THUMBNAIL CLEAR BAR HAD NEVER BEEN SWEPT, AND ABOVE 0.35 IT BUYS ALMOST NOTHING

`GENDER_IMAGE_MIN_SCORE` 0.4 decides every thumbnail on the feed:
`flaggedFaceIndices` clears a face only when it is same-gender AND adult
AND `score >= 0.4`. The VIDEO pair (`GENDER_CLEAR_SCORE` 0.45 /
`_FEMALE` 0.35) has been swept four times -- `clear-bar-roc`, `bar-ab`,
`bar-risk`, `critic-lowbar`. The image bar had been swept **zero**
times. It was set on 2026-08-28 by looking at a distribution after the
crop-squash fix, not at a curve. `bench/image-bar-roc.mjs` sweeps it,
both directions, on two independent ground truths.

**THE STRUCTURAL FACT FIRST, because it changes what the bar even is.**
An opposite-gender face is flagged by the `!same` test, not by the
score test, so the bar CANNOT protect against a correctly-read
opposite-gender face. Its entire job is: *when the model says
same-gender, how sure must it be.* Every exposure in the tables below is
a MISREAD.

### Arm 1 -- 25 real faces re-read at nine sizes (faceres-at-native truth)

Exposure reaches **0 at bar 0.35 and stays 0 to 0.90**, while false
cover climbs 7.7% -> 11.5% -> 19.2% -> 82.7%. Phantom is flat
(39 -> 44 of 509). So on this arm everything above 0.35 is pure cost.

**AND THE ARM IS TOO THIN TO MOVE A DIAL ON.** The whole result rests
on **4 misread instances belonging to 2 subjects**, all female->male at
32-48px. One of the four (childP 0.316) is caught by the child gate
regardless of the bar, and two more score 0.159 and 0.029. So a single
instance -- `X0Qyuw5ietg` at 32px, **score 0.321** -- sets the floor,
and 0.35 clears it by **0.029**. That is calibrating against one
subject's margin, which is the trap `PFF_FRAME_KP_FLOOR` 0.12 was
refused for.

### Arm 2 -- 2,385 HUMAN-labelled corpus reads (man 1,410 / woman 975)

Video crops rather than thumbnails, so it cannot answer "how does a feed
thumbnail behave". It answers the only question the bar decides, which
is identical on both paths, with two orders of magnitude more data and
strictly better truth.

**man mode** (his setting):

| bar | false cover | exposure | phantom |
|---|---|---|---|
| 0.25 | 34 (2.4%) | 48 (4.9%) | 12 (8.9%) |
| 0.30 | 48 (3.4%) | 43 (4.4%) | 17 (12.6%) |
| **0.35** | **65 (4.6%)** | **38 (3.9%)** | **20 (14.8%)** |
| **0.40 SHIPPED** | **94 (6.7%)** | **36 (3.7%)** | **24 (17.8%)** |
| 0.45 | 149 (10.6%) | 35 (3.6%) | 25 (18.5%) |
| 0.60 | 416 (29.5%) | 30 (3.1%) | 30 (22.2%) |
| 0.90 | 1105 (78.4%) | 26 (2.7%) | 31 (23.0%) |

**0.40 -> 0.35 buys 29 fewer false covers and 4 fewer phantoms for 2
more exposures** -- a 16:1 trade in the direction of his oldest
complaint ("it blurs males"). 0.40 -> 0.30 is -46 false cover / -7
phantom for +7 exposure. Above 0.35 exposure is nearly flat: from 0.35
to 0.90 it falls by **12 reads** while false cover rises by **1,040**.

**woman mode, and here the bar is free money:**

| bar | false cover | exposure | phantom |
|---|---|---|---|
| 0.20 | 373 (38.3%) | **37** | 31 |
| 0.40 SHIPPED | 532 (54.6%) | **37** | 31 |
| 0.55 | 629 (64.5%) | **37** | 31 |

**Exposure is PINNED at 37 from 0.20 to 0.55 while false cover climbs
16 points.** In woman mode the bar buys literally nothing above 0.20
and costs 159 covered women. That is a pure cost with no benefit and it
does not need an exposure ruling, because there is no exposure to
trade.

### What this says

- **0.40 is above the knee in both modes.** The defensible move is
  **0.35**, which both arms support and which arm 2 powers properly.
- It is still an EXPOSURE trade in man mode (+2 reads), so **it is his
  ruling**, not mine. In woman mode it is not a trade at all.
- 54.6% of woman reads are covered in woman mode at the shipped bar --
  that is M-4 (7 of 22 woman clusters below 50% accurate) surfacing on
  a second instrument, and no bar setting fixes it.

**HONEST LIMITS.** Arm 1's truth is faceres at native resolution, not a
human, so it can only see a face the model gets wrong AS IT SHRINKS --
never one it reads wrong at every size. Arm 2's population is video
crops at 640x360, not feed thumbnails. Arm 1's non-face column is crops
where BlazeFace found nothing, FORCE read; in production gender only
runs on boxes BlazeFace produced, so it is a refusal rate on face-free
crops and not a prediction of how many patches leave his feed.
`FACE_MIN_CONFIDENCE` 0.35 is upstream of both arms (the crops are
already detections) and remains unswept.

## 29 -- A DYNAMIC CLEAR BAR LOOKS LIKE FREE MONEY IN SAMPLE AND DOES NOT SURVIVE A HELD-OUT SPLIT

His question: *"By any chance, can there be a dynamic mode?"* -- a bar
that asks "sure enough GIVEN what else I know about this crop" instead
of one threshold for every read. `bench/image-bar-dynamic.mjs` answers
it on the 2,520 human-labelled reads finding 28 assembled.

**THE ONLY WAY A DYNAMIC BAR CAN WIN is on an axis carrying information
the SCORE DOES NOT ALREADY CARRY.** A dial keyed on a function of the
score is the same bar wearing a hat -- the circularity loop 38 published
and retracted (`score` is `2|raw-0.5|`, so "his reads read 0.23 like the
non-face arm's 0.234" merely restated "they are in band").

Three axes, all banked per read: `nm` (measured non-circular -- pearson
with |v-0.5| is 0.464 overall but collapses to -0.21..+0.30 inside a
narrow v slice), `px`, and BlazeFace `conf` (on the list to be refuted:
loop 35 measured refused vs kept faces at conf p50 0.74 vs 0.76).

**THE SHIPPED RULE IS NOT RE-IMPLEMENTED.** Evaluating the shipped
`flaggedFaceIndices` at bar 0 and bar 1.01 decomposes every read exactly
-- always-flagged 843 (`!same` or `!adult`), score-GATED 1,510,
nullMint-skipped 167 -- and the dynamic policy is applied to the gated
set alone.

### In sample it wins, at IDENTICAL exposure

| target exposure | fixed | best dynamic | gain |
|---|---|---|---|
| 36 (today's) | 94 (bar 0.40) | `px >= 64 ? 0.32 : 0.40` -> 80 | **14 fewer** |
| 38 | 56 (bar 0.33) | `nm >= 6 ? 0.32 : 0.33` -> 53 | 3 fewer |
| 41 | 52 (bar 0.32) | `px >= 64 ? 0.28 : 0.32` -> 48 | 4 fewer |

**A CORRECTION MADE BEFORE THE NUMBER WAS BELIEVED.** The first version
swept the fixed bar at 0.01 and the dynamic pair at 0.05, so the dynamic
search could not express the policy it was scored against and one row
reported a dynamic LOSS of 8 that was purely the resolution gap. A
comparison whose two arms search different spaces measures the spaces.

### Held out, it does not

Leave one VIDEO out (not one read -- reads in a video share a subject, a
camera and a lighting setup, so a read-level split leaks across the
fold; `critic-lovo.mjs` set that precedent here). **Both** families are
refitted on each training fold, because scoring a refitted dynamic
policy against a frozen fixed bar credits the dynamic family with the
refit.

| | false cover | exposure |
|---|---|---|
| FIXED | 93 | 37 |
| DYNAMIC | 78 | **43** |

Dynamic won 6 folds, lost 1, tied 3 -- but it **did not hold exposure**.
Out of sample it buys 15 fewer false covers for **6 more exposures**,
which is a 2.5:1 trade, not the free win the in-sample table shows at
identical exposure. A policy that lowers one error by raising another
has moved along the fixed bar's own curve; it has not beaten it.

**VERDICT: ship the fixed bar. The 14-at-identical-exposure gain was the
search fitting this corpus.** ~670,000 policies were evaluated against
2,520 reads; that is what a data dredge looks like from the inside, and
the held-out split is the only thing that could tell the difference.

### The useful part of the negative result

`px`, `nm` and `conf` all describe **the same crop the model already
looked at**. That is why none of them generalises: they are not
independent evidence, they are re-descriptions of the input. The first
genuinely independent signal anyone has proposed for this decision is
TEXT -- title, description, captions -- which comes from outside the
pixel pipeline entirely and, uniquely, is available **before the first
frame is decoded**. Whether it carries signal is unmeasured; the corpus
banks no captions or descriptions, so it is a day of banking away from
being answerable. Recorded here so the next attempt at a dynamic bar
starts on an axis that could in principle win.


## 30 -- HEAD POSE IS REAL AND FACE SIZE IS A PASSENGER, ON THE SAME CONTROL THAT KILLED SIZE ONCE BEFORE

His hypothesis, in his words: *"it's generally the more smaller, a bit
smaller opposite gender frame, or like the pose which isn't directly on
camera, that kind of poses or like side face etc."* Two claims. One
survives, one does not, and the instrument that separates them is the
within-identity control (M-4a), where each subject is their own control
so a hard SUBJECT cannot masquerade as a hard CONDITION.

BlazeFace's six landmarks were already decoded and thrown away
(`face-decode.mjs` writes `marks` on every face; the comment above the
download said "12 landmark values we ignore" and was stale).
`src/face-marks.mjs` turns them into scale-free geometry, of which the
load-bearing one is **asym** -- the nose's offset from the eye midpoint
in interocular units, i.e. a yaw proxy. `bench/yaw-slice.mjs` re-runs
BlazeFace over the 2,385 banked crops for landmarks the bank predates,
joins to the 107 human labels, and slices.

Women only, within-identity:

| condition | accuracy change | clusters worse / better |
|---|---|---|
| turned head, asym >= 0.20 | **-10.0 pts** | 5 / 2 |
| turned head, asym >= 0.25 | -11.1 pts | -- |
| tilted head, tilt >= 5 deg | **-4.5 pts** | 8 / 1 |
| detector conf >= 0.72 | **+7.3 pts** | 6 worse below / 0 |
| **face size 40-64px vs >96px** | **+0.1 pts** | **3 / 4, 2 flat** |

The raw size gradient is dramatic -- women wrong 24.6% at 40-64px against
5.0% above 96px -- and it is **entirely between-subject**. Within a
person it vanishes. That reproduces M-4a on a second cut and it is the
second time this repo has had to kill the face-size story with the same
control.

**A CORRECTION TO MY OWN FIRST READ, recorded because the mistake is
reusable:** the first within-identity control on `asym` was cut at 0.1,
which is the MEDIAN, so it split easy-from-easy and read +0.7 pts -- a
null. The band table shows the jump is at 0.2. Re-cut there it is -10.0.
A control cut at the median of the axis measures nothing; cut it where
the band table says the effect is.

**AND ONE ARM MEASURED NOTHING AT ALL:** the `earSpan >= 1.8` control
returned 0 clusters, because earSpan is ~2.03 for essentially every
face, so nothing fell below the cut. Reported as inert rather than as a
null.

**UNCHECKED BIAS, stated because it runs the dangerous way:** only
successfully re-detected crops were banked, so the 226 crops BlazeFace
failed to re-detect are absent from `yaw-rows.json` and their pose
distribution cannot be tested from that file.

### What was built on it, and what it is worth

`src/face-align.mjs` (**nothing calls it**) is the candidate fix: eyes to
a fixed place, eye line level, the dlib/FairFace alignment convention
every face-attribute model in this lineage is trained on and that
`squareBox` does not produce. It is split into TWO arms on his own
instruction ("make sure we're optimized on performance as well"):

- `eyeRect()` -- centre and scale on the eyes. **A different rectangle,
  so `cropAndResize` takes it at exactly the price the shipped path
  already pays.** Zero extra ops, zero extra fence waits.
- `alignTransform()` -- eye-rect PLUS rotation. Needs
  `tf.image.transform`, which takes ONE transform per image, so N faces
  is N ops and N fence waits against the shipped path's one. **Not
  free**, and it has to beat the free arm to be worth a per-face GPU call
  on a Helio G85.

`bench/crop-align-ab.mjs` prices all three against the human labels, on
re-decoded frames (re-cropping the banked crops would measure arm 1
against arm 1, since those crops were already cut by `squareBox`). **The
A/B had not returned when this was written.**

## 31 -- THE GENDER HEAD HAS A SEVERE, RACE-CORRELATED FEMALE-RECALL DEFECT, AND IT IS A SHIFT RATHER THAN A SPREAD

Every accuracy number this repo owns came from ten YouTube videos of
mostly white tech presenters, so "is the gender head worse on some skin
tones" had never been asked in either direction. FairFace exists for
exactly this: 108,501 Flickr faces balanced across seven race groups.
**Dataset licence CC BY 4.0 -- commercial use with attribution,
re-verified live on 2026-09-03**, which closes the licence column the
September research had flagged as never web-checked. Their trained
checkpoints carry NO licence (the repo has no LICENSE for them) and are
not used; only the images.

`bench/fairface-bias.mjs`, 1,400 adults (100 per race x gender, fixed
seed, 0.25-padding validation split), through the SHIPPED chain --
`detectFaceBoxes` then `classifyFaceGenders({square:true})`:

    read 1,348 of 1,400 (BlazeFace found no face in 52)
    OVERALL wrong 19.4% [17.3-21.6]
      truth female 36.0%      truth male 2.3%

    women wrong, by race        men wrong
      Indian          52.6%      0.0%
      Black           51.5%      1.1%
      Middle Eastern  33.7%      0.0%
      White           31.6%      0.0%
      East Asian      29.2%      7.2%
      SE Asian        28.6%      5.1%
      Latino          25.3%      2.1%

Under the SHIPPED image rule (man mode: read male AND score >= 0.40 ->
cleared -> she stays sharp) **Black 24.7% and Indian 21.6% of women are
exposed, against White 3.1% and East Asian 3.1%.** He is in India. This
lands on his actual feed.

This reproduces the 2018 Gender Shades result almost exactly, which
corroborates the harness rather than suggesting a bug in it.

### It is not calibration, and moving the line does not fix it

Raw sigmoid medians: Black women 0.53, Indian women 0.55 -- sitting ON
the 0.50 fence -- against White women 0.25 and Latino 0.21. The female
distribution is **BIMODAL**: 257 of 683 women pile up below 0.2, a dip at
0.3, then a second pile of 181 at 0.5-0.7 which is substantially the
Indian and Black women. **That is a systematic SHIFT for darker skin, not
extra noise**, which is the easiest kind of defect for retraining to
remove and the hardest for a threshold to touch.

Best global threshold is **0.65, not the shipped 0.50** (80.6% -> 85.7%).
But it trades rather than fixes: at the image bar, women exposed
9.5% -> 4.8% while men falsely covered 22.6% -> 36.5%. And for Indian
plus Black women **even T = 0.70 leaves 11.3% exposed against 4.0%
overall** -- the gap does not close, because separability itself is worse:
AUC Black 0.868 and Indian 0.898 against Middle Eastern 0.982, Latino
0.977, White 0.967, ALL 0.932.

**PER-RACE CALIBRATION IS OFF THE TABLE ON PRINCIPLE, not on
measurement.** Correcting per face would require inferring skin tone,
which is biometric categorisation on a sensitive characteristic -- the
exact clause (AI Hub Model License 2.c) that killed the Qualcomm NPU
delegate in loop 47. Do not propose it again.

### What this makes the fix

A better gender model. Measured comparison of what is available:

| model | FairFace gender | size | licence |
|---|---|---|---|
| **ours (faceres)** | **80.6%** | 7MB | MIT, clean |
| dima806 ViT-base | 93.4% | 343MB, 49.7MB smallest quant | Apache-2.0, clean |
| prithiv SigLIP2 | 97% (own test) | ~370MB | Apache-2.0 |
| AgeRaceGenderNet | not reported | 114MB | MIT code, UTKFace = non-commercial |
| FairFace res34 | -- | ~85MB | **weights: no licence** |
| InsightFace genderage | -- | **1.3MB** | **non-commercial** |

**Nothing is small AND clean AND better.** Every big model beats us by
13+ points; every small model is licence-poisoned. `yakhyo/fairface-onnx`
states its weights are CC BY 4.0 -- **that is a conflation**; the upstream
repo licences only the images. Do not rely on it.

What the search did buy is that the DISTILLATION job got cheaper, not
the shopping trip: dima806's ViT is an Apache-2.0 teacher available
today, and FairFace is a CC BY 4.0 training set available today. Both
halves that were priced as work in `distill-2026-09-03` already exist.

### The measurement that must be repeated before quoting any of this

FairFace crops are ALIGNED (their README: dlib `get_face_chip()`), 224px,
and single unoccluded portraits. Production input is a raw detector box
off a 640x360 stream at 38-62 native px. **So 36.0% is the model's GOOD
DAY** and the real number is worse. Relatedly, `bench/wild-signals.mjs`
finds wrong reads come from measurably blurrier crops (Laplacian variance
p50 284 against 425 for right reads), which is independent support for
the untried stream-resolution lever -- his player takes 640x360 because
m.youtube sizes quality off a 393px player box, not because the link is
slow (9.6 Mbps, 1080p offered).

## 32 -- THE FAILURE IS PER-PERSON AND DETERMINISTIC, WHICH KILLS EVERY TEMPORAL IDEA AT ONCE

`proof-gates.mjs` priced his own design instinct -- *"we just find the
male and we are sure about him and then the rest we already know"* -- and
found it already shipped and already working: on the corpus the clear
rule leaks **1.1% of women per read** at 11.2% false cover on men.

**That 1.1% is a misleading average and the per-person cut is the finding:**

    22 women in the corpus
      19 leak on ZERO reads
       2 leak on exactly one read (2.9%, 1.3%)
       1 leaks on 8 of 8 -- every read she has

So it is not "1 frame in 100 slips". It is **one woman in 22 is invisible
to this app, permanently**. And on FairFace-like faces that ratio is
roughly one in four.

Three consequences, all of which close ideas that looked good an hour
earlier:

1. **Multi-frame voting is worthless.** Errors are not independent draws;
   the same face gets the same wrong answer. `bench/wild-signals.mjs`:
   the fully-leaking woman's LOWEST raw over all 8 reads is 0.73. There
   is no good frame to find.
2. **Steadiness is worthless in the direction that matters.** She is
   perfectly steady and perfectly wrong. Measured: steady-2 moves
   exposure 1.1% -> 0.8% for false cover 11.2% -> 18.3%.
3. **A persistent identity memory ("passport") is ACTIVELY WORSE for
   her** -- it would stamp the wrong verdict and hold it. The passport
   idea is only safe on top of a decision that is right.

Best-frame picking out of the 1.5s delay ring survives for the mild
cases (2 of 3 leaking women read correctly on most of their frames) and
cannot touch the hard one.

### The gates, priced one at a time

Per read, at the shipped clear bar. Baseline exposure 1.1% / false cover
11.2%:

| gate | exposure | false cover |
|---|---|---|
| asym < 0.20 | 1.0% | 30.2% |
| tilt < 5 | 0.7% | 57.2% |
| conf >= 0.72 | 0.4% | 34.9% |
| **px >= 56** | **0.2%** | **22.1%** |
| nm >= 8 | 0.7% | 22.6% |
| steady K=2 | 0.8% | 18.3% |
| all stacked | 0.2% | 73.0% |

**Every gate is a bad deal on this corpus and the reason is that the
corpus is at ceiling** -- 1.1% is nearly nothing to win, so any extra
demand only buys false cover. Face size is the least bad. These numbers
must be re-derived on FairFace-like faces, where there is 9.5% to win,
before any of them is refused for good.

### Judging against the room

`bench/room-relative.mjs`. **Only 43% of reads have another face in
frame**, so whatever this buys, it buys on a minority. On those reads,
adding "refuse to clear a face more than 0.10 below the highest-scoring
face in the same frame" moves exposure **2.3% -> 0.6%** for false cover
11.7% -> 18.6%, and it catches the fully-leaking woman (her gapMax runs
-0.15 p50, worst -0.22) where her absolute score cannot.

As a signal ALONE the gap separates worse than the raw score (women p90
-0.14 against men p10 -0.13, versus raw's 0.59/0.72). The gain is from
the conjunction, not from the gap being better. Known hole: in a frame of
two women the higher-scoring one becomes the reference and walks free.

## 33 -- THE FREE RELIABILITY SIGNALS ARE REDUNDANT WITH THE BAR WE ALREADY GATE ON

Five quantities already computed on every read lean the same way on a
wrong read (`bench/wild-signals.mjs`, right p50 vs wrong p50): descriptor
magnitude `nm` 9.70 / 7.23, detector `conf` 0.75 / 0.65, age-posterior
entropy 3.73 / 4.06, `px` 78.4 / 54.7, crop sharpness 425 / 284. That
looks like an uncertainty model waiting to be assembled.

`bench/distrust.mjs` assembles it -- six-feature logistic regression,
leave-one-VIDEO-out, train-fold standardisation only -- and it separates
beautifully: distrust p50 **0.08 on right reads against 0.83 on wrong**.

**As a veto it buys exactly nothing.** Exposure stays 1.0% at every
threshold from 0.80 down to 0.30 while false cover climbs 12.9% -> 16.7%.
The learned weights say why: `certainty` carries -2.068 against nm's
-0.300 and everything else under 0.15. **The distrust score is mostly the
model's own certainty re-derived, and the shipped clear rule already
gates on certainty.** The other four signals describe the same crop the
model already looked at -- re-descriptions of the input, not independent
evidence, which is the same conclusion finding 29 reached about a dynamic
bar.

Two further arms, same session, same shape of answer:

- **Linear probe on the 1024-d descriptor** (`bench/desc-probe.mjs`,
  leave-one-video-out, class-weighted): overall 9.4% wrong against the
  head's 6.7%. It LOSES. But it is better on women (7.2% vs 15.8%) and
  much worse on men (11.0% vs 0.4%) -- the head is male-biased and the
  probe is balanced.
- **k-NN on the same descriptor** (`bench/wild-signals.mjs`, K=1/5/15):
  16.2-16.5% wrong overall, women 10.6-11.6%, men ~20%. Same shape.

**So the descriptor is consistently better on women and worse on men,
twice, by two methods.** That makes it useless as a replacement and
possibly useful as a one-way VETO -- "the fingerprint says woman,
therefore do not clear" -- which is untested. Caveat that bounds both
arms: 1024 free parameters fitted on 52 people is badly under-powered,
and the honest version of this test fits on FairFace's 108,501 faces,
where the 52.6% actually lives.

**A NOTE ON WHAT NONE OF THIS SESSION MEASURED.** Every number above is
conditional on DETECTION -- the corpus reads exist because BlazeFace
found a face, and the FairFace table scores the 1,348 crops it found a
face in. A face the detector walks past gets no read, no track and no
patch, and is invisible to all of it by construction. One hint that the
class is real: BlazeFace found nothing in 52 of 1,400 clean aligned
224px portraits. `bench/detect-recall.mjs` pastes known faces at chosen
native sizes into a 640x360 frame to price it; it had not returned when
this was written. It measures RECALL only -- one face is present, so it
is structurally blind to the false-positive side, which is his "random
blur marks" complaint and is a different bench on different data.


## 34 -- FACE ALIGNMENT LOSES, BOTH THE FREE VERSION AND THE EXPENSIVE ONE, AND R26 WAS RIGHT ALL ALONG

Every serious face model in the literature aligns before it classifies:
rotate the face so the eyes sit on a fixed pair of pixels, then crop. It
is the single most standard preprocessing step in the field, our
detector already hands us the eye landmarks for free (`face-decode.mjs`
writes `marks`), and we do not do it. That gap looked like the largest
unclaimed win in the pipeline.

It is not a win. It is a large, decisive loss.

`bench/crop-align-ab.mjs` ran three crop geometries over the SAME 2,385
labelled reads, all through the shipped `classifyFaceGenders`, one row
per read carrying all three answers -- so the comparison is paired and no
arm can win by being asked easier questions. Scored by
`bench/crop-align-score.mjs`.

| arm | wrong | wrong on women | wrong on men | exposure | false cover |
|---|---|---|---|---|---|
| **shipped** `squareBox` at FACE_ENLARGE 1.4 | **6.7%** | **15.8%** | 0.4% | **1.0%** | **12.9%** |
| `eyeRect` -- eye-anchored rectangle, FREE | 12.0% | 29.1% | 0.1% | 2.9% | 16.0% |
| `alignTransform` -- full similarity warp, COSTS | 11.8% | 28.8% | 0.0% | 2.9% | 14.9% |

Nearly DOUBLE the error on women, both arms. Paired, counting only the
reads where the arms disagree: eye-rect fixed 44 faces and broke 171
(z 8.59); the full warp fixed 42 and broke 164 (z 8.43). It loses on 8 of
the 10 corpus videos, and on one (`8R1hy3uHds0`) it goes from 28.8% wrong
to 86.3%.

**WHY, AND IT IS THE SAME REASON R26 PINNED 1.4 IN THE FIRST PLACE.** An
aligned crop is a TIGHT crop: it puts the eyes on fixed pixels, which
fixes the scale to the interocular distance and cuts away hair, jaw edge
and ear. The shipped `squareBox` is deliberately 1.4x the detector box
and square, so faceres sees forehead, hairline and jaw. R26 swept crop
scale from 0.55x to 1.9x and kept 1.4; this is that same sweep arriving
from a different direction and landing on the same answer. Alignment
buys geometric consistency and pays for it in context, and on this model
context is worth more.

**THE COST ARM WAS SPLIT ON PURPOSE AND THAT SPLIT IS NOW MOOT.**
`eyeRect` is free -- it is just a different rectangle handed to the same
batched `cropAndResize`. `alignTransform` is expensive, because
`tf.image.transform` takes ONE transform per image, so N faces means N
ops and N fence waits instead of one batched crop. The split existed so a
win could be bought at the cheaper price. Both arms lose by the same
margin, so the price never came up.

**`app/gaze/src/face-align.mjs` IS DEAD CODE AND SHOULD STAY THAT WAY.**
Nothing calls it. It exports `ALIGN_EYE_Y`, `ALIGN_EYE_DX`,
`setAlignTarget`, `alignTransform`, `alignError` and `eyeRect`, all
written for this round. The eye-target geometry was going to be swept
next if the A/B was close; it is not close, so the sweep is cancelled
rather than deferred.

**AND IT RETIRES A STALE COMMENT.** `detector.js` says BlazeFace's 6
facial landmarks are "computed and thrown away". They have not been
thrown away since `face-decode.mjs` started writing `marks`; they feed
`markShape()` and finding 30's yaw proxy. What this round establishes is
that having them does not help the CROP.

## 35 -- HIS RANDOM BLUR MARKS, MEASURED AT LAST: THE NULL GUARD KILLS 78% AND ONE IN FIVE STILL GETS THROUGH

His most repeated complaint has never been measured. Every accuracy
number this repo owns answers "given a person is there, did we get their
gender right"; the marks he sees are the other question -- how often does
a patch land where NOBODY IS. That is precision, and the corpus can
answer it: 32 clusters are labelled `notperson` (135 reads) and 4 are
`bodypart` (59 reads), all crops BlazeFace reported a face in and faceres
then read a gender on. `bench/false-patch.mjs`, no inference, joins the
cluster labels to the full read objects by crop path.

In his man mode a patch is minted whenever the read is NOT cleared, and
the shipped clear rule is same-gender AND adult AND `score >= 0.45`.

| label | n | mints a mark | 95% | image rules | after the null guard |
|---|---|---|---|---|---|
| notperson | 135 | 95.6% | 91-98% | 91.9% | **18.5%** |
| bodypart | 59 | 100.0% | 94-100% | 98.3% | **20.3%** |
| man | 1410 | 13.2% | 12-15% | 8.9% | 10.6% |
| woman | 975 | 99.1% | 98-100% | 99.0% | 96.4% |

**NON-PEOPLE, 194 reads: 96.9% would mint a mark, the null guard refuses
77.8%, and 19.1% STILL GET THROUGH.** So the guard shipped in 1079/1042
is doing most of the work -- it is not a dead check -- and one mark in
five survives it.

**WHAT ESCAPES, AND WHY THE GUARD CANNOT SEE IT.** The escapees read
`nm` p50 **5.11** against a floor of **5** -- they clear it by a
hundredth. Raw p50 0.63, score p50 0.25, age p50 34.2, px p50 39.8.
**89.2% are a WEAK MALE read** and only 10.8% read female. So the
mechanism is not the model calling a signpost a woman; it is the model
shrugging, and a shrug fails closed into a patch. `isNullRead` fires on
the model returning its own PRIOR, and these sit just outside that
window.

**THE LEVER, AND ITS PRICE.** `NULL_MINT_NM_FLOOR`, swept on the same
data:

| floor | junk marks | man false cover | woman exposure |
|---|---|---|---|
| **5 (ships)** | **19.1%** | **10.6%** | **3.6%** |
| 5.5 (OTA ceiling) | -- | -- | -- |
| 6 | 11.9% | 9.7% | 4.7% |
| 7 | 11.3% | 8.4% | 5.1% |
| 8 | 11.3% | 7.3% | 5.3% |
| 10 | 11.3% | 6.5% | 6.5% |

5 -> 6 nearly halves the junk marks AND improves men slightly, for +1.1
points of woman exposure. That +1.1 is not a surprise: loop 38's ground
-truth arm measured floor 6 refusing 5 of 125 real faces, four of them
one woman at 32px and 48px.

**BUT IT IS NOT AN OTA PUSH.** `tuning.mjs` clamps
`NULL_MINT_NM_FLOOR` to **[0, 5.5]**. 6 needs a build. 5.5 is reachable
today and is untested -- the sweep above jumps from 5 to 6.

**IT IS AN EXPOSURE TRADE, SO IT IS HIS.**

**THE HONEST BOUND, and it is a big one.** These are crops BlazeFace
ALREADY reported a face in. A mark that appears on a stretch of text the
detector invented from nothing is not in this corpus at all. So 19.1% is
a LOWER bound on the mark rate, and the detector's own false positives
are a separate, unmeasured question.

## 36 -- GREY BEATS COLOUR; FORCING EVERY FACE TO THE SAME SKIN TONE MAKES IT WORSE

**PARTLY WITHDRAWN BY FINDING 39 -- read that first.** The grey win
replicates at z 4.16 on 1,348 faces, but the between-group GAP claim
below (31.1 -> 21.1 points) does NOT: on the full sample the gap is
27.3 -> 27.2 and does not move. Grey is a uniform six-point win on
women, not a bias fix.

Finding 31 measured the gender head failing 52.6% of Indian women and
51.5% of Black women against 31.6% of White women, and diagnosed a SHIFT
rather than a spread. Per-race calibration is refused on principle here
(inferring a sensitive characteristic in order to treat a person
differently is biometric categorisation -- the AI Hub Model License 2.c
clause that killed the QNN delegate in loop 47). The question this round
asks instead is whether a UNIFORM preprocessing step, applied identically
to every face with no branch and no group label read anywhere, removes
the shift.

`bench/colour-arms.mjs` and `bench/skin-norm.mjs`, 386 FairFace faces
scored, four arms per face, paired, over the two worst cells (Indian,
Black) and two controls (White, East Asian), women and men both -- men
included as the control that catches an arm which merely drags every read
toward "female".

| arm | all wrong | women | men | worst-minus-best female cell |
|---|---|---|---|---|
| `rgb` (ships) | 21.5% | **40.6%** | 1.6% | **31.1 pts** |
| **`grey`** luma to 3 channels | **18.9%** | **35.0%** | 2.1% | **21.1 pts** |
| `eq` per-crop histogram equalisation | 20.7% | 38.1% | 2.6% | 29.3 pts |
| `norm` per-crop luma mean/sd | 19.4% | 35.5% | 2.6% | 27.3 pts |
| `tone` per-channel MEAN to a fixed target | 23.3% | 42.6% | 3.2% | 31.0 pts |
| `tonesd` mean AND sd to fixed targets | 24.6% | 45.2% | 3.2% | 35.0 pts |

Paired, counting only the faces where an arm disagrees with `rgb`:

| arm | fixed | broke | net | z |
|---|---|---|---|---|
| grey | 17 | 7 | **+10** | 1.84 |
| norm | 17 | 9 | +8 | 1.37 |
| eq | 18 | 15 | +3 | 0.35 |
| tone | 5 | 12 | -7 | 1.46 |
| **tonesd** | 4 | 16 | **-12** | **2.46** |

**GREY WINS AND SKIN-TONE EQUALISATION LOSES, WHICH TOGETHER KILL THE
OBVIOUS EXPLANATION.** Black women's raw median moves 0.57 -> 0.47 under
grey, crossing the decision fence, and their wrong rate falls 54% -> 44%.
But forcing every face onto one neutral tone -- the direct test of "the
model reads dark skin as male" -- makes Indian women WORSE (48% -> 56%)
and Black women worse (54% -> 60%), and `tonesd` is the only arm whose
loss is significant on its own (z 2.46). If a tone offset were the
mechanism, flattening tone would have fixed it. It did not; it hurt.

So grey is not working by removing skin tone. UNEXPLAINED, and stated as
a hypothesis rather than a result: stripping the channel may force the
model onto shape and structure rather than whatever colour cue it was
leaning on. Not measured.

**GREY IS NOT YET SHIPPABLE AND THE REASON IS THE SAMPLE.** z 1.84 is
p ~ 0.07 -- leaning, not proven -- on 386 faces, over four cells CHOSEN
because they were already known to be broken. A full 1,400-face run over
all seven groups is the confirmation, and it is running. If the net holds
at ~4 points of women with 3x the faces it is real; if it shrinks to
nothing it was noise, and this repo has already shipped one flat sweep as
a finding (loop 40).

**AND THE DIRECTION HAS A REAL WAY TO FAIL:** faceres was trained on
colour, so a grayscale face is off-distribution for it. The gender model
this repo used BEFORE faceres (Oarriaga mini-Xception) was 64x64
grayscale -- but it was dropped for being WIRED WRONG (a single saturated
output, every real face reading ~1.0), not for being grey. Those are
different failures and the old model is not evidence against this arm.


## 37 -- 360p COSTS 4.7 POINTS AND THE MODEL COSTS 34: THE STREAM IS NOT THE WALL

Raising the stream from 360p to 720p is one of his open rulings. It
spends his data and is a page mutation beyond hide/blur/remove, so it has
been sitting unpriced since loop 38 measured his player decoding 640x360
with faces reaching faceres at px p50 38-62. This prices it offline, with
no phone and no data spent.

`bench/resolution-cost.mjs`: 339 FairFace faces, each read at its native
224px and then at seven degraded detail levels. The face is downscaled
and upscaled BACK to the same pixel dimensions, because
`classifyFaceGenders` resizes every crop to the model's fixed input
anyway -- so feeding a smaller tensor would measure nothing. What changes
is the DETAIL, which is exactly what a 360p stream destroys. Detection
runs once at native resolution and the box is reused at every level, so a
gender number here cannot be contaminated by a detection number.

| detail | all wrong | women | men |
|---|---|---|---|
| 224 px (ceiling) | 18.6% | **34.3%** | 2.4% |
| 112 | 19.2% | 35.5% | 2.4% |
| 80 | 19.8% | 36.6% | 2.4% |
| 64 | 19.2% | 36.0% | 1.8% |
| 56 | 20.1% | 37.2% | 2.4% |
| **48 (his band)** | 20.6% | **39.0%** | 1.8% |
| 40 | 21.2% | 40.7% | 1.2% |
| **32** | 27.1% | **52.3%** | 1.2% |

**RESOLUTION COSTS 4.7 POINTS AND THE MODEL COSTS 34.3.** At a perfect
224px portrait the gender head still gets a third of women wrong. So the
stream is not what is failing him -- the model is, and a better picture
cannot buy back an error the model makes on a clean face.

**BUT THERE IS A CLIFF JUST BELOW HIS BAND.** 40px -> 32px is 40.7% ->
52.3%, a 12-point fall in one step, where every step above it costs 1-2.
His faces land at 38-62px, sitting ON the edge of that cliff, so part of
his population is already over it. 720p roughly doubles native face size
and moves the whole distribution clear. That is worth ~5 points plus
whatever the sub-40px tail is costing today, which this bench cannot
size because it does not know his size distribution -- only that p50 is
38-62.

**MEN ARE FLAT AND SLIGHTLY IMPROVE AS DETAIL DROPS** (2.4% -> 1.2%),
which is the same asymmetry finding 31 measured: the head's decision
boundary sits far into male territory, so blur pushes ambiguous faces
toward "male" and men benefit from exactly what costs women.

**THE PER-GROUP TABLE IS THE HARSHEST NUMBER IN THIS FILE.** Black women
read **64.0% wrong at FULL 224px resolution**, rising to 88.0% at 32px.
Indian women 48.0% at native. That is not blur, not the stream, and not
the crop -- it is the model on a clean, aligned, well-lit portrait, and
it is why finding 36's grey arm is the only lever left with real upside.

**LIMIT, stated because it runs the optimistic way:** bicubic downscale
is CLEANER than a real video pipeline, which also adds compression
blocking, chroma subsampling and motion blur. So 4.7 points is a FLOOR on
what 360p costs, not a ceiling.


## 38 -- THE DETECTOR IS NOT THE LEAK: 0.4% MISSED AT 48px, AND NO GROUP OR SEX BIAS AT ALL

Every accuracy figure this repo owns is CONDITIONAL ON DETECTION. The
corpus reads exist because BlazeFace reported a face; the FairFace bias
table scores the crops it reported a face in. A face the detector walks
past gets no read, no track and no patch -- the subject is simply sharp
-- and it is invisible to all of it, by construction. We only ever grade
the questions we asked.

One number made that look like a real gap: on FairFace's clean 224px
portraits BlazeFace found nothing in 52 of 1,400 (3.7%) under ideal
conditions. `bench/detect-recall.mjs` asks the honest version. Each of
1,400 FairFace crops -- exactly one face, known present, known label --
is resized to a chosen NATIVE PIXEL SIZE and pasted into the middle of a
flat mid-grey 640x360 frame, the exact frame size his player decodes.
Then the shipped detector runs and is asked whether it found anything.

| native size | found | MISSED |
|---|---|---|
| 128 px | 1382/1400 | 1.3% |
| 96 | 1393/1400 | 0.5% |
| 80 | 1395/1400 | 0.4% |
| 64 | 1395/1400 | 0.4% |
| 56 | 1398/1400 | 0.1% |
| **48 (his band)** | 1395/1400 | **0.4%** |
| 40 | 1375/1400 | 1.8% |
| 32 | 1339/1400 | 4.4% |
| 24 | 1235/1400 | 11.8% |

**HIS FACES LAND AT 38-62px AND THE DETECTOR MISSES UNDER 2% OF THEM.**
So detection is not what is failing him. That is the third independent
route to the same conclusion this round: finding 37 showed the gender
head is 34.3% wrong on women at a perfect 224px portrait, finding 34
showed the crop geometry is already right, and this shows the faces are
being found. The gender model is the wall.

**AND THERE IS NO DETECTOR BIAS.** Across all seven groups the miss rate
at 48px is 0.0-1.5%, and Female 0.4% against Male 0.3%. The race-
correlated defect finding 31 measured is entirely in the gender head; it
does not begin at detection. Worth knowing, because "we never even see
her" was the cheaper explanation and it is false.

**ONE ODDITY, REPORTED RATHER THAN SMOOTHED:** 128px misses MORE (1.3%)
than 48px (0.4%). Unexplained. Likeliest cause is a large face filling
the pasted square edge to edge with no surrounding context, which is a
property of this synthetic frame rather than of the detector. It does not
touch the conclusion -- every size in his band is under 2% -- and it is
recorded so nobody later reads the curve as monotone.

**WHAT THIS CANNOT SEE, and it is the half that matters for his random
blur marks.** One face is present in every frame, so this measures
RECALL only. It is structurally blind to FALSE POSITIVES -- the detector
reporting a face on text, a logo or a pattern, which is the mechanism
finding 35 could only bound from above. Finding 35 measured 19.1% of
crops the detector ALREADY reported as non-people still minting a patch;
how often it reports one in the first place is still unmeasured, and
needs frames with no people in them.

**LIMIT: THIS IS THE OPTIMISTIC ESTIMATE.** The background is flat grey
-- no distractors, no motion blur, no compression blocking, no occlusion,
no pose beyond what FairFace already contains. A real 360p YouTube frame
is harder in every one of those directions, so a miss here is definitely
a miss and a hit here is not a promise of a hit in the wild.


## 39 -- GREY CONFIRMED ON 1,348 FACES, AND FINDING 36's HEADLINE IS WITHDRAWN: IT IS A UNIFORM WIN, NOT A BIAS FIX

Finding 36 measured grey beating colour on 386 faces at z 1.84 and said
so honestly -- leaning, not proven, on four cells CHOSEN because they
were already known to be broken. This is the confirmation run: all seven
FairFace groups, 1,348 faces scored, same four arms, paired.

| arm | all wrong | women | men | worst-minus-best female cell |
|---|---|---|---|---|
| `rgb` (ships) | 19.4% | **36.0%** | 2.3% | **27.3 pts** |
| **`grey`** | **16.6%** | **30.0%** | 2.9% | **27.2 pts** |
| `eq` | 18.6% | 33.5% | 3.3% | 27.6 pts |
| `norm` | 16.6% | 29.6% | 3.3% | 28.2 pts |

Paired, counting only faces where an arm disagrees with `rgb`: grey fixed
**56** and broke **19** (**z 4.16**, women fixed 53 broke 12); `norm`
fixed 60 broke 23 (z 3.95); `eq` fixed 59 broke 49 (z 0.87, noise).

**THE WIN IS REAL AND IT IS SIX POINTS ON WOMEN.** 36.0% -> 30.0%, and
every one of the seven groups improves with no exception: Indian 52.6 ->
48.5, Black 51.5 -> 44.3, White 31.6 -> 24.5, East Asian 29.2 -> 25.0,
Latino 25.3 -> 21.2, Middle Eastern 33.7 -> 23.5, Southeast Asian 28.6
-> 23.5.

**AND FINDING 36's HEADLINE IS WITHDRAWN.** It reported the between-group
gap falling 31.1 -> 21.1 points and read that as grey removing a
race-correlated leak. On the full sample the gap is **27.3 -> 27.2** --
it does not move at all. The 10-point shrink was small-sample noise
across four cherry-picked cells, which is exactly the failure that run
warned about in its own text and then produced anyway. **Grey lifts
everybody by about the same amount; it does not close the bias.** The
mechanism sentence in finding 36 stands only in its negative half: it is
not skin tone, because tone equalisation made things worse. Why grey
helps at all remains unexplained.

**THE COST IS MEN, AND IT IS SMALL BUT NOT ZERO:** 2.3% -> 2.9% overall,
and the worst cell is Southeast Asian men 5.1% -> 10.1%. On a corpus of
~99 men per group that is 5 faces, so treat the per-cell number as
indicative and the aggregate as the real figure.

**`norm` TIES GREY EXACTLY** (29.6% vs 30.0%, z 3.95 vs 4.16) and costs
an extra pass over the crop. Plain grey is the simpler of two equals and
is the one to carry forward.

**NOT SHIPPED, AND THE REASON IS FINDING 40'S DOMAIN GAP.** Everything
above is 224px studio portraits. His faces arrive off a 640x360 stream at
38-62px, and finding 37 showed the head behaving differently down there.
`bench/grey-corpus.mjs` runs the same arms over the 2,385 labelled corpus
reads -- real frames, real sizes, real lighting -- and that is what
decides whether this is shippable.

## 40 -- TEST-TIME AUGMENTATION WORKS, BUT ONLY WHEN SCORED ON WHAT ACTUALLY SHIPS

Finding 32 established that the failure is per-person and deterministic
-- 19 of 22 corpus women never leak a read and one leaks on all 8 of
hers, with a best raw of 0.73 -- and concluded that every temporal idea
was dead. This tests the non-temporal version: read the SAME face four
ways in the same instant (original, mirrored, zoomed 1.12x, rotated 8
degrees) and combine.

`bench/wiggle-test.mjs`, 2,385 labelled corpus reads, all four views
through the shipped `classifyFaceGenders`.

**ON LABEL ACCURACY IT LOOKS DEAD OR WORSE.** Wrong on women: orig 18.5%,
mirror 18.2%, zoom 25.2%, rot 20.6%, mean-of-four 20.3%. Zoom is
significantly WORSE (fixed 26, broke 86, z 5.57). Taking the
most-female of the four looked like a large win (11.8%) and is not one --
it is a one-way tilt toward "female", which is the same move as lowering
the decision boundary, and the control confirms it: min-of-four at
11.8%/1.6% sits on the plain-threshold curve between orig@0.54 and
orig@0.56. That is finding 29's trap in a new shape.

**BUT THE LABEL BOUNDARY IS NOT WHAT SHIPS.** The clear rule is
`GENDER_CLEAR_SCORE` 0.45 on the male branch, i.e. raw >= **0.725**. A
face that flips label anywhere between 0.50 and 0.725 was already
uncleared and already patched -- the flip changes NOTHING. So every
label-accuracy number above is measuring a question the pipeline does not
ask. Rescored on the shipped consequences (exposure = a woman CLEARED;
false cover = a man NOT cleared), with each arm's bar tuned to hit the
SAME exposure so no arm wins by simply being more cautious:

| at exposure <= 1.6% (today's level) | bar | false cover |
|---|---|---|
| orig, 1x inference | 0.736 | 18.0% |
| **mean of orig+mirror, ~1.5x** | 0.714 | **12.3%** |
| min of orig+mirror | 0.700 | 14.0% |
| min of all four, 4x | 0.684 | 14.7% |
| mean of all four, 4x | 0.722 | 15.3% |

| at exposure <= 1.0% | bar | false cover |
|---|---|---|
| orig | 0.766 | 23.7% |
| mean2 | 0.750 | 19.5% |
| min2 | 0.722 | 18.9% |
| **min of all four** | 0.696 | **17.1%** |

**MIRROR-AVERAGING BUYS 3-6 POINTS OF FALSE COVER AT EQUAL EXPOSURE**,
and it is NOT a threshold move in disguise -- the matched-exposure
comparison is the control for exactly that, and mean2 beats the orig
curve at every operating point on it. At a tighter exposure target the
four-view minimum wins by 6.6 points.

**THE COST, AND IT IS SMALLER THAN IT LOOKS.** faceres is the expensive
half of a verdict (220ms of ~355 on the Redmi at fp32). Naively mirroring
doubles it. But `classifyFaceGenders` already batches EVERY face in a
frame into ONE inference, so mirroring means one batch of 2N crops rather
than two calls of N -- one extra crop-and-upload, one inference, one
readback. The readback count, which findings on the single-frame-crops
plan identify as the real cost driver, does not change at all. Unmeasured
on device; the prediction is closer to 1.4-1.6x than 2x and it needs a
BenchActivity run to confirm.

**ZOOM AND ROTATE ARE NOT WORTH THEIR PRICE** -- zoom is worse on its
own and the four-view arms only beat mean2 at exposure targets tighter
than today's. If this ships it ships as MIRROR ONLY.

**THE SPREAD ACROSS VIEWS IS A WEAK DISTRUST SIGNAL AND NOT A USABLE
ONE:** right reads p50 0.063, wrong reads p50 0.101. Real separation,
same order as everything finding 33 already priced and refused.

**IT IS A COMPUTE-FOR-ACCURACY TRADE AND THEREFORE HIS CALL.**


## 41 -- GREY HOLDS ON HIS OWN FOOTAGE: z 5.56, AND IT BUYS 3.7-5.8 POINTS OF FALSE COVER AT MATCHED EXPOSURE

Findings 36 and 39 measured grey on FairFace -- 224px studio portraits.
Finding 39 said plainly that a win there is a hypothesis about his phone,
not a measurement of it, and named `bench/grey-corpus.mjs` as the run
that decides. This is that run: four arms over the labelled corpus
reads, real frames off ten videos, real sizes, real lighting, scored on
the SHIPPED clear rule rather than on label accuracy.

**2,159 reads scored (910 women, 1,249 men).** Detection runs ONCE on the
untouched crop and the box is reused for every arm, so a gender number
cannot carry a detection difference.

| arm | wrong | women | men | EXPOSURE | FALSE COVER |
|---|---|---|---|---|---|
| `rgb` (ships) | 11.0% | 25.8% | 0.2% | 2.4% | 18.7% |
| **`grey`** | 8.6% | **19.0%** | 1.0% | 1.4% | 20.6% |
| `blueOnly` | 10.7% | 24.2% | 1.0% | 2.0% | 23.0% |
| `gammaUp` | **7.2%** | **14.3%** | 2.1% | 1.0% | 25.4% |

Paired: grey fixed **68** broke **16** (**z 5.56**); gammaUp fixed 113
broke 31 (z 6.75); blueOnly net +6 (z 0.58, noise).

**SO GREY SURVIVES THE DOMAIN GAP.** Finding 39's win transfers to his
own footage at a stronger significance than it had on portraits, and the
size split says it lands exactly where he needs it -- **32-48px: rgb
36.9% -> grey 24.8%; 48-64px: 38.2% -> 32.5%**, and his faces read px p50
38-62.

**AND THE MATCHED-EXPOSURE CONTROL REVERSES THE gammaUp HEADLINE.** The
raw table makes gammaUp look best by a distance. It is not: an arm can
win the "wrong" column by simply leaning female, which is a threshold
move in disguise, and finding 40 already caught that trap once. Tuning
each arm's bar to a common exposure and reading false cover:

| exposure target | rgb | grey | blueOnly | gammaUp |
|---|---|---|---|---|
| <= 2.4% (today) | 19.2% | **15.5%** | 20.3% | 14.1% |
| <= 1.5% | 23.2% | **18.3%** | 23.8% | 20.7% |
| <= 1.0% | 26.0% | **22.1%** | 25.5% | 25.4% |
| <= 0.5% | 35.1% | 29.3% | **29.2%** | 34.8% |

**Grey beats the shipped arm at every operating point and wins outright
at three of the four. gammaUp only leads at today's loose target and
collapses to a tie by 1.0% -- most of its apparent lead was the tilt.**
Grey buys **3.7-5.8 points of false cover at equal exposure**, which is
his random-blur-marks complaint measured in the currency it costs him.

**THE COST IS MEN AND IT IS REAL: 0.2% -> 1.0% wrong.** Five times the
rate, on a base so small it is 2 reads against 10. Read the aggregate,
not the multiple.

**IT NEEDS A BUILD.** Grey is a pixel transform inside the crop path, not
a dial -- it cannot travel over OTA, and it changes who gets blurred. HIS
CALL.

## 42 -- THE BLUE-CHANNEL HYPOTHESIS IS REFUTED, AND THE REVERSAL IS THE INFORMATIVE PART

Finding 36 could not explain WHY grey helps. The standing hypothesis was
that blue carries the least melanin signal, so a blue-only greyscale
should strip the most skin-tone information and win by the most.
`bench/grey-variants.mjs` sweeps eleven arms over 202 FairFace faces --
every grey arm through ONE `greyBy(d, n, f)` function, so a gap between
two of them cannot be an implementation difference.

**THE ORDERING IS THE EXACT REVERSE OF THE PREDICTION.**

| arm | women wrong | vs rgb |
|---|---|---|
| `gammaUp` (gamma 0.7) | **22.3%** | best overall |
| `redOnly` | 23.3% | best single channel |
| `equal` (thirds) | -- | z 2.04 for |
| `greenOnly` | 30.1% | neutral |
| `rgb` (ships) | -- | baseline |
| **`blueOnly`** | **40.8%** | **z 2.25 AGAINST** |
| `invert` | **84.5%** | **z 7.12 against** |

Blue-only is the WORST greyscale arm and is significantly worse than
colour. Red-only -- the channel carrying the MOST melanin signal -- is the
best single channel. **So grey is not helping by removing skin tone.**
That is the third independent route to the same negative: finding 36's
tone-equalisation arm made things worse, finding 39 showed the
between-group gap does not move at all (27.3 -> 27.2), and now the
channel that should strip tone best is the one that loses.

**`invert` IS THE ROW THAT SAYS WHAT THE MODEL IS ACTUALLY USING.** A
luma inversion preserves every edge, every shape and every spatial
relationship, and destroys only polarity -- and it takes women from ~30%
wrong to **84.5%**, an almost total collapse (z 7.12). A network reading
structure would barely notice. **faceres is reading tone and polarity,
not geometry**, which is consistent with gammaUp (a brightening curve)
being the best arm in both this sweep and finding 41.

**WHAT THIS DOES NOT EXPLAIN.** Why flattening three channels to one
should help a network that reads tone remains open. The honest state is:
grey wins, reproducibly, at z 4.16 on portraits and z 5.56 on his own
footage, and NOBODY HAS A MECHANISM. Every mechanism proposed so far has
been tested and refused. Ship it on the measurement or not at all -- do
not ship it on a story.

**LIMIT:** 202 faces, 14-15 per race-sex cell. The top of that table is
ordered inside its own noise; the two significant rows (blueOnly against,
invert catastrophic) are the load-bearing ones and they are the reason the
hypothesis is closed.


## 43 -- THE GENDER MODEL WILL NOT RUN SMALLER, AND THE FIRST RUN THAT SAID IT WOULD WAS A BROKEN HARNESS

faceres is the most expensive thing in a verdict -- 220ms of ~355 on the
Redmi at fp32, 7MB of the APK -- and its input is 224x224x3. A ResNet
ending in a global average pool consumes any spatial size, so the
locked-at-224 input shape is a GUARD rather than a limit. Halving it
should cut the convolution cost about fourfold. That is the largest cheap
performance lever this pipeline has left.

`bench/faceres-input-size.mjs` patches the graph topology IN MEMORY to
free the input dimension, reuses the shipped weight bytes, and runs the
224 reference through the UNPATCHED graph so the reference cannot inherit
a patching mistake. Nothing under `app/gaze/models` is written.

**IT RUNS AT EVERY SIZE, AND IT IS FAST.** 224 / 160 / 112 / 96 all
produce the full three-head output, at **1.00x / 1.96x / 3.82x / 5.38x**.

**AND IT CHANGES WHO GETS BLURRED, AT EVERY SIZE.**

| px | agrees with 224 | abs diff p50 | p95 | wrong vs label | speed |
|---|---|---|---|---|---|
| 224 (ships) | 100.0% | 0 | 0 | 12.1% | 1.00x |
| 160 | 90.7% | 0.089 | 0.276 | 12.9% | 1.96x |
| 112 | 89.3% | 0.106 | 0.423 | **20.0%** | 3.82x |
| 96 | **71.4%** | 0.189 | 0.509 | **32.1%** | 5.38x |

**REFUSED.** Loop 34 refused a uint8 requant of this same model at **8
decision flips in 100**; the cheapest size here flips **9.3 in 100** and
the fast ones flip 10.7 and 28.6. A verdict that changes is a person who
was covered going sharp or the reverse, so none of this is a free speed
win. The idea is closed: the shape guard was not the only thing holding
faceres at 224.

**THE FIRST RUN OF THIS BENCH SAID THE OPPOSITE, AND IT WAS ENTIRELY
WRONG.** It reported **100.0% agreement at every size** and a free 3.8x.
The cause was one line: it fed the model `x/255`, and faceres takes a
**0..255 float** (`detector.js:797` and `:825` -- `cropAndResize`
interpolates from a 0..255 float source and nothing divides). Starved of
255x its expected input magnitude the network saturated: across 140 faces
the reference output spanned **0.6262 to 0.6284, three distinct values**,
with male and female means identical to three decimals.

**A CONSTANT OUTPUT AGREES WITH ITSELF PERFECTLY AND SCORES EXACTLY
CHANCE.** That is the signature, and both halves were printed in the same
table: 100.0% agreement beside 50.0% label accuracy at EVERY size,
including the 224 reference that ships. The 50.0% was the tell -- the
shipped model is 12.1% wrong on this sample, so a reference reading
chance is a reference that is not looking at the image.

**A DEGENERACY GUARD NOW STANDS IN FRONT OF THE TABLE.** Before scoring,
the bench measures the spread of the 224 reference across faces and the
gap between its male and female means; under 0.2 spread or 0.05 gap it
prints "REFERENCE IS DEGENERATE", names the likely preprocessing
mismatch, and refuses to print an accuracy table at all. On the corrected
run it reads **spread 0.993, male-minus-female 0.519**.

**THE LESSON IS THE ONE PHASE G ALREADY WROTE DOWN, IN A NEW SHAPE.** An
instrument that cannot fail is worse than no instrument, and a
self-agreement metric is exactly that whenever the thing being compared
can go flat. **Any agreement number needs a spread check beside it**, or
100% means "identical" and "dead" indistinguishably. This repo has now
shipped a saturated gender model once (mini-Xception, 2026-08-23) and
nearly published a saturated one as a 4x speed win; the failure mode is
the same both times and it looks like success from the outside.


## 44 -- IF GREY SHIPS: WHERE IT GOES, WHAT IT COSTS, AND THE ONE THING IT SILENTLY BREAKS

Findings 41 and 42 leave grey as the strongest unshipped accuracy lever
this pipeline has. This is the shipping shape, written before anyone
builds it, because two of the three points below are not obvious from the
measurement.

**IT IS ONE LINE, IN ONE PLACE, AND IT COVERS BOTH PATHS.**
`classifyFaceGenders` is the single door every gender read goes through --
video verdicts and thumbnail verdicts alike -- and the crop batch already
exists as a tensor immediately after `cropAndResize` (`detector.js:825`).
Grey is a weighted sum over the channel axis and a tile back to three,
applied to `crops` before `model.execute`. No call site changes, no
geometry changes, and the image path inherits it for free.

**THE COMPUTE COST IS ESSENTIALLY ZERO.** One elementwise multiply, one
reduction and one tile over `[N,224,224,3]`, against a ResNet forward pass
on the same tensor. Unlike finding 40's mirror-averaging -- which is a
real 1.4-1.6x on the most expensive model in the verdict -- grey is free.
That matters for the ordering: **if only one of the two ships, grey is the
one that costs nothing.**

**SHIP IT THE 1098 WAY: CODE AT TODAY'S BEHAVIOUR, FLIPPED BY A DIAL.** A
pixel transform cannot travel over OTA, so grey needs a build either way.
But a build that ships `GENDER_GREY` at **0**, whitelisted and clamped
`[0,1]` in `tuning.mjs`, renders exactly like 1102 until a number is
pushed -- and then the switch, the A/B and the revert all travel with no
second install. That is the pattern the whole 1098 dial batch used and it
is the right one here, because grey changes who gets blurred and the first
real device read of it should be reversible in seconds.

**AND HERE IS THE THING IT SILENTLY BREAKS.** faceres is multi-head: the
same forward pass that produces the gender sigmoid also produces the
**[1024] descriptor** that the identity memory matches on, at
`MEM_SIM = 0.6` (`identity-memory.mjs:71`). That constant is not a guess
-- the module records that raising it to 0.65 was measured and destroys
three quarters of the win, and that the descriptor's separability is
"genuinely poor" to begin with. **Change the input and every descriptor
changes with it, so 0.6 becomes an UNCALIBRATED number on a threshold
that was already close to its edge.**

Nothing in findings 41 or 42 measured this. The memory is per-video and
cleared on `loadstart`, so there is no cross-build staleness hazard and
nothing corrupts -- the risk is purely that same-person matching gets
better or worse by an unknown amount, silently, in the same build that
changes gender accuracy. Two effects, one release, no way to attribute a
regression.

**SO A GREY BUILD OWES ONE MORE BENCH BEFORE IT GOES OUT:** descriptors
under both arms over the labelled clusters, scoring within-identity cosine
against between-identity cosine, and re-deriving `MEM_SIM` on the grey
distribution rather than inheriting 0.6. The corpus already carries the
cluster identities that makes that a pure offline run. It is NOT written;
it is deliberately not being written until he rules on grey, because it
prices a change nobody has decided to make.


### 43a -- THE KNEE, SWEPT: THERE IS NO FREE SIZE, AND 140 FACES CANNOT RANK THE ONES NEAR 224

Finding 43 refused 160/112/96. The obvious follow-up is whether something
just under 224 is cheap enough to be worth having, since faceres is 220ms
of a ~355ms verdict and even a small factor moves the whole cadence.
Re-swept at 208/192/176/160, same 140 faces, same patched-in-memory graph.

| px | agrees with 224 | wrong vs label | speed |
|---|---|---|---|
| 224 (ships) | 100.0% | 12.1% | 1.00x |
| 208 | 97.9% | 14.3% | 1.19x |
| 192 | 94.3% | 10.7% | 1.41x |
| 176 | **95.7%** | 12.1% | **1.68x** |
| 160 | 90.7% | 12.9% | 2.08x |

**READ THE NON-MONOTONICITY FIRST, because it bounds everything else: 176
AGREES MORE THAN 192 while being 19% faster.** Agreement with the 224
answer must fall as the input shrinks -- a smaller input cannot carry more
of the original signal -- so an inversion is the instrument telling you the
gap between those two cells is smaller than its own noise. At n=140 a
single flip is 0.7 points, and 192-vs-176 is 1.4. **Nothing in the middle
of this table can be ranked at this sample size.**

**AND NO CELL IS FREE.** 208 costs 2.1 flips per 100 and buys only 1.19x,
which is not worth a build. 176 buys a real 1.68x -- faceres 220ms -> 131,
verdict ~355 -> ~266, a quarter off the whole cadence -- at 4.3 flips per
100. That is under loop 34's refusal bar of 8 flips, so unlike 160 and
below it is not automatically dead; it is simply unmeasured at a sample
size that could support the decision.

**RE-RUNNING AT n=700 ON 224/192/176 ONLY.** If 176 holds under 5 flips
per 100 at that n it becomes a genuine question for him -- a quarter of
the verdict clock against a small number of changed decisions -- and if it
does not, the whole smaller-input idea closes for good. Either way the
answer is a measurement rather than a ranking inside noise.

**WHAT DOES NOT CHANGE:** the 224 reference reads spread 0.993 and
male-minus-female 0.519 in every run, so the degeneracy guard of finding
43 is satisfied throughout and none of these numbers are the saturated
kind.
