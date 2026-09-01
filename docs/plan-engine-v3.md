# plan-engine-v3 — the detection/blur engine, both paths, all platforms

Written 2026-09-02. Planning deliverable only; no source changed. Every
number is from this repo's own measurements (CLAUDE.md loops 27-40,
docs/detection-engine.md, docs/speed-findings-2026-08-29.md,
app/gaze/bench, the 2026-09-02 Redmi stage marks) or from the parallel
research docs under docs/research/. Where a claim is unproven it says so
and names the experiment that settles it.

The owner's bar, verbatim: *"make it so perfect that it blurs the
correct person, correct way, works on mobile perfectly as well as on
desktop perfectly"* — and the output ambition: *"such a neat model that
we can open source this completely and have people use this as well."*
Training, fine-tuning, distillation and model surgery are explicitly on
the table. Shipping to him still comes first; the open-source ambition
shapes the module boundaries (§10), not the schedule.

**Sourcing status.** Six parallel research docs existed when this was
finalised and are incorporated: `research/models-2026-09-02.md` (+ the
`-partial` salvage), `gender-lowres-2026-09-02.md`,
`embeddings-2026-09-02.md`, `person-detect-2026-09-02.md`,
`runtimes-2026-09-02.md`. Two are pending and the affected sections
say so: `custom-model-2026-09-02.md` (§3.6 — the dataset-licence crux
is flagged, not resolved) and `temporal-2026-09-02.md` (§4). One
conflict between the surveys is adjudicated in §3.4 (EdgeFace's weight
licence) with the reason given. Nothing below *depends* on a pending
doc; decisions that could move on arrival are marked.

The one-sentence verdict up front, because everything else follows from
it: **this engine's remaining failures are dominated by the clock and
the association layer, not by the models.** The corpus says the gender
model reads his men right 99.6% of the time; cadence alone is worth 73
of the 81 seconds of exposure; 77% of misread false cover is a correct
verdict arriving after its track already died; and the single most
expensive component in the system — MoveNet, 78% of a pass on low-end
hardware — has admitted zero persons in every measured pass on the
footage that matters. The model swaps this plan does propose (§3) are
the two with measured headroom: a separating re-ID descriptor, and a
small-face gender model (spike first, distillation if the spike loses).

---

## 1. Diagnosis, ranked by measured cost

Shipped numbers, his regime (man mode, 1.5s/verdict, coast, scene gate
both sides): **exposure 81.0s, false cover 216.5s, phantom 144.0s** over
the 18-window / 3,465-read / 107-cluster corpus (93.7% labelled).

### 1.1 The clock — worth 73s of exposure. Failure class: CADENCE.

`cadence-ab.mjs`, holding every threshold fixed:

| verdict cadence | exposure | false cover | phantom |
|---|---|---|---|
| 1.5s (his regime) | 81.0s | 216.5s | 144.0s |
| 1.0s | 43.5s | 192.5s | 160.0s |
| 0.5s | **8.0s** | 156.0s | 260.5s |

Every threshold swept this month moved 1-3s. The clock moves 73s. The
mechanism is arithmetic: `CLEAR_STREAK_N` 2 means any track birth costs
a 3s floor of wrong blur at 1.5s/verdict, and a person entering frame
can be exposed up to a full verdict interval before anything sees them.

Where the clock goes, two devices:

**His daily phone (23122PCD1I):** verdict pass ~795ms wall — MoveNet
~504ms (63%), BlazeFace + faceres ~290ms. All twelve MoveNet slots read
n:0 on every pass since loop 27; confirmed footage-not-hardware (the
emulator reproduces it at his timestamps; the fixed-input bench shows
the model bit-identical across machines).

**The old Redmi (M2010J19SI, Snapdragon 662 / Adreno 610, build 1087,
2026-09-02 stage marks, n=3 — indicative, not settled):**

| stage | p50 | p90 |
|---|---|---|
| frame upload | 7ms | 7ms |
| **MoveNet** | **3028ms** | **11085ms** |
| full-frame faces (delta) | 1ms | 1ms |
| gender crops (delta) | 844ms | 1002ms |
| whole pass | 3872ms | 12088ms |

**MoveNet is 78% of the pass at p50, admitted zero persons in every
pass, and the device completed 3 verdicts in 120 seconds — one per ~40
seconds.** On low-end hardware the current architecture is not
degraded, it is effectively absent: at 40s/verdict the cadence table
does not even have a row, and blur-first means the player is either
wrongly sharp for tens of seconds (exposure) or wrongly covered for
tens of seconds (his oldest complaint), depending on which side of a
birth the clock lands. "Works on mobile perfectly" is decided here.

Remove MoveNet from that pass and the arithmetic is ~850ms
(7 + 1 + 844) — a predicted **~4.5x cadence on the hardware floor**,
and ~300ms (~2.7x) on his daily phone. That is the headline of §2.

### 1.2 The association layer — the mechanism behind 115s of false cover. Failure class: ASSOCIATION.

