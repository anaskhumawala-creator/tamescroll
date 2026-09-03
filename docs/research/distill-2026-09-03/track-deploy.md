# Track: DEPLOY — everything after a student `.tflite` exists

2026-09-03. Read-only research pass. No source touched, no device driven.
Companion tracks: `track-prior-art.md` (what to build). This doc is the
integration surface, the gate, and the rollout.

Scope: the **video path only** (`#movie_player`). nsfwjs and the image
path are untouched by any of this — `spikes/native/REPORT.md` says
nsfwjs is not converted because "the video path is the Redmi's problem".

---

## 0. Bottom line, up front

Five things decide whether this ships, and four of them are not training:

1. **The corpus scorer is blind in the flattering direction for a new
   detector.** `corpus-score.mjs:21-24` — *"labels cover faces the
   DETECTOR FOUND. A person BlazeFace never detected is invisible here."*
   A student that misses faces scores LOWER exposure. The scorer must be
   changed before it may judge a student. This is the single most
   important item in the document.
2. **The 107 ground-truth labels are keyed on faceres descriptor
   clusters** (`corpus-label.mjs:36-62`, ids `vid#N`). A student
   descriptor re-clusters and every label is orphaned. Freeze them to a
   per-crop map first — one afternoon, and it must happen before any
   student run.
3. **`nm` has no student equivalent.** It is faceres' pre-L2 pooled
   magnitude (`face-decode.mjs:224-231`). A distilled descriptor's scale
   is a free parameter of the KD loss. Three replacement routes in §1.3;
   the cheapest safe one already exists in the repo unused
   (`face-marks.mjs`).
4. **The crop geometry cannot collapse into one 256 pass.** faceres
   today reads a 224 square crop of the NATIVE bitmap
   (`native-client.mjs:359-381`), so a 40px face arrives at 224px. Off a
   whole-frame 256 tensor it arrives at ~16px. `docs/detection-engine.md`
   already priced that exact failure at R16: *"the face arrives at ~2% of
   model input against BlazeFace's ~5% evaluation floor regardless of
   subject size"*. Two students (detect@256, attributes@224-crop) or a
   measured refutation.
5. **The corpus CAN score a new model** — the 10 source mp4s are on disk
   (`Z:/tamescroll-corpus/video/*.mp4`, verified present) and
   `corpus-lib.mjs:43 grabRaw` re-decodes them at 640x360. The bank
   stores derived reads, not pixels, so scoring a student means
   **re-banking**, not replaying. Cost ≈ 2.5 days of harness work.

Ceiling check, unchanged and still binding: a *perfect* gender model buys
13.7% of man-mode scored error and 24.1% of woman-mode
(`docs/research/custom-model-2026-09-02.md` §3, 491.5s → 424.0s). A
distilled student is normally worse than its teachers. **The student's
case is latency, not accuracy** — and one condition that doc set for the
latency case has since been met: it said "after the cheap MoveNet-skip
has been tried", and `PERSON_SKIP_EVERY` now ships at **4**
(`rules/tuning.json`). So the cheap lever is spent; the expensive one is
live.

---

## 1. INTEGRATION MAP

### 1.0 Where the three teachers are called

| path | file | call |
|---|---|---|
| Android native | `native-client.mjs:411 videoFrame` | modelId 3 then 1 on ONE 256 RGBA (`:436-437`) |
| Android native | `native-client.mjs:473 cropFaces` | modelId 1 on a 256 person crop |
| Android native | `native-client.mjs:505 cropGender` | modelId 2, **one request per face** (`:511-515`, "faceres batch is 1 natively") |
| Android native | `native-client.mjs:534 genderOnce` | modelId 2, one-shot |
| tfjs worker | `worker-entry.js:249 handleFrame` → `vframe/vfaces/vgender` (`:374-390`) | same shapes |
| in-page fallback | `init-entry.js:2404-2420` `detector.detectPersons` / `detectFaceBoxes` | last resort |

Engine selection: `init-entry.js:587 nativeVideo()` → `:604 vid()` →
`:684 workerVideo()`. One-way on failure (`:695 banWorkerVideo`).

### 1.1 MoveNet `[1,6,56]` → persons

**Consumer:** `person-gate.mjs:472 parsePersons(data, minScore, aspect, held)`.
Called at `native-client.mjs:445` with `personReply.outputs[0]` flat.

Layout it reads: 6 slots × stride 56; per slot 17 keypoints as
(y, x, score), then box, then `score` at offset 55 (`person-gate.mjs:486-487`).

Everything downstream of the keypoints, with line cites:

| consumer | constant | where |
|---|---|---|
| slot admission | `PERSON_MIN_SCORE 0.35` | `person-gate.mjs:25` |
| low tier | `PERSON_LOW_SCORE 0.12` | `:30` |
| keypoint confidence floor | `PERSON_KEYPOINT_MIN 0.3` | `:131` |
| evidence count | `PERSON_MIN_KEYPOINTS 5`, `PERSON_STRONG_KEYPOINTS 7` | `:134`, `:55` |
| weak (back-turned) tier | `PERSON_WEAK_KP15 8`, `PERSON_WEAK_MAXKP 0.25`, `PERSON_WEAK_ANCHOR 0.20` | `:263-274` |
| hysteresis / hold tier | `PERSON_HOLD_SCORE 0.22`, `_IOU 0.4`, `_KEYPOINTS 3`, `_MAX 8`, `PERSON_KEYPOINT_EXIT 0.22` | `:276-279`, `:454` |
| **ghost gate** | `PFF_FRAME_KP_FLOOR 0.1` via `frameMaxKp` / `frameHasNoHumanShape` | `:97`, `:1246`, `:1256` |
| head anchor | `headW = abs(lEar.x − rEar.x)`, else eyes×2.5, else shoulders×0.6, floored 0.04; `headH = headW * ar` | `:942-955` |
| patch top edge | `HEAD_ANCHOR_UP 1.6` | `:129` |
| R27 head floor | `clearedFaceBox` from `headX/headY/headW/headH`, `CLEARED_FACE_HALF 0.6`; refused below `HEAD_FLOOR_MIN_W 0.045` | `person-track.mjs:2311-2325`, `:181`, used `:2480-2489` |
| adjacency clamp core | `t.core` = hull of confident keypoints → `clampPatchOffFaces` | `person-track.mjs:2483` |
| slot-bounding | `rejectedSlotBoxes` → `boundBodyToSlot` | `person-gate.mjs:1565`, `:1584` |
| crop region | `PERSON_GATE_PAD 0.15`, `PATCH_MARGIN 0.045` | `:130`, `:125` |