Attribution of the 216.5s: ABSORBED (inside another subject's patch)
56.5s / 26%; MISREAD 149.0s / 69%; STALE 11.0s / 5%. Of the misread,
**77% (115.0s) is "other": male, adult, carries descriptor signal,
clears the bar at score p50 0.71 — and is still covered.** The verdict
is right; it lands on a track that no longer exists. `churn.mjs`: over
the 482 frames a labelled man is covered, the covering track changes
**260 times across 163 ids, median id run ONE frame**, and 68% of the
time a clear-certain read had already landed 0-3s earlier with no cut
between. Every new track is born blurred, so the earned clear dies with
the id that earned it.

Identity memory v2 (loop 40, shipped) attacks the *symptom* — a
remembered identity re-inherits its clear. Nothing yet attacks the
*cause*: association is body-box IoU, and on his phone every body is
synthetic — 7.4 face-heights of geometry manufactured from a face box,
flopping with the face box's jitter. §4 is the cause-side fix.
(`research/temporal-2026-09-02.md` is pending; §4 is this plan's own
design and will be reconciled against it on arrival.)

### 1.3 The instrument — the corpus systematically disagrees with the device. Failure class: MEASUREMENT.

The corpus is native-resolution. His player decodes **640x360** (m.
youtube picks quality from a 393px player box), so faces reach faceres
at px p50 38-62. Consequences, all measured: corpus men read v p50
**0.864**, his phone **0.657 on the same video**; corpus clear-bar
reads carry no descriptor signal 2.3% of the time, his phone
**36-42%**. Three sweeps read flat this month for exactly this reason.
**Until the instrument is fixed, every threshold tuned offline is a
guess about his device.** And the complement is also true and now part
of the bar: essentially all measurement to date is Android — desktop
"perfectly" is asserted, not measured (§7.5). Stage 0 fixes both.

### 1.4 The model layer — real but bounded, with two exceptions. Failure class: MODEL.

- faceres direction is right 99.6% on corpus men, and degradation to
  32px flipped zero of 28 reads on stills — but live 360p video reads
  materially worse than degraded stills (0.657 vs 0.864 p50; the
  degradation harness has no motion blur or video compression). The
  device's weak reads are missing *pixels* plus *video artefacts*. A
  drop-in replacement model is not obviously the answer; a model
  *built for* 24-96px faces might be (§3.2, §3.6).
- The descriptor is exception one: 17% of DIFFERENT-person pairs score
  >= 0.9 against a same-person p05 of 0.28 — no operating point. A
  separating descriptor makes memory and association dramatically
  stronger (§3.4).
- MoveNet is not wrong, it is *irrelevant on his footage* and ruinous
  on low-end hardware (§1.1). §2 demotes it; replacing it with
  coco-ssd is already refused on measurement (phantom −41% but
  exposure 82 → 89.5s, four recovery attempts failed).
- The 2025/26 field itself: `models-2026-09-02-partial.md`'s headline
  negative — **no licence-clean edge model does two of our three jobs
  in one pass.** A multi-task net would be our own distillation
  project. That is now on the table (§3.6), scheduled behind the
  things that move his numbers this month.

### 1.5 The image path — behind the video path on safety. Failure class: POLICY DRIFT.

`faceVerdict` / `imageFlagIndices` test same-gender + adult + score
only. The video path guards the identical failure with `isNullRead` +
`nm`; the image path has neither. A null read at v 0.72 folds to score
0.44, which **clears** the 0.40 image bar — and a non-face crop reads
CERTAIN 38-53% of the time. On images there is no tracker, no streak,
no memory: one shot, one verdict, done. §5.

---

## 2. The cadence answer

### 2.1 Architectures considered — the fan-out, then the pick

**A. MoveNet on demand (RECOMMENDED, §2.2).** Person model leaves the
steady-state pass, runs on cuts / faceless frames / heartbeat. Verdict
wall 795 → ~300ms (daily), 3872 → ~850ms (Redmi). No licence, no size,
no parity risk; reversible by constant.

**B. Delete MoveNet entirely.** Simplest, biggest bundle win (−4.94MB).
REFUSED: the weak tier (back-turned person, no face) has no other
detector, and that is a measured exposure class (R18 classroom). The
faceless-frame rule in A keeps exactly the passes where MoveNet is the
only witness, for a fraction of the cost.

**C. Replace the detector stack with the Qualcomm BSD-3 pair**
(`face_det_lite` 965KB quantized for faces, `foot_track_net` 2.6MB for
persons — `models-2026-09-02-partial.md`). DEFERRED, not refused: no
Adreno 610 benchmark exists for either, BlazeFace is not the cost
problem (1ms delta on the Redmi — detection rides the same frame the
person pass uploaded), and coco-ssd already showed person-box
substitution fails on exposure. Revisit only if the §7.1 corpus shows a
BlazeFace recall gap at 360p (then `face_det_lite` and YuNet — MIT,
verified in OpenCV Zoo — are the two candidates for one offline recall
bench).

**D. Native pipeline (Kotlin + LiteRT GPU delegate / Rust `ort` on
Windows).** DEFERRED, gated exactly as speed-findings item 4 left it,
now with the runtimes survey's specifics: NNAPI is deprecated as of
Android 15 and the Adreno 610 has no NPU, so the realistic Android win
is the TFLite/LiteRT **GPU delegate** only — no Hexagon shortcut
exists on our floor hardware, and the QNN NPU path would force the
uint8 quantization this repo already measured and refused. Frame
handoff is the make-or-break: `addJavascriptInterface` cannot carry
bytes (base64 only — the exact overhead being avoided); the viable
path is `postWebMessage` + MessagePort ArrayBuffer transfer, which
should be single-digit ms for a 256px crop **and needs an on-device
micro-benchmark, not an assumption**. That micro-benchmark plus a
LiteRT-GPU MoveNet-class latency number on the Redmi are the two
gating measurements; Windows (Rust already owns the host process,
`ort` + DirectML) is the cheapest prototype if this is ever pursued.
Do not start until A has landed and the remaining ~300-850ms is
measured to still be the bottleneck — even 844ms of gender is a 1.2s
cadence ceiling on the Redmi, which is why this stays on the list.

**E. Dual-input attribute model** (face crop + body crop, MiVOLO v1's
architecture — Apache-2.0, `gender-lowres-2026-09-02.md`): not a
cadence lever at all, an *accuracy* lever that happens to fit our
pipeline (we always have a body box, synthetic or measured). Folded
into §3.6 as the distillation-target architecture.

### 2.2 The design: MoveNet on demand

MoveNet leaves the steady-state verdict pass and runs only when it can
contribute:

1. **On a scene cut** (the design's own claim: cuts are where new
   people appear; the cut already forces a full pass).
2. **When BlazeFace found zero faces and the scene is not static.**
   The load-bearing rule. A back-turned person has no face, so the
   face path is blind exactly there — MoveNet is the only detector for
   the weak tier. And the eraser (`wipeIfEmpty`) needs fresh person
   evidence precisely on faceless frames; this rule guarantees a
   faceless frame always has it.
3. **On a heartbeat** — `PERSON_HEARTBEAT_MS`, propose 4000ms,
   OTA-clamped [1500, 10000] — so a body entering behind a
   face-bearing frame is bounded, not open-ended.
4. **On the first 3 passes after player attach** (a fresh video has no
   history to coast on).

Everywhere else — faces present, tracks live, no cut — the pass skips
MoveNet.

### 2.3 Why the 1070 disaster cannot recur — read before objecting

Loops 28-30 shipped a skip (1068-1070) and reverted it after "it's not
blurring the female". The postmortem is precise and this design is
built against it:

- **1070's trigger was inverted.** It skipped after 3 consecutive
  *empty* person passes — i.e. precisely in the faceless/n:0 regime —
  and a held `noHumanShape` made a face-bearing pass report an EMPTY
  frame, so `emptyStreak` climbed and `wipeIfEmpty` erased a covered
  woman's patch. This design skips **only when faces > 0**, so a
  skipped pass carries face evidence by construction and
  `emptyFrame = persons.length===0 && faceEvidence===0` cannot be true
  on one.
- **The ghost gate no longer needs a fresh MoveNet answer.** In 1070
  the frame-keypoint floor was the only thing deciding face → patch.
  Since then that gate's separator was measured dead (refused faces
  max 0.098 vs kept min 0.101 — the same faces), the 1078 ruling made
  the floor a counter, and the null-mint `nm` floor (1079) is the
  discriminator on the right axis and is a property of the *read*, not
  the frame. The dependency that made skipping unsafe is gone.
- **The protocol survives.** `wantPersons()` / `notePersons()` are
  still wired in init-entry.js and the worker keeps `withPersons` —
  the comment there says it is "the honest way to express 'this pass
  did not run the model' if a future round ever needs it". This is
  that round. A skipped pass stamps `personsSkipped: true`; the ghost
  gate is inert on it; the eraser does not advance `emptyStreak` on
  it; `heldPersons` geometry is reused for association only, never as
  evidence.

### 2.4 Expected effect, and the measurements that prove it

Cadence self-adjusts (`effZoom = lastVerdictMs * 4`, clamp 2000ms). At
~300ms verdicts the natural cadence is ~1.2s on his daily phone and
dial room opens below 1.0s; on the Redmi, ~850ms passes put a device
that today manages one verdict per 40s at ~3.4s cadence — from absent
to functional. `cadence-ab` prices 1.0s at exposure 43.5s / fc 192.5s:
**roughly half the exposure and −24s of false cover, from removing
work that was producing a constant.** Honest costs: phantom rises with
cadence (160s @1.0s, 260.5s @0.5s) — the accepted direction, but said;
and body geometry for face-visible people is synthetic between
heartbeats even on footage where MoveNet would have measured it.

Three measurements, in order:

1. **Corpus arm first** (no device, no APK): an arch-arms variant that
   strips person slots except at cut frames + every Nth
   (`corpus-persons.mjs` reads slot data; `cocossd-arm.mjs` is the
   template for a substituted-persons arm). Score all three metrics at
   fixed nominal cadence to isolate the geometry cost of losing
   measured bodies. Predicted: small (his regime never has them; the
   corpus regimes that do will price the weak tier).
2. **Redmi A/B**: candidate vs 1087 control, same video, same
   timestamps (the loop-36 rule: regime is footage + timestamp, pin
   both). Read `secsPerVerdict`, stage marks, rAF, and the eraser
   counters — **`wipeErasedBlurred` must not rise; that is the 1070
   signature and the tripwire on every A/B.**
3. **His phone, rings only, post-release**: secsPerVerdict ~0.9-1.2
   against today's 1.45; `personsSkipped` proves the machinery is
   live; `wipeErasedBlurred` flat at the 1073-era baseline.

### 2.5 The second cadence lever: stop re-reading settled faces

faceres is ~250ms/face on his daily phone and **844ms of crops per
pass on the Redmi** — after MoveNet leaves, gender is the whole pass.
Proposal: a track that is CLEARED with memory trust and a read younger
than ~2 verdicts gets its faceres read *sampled* every 2nd verdict
rather than every one. **Failure direction: exposure** (a wrong clear
or a person swap is re-flagged one verdict later), so this ships only
with its own corpus number, only after §2.2 lands, and only under a
measured budget: if the corpus prices it above +2s exposure, drop it
permanently. On the Redmi it is the difference between ~3.4s and ~2s
cadence on multi-face frames, which is why it stays on the list at all.

### 2.6 Backend levers (sourced: runtimes-2026-09-02.md)