**What the student must emit to keep every one of these unchanged:**

- **The same `[1,6,56]` tensor, six slots ALWAYS present.** MoveNet emits
  all 17 keypoints even when occluded, with low confidence rather than
  absence (`docs/detection-engine.md`, weak-tier section). Two shipped
  gates depend on that: the weak tier reads `nKp15` (keypoints ≥ 0.15) on
  slots nothing else admits, and `frameHasNoHumanShape` takes the max
  over **every** slot including rejected ones (`person-gate.mjs:1256-1265`).
  A student that emits only above-threshold detections **kills the ghost
  gate**. That gate is what stops a text slide minting a patch (gauntlet
  R21) — losing it is a phantom regression, i.e. his loudest complaint.
- Per-keypoint confidences on the SAME 0..1 scale, or every constant in
  the table above is void. A student trained with a different keypoint
  loss will not land at MoveNet's calibration. **Assume all 11 of those
  constants must be re-derived** unless the distillation explicitly
  regresses MoveNet's raw per-keypoint scores.
- Head keypoints specifically: ears, eyes, shoulders (indices 3/4, 1/2,
  5/6 — `person-gate.mjs:301-306`). The whole R27 head floor and the
  patch top edge are computed from ear/eye/shoulder x-spans. A student
  that emits a bounding box and a "head point" but not those six named
  keypoints cannot produce `headW`, and `clearedFaceBox` returns null →
  the clamp gets no floor (`person-track.mjs:2480`) → the phase-L L1
  exposure (an edge crossing into a subject's own head box) comes back.

**Cheapest shim if the student's person head is a different shape:** a
pure JS adapter that writes the student's outputs into a `[1,6,56]`
Float32Array before `parsePersons`. Costs nothing at runtime (336 floats)
and keeps every gate literally unchanged. Recommend this over changing
`parsePersons` — that function is the one the control triple is *blind
to* (§3.0.2), so edits there are unmeasurable by the cheap gate.

### 1.2 BlazeFace 4 tensors → faces

**Consumer:** `face-decode.mjs:120 faceRowsFromOutputs(outputs)` →
`:156 facesFromRows(rows)`.

- Outputs are matched **by LENGTH**, not by name: 384, 512, 384×16,
  512×16 (`face-decode.mjs:126-133`). Anchors regenerated in JS
  (`:48-70`), sigmoid applied in JS (`:102`), boxes decoded against
  anchor centres, 6 landmark pairs added back (`:110-116`).
- `facesFromRows`: NMS at `FACE_IOU 0.1`, `FACE_MAX 20`,
  `FACE_MIN_CONFIDENCE 0.35` (`face-decode.mjs:30-33`), then
  `FACE_ENLARGE 1.4` and squarify (`:167-171`), then `marks` normalised
  the same way (`:182`).
- Downstream: `faceOrderBySize` + `faceInsideIndex` + `claimed` set →
  synthetic bodies (`person-gate.mjs:1890-1940`, called
  `init-entry.js:4115-4135`); `personFromFace` (`person-gate.mjs:1267`)
  builds the synthetic body from face height ÷ 1.4 (de-inflating
  `FACE_ENLARGE` — `:1269`), so **the 1.4 is load-bearing geometry, not
  a crop convenience**.
- `FACE_MIN_NATIVE_PX 40` (`gender-verdict.mjs:549`) applied at
  `init-entry.js:2954` against `nativePx` computed `:2936`.
- `marks` (6 landmarks) are today **diagnostic only** — `markShape` /
  `markRing` banked at `init-entry.js:2170`, nothing decides on them
  (`face-marks.mjs:19-23`: "NOTHING HERE DECIDES ANYTHING YET").

**What the student must emit:**

- Simplest: **decoded face boxes + confidence, already NMS'd**, in
  normalized 0..1 of the source. Then `faceRowsFromOutputs` /
  `facesFromRows` are bypassed and `FACE_IOU`/anchors disappear. But
  `FACE_ENLARGE 1.4` must be applied by the student's adapter, or
  `personFromFace` shrinks every synthetic body by 1.4 — a silent
  exposure.
- `FACE_MIN_CONFIDENCE 0.35` is a BlazeFace calibration
  (`face-decode.mjs:26-30`: sub-0.35 detections "were mostly non-faces").
  **It does not transfer.** Re-derive on the same population that set it,
  and expect a different number.
- Landmarks: emit them. They cost nothing extra in a distilled head, and
  `face-marks.mjs` is the leading candidate to replace the `nm` gate
  (§1.3) — that file exists precisely because "confidence, size and frame
  keypoints" all failed to separate a face from a face-shaped graphic
  (`face-marks.mjs:5-17`, refused conf p50 0.78 vs kept 0.79).

### 1.3 faceres 3 heads → gender / age / descriptor

**Consumer:** `face-decode.mjs:198 genderReadsFromOutputs(genderData, ageData, descData, boxes, hadGenderHead)`.
Assembled from N single-face replies at `native-client.mjs:383-405`
(again matched **by length**: 1, 100, 1024).

| head | shape | derived | consumer constants |
|---|---|---|---|
| gender | `[N,1]` sigmoid | `raw = v`; `score = min(0.99, 2·abs(v−0.5))` (`face-decode.mjs:201`) | `GENDER_MIN_SCORE 0.25` (`gender-verdict.mjs:12`), `GENDER_CLEAR_SCORE 0.45` (`:110`), `GENDER_CLEAR_SCORE_FEMALE 0.35` (`:140`), `GENDER_IMAGE_MIN_SCORE 0.4` (`:61`), `isNullRead` band `NULL_V_LO 0.53 / NULL_V_HI 0.72` (`:551-552`) |
| age | `[N,100]` softmax | expected value `age`; `childP` = mass under 18; `ageBin/ageMass/ageEnt` (`face-decode.mjs:206-220`) | `GENDER_ADULT_AGE 18` (`:336`), `GENDER_CHILD_MASS 0.25` (`:392`), `NULL_AGE_LO 34 / HI 42` (`:553-554`) |
| descriptor | `[N,1024]` | L2-normalised in place; `shape.norm = nm` kept BEFORE normalising (`face-decode.mjs:224-231`) | `NULL_MINT_NM_FLOOR 5` (`gender-verdict.mjs:648`), `hasDescriptorSignal` (`:672`), `mayNotMint` (`:678`), `MEM_SIM 0.6` (`identity-memory.mjs:71`), `IDENT_SIM_MIN 0.15` (`person-track.mjs:192`) |

**Three consumers CANNOT survive a distilled head unchanged.**

**(i) `nm` — the null-mint gate. No student equivalent exists.**

`nm` is the magnitude of faceres' `global_pooling/Mean` before L2
normalisation. `gender-verdict.mjs:610-620` states its whole value: *"how
much the network extracted, not which way it leaned"*, and it is **not
the sigmoid restated** — within a narrow v slice the correlation with
|v−0.5| collapses to −0.21..+0.30. Measured separation: 12.66 clearing /
2.88 null on his phone over 300 reads; 11.40 out-of-band / 3.87 in-band
male on 6,281 corpus reads (`gender-verdict.mjs:614-621`).

A distilled descriptor trained with cosine/KD loss has **no calibrated
magnitude** — the scale is whatever the loss left. Three routes:

| route | what it is | cost | risk |
|---|---|---|---|
| (a) regress the un-normalised vector with an MSE loss so ‖ŷ‖ tracks ‖y‖, then re-derive the floor | preserves the axis | training constraint + 1 re-derivation run | the student now has to match a 1024-d magnitude, which is the hardest thing to distil |
| **(b) a trained scalar "is this crop a face" head, re-key `mayNotMint` on it** | makes the signal an OUTPUT instead of an accident of pooling | new head + new OTA dial + full re-derivation | it is a NEW gate; a new gate that refuses a real face is the loop-37c failure verbatim |
| (c) ship `NULL_MINT_NM_FLOOR 0` | the gate off | zero | reinstates ~89 of 300 reads minting patches (his "random blur marks"); monotone toward COVERING so it **cannot** add exposure (`gender-verdict.mjs:625-628`) |

Recommend **(c) for step 1 of the rollout** — it is already reachable
over the air, `tuning.mjs:84` range `[0, 5.5]`, so the student can ship
with the gate off and no install — then **(b)**, using
`face-marks.mjs`'s landmark-arrangement measurements as the candidate
axis rather than inventing one. Re-derivation arm already exists:
`app/gaze/bench/nm-floor.mjs` over `spikes/gauntlet/nmtruth-{face,nonface}.json`
(125 real-face reads × 5 sizes, 403 in-band non-face reads).

Acceptance for any replacement, from the floor's own table
(`gender-verdict.mjs:641-644`): **0 of 125 real faces refused** and
**≥ 96.3% (388/403) of in-band non-faces refused**. Floor 6 refused 5 of
125 real faces and is the recorded exposure edge.

**(ii) `MEM_SIM 0.6` — the identity descriptor's operating point.**

A student descriptor's cosine distribution is not faceres'. This repo has
already deleted identity memory once for exactly this class of failure:
*"same-person median 0.90 and 5th pct 0.28, but DIFFERENT people scored
≥0.6 in 32% of pairs and ≥0.9 in 17% — the distributions overlap across
their whole useful range, so there is no operating point"*
(`docs/detection-engine.md`, "Identity memory — DELETED IN R13"). And
`arch-arms.mjs:20-30` records that at 0.60 two different people of the
SAME gender cross five times as often as a cross-gender pair.

**A student descriptor may not be given a threshold until the same
two-distribution test is re-run**: same-person pairs vs same-frame
different-person pairs. The pair sets are reconstructible from the frozen
crop labels (§3.2 step 1) at zero device cost.

**(iii) the age posterior.**

`NULL_AGE_LO 34 / HI 42` is a window drawn round **faceres' own adult
training prior (~36.9)** — `gender-verdict.mjs:695-702`. A student has a
different prior, so the window is meaningless until re-measured. The
measurement is cheap: run the student over the 403 in-band non-face crops
and take age p05/p50/p95; today's faceres reads 35/38/41 (CLAUDE.md loop
37e).

`GENDER_CHILD_MASS 0.25` needs the full **100-bin posterior**, not a
scalar: the constant exists because *"a mean over a bimodal posterior
lands where no mass is"* (`docs/detection-engine.md`, "Child gate: mass,
not mean"). A student emitting only a scalar age destroys the child gate.
It must emit either the 100-bin softmax, or `(age, childP)` as two
separately calibrated scalars **plus** a substitute for the null-age
window.

### 1.4 Summary — the student's required output contract

| # | output | shape | why |
|---|---|---|---|
| 1 | person slots | `[1,6,56]` (or a JS adapter to it) | `parsePersons` and 11 constants |
| 2 | per-keypoint confidence, all 17, always present | inside (1) | weak tier + `frameHasNoHumanShape` |
| 3 | ear / eye / shoulder keypoints specifically | inside (1) | `headW`, R27 head floor, patch top edge |
| 4 | face boxes + confidence, normalized, NMS'd | `[K,5]` | `facesFromRows` replacement; adapter applies `FACE_ENLARGE 1.4` |
| 5 | 6 face landmarks | `[K,12]` | `face-marks.mjs`, candidate `nm` replacement |
| 6 | gender sigmoid, per face, **read off a 224 crop of the native bitmap** | `[K,1]` | 5 threshold constants + the null band |
| 7 | age, 100-bin softmax | `[K,100]` | child gate needs the mass, not the mean |
| 8 | identity descriptor, un-normalised | `[K,D]` | `MEM_SIM`; magnitude also feeds (9) if route (a) |
| 9 | crop-is-a-face scalar | `[K,1]` | the `nm` replacement, route (b) — **strongly recommended** |

---

## 2. PROTOCOL

### 2.1 What exists

Wire format, `native-frame.mjs:9-19`:

```
page -> native  [u32 reqId, u32 modelId, u32 w, u32 h] + RGBA w*h*4   (LE)
native -> page  [u32 reqId, u32 status, u32 nOutputs, u32 elapsedUs]
                then per output [u32 byteLength] + float32 data
```

- `decodeReply` already returns an **arbitrary-length** outputs array
  (`native-frame.mjs:57-76`) and throws on any self-inconsistent reply.
  **N heads therefore cost ZERO protocol change.**
- modelIds: 1 BlazeFace, 2 faceres, 3 MoveNet (`native-client.mjs:25-27`);
  0 = CONFIG, a bare 16-byte header carrying `NATIVE_CPU_MASK` in `w` and
  flags in `h` (`native-client.mjs:67`, `:221-248`; Kotlin
  `NativeInfer.kt:507 handleConfig`).