- **WebGPU: the probe IS the plan, and it is Stage 0's cheapest item.**
  Chrome for Android shipped WebGPU in 121 (Adreno on Android 12+),
  but **Android System WebView is a different Chromium build target
  and no dated WebView-shipped announcement exists** — the survey
  found the gap explicitly. The only answer is
  `navigator.gpu.requestAdapter()` on the actual devices: WebView2
  first (Edge has had WebGPU since 113/2023 — nearly free to check,
  likely yes), then the Redmi's WebView. Expected win if reachable:
  ~30% warm-state on a MobileNet-class microbenchmark (the credible
  number; Chrome's "3x" is a vendor ceiling), with *worse* first
  inference (pipeline creation front-loads differently) — so it helps
  steady-state cadence and hurts the cold path, and needs its own
  warm-up treatment. TF.js's webgpu backend is inference-complete but
  not called stable by its own README. Build nothing on it until the
  adapter probe returns non-null on the hardware that matters.
- **WASM threads are structurally dead for us — recorded so nobody
  re-derives it.** SharedArrayBuffer needs `crossOriginIsolated`,
  which needs COOP/COEP from the *top-level document's server* —
  youtube.com/reddit.com/x.com will never set it for us. Single-thread
  SIMD WASM is the ceiling on that path, and it will not beat WebGL on
  a phone GPU for MoveNet-class FLOPs. Credible only as a fallback for
  the small gender crops, never the detector.
- **WebNN: not usable, full stop, until ~2027.** Chrome 146's origin
  trial explicitly excludes Android (CPU-only implementation there),
  and the planned Android backend routes through NNAPI, which Google
  has deprecated. Revisit no earlier than Chrome ~150 with Android off
  the exclusion list. No probe even needed; the WebGPU probe line can
  carry `'ml' in navigator` for free anyway.
- **Optical flow between verdicts:** position interpolation already
  runs at 60Hz with velocity; the scene gate's luma grid could steer
  patch *position* by block motion for ~free. Small spike, never
  verdicts, low priority — the complaint history is identity, not
  inter-pass drift.
- **Cheap wins inside the current stack:** most known WebGL mobile
  levers already ship here (shape uniforms, parallel shader compile,
  zero-readback player path, mobile flush threshold). The survey's two
  unexplored items: audit every image-crop path for
  `createImageBitmap({resize…})` instead of canvas draw+read (an
  afternoon, ~10-20% class), and `VideoFrame`-as-texture-source, gated
  on the WebGPU probe. Both ride Stage 2's release or earlier.
- **Downscale-then-refine detection:** BlazeFace input is fixed 256
  and costs ~1ms delta on the shared frame. No lever.
- **Optical flow between verdicts:** position interpolation already
  runs at 60Hz with velocity; the scene gate's luma grid could steer
  patch *position* by block motion for ~free. Small spike, never
  verdicts, low priority — the complaint history is identity, not
  inter-pass drift.
- **Downscale-then-refine detection:** BlazeFace input is fixed 256
  and costs ~1ms delta on the shared frame. No lever.

---

## 3. The model layer

Licence rule restated for every row: **MIT / Apache-2.0 / BSD only,
verified against the weight files, not the repo's code licence.** The
survey docs confirmed the trap is real and current: InsightFace (MIT
code, non-commercial weights), MiVOLO v2 (Meta gated backbone),
Levi-Hassner (no grant at all), FairFace (licence drift — see §3.6).
Every verdict, including refusals, gets recorded so nobody re-litigates
without new facts.

### 3.1 Face detection — keep BlazeFace; two shelf candidates if a gap is measured

BlazeFace (Apache-2.0, 539KB) costs ~1ms delta per pass and its open
question is *recall at 360p decode* — never measured, because the
corpus is native-res (BlazeFace has never published a WIDER FACE score
at all; its 98.61% is Google's private 2K-image set). The §7.1 corpus
answers it as a side effect. If labelled faces exist that
BlazeFace-at-360p misses, the bench is: run the candidates over the
same 360p bank offline, compare recall at matched false-positive rate.
Candidates, licence-verified by the surveys:

| model | licence | size | note |
|---|---|---|---|
| YuNet (OpenCV Zoo) | **MIT** in-directory (repo Apache-2.0), verified | 75,856 params, ~350KB ONNX | the strongest drop-in: disclosed **WIDER hard 0.7503**, trained down to ~10px faces — exactly our regime; ONNX-only → drags ORT-Web in (§3.5) |
| facex-engine detector | Apache-2.0 | 401KB, 100K params | the one recall number measured near our regime: **~85% at faces >= 32px**; runs in-browser today via ORT-Web WASM; young single-maintainer project, unusual encrypted-weights design — understand before depending |
| Qualcomm face_det_lite | **BSD-3 code AND weights** | 965KB-1.09MB quantized | June-2025 training; bbox+5 landmarks; tuned for Qualcomm NPU, generic WebGL/WASM path unproven; **no Adreno 610 bench exists** |

No swap is proposed today; detection is neither the cost (§1.1) nor a
known accuracy hole. Measure first. (MediaPipe's Face Detector is
BlazeFace under a Google wrapper — not an upgrade, per the survey.)

### 3.2 Gender/age — keep faceres; run the one cheap spike the survey found

From `gender-lowres-2026-09-02.md`, the field at our face sizes
(38-62px) is thin and mostly licence-dead. What survives:

- **face-api.js `age_gender_model` — MIT code, MIT weights, ~420KB,
  already a TFJS graph model.** 16x smaller than faceres (6.98MB),
  same deployment shape, no published low-res curve. **This is the
  cheapest real experiment on the list and it is scheduled (Stage 3):**
  run it through `small-face.js` + the 360p corpus against faceres on
  identical crops. Three possible outcomes, all valuable: it wins at
  38-62px (swap candidate + distillation teacher), it ties (bundle −6.5MB
  and a faster Redmi pass for free, if the abstention machinery ports —
  it has no descriptor, so `nm` must be re-derived or replaced, which
  is the likely blocker and must be in the bench), it loses (faceres is
  vindicated and the distillation case sharpens).
- **`gender-ssrnet-imdb` — the known trap.** Native 64x64, Apache-2.0,
  and almost certainly the model this repo already shipped and retired
  (2026-08-23: output saturated ~1.0 on every real face). Do not
  revisit; the survey found no upstream fix and independent comparisons
  put it last (88% vs faceres 98% at ~150px).
- **MiVOLO v1 — Apache-2.0, dual face+body input.** Face-only MAE
  falls apart cross-dataset (5.55) but face+body is the best published
  (gender 97.99%). PyTorch-only; a porting project, not a drop-in. Its
  real value to us is the *architecture*: we always have a body box.
  Carried into §3.6 as the distillation-target shape, not proposed for
  integration.
- **FairFace-trained classifier** — the only attribute model whose
  training regime approaches our operating point (minimum face size
  50x50px; 97% gender overall, not broken out by size). Licence is the
  blocker, flagged independently by both surveys: the "CC BY 4.0"
  claim sits under a Data heading with no LICENSE file and no
  checkpoint terms. Direct read (or author contact) before it goes
  anywhere near the tree; until then it is an *anchor for §3.6's
  training floor*, not a candidate.
- Refused on licence, permanently unless terms change: InsightFace
  genderage, MiVOLO v2, DEX/IMDB-WIKI-derived weights, Levi-Hassner,
  the ViT-Base age-gender ONNX (clean but 86.8M params — a regression).
  MiVOLO v1's own licence signal is conflicting (Apache per repo
  footer, MIT per an HF card — permissive either way, confirm which)
  and its authors advise against ONNX export, so it stays an
  architecture reference, not an integration.
- The survey's headline, now sourced twice: **nobody anywhere has
  published gender/age accuracy at 38-62px.** The one resolution study
  found (arXiv 2511.14689) bottoms out at 64px. The niche §3.6
  proposes to fill is genuinely empty.

What moves the gender numbers on his device regardless of model, in
order: (a) the decode-quality ladder — 640x360 → 854x480 puts p50
faces from ~50px to ~66px, above every degraded band; a page mutation
beyond hide/blur/remove that spends his data, so it is HIS call and
the plan only prepares the measurement (one A/B on the Redmi); (b)
device-calibrated thresholds on the 360p instrument via tuning.json;
(c) §3.6.

### 3.3 Person detection — demoted, not replaced

§2. coco-ssd stays refused (exposure 82 → 89.5s). The person-detect
survey sharpens the shelf: **NanoDet-Plus-m-320** (Apache-2.0, 1.17M
params, 980KB int8, COCO 27.0, the only clean candidate with a proven
in-browser WASM build) and **EfficientDet-Lite0 via MediaPipe Tasks**
(Apache-2.0, 4.4MB, the only candidate with published latency — 28-61
ms, Pixel-class device, unverified on Adreno 610, and it drags a second
runtime into the bundle). Qualcomm `foot_track_net` (BSD-3, 2.6MB)
remains the third. All stay unscheduled *unless* the §2.4 corpus arm
shows the weak tier needs better boxes than MoveNet's.

Two warnings the survey states that this plan adopts as rules: any
MoveNet removal must first grep the keypoint consumers —
`person-gate.mjs` head anchoring, the keypoint-union geometry, the
weak tier itself, and `boundBodyToSlot` all read slots, so a box-only
detector is a *redesign* of that logic, not a swap (one more reason
§2 demotes rather than deletes). And the AGPL trap has teeth in this
category specifically: Ultralytics YOLOv8/11 and everything trained
with them (including the one published joint face+person model, which
is exactly the architecture worth wanting), plus mmyolo's GPL re-host
of RTMDet — RTMDet is clean only from mmdetection's own tree.

### 3.4 Re-identification — the one model spike with measured headroom

The faceres descriptor does not separate (17% different-person pairs
>= 0.9). Identity memory v2 was built to be safe *despite* that; a
descriptor that separates lets association and memory key on identity
instead of geometry — the root fix for §1.2.

**The licence pass is already done by the embeddings survey, and it
adjudicates a conflict between two of the parallel docs.** The models
survey read EdgeFace's GitHub repo LICENSE (BSD-3) and called the
weights clean; the embeddings survey read **Idiap's own model card,
which licenses the official weights CC BY-NC-SA 4.0**, and found the
MIT-badged third-party ONNX re-host to be a repackager re-badging
someone else's NC weights. **The embeddings doc wins**: the weight
files live with the model card, a repo code-licence does not cover
them, and a repackager cannot relicense — the exact split this plan's
licence rule exists for. EdgeFace is DISQUALIFIED (1.24M params, LFW
99.57% — attractive and unusable). Also killed by the survey: every
MobileFaceNet reimplementation checked (all trace to MS-Celeb-1M,
withdrawn 2019 — code licence does not launder the weights), and
SFace (undisclosed training set, 36.9MB anyway).

What survives, and it is a short list:

1. **dlib ResNet-34, shipped as face-api.js `face_recognition_model`
   — the primary candidate.** MIT code, weights **public domain by
   explicit grant** from the author. 128-dim, ~6.2MB quantized, LFW
   99.38%, **already a working TFJS package** — zero conversion work.
   Integration note: 150x150 *aligned* input, so it brings an
   alignment step (face-api.js's own 5-point landmark net) whose cost
   goes in the bench.
2. **MobileFace via human-models — the fallback.** MIT, 2.1MB,
   256-dim, 112x112, one config flag from our pipeline; accuracy
   self-reported on a non-standard protocol (discount it) and the
   training set is undisclosed — a provenance gap to weigh, not a
   violation.
3. **OSNet x0_25 (deep-person-reid) — the orthogonal idea.** MIT code
   AND weights, 0.2M params: a **person-appearance** embedding
   (clothing/build, not face) — aimed at exactly the subjects this
   engine cannot re-identify today, the ones not facing the camera.
   No browser build exists for any permissive re-ID model (the survey
   searched); torchreid's ONNX export makes the path ours to build,
   and accuracy at our crop sizes is uncharacterised anywhere. A
   second-round spike, not the first. Avoid the DukeMTMC-trained zoo
   variants (dataset withdrawn); the MSMT17 provenance of the main
   weights is research-use and gets the same written-verdict treatment
   as everything else before an open-source release leans on it.

The bench, unchanged: **ROC on the existing pair corpus** (128
same-person + 65 same-frame different-person pairs, extendable to
thousands from the 107 labelled clusters), bar written before running
— **different-person pairs >= 0.9 under 2%, at same-person p50 >=
0.8** — an order of magnitude over shipped, because integration costs
a second per-face inference. Only a candidate clearing the bar gets a
Redmi latency measurement. If nothing clears: the fallback is
geometric association (§4.2), which needs no model and attacks the
same 115s.

### 3.5 Runtimes (sourced: runtimes-2026-09-02.md)

TFJS/WebGL stays the default — every measured number in this repo is
on it, and worker delivery through the synthetic URL is proven on all
five platforms. The survey's bottom line matches: nothing is a free
win, and the highest-leverage next step is the WebGPU adapter probe
(§2.6), which every other runtime row is gated on or more expensive
than.

- **ONNX Runtime Web** (MIT) enters only attached to a model that
  earned it (YuNet, facex-engine, or a spike winner). Eyes open: its
  WebGPU path is mid-transition (JSEP → native Dawn EP, mutually
  exclusive by design intent), its WASM path has the same
  single-thread SIMD ceiling as TF.js (no crossOriginIsolated in a
  third-party page), and **nothing establishes WASM-CPU ONNX beats
  WebGL TF.js on an Adreno 610** — that is measured before adopted.
  Migration of our existing models is a non-starter (no TFJS-graph →
  ONNX first-party path; the SavedModels for the hand-requantized
  variants may not exist); ORT-Web is for *new* models only. One
  genuinely useful feature if ever adopted: `preferredOutputLocation`
  keeps tensors on-GPU between passes.
- **MediaPipe Tasks** (Apache-2.0): the survey settles it — Model
  Maker is deprecated and fine-tunes only within fixed task families,
  so MediaPipe cannot run our custom models; adopting it means
  *replacing* our detector and gender model with Google's, an
  accuracy/behaviour change wearing a runtime costume. Refused as a
  runtime; its EfficientDet-Lite0 stays on the §3.3 shelf as a model.
- **Quantization rule, confirmed and generalised:** TF.js WebGL
  dequantizes weights before compute, so quantization there is a
  *download-size* move with a real accuracy cost — exactly what the
  faceres uint8 refusal measured. Int8-as-acceleration exists only on
  NPU delegates we do not have (Adreno 610, no Hexagon). f16 stays
  the safe middle ground. Do not re-litigate inside TF.js/WebGL.
- Native LiteRT / Rust `ort`: §2.1-D. WebNN/WebGPU: §2.6.

### 3.6 The custom model — fine-tune, distil, or train, and the open-source deliverable

(`custom-model-2026-09-02.md` pending; this section states the plan's
own position and flags the crux it must resolve.)

The survey's two headline facts point at the same conclusion. No
licence-clean model does our jobs in one pass, and no licence-clean
gender model is *built for* 24-96px faces — while the evidence says
the task is tractable there (FaceHop: 94.6% gender at 32px greyscale
with 16.9K parameters; compact pipelines lose ~1 MAE point at 64px).
Meanwhile our production model is a 224px network fed 38-62px faces,
returning its prior on 36-42% of device reads. **The gap in the world
is exactly the model we need — which is also why it is the component
worth open-sourcing standalone.**

Three routes, in ascending cost:

1. **Fine-tune faceres on degraded inputs.** Teacher = faceres itself
   at native resolution; student = faceres fine-tuned on the same
   images pushed through our degradation pipeline (the 360p re-bank
   machinery IS the augmentation: decode-scale, video compression,
   motion blur). Cheapest, keeps the descriptor head and the abstention
   semantics. Risk: 6.98MB stays 6.98MB, and a 224px architecture may
   simply not have headroom at 40px input.
2. **Distil into a purpose-built small student (RECOMMENDED ROUTE).**
   Target: 24-96px input, gender + age + childP + an explicit
   abstention head (replacing the `nm` proxy with a trained "no
   signal" output — the nm floor and null band are hand-derived
   approximations of exactly this), 0.3-1.5MB, TFJS + ONNX exports.
   Architecture informed by MiVOLO v1's finding: an optional body-crop
   second input, because this pipeline always has a body box and a
   40px face usually comes attached to a much larger body. Teachers:
   faceres (MIT — distilling from an MIT model is clean) at native
   res, optionally face-api.js age_gender (MIT) as a second opinion.
3. **Train from scratch.** Only if the custom-model doc's dataset
   findings make supervised labels cheap and clean. Weeks-class;
   default no.

**The crux is data, and it is flagged, not solved.** The survey already
demolished the easy answers: IMDB-WIKI is research-only and the
restriction travels with weights; FairFace's "CC BY 4.0" sits under a
Data heading with no LICENSE file and no checkpoint terms — treat as
ambiguous until the authors answer, and do not build the open-source
claim on it; UTKFace and CelebA are non-commercial/research. The route
that avoids the whole problem: **teacher-labelled distillation needs
unlabeled face images only**, so the training set can be frames from
openly-licensed video (YouTube CC-BY, Wikimedia Commons) plus our own
degradation pipeline — provenance recorded per source. If
`custom-model-2026-09-02.md` finds a genuinely clean labelled corpus,
route 3 reopens; until then route 2's data story is the defensible one.

**Acceptance bar, written before training:** the student must beat
faceres on the 360p corpus at px 32-96 on (a) direction agreement with
native-res truth, (b) abstention quality (catch >= 90% of the non-face
control at <= 5% real-face refusal — the shipped nm floor's own
numbers are the baseline: 96.3% / 0%), and (c) must not regress the
native-res bands faceres serves well. Lose any of the three and it
dies in the bench like everything else.

**What a standalone release needs** (the "people use this as well"
half, scoped so it cannot inflate the schedule): Apache-2.0 weights +
training code; a model card stating task, input regime (24-96px),
training-data provenance table, and the abstention head's semantics;
the eval harness (our bench runs on a corpus the user banks themselves
— the harness ships, YouTube-derived footage does not); ONNX + TFJS
exports; and a fairness/misuse section — a gender classifier release
must publish its error rates across demographic slices and state the
protective purpose plainly. This is a deliverable checklist, not a
schedule item, until Stage 6.

---

## 4. The association/identity layer

The target: the 115s of "verdict was right, track was gone", and the
churn number behind it (median id run 1 frame). Pending
`temporal-2026-09-02.md`; reconcile on arrival — where it disagrees
with the following, the disagreement gets settled by the corpus, not
by seniority.

### 4.1 What already shipped and what it must show

Identity memory v2 is in HEAD with corpus numbers (fires 359x man
mode, reachable wrong firings zero, trust 2-man/1-woman). Device
checkpoint: `memClear` against `readClearCertain` on his rings over
90s. If memClear ~0 on-device while the corpus fires 359, that is the
calibration gap again (36-42% signal-less reads block the pusher) —
already half-expected, and the 360p corpus is what tunes `MEM_*`
honestly. The dials are already OTA.

### 4.2 Face-anchored association — attack the churn at its source

Association is body-IoU (`PTRACK_IOU_MIN` 0.2). On his phone every
body is synthetic, 7.4 face-heights wide, jittering with the face box;
one flop drops IoU below the floor → new id → born blurred → the
clear dies. The face box itself is comparatively stable.

Proposal: when observation and track both carry `fromFace` with a face
box, associate on **face-box IoU / face-centre distance first**, body
IoU as fallback. This is "better association … tighter observation
geometry" — the exact upstream fix the owner's solid-patch rule
prescribes. No rendered edge moves; nothing is cut.

Measurement, offline first: an arch-arms variant swapping the
association key; read `churn.mjs` (target: median id run 1 → >= 4
frames on the covered-man population) and the three corpus metrics.
Predicted from the mechanism: false cover down 20-40s (the clear
survives the pass), exposure flat or better (churn kills coverage the
same way it kills clears — a surviving track is a surviving patch).
Failure direction if the key is too loose: two *different* people
bridged into one track — an exposure path (a cleared man's track
absorbing a woman's observation). Guards exist (`IDENT_SIM_MIN` gross-
mismatch reset, `CLEARED_TTL_MS` re-prove), the corpus scores exactly
this class, and the variant ships only with the ABSORBED attribution
(today 56.5s) not degraded.

### 4.3 The descriptor as association glue — only after §3.4

If a separating descriptor lands, it becomes a *tiebreaker* in
association (never clear evidence — that stays memory's job with its
trust guards). Until then the shipped descriptor must NOT be added to
association: at 17% false-match >= 0.9 it would bridge different
people — the exposure direction — and pooling-style aggregation is
already refused on measurement (rescues 4 men, loses 75).

### 4.4 Scene cuts — run the fair experiment the corpus already hints at

The cut-never-wipes arm reads man 81.0 → 53.5s exposure and 218 →
154s false cover — but that arm is HALF the shipped behaviour (it
wipes without the forced immediate pass), so only differences between
cut arms are fair. The fair experiment: implement **demote-not-wipe**
(tracks demoted to blurred, identity retained, forced full pass
exactly as shipped) as a corpus arm that models the forced pass, and
as a code path behind a numeric `CUT_MODE` constant, OTA-clamped
[0,1], shipped in today's behaviour. If the corpus holds even half the
delta, flip it over the air — reversible in one push. Failure
directions: phantom (a patch surviving a cut onto a title card —
bounded by `wipeIfEmpty` + `PTRACK_CUT_COAST_MS`), and one real
exposure edge: a cut to a *different person in the same screen
position* inheriting a demoted track — but demoted means blurred, and
re-clearing needs fresh certain reads, so the inherited state is
covered, not clear. A state-machine review of exactly that transition
is a named precondition of shipping the flip.

`CUT_DELTA` itself is done: 50, OTA-clamped [30,90], calibrated on his
phone's own luma ring. Nothing further without new device data.

---

## 5. The thumbnail/image path — one policy, two consumers

### 5.1 The unified verdict layer

Extract `read-policy.mjs`: one module owning `isNullRead`, the `nm`
floor, `isAdultRead`/`GENDER_CHILD_MASS`, and the score bars. The
video path consumes it as today (null+nm refuses a track *birth*,
never an observation or refresh — monotone toward covering). The image
path consumes it as: **a read that is null or carries nm below floor
may never count as a same-gender clear** — it fails the
`same && adult && score` test and the face stays covered. Same
predicate, same constants, same OTA dials; the paths can no longer
drift, and a tuning push moves both. This module is also the natural
home of §3.6's trained abstention head if it ever lands — one boundary
to swap behind.

Safety, half-measured already: on 25 banked native-resolution
thumbnail faces (px 152-360) nm min is **6.19** — floor 5 refuses 0 of
25, so no newly-covered men at thumbnail sizes. The benefit half
(non-faces at thumbnail resolution) is bounded by the corner-crop arm
(91-98% caught at 32-160px) but has no dedicated thumbnail-resolution
non-face arm; `small-face.js` gets one before the constant is trusted
for image tuning — banked, so it never costs a second live feed.

Direction of every case: null/low-nm read on an image → covered.
Fail-closed, the accepted direction, the same trade the owner accepted
on 1078 for graphics on the video path. No exposure path exists in
this change.

### 5.2 What the image path needs that video does not

- **No temporal signal — no second chances.** Bars stay
  image-specific (`GENDER_IMAGE_MIN_SCORE` 0.4, not the video's
  asymmetric clear bar): raising toward 0.6 re-blurs the 0.3-0.6
  same-gender adults the owner already reported, and there is no
  streak to recover them. Registered, not changed.
- **No size floor** — refused on measurement (a 53px thumbnail face
  read male 0.99; a floor would newly cover that man). Stays refused;
  the nm guard covers the axis the size floor was guessing at.
- The retry bound, verdict cache, CORS preflight, occluder clamp and
  host-scale conversion stay as-is — each carries its own measured
  justification and none is engine policy.

One release carries 5.1 (bundle code); its dials ride OTA thereafter.

---

## 6. Cross-platform

### 6.1 What is YouTube-specific today, named

In `init-entry.js` / `video-region.mjs`: `#movie_player` /
`#player-container-id` attach logic, shared-player preview gating, the
miniplayer module, sticky-player occluder assumptions, SPA navigation
wiring, and the decode-quality fact (640x360 is m.youtube's choice).
Everything else — discovery (MutationObserver + shadow piercing), the
image pipeline, worker delivery, tracker, verdict layer, renderer
geometry — is already platform-neutral and proven live on
Reddit/X/IG/FB (workers alive, 0 CSP violations, IG blur 12/12
verified on /explore/).

### 6.2 The abstraction: a per-host player adapter

`player-adapter.mjs`: `{ findPlayers(root), isPreview(el),
clipHost(el), isWatchContext() }` per host, YouTube's current logic
becoming the first adapter verbatim. Reddit's shreddit player (open
shadow root — discovery already pierces it) is the second; X and IG
in-feed autoplay the third/fourth, with one budget rule imported from
the feed-preview precedent: **at most ONE active video pipeline,
viewport-priority; scrolling feeds get whole-blur, not passes.** An
infinite feed of autoplaying videos running N pipelines is the
m.youtube preview bug at platform scale; the stand-down is the shipped
pattern. Selectors are read from the live DOM per the working
agreement, never guessed — each adapter lands `[unverified]` until its
emulator run, exactly like rules. Harness note: the emulator dies on
Reddit under swiftshader — one site per invocation, or the Redmi.

### 6.3 Delivery per platform — settled except iOS

Android + desktop: settled (synthetic URL + interceptor, query-string
past the service worker, SYNTHETIC_HOSTS earn the model-free bundle).

**iOS is the open constraint, stated plainly: WKWebView cannot
intercept https:// requests of remote origins.** The synthetic-URL
path — the thing that made the bundle 1MB instead of 22.7MB — does not
exist there. Options for the cousin-window spike, in preference order:
(a) `WKURLSchemeHandler` custom scheme — but a page fetch to a custom
scheme is cross-origin, gated by each site's `connect-src`: works on
YouTube (unrestricted), dead on Reddit (`default-src 'none'`); (b)
inline full bundle + models per navigation via `WKUserScript` — works
everywhere, costs the multi-MB parse Android paid before the
interceptor (~1s class on desktop; A-series silicon is fast; still
unmeasured); (c) the mixed matrix — scheme-fetch on permissive hosts,
inline on strict ones — which SYNTHETIC_HOSTS already implements in
shape on Android. Everything iOS must be prepared before the window
and tested during: the spike is a matrix (host x delivery x
worker-alive x CSP violations) plus one latency number per cell, run
in week one of the window.

### 6.4 What does not vary

The models, verdict layer, tracker, tuning.json and the corpus serve
every platform unchanged — images are images everywhere, and an
in-feed video is the player pipeline behind an adapter. The 360p
instrument is YouTube-calibrated because his complaint is YouTube;
Reddit/X/IG image feeds are already covered by the thumbnail path and
its bench.

---

## 7. The measurement plan — fix the instrument before the engine

### 7.1 The 360p corpus

Re-bank the existing 18 windows with frames decoded at **640x360**
(and an 854x480 arm for the quality-ladder question) — same videos,
same labels (cluster-level; loop 40 proved labels survive
re-clustering unchanged), same arch-arms machinery, new
`bank/reads360/`. The uncommitted bench work already points here
(`export-frames.mjs`, `live-frames.mjs`, `movenet-frames-*`, the
`oldphone-*-360p.json` rings with px/nm/raw distributions banked from
a real device at 360p): finish it, don't restart it. The 360p bank
also answers BlazeFace's recall question (§3.1) as a side effect.

**The instrument gets an acceptance test before any tuning trusts it**
— the step that was always missing: on the re-bank, male v p50 must
land near the phone's 0.657 (not 0.864), the no-signal share near
36-42% (not 2.3%), and the nm split near the phone ring's 12.66-clear
/ 2.88-null. The banked `oldphone-*-360p.json` distributions are the
reference. If the re-bank does NOT reproduce the device statistics,
the resolution hypothesis is falsified and the gap is something else
(codec, capture path) — either result is worth more than any sweep
run before it.

### 7.2 The device-in-the-loop harness

The Redmi (M2010J19SI, Android 12, Adreno 610 — the fp32-verified GPU
class, and the 2026-09-02 stage marks prove the probe path works) is
the A/B machine his daily phone must never be: scripted
install-control / install-candidate, drive the same video to the same
timestamps, read the rings. Every APK-carried engine change in §8 gets
its Redmi A/B before release. Probes exist (`probe_phone_cadence.py`,
`probe_phone_gate.py`, ring readers); the new work is only the
two-install choreography. The Redmi is also the *floor* device: a
change that works there works everywhere above it, which is what
"works on mobile perfectly" cashes out to.

### 7.3 The zero-install tuning loop on his daily phone

He is on 1086/1087-class builds; tuning.json rides the rules OTA. The
loop: push a number → he watches normally → read the rings. Every
threshold in SPEC is clamped to protection-reviewed ranges. The
standing rule from loop 40 carries verbatim: **a constant changed in
source and not in rules/tuning.json silently reverts on every device
at the next OTA** — the embedded-equality test is the guard, and every
new dial added to SPEC extends that test in the same diff.

### 7.4 Standing measurement rules (all pre-paid lessons)

Verify a flat sweep is real before recording it (two of loop 40's
flats were broken instruments). Break an assertion to prove a new test
can fail (twice this repo shipped checks that couldn't). Read
constants from the emitted bundle, never the source (the `var IY;`
class). Bank every series so a re-derivation costs no device run. A
probe that hit-tests our overlays must force them hit-testable; a
patch count without a display check overstates coverage. Never act on
n=1 on the emulator; its wall-clock wobbles 28%. Build every bench
worker-first (a main-thread MoveNet inference never returns on the
phone). A 0 read after a WebView pid change is a fresh counter, not a
clean run.

### 7.5 Desktop parity — measured, not asserted

Essentially all engine measurement to date is Android; the bar now
names desktop explicitly. What is on file: WebView2 worker alive on
webgl, verdict p50 89ms / p95 172ms, image p50 69ms — desktop already
*runs* at the cadence table's 0.5s-class row, which predicts
exposure in the ~8-15s class there, but that is a prediction. Stage 0
adds a **desktop baseline session**: the same ring probes over CDP
(`__TS_DIAG_NOW`, probes exist) on www.youtube with a playing watch
page, banked like a phone run — secsPerVerdict, reads distribution,
px distribution (desktop's bigger player decodes higher, so faces are
larger; the null-read share should be near the corpus's 2.3%, and if
it is not, desktop has its own calibration gap to chase). Every stage
checkpoint in §8 then carries a desktop line next to its Android
line. Desktop-specific risks to watch rather than pre-fix: www vs m
DOM drift in the player adapter, and association churn (cadence-
independent per §1.2 — fast verdicts shrink its cost but do not fix
the mechanism).

---

## 8. Build order — each stage shippable, visible, measured

He is tired of installing. Stages 0, 1, 3 need **no release**; stages
2 and 5 are **one APK each**; stage 4 is OTA-first with one
conditional APK; stage 6 is the long-pole open-source/model work and
gates nothing before it.

**Stage 0 — the instruments (no APK).** The 360p corpus + its
acceptance test (§7.1); the Redmi A/B choreography (§7.2); the desktop
baseline session (§7.5); and the two five-minute runtime probes the
survey put first — `navigator.gpu.requestAdapter()` inside WebView2
(likely yes) and inside the Redmi's WebView (likely no), results
banked. Checkpoint he can see: nothing — this stage is for us; its
deliverable is that every later number is about *his devices*. Exit:
acceptance test passes or the resolution hypothesis is falsified in
writing; desktop baseline banked; WebGPU answer on file.

**Stage 1 — tune what already ships (no APK, no install).** On the
validated 360p instrument, re-sweep the dials already in SPEC
(GENDER_CLEAR_SCORE within its floor, MEM_TRUST_*, MEM_SIM,
NULL_MINT_NM_FLOOR, CUT_DELTA) and push tuning.json. Checkpoint he can
see: fewer wrong blurs on the videos he actually watches, zero
installs. Exit: his rings move in the predicted direction
(readClearCertain up, memClear firing, wipe counters flat).

**Stage 2 — the engine release (ONE APK).** Together: MoveNet-on-
demand (§2.2) with its counters (`personsSkipped`, heartbeat);
the unified read-policy module + image null guard (§5.1);
face-anchored association (§4.2, corpus-proven first); the `CUT_MODE`
constant shipped in today's behaviour (§4.4); the WebGPU/WebNN probe
line; SPEC widened with the new dials (heartbeat, verdict duty /
max-interval, CUT_MODE), each clamped, embedded-equality test extended
in the same diff. Redmi A/B before release (§2.4). Checkpoints he can
see: the blur *keeps up* — verdicts ~2x more often on his phone, and
a Redmi-class device goes from one verdict per 40s to one per ~3.5s —
and thumbnails stop clearing on graphics. Exit numbers: secsPerVerdict
<= 1.2 on his ring; `wipeErasedBlurred` flat; 360p-corpus exposure
<= 45s at the device cadence; desktop ring re-run shows no regression.

**Stage 3 — two offline spikes (no APK, parallelisable).**
(a) face-api.js age_gender vs faceres at 38-62px through
`small-face.js` + the 360p corpus, abstention portability included
(§3.2). (b) The descriptor ROC (§3.4) — the licence pass is already
done by the surveys: dlib-128 (public-domain weights, TFJS-ready) is
the primary arm, MobileFace the fallback, alignment cost included in
the bench; OSNet body re-ID is a second-round arm only if the face
arms fail on back-turned coasting cases. Exit: each candidate either
clears its bar or dies in the bench with the table banked.

**Stage 4 — conditional follow-ups (OTA-first).** CUT_MODE flip if
the fair corpus arm holds (§4.4) — zero-install, reversible.
Settled-face sampling (§2.5) only under its +<=2s corpus exposure
budget — rides the next planned APK, never forces one. Descriptor or
gender-model integration only if Stage 3 cleared — one APK, Redmi
A/B, ABSORBED-attribution guard.

**Stage 5 — platforms (ONE APK).** Player adapters + the one-active-
pipeline budget for Reddit/X/IG in-feed video (§6.2),
emulator-verified per platform, one site per invocation. Checkpoint he
can see: gaze blur working on Reddit video and the IG feed.

**Stage 6 — the custom model and the open-source cut (long pole,
gates nothing).** Route 2 distillation (§3.6) once
`custom-model-2026-09-02.md` settles the data question; the standalone
release checklist (§3.6, §10). iOS delivery spike stays pinned to the
cousin window (§6.3) and is prepared before it. Native TFLite stays
gated behind Stage 2's measured remainder on the Redmi.

---

## 9. Risk register

Failure directions: **exposure** = should-be-covered left sharp
(unacceptable); **over-cover** = wrong person/nothing covered
(accepted, but it is his oldest complaint — bounded, not ignored).

| change | fails toward | mechanism | bound / guard |
|---|---|---|---|
| MoveNet-on-demand | exposure (weak tier) | back-turned person while faces>0 elsewhere, no cut | heartbeat <= 4s + cut-forced + faces==0 rule; corpus arm prices it before ship |
| MoveNet-on-demand | over-cover (phantom) | higher cadence mints more graphic patches | nm floor + null band already gate births; phantom counter watched |
| skip machinery regression | exposure (the 1070 class) | a skipped pass mis-reported to the eraser | skip only when faces>0; `wipeErasedBlurred` is the tripwire on every A/B |
| face-anchored association | exposure | too-loose key bridges two people; cleared track absorbs a woman | IDENT_SIM_MIN reset + CLEARED_TTL_MS; ship only with ABSORBED-s not degraded on corpus |
| image null guard | over-cover only | null/low-nm read stays covered | monotone by construction; 0 of 25 banked thumbnail faces refused at floor 5 |
| unified read-policy | drift removed, regression added | one module feeds both paths; a bad constant hits both | OTA clamps + embedded-equality test; dials revert over the air |
| CUT_MODE demote | exposure (edge) | same-position person inherits a demoted track across a cut | inherited state is blurred; re-clear needs fresh certain reads; state-machine review named in §4.4 |
| CUT_MODE demote | over-cover (phantom) | patch survives cut onto a title card | wipeIfEmpty + cut coast; OTA-revertible in one push |
| settled-face sampling | exposure | revocation delayed one verdict | ships only under a measured +<=2s corpus budget, else dropped permanently |
| gender-model swap (face-api.js) | exposure | no descriptor → no nm axis → abstention machinery weakened | abstention portability is IN the bench bar; no swap without an equivalent no-signal test |
| descriptor swap | exposure | a false match feeding association/memory | dies in the bench unless <2% false-match at 0.9; memory's trust/revoke guards retained regardless |
| custom distilled model | exposure | student confidently wrong where teacher abstained | three-part acceptance bar (§3.6) incl. abstention quality vs the shipped 96.3%/0% baseline |
| 360p corpus | wrong-instrument | tuning against a bank that still doesn't match the device | the §7.1 acceptance test is mandatory before any Stage 1 push |
| wider OTA SPEC | both | a bad push moves more dials | every range clamped at a protection-reviewed edge; unknown keys refused; worst case is a dial at a considered edge |
| open-source model release | reputational/licence | dataset provenance challenged after release | provenance table per source; ambiguous sources (FairFace) excluded until resolved in writing |
| iOS inline delivery | over-cover (stuck) | multi-MB parse fails mid-boot, blur-first never lifts | the fail-closed-forever class; retry bound + fail-open sweep verified in the spike matrix |
| platform adapters | over-cover | wrong selector whole-blurs a player | selectors from live DOM only, [unverified] until emulator-verified; player red line test per adapter |

The two owner-gated calls this plan surfaces and does not make: the
decode-quality ladder (page mutation + his data), and any change to
the image bars. Both are protection decisions and both wait for him.

---

## 10. Open-source boundaries — how "people use this as well" shapes the cut

Scope guard first: nothing in this section adds schedule before Stage
6. It constrains *where module seams go*, which costs nothing now and
everything later if ignored.

- **The engine modules that are already clean seams** and stay that
  way: `read-policy.mjs` (§5.1 — one file, pure, unit-tested, the
  entire verdict policy), `person-track.mjs` (tracker + state machine,
  already pure with a bench harness), `scene-gate.mjs`, `tuning.mjs`
  (the clamped-OTA pattern is itself worth documenting for reuse).
  Code is MPL-2.0 already; keep DOM/platform specifics out of these
  files and a stranger can lift them.
- **The bench harness is the second open-source artifact.** arch-arms
  + corpus-score + the banking pattern is a working "label your own
  footage, score exposure/false-cover/phantom, A/B a variant offline"
  kit. The corpus itself (YouTube-derived frames) cannot ship;
  the harness plus bank-your-own instructions can, and that is the
  honest cut.
- **The low-resolution gender/attribute model (§3.6) is the flagship
  candidate** — the survey shows the niche is genuinely empty. Its
  release checklist (model card, provenance, fairness slice
  evaluation, abstention semantics, ONNX+TFJS exports, Apache-2.0) is
  written in §3.6 and is the definition of done for Stage 6, not a
  vague aspiration.
- **What is NOT released:** rules/scriptlets stay CC0 as today; the
  identity-memory constants and protection floors ship as code like
  everything else (they are already public in this MPL repo — the
  boundary is not secrecy, it is packaging).

---

## Appendix: refused with evidence — the standing list, do not re-propose without new data

Track pooling of gender logits (rescues 4, loses 75). coco-ssd person
boxes (exposure 82 → 89.5s). GENDER_CLEAR_SCORE below 0.36 (a real
woman reads male raw 0.58-0.66 at his sizes). Shortening PFF_BODY_DOWN
from 6.0 (a speaker's legs went sharp). Cross-image inference batching
(BlazeFace fixes its batch dim). SharedWorker (absent in Android
WebView). Full-uint8 faceres requant (8/100 cover flips, 2 sign
flips). URL verdict cache beyond the shipped page-scoped one (2-6.5%
hit). A 64px size floor on images (covers a man who read male 0.99 at
53px). gender-ssrnet-imdb in any wrapper (saturated output, retired
2026-08-23, survey found no fix). WASM multithreading in a third-party
page (SharedArrayBuffer needs COOP/COEP from the platform's own server
— structural, not configurational). WebNN on Android before ~Chrome
150 (origin trial excludes Android; CPU-only there). MediaPipe as a
runtime for our models (Model Maker deprecated; it can only replace
them). Quantization for speed inside TF.js/WebGL (backend dequantizes
before compute — download-size only, accuracy cost real).

Refused on licence, with the weight files checked, not the repos:
InsightFace weights (all of buffalo/genderage/SCRFD — non-commercial),
MiVOLO v2 (gated backbone), DEX/IMDB-WIKI weights, Levi-Hassner (no
grant), Ultralytics YOLOv8/11 and anything trained with them (AGPL,
including the one published joint face+person model), mmyolo's RTMDet
re-host (GPL — take RTMDet only from mmdetection), **EdgeFace weights
(CC BY-NC-SA on Idiap's own model card; the MIT-badged ONNX re-host is
a repackager and cannot relicense them)**, every MobileFaceNet lineage
tracing to MS-Celeb-1M, DukeMTMC-trained OSNet variants. Holes,
windows, splits or silhouette-tight masks in any patch (owner rule,
twice).