- Kotlin side: `MODEL_ASSET` map (`NativeInfer.kt:53`), report names
  (`:54`), per-model fp16 membership `MODEL_FP16 = setOf(2)` (`:64` —
  faceres only; MoveNet fp32 because fp16 is **blind** on Adreno 610,
  BlazeFace fp32 per phase-k K1), input packing per model id
  (`:538 fillInput` — BlazeFace `(x/127.5)−1` float, faceres raw 0..255
  float, MoveNet raw int32), 3-strike per-model death (`:52`, `:494`).
- Input sizes: 256 for BlazeFace and MoveNet, 224 for faceres
  (`native-client.mjs:33-35`).

### 2.2 The smallest change for a multi-head student

**Recommendation: one NEW modelId `4 = student`, N outputs. Keep 1/2/3.**

| change | file | ~lines |
|---|---|---|
| `MODEL_STUDENT = 4` + a branch in `videoFrame`/`cropFaces`/`cropGender` | `native-client.mjs:25`, `:411`, `:473`, `:505` | 60 |
| `MODEL_ASSET`/`MODEL_REPORT_NAME` entry, `MODEL_FP16` decision, `fillInput` case 4 | `NativeInfer.kt:53`, `:54`, `:64`, `:538` | 25 |
| **output index by NAME, not by length** (below) | `native-client.mjs` new | 30 |
| flags bit 1 = "student allowed" so the engine knows what to load | `native-client.mjs:87 configFlags`, `NativeInfer.kt:507` | 20 |

**The one protocol defect a multi-head model exposes:** replies carry no
tensor names, so both decoders match outputs **by byteLength** —
`face-decode.mjs:126-133` (4 face tensors of 4 distinct sizes) and
`native-client.mjs:384-389` (`sorted[0]/[1]/[2]` = gender/age/descriptor
by length 1 < 100 < 1024). A student with, say, a `[K,1]` gender head and
a `[K,1]` faceness head becomes **ambiguous and silently wrong**.

The fix is already 90% present and unused: `postReady` publishes each
model's `getOutputTensor(i).name()` list (`NativeInfer.kt:619-628`,
`models[].outputs`), and `parseReady` passes `models` through
(`native-frame.mjs:96`), but `native-client` never reads it (`:264-270`
stores `state.models` and stops). Build the index map from that list
once, at ready. ~30 lines. **Do this before adding any equal-length
head**, and note that TFLite output order is signature-key order, not
graph order (`spikes/native/REPORT.md`, model contracts: *"read by name,
never by index"*).

**Three modelIds served by one interpreter** (the alternative) is worse:
`handleFrame` looks up `models[modelId]` and compares `w`/`h` against
that model's own input shape (`NativeInfer.kt:474-477`), so three ids
pointing at one interpreter with two different input sizes needs a
per-id input-size table anyway — the same work, plus an aliasing map,
plus a report that lies about which backend served what.

### 2.3 The pass does NOT collapse to one request — and this is the design constraint

Today one verdict pass is:

1. one `drawTo(256)` + **two** requests (MoveNet, BlazeFace) on the same
   RGBA (`native-client.mjs:436-437`);
2. then `cropGender` → `squareBox` → `drawSquareCrop` at 224 **per face,
   from the native-resolution bitmap** (`:505-520`, `:359-381`), one
   request each.

Step 2 is why a 40px face reaches the attribute model at 224px. If the
student reads attributes off the whole-frame 256 tensor, that same face
arrives at ~16px of model input. `docs/detection-engine.md` already
measured this class and removed a re-detect for it (R16 row): *"the face
arrives at ~2% of model input against BlazeFace's ~5% evaluation floor
regardless of subject size"*. His player decodes 640x360 with facePx p50
38-62; 26.8% of corpus reads sit in that band and 49.9% are under 64px
(`custom-model-2026-09-02.md` §1).

So the deployable shapes are:

- **(A) two students** — detect+pose at 256 (replaces MoveNet+BlazeFace,
  2 requests → 1), attributes at 224 crops (replaces faceres, unchanged
  cadence). Pass cost falls by one whole-frame inference plus whatever
  the merged detector saves. **Recommended.**
- **(B) one student at 256 doing everything** — one request per pass, the
  biggest latency win, and it must be shown NOT to collapse on 38-62px
  faces before anything else is measured. That is a bench question, not a
  training question, and it is answerable on the corpus today by slicing
  by `px` (§3.2 gate B5).

### 2.4 The tfjs fallback

The tfjs worker (`worker-entry.js`) is the engine everywhere Android's
port does not exist — desktop WebView2, and any Android page where
`__TS_TAKE_NATIVE_PORT` returns nothing (`init-entry.js:617-624`). It
loads models through `detector.js:166 ioHandlerFor(kind)`, with
`MODEL_ASSETS = {face: 'blazeface', gender: 'faceres', nsfw, person}`
(`detector.js:110`) fetched from `/__tamescroll/models/<asset>.json|.bin`
(`:138-146`) and base64-inlined only where our interceptor is unreachable
(`model-blobs-lazy.mjs:1-20`).

Sizes today, `app/gaze/models/` (raw, single copy in the binary):

| model | .bin | .json |
|---|---|---|
| blazeface | 538,928 | 79,038 |
| faceres | 6,978,814 | 71,432 |
| movenet-multipose | 4,938,727 | 250,686 |
| **video-path total** | **12,857,625 B (12.26 MiB)** | → **~17.1 MB base64** when inlined |

Two options:

1. **Ship the student as tfjs too.** The tfjs fallback then shrinks by
   12.86 MB minus the student. Cost: a second export path and a second
   parity gate — and the WebGL runtime is a **known divergence**: findings
   25 says tfjs-WebGL on Adreno 610 is BLIND to MoveNet (maxKp 0.03-0.19,
   admits nobody) where TFLite CPU/GPU fp32 read 0.77-0.82 on the same
   frames. A student inherits that risk class, not the specific bug.
2. **Fallback stays on the three teachers.** Zero bundle change, but two
   decision layers in the field, and every number has to name which. The
   desktop path never gets the win.

**Recommend (1), gated on its own parity run, and until then ship the
student Android-only behind `NATIVE_STUDENT` — which is free, because the
`NATIVE_*` dials are already Android-only by construction.** See the
ordering constraint in §4 (fail-safe): the teachers may not leave the APK
until the student also ships as tfjs, or a native death on his Redmi
falls back to a WebGL worker with no working person model.

---

## 3. THE BENCH THAT GATES SHIPPING

### 3.0 What the existing instruments can and cannot do — read this first

| # | blind spot | cite | consequence for a student |
|---|---|---|---|
| 1 | ground truth is **faces the teacher found** | `corpus-score.mjs:21-24` | a student that MISSES a face lowers exposure. **The corpus scores a new detector in the flattering direction.** |
| 2 | the bank stores **parsed persons (boxes)**, so scoring sits downstream of `parsePersons` and is blind to the extent layer — `PATCH_MARGIN` 0.045→0.500, `PERSON_MIN_SCORE`→0.99, `HEAD_ANCHOR_UP`→0.0 all leave it green | `test/control-triple.test.mjs:21-36` | a student that changes person-box shape is invisible to the cheap gate |
| 3 | the 112px PPM crops are a nearest-neighbour thumbnail **for a human**; "the model never sees this resampling" | `corpus-bank.mjs:65-67` | re-running a student on those crops (as `custom-model` §7.1 proposes) measures it on resampled pixels — re-decode instead |
| 4 | ffmpeg mp4 decode ≠ live MSE decode; no compression/motion artefacts, no Adreno fp behaviour, no detector recall | `custom-model-2026-09-02.md` §7.7 | a corpus win is never a ship decision on its own |
| 5 | labels are keyed on **faceres descriptor clusters** | `corpus-label.mjs:36-62`, ids `${vid}#${i}` | a student descriptor orphans all 107 labels |

Blind spots 1 and 5 must be **fixed before the first student run**.
Blind spot 2 means the extent-layer benches
(`bench/movenet-gated.mjs`, `bench/movenet-held.mjs`,
`bench/extent-reach.mjs` — they decode video) are mandatory, not
optional.

### 3.1 (a) Head-by-head parity — and the frame it belongs in

Harness that exists: `spikes/gauntlet/probe_faceres_parity.py` (drives
his phone over CDP; host serves `spikes/faceres-parity` on :8899 via
`adb reverse`) + `app/gaze/bench/faceres-parity.js`. Population: 20 live
search thumbnails × 5 deterministic crops = **100 byte-identical
`[1,224,224,3]` tensors** (`faceres-parity.js:33-56` — no detector on
purpose, so a detector difference can't be read as a model difference).
Metrics it already emits (`:152-172`): gender |Δ| p50/p95/max, age |Δ|,
childP |Δ|, `descCosMin`, `signFlips`, `flips025`, `flips040`,
`nullFlips`, `childFlips`, worst-5.

**Loop 34's refused uint8 faceres, measured on his phone:**

| metric | loop-34 value |
|---|---|
| gender \|Δ\| p50 / p95 / max | 0.0234 / 0.0758 / **0.1042** |
| age (years) p50 / p95 / max | 0.53 / 2.05 / 3.73 |
| childP p50 / p95 / max | 0.0102 / 0.0420 / 0.0567 |
| sign flips | **2** |
| decision flips @ `GENDER_MIN_SCORE` 0.25 | **17 / 100** |
| decision flips @ `GENDER_IMAGE_MIN_SCORE` 0.4 | **8 / 100** |
| `isNullRead` band crossings | **11** |
| child-gate crossings | **10** |
| descriptor cosine **min** | **0.5962** (against `MEM_SIM` 0.60) |

**Thresholds that would have refused it — gate A2:**

| metric | REFUSE at | headroom vs loop 34 |
|---|---|---|
| gender \|Δ\| p50 | > 0.010 | refused 0.0234 |
| gender \|Δ\| max | > 0.050 | refused 0.1042 |
| sign flips | > 0 | refused 2 |
| flips @ 0.25 | > 2 / 100 | refused 17 |
| flips @ 0.40 | > 1 / 100 | refused 8 |
| null-band crossings | > 2 / 100 | refused 11 |
| child-gate crossings | > 0 | refused 10 |
| descriptor cosine min | < 0.90 | refused 0.596 |
| age \|Δ\| p95 | > 1.0 yr | refused 2.05 |

**The frame matters and it is easy to get wrong.** A parity table asks
*"does B reproduce A"*. That is the right question for a **quantisation**
and the wrong question for a **student**: a student that is genuinely
better than faceres on 40px faces fails every row above. So:

- **Gate A1 — student(f32) vs teachers.** Run the same table, but as
  *information only*. The decision metric here is agreement with
  **LABELS**, not with the teacher: on the labelled corpus crops, per-class
  recall by px slice (§3.2 B5). Nothing in the A2 table may block A1.
- **Gate A2 — student(shipping export) vs student(f32 reference).** The
  table above, verbatim, mandatory, for **every** export variant: fp16
  GPU delegate, any int8, and NNAPI. This is the gate that catches a bad
  quantisation and it is exactly what `NativeInfer.outputsAgree` does a
  cruder 2%-per-head version of at load time
  (`NativeInfer.kt:243-262`; its own comment says 10% was looser than the
  requant loop 34 refused at a measured p50 0.023).

**Two arms do not exist and must be written:**

- a **face-head** parity arm — there is none today. Extend
  `faceres-parity.js`'s harness shape: same fixed inputs, compare box
  IoU, confidence, and the 6 landmarks.
- a **person-head** parity arm — `app/gaze/bench/movenet-parity.js`
  exists and banks a fixed-input arm (20 ytimg thumbnails through the
  shipping `detectPersons`; emulator baseline persons 25/25, maxKp p50
  0.816 / max 0.858, noShapeFrames 0 — CLAUDE.md loop 36). Extend it to
  the student and compare **admitted persons after `parsePersons`**, not
  raw scores — the raw-vs-gated trap `movenet-gated.mjs:8-18` warns about.
  **Build every bench worker-first**: a main-thread MoveNet inference
  never returns on his phone (CLAUDE.md loop 36, stuck at `infer-0` for
  six minutes, twice).

### 3.2 (b) End-to-end on the corpus

**Answer to the brief's question: the bank does NOT store pixels.**
`bank/reads/*.json` stores derived reads — box, conf, `px`, gender,
score, raw, age, childP, `nm`, `shape`, `descIdx`, `crop`
(`corpus-bank.mjs:118-130`) — plus `bank/reads/*.desc` (1024-d
descriptors) and `bank/persons/*.f32` (raw MoveNet `[1,6,56]`,
`arch-arms.mjs:307-312`). Pixels are 112×112 PPM thumbnails for human
labelling only.

**But the 10 source mp4s are on disk** (`Z:/tamescroll-corpus/video/`,
verified: `1L_R0MB2W5A, 4u3jS_cTHH0, 8R1hy3uHds0, Ary1gIbaOTc,
H14bBuluwB8, KAWvDsghyc8, NWoT1ZVd1Lo, RcGyVTAoXEU, eIho2S0ZahI,
z86LGEFyQpo`) and `corpus-lib.mjs:43 grabRaw` re-decodes them at 640x360
with ffmpeg — which is how the bank was built.

**So the corpus CAN score a student — by RE-BANKING, not by replaying.**
`BANK` is already an env var (`corpus-lib.mjs:22`), so a second bank
lives beside the first.

Work, in order:

1. **Freeze the labels per crop, once.** Write
   `bank/label/crop-labels.json = {crop: label}` from today's
   `clusters.json` + `labels.json`. Members already carry
   `crop = "${tag}/f%04d_b%d.ppm"` (`corpus-label.mjs:57-58`) and **every**
   consumer already joins by crop (`arch-ab.mjs:52-55`,
   `control-triple.test.mjs:54-57`). After this, never re-cluster.
   *Without this step every student run is unlabelled.*
2. **`corpus-bank-student.mjs` + `corpus-persons-student.mjs`**, writing
   the identical schemas into `bank-student/`.
3. **Join labels by IoU.** For each student face, best IoU against the
   teacher face list for that same `(tag, frame)`; ≥ 0.5 inherits the
   crop's label. No match → unlabelled → skipped **in both directions**,
   which the scorer already does symmetrically (`corpus-score.mjs:105-118`).
4. **Add the missing error class — this is the important one.** A teacher
   face carrying a `shouldCover` label that the student did not detect,
   and which no student patch covers, must be charged **EXPOSURE**.
   Without it, detector misses score as improvements (§3.0.1). New code
   in `score()`; report it as a separate column
   (`exposureMissedDetectionS`) so it can never be quietly folded in.
5. **Score both arms with a byte-identical decision layer**:
   `hisRegimeOpts(g)` (`arch-arms.mjs:190`), `thinFrames(win, K_HIS)`
   (`:128`), `K_HIS = 2` derived from `his-regime.json` verdictGapP50
   1201 (`:120-121`), told `HIS_EFFZOOM` from verdictMs 795 × `VERDICT_DUTY`.
6. **Re-run the extent-layer benches** the control triple is blind to:
   `movenet-gated.mjs`, `movenet-held.mjs`, `extent-reach.mjs`.

**Acceptance table.** Control = `arch-arms.CONTROL`
(`arch-arms.mjs:184-186`), config *`PTRACK_IOU_MIN 0.15, CUT_DELTA 60,
PTRACK_ASSIGN optimal, PTRACK_MIN_COAST_PASSES 2`*:

| gate | metric | must reach | why this number |
|---|---|---|---|
| **B0** instrument check | teacher run through the **re-bank** pipeline, then scored | man exactly **13.5 / 117.5 / 477.5**, woman **15.0 / 181.0 / 569.5** | if a re-bank of the teacher does not reproduce the published triple, the instrument moved and no student number means anything |
| **B1** exposure, man | `exposureS` | ≤ **13.5s**. Any increase blocks. | exposure is the severest class; the repo's whole ordering |
| **B1b** exposure incl. missed detections | `exposureS + exposureMissedDetectionS`, both arms | student ≤ teacher | closes §3.0.1 |
| **B2** false cover, man | `falseCoverS` | ≤ **123.4s** (117.5 + 5%) | 143s of man-mode false cover survives a *perfect* model and is accepted geometry policy (`custom-model` §3) |
| **B3** phantom, man | `phantomS` | ≤ **501.4s** (477.5 + 5%) | ~88% of phantom is unclaimed patches no model fixes (`custom-model` §3) |
| **B4** woman mode | all three | same rule vs 15.0 / 181.0 / 569.5 | "report all three errors, both gender modes, always" (`custom-model` §7.2) |
| **B5** px slices | exposure + per-class recall in `<40 / 40-64 / ≥64` | no slice worse than teacher | §1 of `custom-model`: three sweeps already read flat because they ran over faces bigger than the device sees |
| **B6** oracle-relative | total scored error | recover ≥ **50% of the 68s** man-mode oracle prize (i.e. ≥ 34s of 491.5s), else the model is not worth its risk | "Score against the oracle arm, not against zero" (`custom-model` §7.6) |
| **B7** extent layer | `movenet-gated` / `movenet-held` admitted persons + geometry | ≥ teacher admissions, patch area within ±10% | control triple is blind here (§3.0.2) |
| **B8** cluster split | held-out split by CLUSTER, never by read | mandatory | 3,465 reads are 107 clusters over 10 videos (`custom-model` §7.3) |

Tolerances: **exposure gets zero**, the other two get 5% because the
corpus is 10 heavily autocorrelated videos — *"n is not confidence"*
(`custom-model` §"Honest limits" 5).

### 3.3 (c) Device A/B on the Redmi

Device: the OLD Redmi `1ec2c48e0621` (M2010J19SI, Helio G85, Mali) is on
ADB and is the smoke device; it **cannot** answer the NPU question and
proves only that the arm fails safe. His Redmi 13 (SM4450, Adreno) is the
phone the numbers are for.

Instruments, all present:
`probe_events.py <cdpPort> <label> [secs] [videoId] [seekTo]` — 180s,
NWoT1ZVd1Lo @ 55s, man mode; joins per rAF frame the presented media
time, every visible patch normalized to the video rect, the reads ring,
the per-pass track ring, life counters and cut times, then classifies
EXPOSURE / FALSECOVER / PHANTOM offline
(`spikes/gauntlet/probe_events.py:1-31`). Plus `events_reclass.py`,
`cover_source.py`, `trace_cover.py`, `stale_target.py`, and
`probe_drops_ab.py` for the frame-drop cost.

| gate | metric (180s, same video/seek, man mode) | must reach | baseline |
|---|---|---|---|
| **C1** exposure | `nPositive` over 300ms windows | **0** | 0 in all four v1096 runs |
| **C2** false cover | certain-male reads covered | ≤ **16 / 82** | v1096f shipped 16/82 |
| **C3** render integrity | `repositionErrors`, stale frames | **0 / 0** | v1096f: 0 over 7836 rAF |
| **C4** cut keying | `cutLocated / (cutLocated + cutUnlocated)` | ≥ **25 / 28 = 0.89** | 1097 smoke |
| **C5** verdict cost | verdict p50 | ≤ **355 ms** | 1094 shipped 355 (1093 native 474) |
| **C6** verdict gap | gap p50 / p95 | ≤ **805 / 2353 ms** | 1094 |
| **C7** dropped frames | `probe_drops_ab.py`, 426p, 120s, control arm | < **13.2%** — this is the point of the whole project | smart control 13.2%, off 0%, `DELAY_MS 0` 9.3%, `VERDICT_DUTY 4` 11.5% |
| **C8** backends | About report `native.backends` per model | every model `gpu` (or `npu: ok`), none `cpu` | `native-client.snapshot()`, `diag-report` `native{}` |
| **C9** fail-safe | terminate the client mid-video | `nativeDead` 0→1 once, worker takes over, covered samples do not fall to 0 | loop 47: 15/20 → 12/20, no exposure |

Probe rules that cost runs when forgotten:
**one planted arm per invocation** — `Page.addScriptToEvaluateOnNewDocument`
lives for the CDP session and a second plant in one process gets BOTH
(CLAUDE.md loop 50-51); **a 0 read after a WebView context reset is a
fresh counter, not a clean run** (loop 37f); **lock rotation** before any
rect-sensitive probe (loop 48).

### 3.4 The critic gate

`bench/critic-gate.mjs` exits non-zero while any EXPOSURE or WRONG-NUMBER
row in `docs/critic/ledger.md` is OPEN, and a missing/unparseable ledger
exits 2. A student is its own phase; expect an Opus critic pass over the
whole diff with its own ledger rows, and **an open EXPOSURE row blocks
the release** (project CLAUDE.md, standing rule).

---

## 4. ROLLOUT

### 4.1 The dial

`NATIVE_STUDENT: [0, 1]` in `tuning.mjs` SPEC beside `NATIVE_INFER`
(`tuning.mjs:302`), shipping **0** in `rules/tuning.json`. Numbers only —
executable code never travels this channel (`tuning.mjs:14-22`), same
store-policy split as scriptlets. Regenerate
`rules/manifest.json` via `scripts/gen-rules-manifest.mjs` or shipped apps
never see it.

Semantics:
- **1** — the pass sends modelId 4; **0** — modelIds 1/2/3, byte-for-byte
  1098 behaviour.
- Page side: one branch in `videoFrame` / `cropFaces` / `cropGender`.
- Engine side: the engine must be told, because it decides what to
  *load*. Use **flags bit 1** of the existing CONFIG request
  (`native-client.mjs:87 configFlags`, `NativeInfer.kt:507`). Bit 0 is
  already `NATIVE_NPU`.
- **Known wrinkle:** the CONFIG is sent *after* `native-ready`
  (`native-client.mjs:271-277`), and the engine is one per process that
  outlives the document (`NativeInfer.kt` class comment). So the first
  page of a process pays whatever `loadAll` decided. Either accept a
  one-page delay (recommended — the engine persists, so it is one page
  per app launch) or persist the last flags in SharedPreferences.
- **A 1098-or-earlier phone REFUSES the unknown key** (whitelist,
  `tuning.mjs` SPEC), so pushing the dial is safe before the release
  lands. Same property the 11 perf dials relied on.

### 4.2 APK size

Today, `app/src-tauri/gen/android/app/src/main/assets/models/`:

| asset | bytes |
|---|---|
| blazeface.tflite | 580,224 |
| faceres.tflite | 13,956,708 |
| movenet-multipose.tflite | 19,016,912 |
| **total** | **33,553,844 (32.0 MiB)** |

APK is **94 MB** with those three f32 models (CLAUDE.md, 1093 release
note). Adding a student:

| student size | f32 asset | APK ≈ | verdict |
|---|---|---|---|
| 3M params | 12 MB | 106 MB | acceptable |
| 6M params | 24 MB | 118 MB | borderline |
| 8M params | 32 MB | 126 MB | too big — he installs by hand |

Two levers:
- **fp16 the student** (halves it), but `MODEL_FP16` excludes MoveNet and
  BlazeFace **for measured reasons** (`NativeInfer.kt:56-70`: fp16 is
  blind to MoveNet on Adreno 610; phase-k K1, fp16 BlazeFace lost the
  only face on the one parity frame where MoveNet admits nobody). A
  student inherits that risk class and must pass gate A2 at fp16 before
  it may ship that way.
- **Drop the teachers** — but only in the release *after* the one where
  `NATIVE_STUDENT` defaults to 1, and only once the student also ships as
  tfjs (§4.4).

Build note: `assets/models/*.tflite` are **gitignored** and regenerated by
`spikes/native/convert.py`. The student needs its own convert path plus
`spikes/native/flex_check.py` — a Flex/SELECT_TF_OPS model converts
happily and is **refused on the device** (`spikes/native/REPORT.md`,
"What went wrong first"), and `flex_check.py` exits 1 on any Flex/custom
op. Run it, every time.

### 4.3 Kill switch

`NATIVE_STUDENT 0` is a number push over the rules OTA. Reaches a phone
at its next rules refresh: launch, +24h, or the About pane's
Check-for-updates button. No install. This is the same channel that
carries `NATIVE_INFER`, and the precedent for turning off a bad native
build without an install is already written into
`native-client.mjs:47-53`.

### 4.4 Fail-safe, and the one ordering constraint

Already correct and measured:

- Page side: any reply with `status != 0`, any decode failure, any 4s
  timeout counts as a failure (`native-client.mjs:181-219`); **3
  consecutive → `die()`** (`:169-173`) → `nativeVideo()` false
  (`init-entry.js:589-597`) → `vid()` returns `gazeWorker` (`:604-607`),
  one-way for the page. Measured (loop 47, `probe_native_failsafe.py`):
  `nativeDead` 0→1 once, worker webgl alive, covered samples 15/20 →
  12/20, **no exposure**.
- Kotlin side: 3 consecutive per-model errors → `deadForThisPage` +
  `native-failed`; the NEXT page gets a fresh chance
  (`NativeInfer.kt:494-497`).

**THE ORDERING CONSTRAINT.** If the teachers are dropped from the APK,
`die()` falls back to the WebGL worker — which on Adreno 610 is **BLIND
to MoveNet** (findings 25: maxKp 0.03-0.19, admits nobody). That converts
a native failure from "1092 behaviour" into "no working person model at
all". **Do not remove the three teacher `.tflite` assets until the
student also ships as a tfjs graph in the worker.** Order:

| release | contents | `NATIVE_STUDENT` |
|---|---|---|
| R1 | 3 teachers + student tflite | ships **0**; flipped to 1 over OTA per-phone after the device A/B |
| R2 | same, default 1 | 1 |
| R3 | student tflite + student tfjs, teachers dropped | 1 |

A fourth model at load also matters: `loadAll` is eager
(`NativeInfer.kt:160-166`) and the GPU delegate spends **1.4-3.9s per
model** compiling shaders (class comment). Four models could exceed the
page's `DEFAULT_READY_TIMEOUT_MS 15000` (`native-client.mjs:42`) on a
cold Redmi — the exact failure 1098 hit when NNAPI arbitration inside
`loadAll` took 19s and the page died into `native dead`, running the
WebGL worker for good (drops 26.5% vs 13.2%). **Load the student first
and the teachers lazily**, or raise the timeout, and measure `initMs`
from the ready message before believing either.

---

## 5. RISKS, RANKED BY EXPOSURE

| # | risk | evidence | mitigation |
|---|---|---|---|
| **1** | **`nm` / descriptor-magnitude gate has no student equivalent** — it decides whether a patch EXISTS (`gender-verdict.mjs:660-681`) | 89 of 300 live reads carry no signal and each mints a patch; floor 5 refuses 388/403 non-faces and 0/125 real faces | ship `NULL_MINT_NM_FLOOR 0` first (OTA range `[0,5.5]`, `tuning.mjs:84`) — monotone toward covering, cannot add exposure; then re-derive on `bench/nm-floor.mjs` with a trained faceness head |
| **2** | **small faces 38-62px** — attributes read off a whole-frame 256 tensor arrive at ~16px | R16 row: "~2% of model input against BlazeFace's ~5% evaluation floor"; his facePx p50 38-62; 49.9% of corpus reads < 64px | shape (A) in §2.3 (keep the 224 crop stage); gate B5 slices by px |
| **3** | **child mass** — `GENDER_CHILD_MASS 0.25` needs the 100-bin posterior, and `NULL_AGE_LO/HI 34/42` is drawn round faceres' own ~36.9 prior | `detection-engine.md` "mass, not mean"; `gender-verdict.mjs:695-702`; loop 34's requant crossed the child gate 10/100 | emit the full softmax; re-measure the student's prior on the 403 in-band non-face crops (faceres: age p05/p50/p95 = 35/38/41) |
| **4** | **tfjs-WebGL blindness class** — a student that reads near-zero on Adreno WebGL is invisible until a device run | findings 25: tfjs-WebGL maxKp 0.03-0.19 vs TFLite fp32 0.77-0.82 on the same dumped frames | if it ships as tfjs, run `movenet-parity.js`-style fixed inputs on the Redmi, **worker-first** (a main-thread inference never returns there) |
| **5** | **int8 on the gender head** | loop 34: per-tensor affine pushes confident activations toward 0.5 → 8/100 flips at the image bar, 2 sign flips, descriptor cos min 0.596 | if int8 at all, keep the head layers at f16/f32 (the hybrid-requant precedent, `build/requant-uint8.py`, 0.02 absolute error bound); gate A2 mandatory |
| **6** | **NNAPI** — a new graph voids every earlier NNAPI result | `NATIVE_NPU` ships 0; the arbiter is unpriced on real crops (`native-client.mjs:70-84`); `outputsAgree` is 2%/head (`NativeInfer.kt:243-262`), stricter than 10% but not the loop-34 gate | keep `NATIVE_NPU 0` through the whole student rollout; re-open only after gate A2 passes at fp16 |
| **7** | **Flex ops in conversion** — converts clean, refused on device | `spikes/native/REPORT.md`; `flex_check.py` exits 1 | run `flex_check.py` on every student export, in CI if there is one |
| **8** | **ready timeout with 4 models** | 1098's 19s-vs-15s failure; 1.4-3.9s shader compile per model | lazy teachers, or raise `DEFAULT_READY_TIMEOUT_MS` and measure `initMs` |
| **9** | **output-by-length ambiguity** with a multi-head model | `face-decode.mjs:126-133`, `native-client.mjs:384-389` | switch to output-by-name from the ready message's `models[].outputs` **before** adding any equal-length head |
| **10** | **the label join** — 107 labels orphaned by a new descriptor | `corpus-label.mjs:36-62` | freeze `crop-labels.json` once, before anything else |

---

## 6. EFFORT — engineering days, excluding training

| # | item | days | group |
|---|---|---|---|
| 0 | freeze `crop-labels.json`; re-bank harness for the TEACHER; reproduce the control triple exactly (gate B0) | 1.5 | bench |
| 1 | scorer: student↔teacher face join by IoU + charge missed detections as exposure | 1.5 | bench |
| 2 | `corpus-bank-student.mjs` + `corpus-persons-student.mjs`, both schemas | 1.0 | bench |
| 3 | head-parity harness: face arm + person arm + gate A2 runner | 2.0 | bench |
| 4 | `native-client.mjs`: modelId 4, output-by-name index map, student branch | 1.5 | integration |
| 5 | `NativeInfer.kt`: asset/report/fp16 entries, `fillInput` case, flags bit 1, lazy teacher load | 1.5 | integration |
| 6 | `tuning.mjs` SPEC + `rules/tuning.json` + manifest + tests | 0.5 | integration |
| 7 | tflite convert path + `flex_check` + numeric parity vs the training graph | 1.0 | integration |
| 8 | `nm` replacement (route b) + re-derive the floor on `bench/nm-floor.mjs` | 2.0 | calibration |
| 9 | `MEM_SIM` re-derivation (same-person vs same-frame-different-person pairs) | 1.0 | calibration |
| 10 | age-window + `FACE_MIN_CONFIDENCE` re-derivation | 0.5 | calibration |
| 11 | tfjs export path + `MODEL_ASSETS` entry + `worker-entry` wiring + blobs | 2.0 | rollout |
| 12 | device A/B runs + offline classification (C1-C9) | 2.0 | bench |
| 13 | Opus critic phase + ledger rows + fixes | 2.0 | rollout |
| 14 | release, manifest, Redmi smoke | 0.5 | rollout |
| | **TOTAL** | **20.5** | |

By group: **integration 4.5d**, **bench 8.5d**, **calibration 3.5d**,
**rollout 4.0d**. Roughly four working weeks, plus device wall-clock
(each `probe_events.py` arm is 180s and a full C1-C9 sweep is a
half-day of the Redmi per build).

**Items 0 and 1 are prerequisites for everything and are worth doing
even if the student is never built** — they close the corpus's blindness
to detector recall, which `custom-model-2026-09-02.md` §4c names as the
one error class in this product that has never been measured and the only
crack through which a model project is justified at all.

---

## Provenance

Every claim above is line-cited to a file in this checkout, or to a
measurement already recorded in `CLAUDE.md` /
`docs/research/custom-model-2026-09-02.md` / `spikes/native/REPORT.md`.
**No new measurement was taken for this document** — nothing was run on a
device, no bench was executed, and the corpus was inspected only for the
existence and shape of its files.
