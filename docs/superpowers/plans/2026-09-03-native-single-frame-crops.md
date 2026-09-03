# Native single-frame crops — implementation plan

**Goal:** the page uploads the decoded video frame **once per verdict**;
Kotlin does every resize and every crop natively, runs MoveNet →
BlazeFace → faceres on `ts-infer`, and returns **the same per-model
outputs the page consumes today**. Nothing in `person-gate.mjs`,
`gender-verdict.mjs`, the identity memory or any threshold moves.

**Why:** the crop uploads are not a byte problem, they are a
**readback** problem. `spikes/native/BRIDGE-REPORT.md`:
`drawImage`+`getImageData` is **17-24ms p50 / 150-200ms p95** and is
**size-insensitive** at these scales (128x128 is *not* cheaper than
256x256 — 24.1 vs 20.2ms p50), i.e. a roughly fixed GPU-sync cost **per
call**. Today a 2-person verdict makes **five** of those calls. The
bench flagged this itself: *"This is where a native-inference pipeline's
real frame-rate ceiling is set, not the choice of bridge."*

**Spec / revert point:** tag at the 1098 release commit
(`docs/superpowers/plans/2026-09-03-performance-batch-1098.md`, T5 DONE).

**Rules that bound every task:**
- BLOCK-ONLY; NO NAGS; **patches SOLID** (`CLAUDE.md:6225-6241`) — this
  plan touches no drawn geometry at all.
- **An instrument that re-derives a shipped rule is a check that cannot
  fail** (`CLAUDE.md:916-922`). The remedy is stated there and is the
  spine of T1: *move the rule into a module, call it from both sides,
  delete the copy* — the move that put `faceInsideIndex` /
  `faceOrderBySize` / `synthFaceIndices` into `person-gate.mjs`
  (`CLAUDE.md:1121-1122`).
- **PIN THE CADENCE** (`CLAUDE.md:1124-1139`): any bench arm quoting a
  verdict number passes `hisRegimeOpts(g)` / `thinFrames(w, K_HIS)`.
  This plan changes verdict COST, so every corpus row it quotes must
  name the regime it was measured in.
- Every dial in `tuning.mjs` SPEC + `rules/tuning.json` + the SHIPPED map
  in `test/tuning.test.mjs`; `scripts/gen-rules-manifest.mjs` after
  editing `rules/`; constants verified in the EMITTED bundle.

---

## 0. What the page does today (the thing being replaced)

Per **verdict** pass, native path, P persons that get a read, F native
face reads (F <= P, one per person):

| step | site | pixels | readback |
|---|---|---|---|
| whole frame → 256x256 squash | `native-client.mjs:340-352` (`drawTo`) | 262,144 B | **1** |
| … sent to MoveNet **and** BlazeFace | `:424-425` (two `send`, one buffer, **copied twice** by `encodeRequest`) | 2 x 262,144 B | — |
| person crop, aspect-preserving, 224 long side | `init-entry.js:2627-2647` (`cropPersonPixels`, `ZOOM_CROP_SIZE = 224` at `:2553`) | GPU-side `createImageBitmap` | 0 |
| … → 256x256 squash for BlazeFace | `native-client.mjs:478` (`drawTo`), `cropFaces` `:473-503` | P x 262,144 B | **P** |
| face re-crop at native res | `init-entry.js:2910-2938` (`faceRegionInVideo`) then `cropPersonPixels(fr)` `:2964` | GPU-side | 0 |
| … → 224x224 square, black bars | `native-client.mjs:359-374` (`drawSquareCrop`) via `genderOnce` `:534-559` | F x 200,704 B | **F** |

Round trips: 2 + P + F, **serialised per person** through
`observePerson`'s chain (`init-entry.js:4338-4392`, `yieldToBrowser`
between people at `:4380`).

**The decisions that live on the page and cannot move** (each one is a
shipped rule with a ledger row or a paragraph behind it):

| decision | site | why it stays |
|---|---|---|
| `parsePersons` admission + hysteresis | `person-gate.mjs:472`, `detector.js:654` | the extent source the whole placement layer sits on |
| face→person ownership, **10% pad** | `person-gate.mjs:1890-1900` `faceInsideIndex` | G1: a private re-derivation read 16.8% where the rule says 27.5%. **Not a crop rule — never goes to Kotlin.** |
| synthetic bodies | `person-gate.mjs:1927-1938` | same |
| `personCropRegion` / `headCropRegion` | `person-gate.mjs:1788-1861` | R28; head crop only wins where it is smaller |
| who gets a crop at all | `init-entry.js:4308-4325` (`zoomBudget`, `rotateBudget`, `cropPriority`) | R30 F2 — the budget is measured false-cover |
| `trackNeedsRead` | `init-entry.js:4364` | settled tracks pay nothing |
| `knownFaceInCrop` (skip BlazeFace entirely) | `init-entry.js:3092-3120` | R28 F3: an off-crop box was a silent cover |
| `personNoFace` | `init-entry.js:3150-3153` | R23 counter |
| **`ownFaceIndex === -1` ⇒ no gender read** | `init-entry.js:3174-3177` | fires on **25% of reads**; S9 measured crop+gender at **64 of a 102ms verdict** |
| **`FACE_MIN_NATIVE_PX` 40 abstain** | `gender-verdict.mjs:549`, used `init-entry.js:2954` | R10: below it faceres returns its prior labelled `male` — a CERTAIN flag on zero information |
| `classifyBest` / `bestIndex` / descriptor pick | `init-entry.js:3021-3081, 3191-3197` | R7 F3 |

---

## 1. Protocol

Header stays 16 bytes little-endian (`native-frame.mjs:23-42`); the new
kinds add a **second 16-byte block**, so the old three requests are
byte-for-byte unchanged.

```
kind 4  FRAME    [reqId, 4, w, h][fid, modelMask, 0, 0] + RGBA w*h*4
kind 5  PERSONS  [reqId, 5, nPersons, 0][fid, 0, 0, 0]  + n*4 float32  (x1,y1,x2,y2, FRAME-normalised)
kind 6  FACES    [reqId, 6, nFaces,   0][fid, 0, 0, 0]  + n*4 float32  (x1,y1,x2,y2, FRAME-normalised)
```

- `fid` — the page's frame id. Kotlin keeps a **2-slot ring** of retained
  frames keyed by `fid`, TTL 8000ms (mirrors `CROP_TTL_MS`,
  `native-client.mjs:48`). Two slots because ~10% of verdicts are
  dropped mid-pass (ledger K6) and a new pass can start over an old one.
  A `fid` Kotlin no longer holds ⇒ `status 1`, never a guess.
- `modelMask` bit0 BlazeFace, bit2 MoveNet — so a `withFaces:false` pass
  could ride kind 4 if a later round wants it. **It does not today**
  (§1.3).
- **Kind 6 takes FRAME-normalised face boxes.** The page has already
  mapped the crop-local box back through the crop geometry with the
  shared module (T1), so Kotlin never learns which person a face came
  from, and `nativePx` / `FACE_MIN_NATIVE_PX` stay page-side unchanged.

**Reply**: the existing layout (`native-frame.mjs:51-77`), outputs flat,
in item order, per-model head count:

| kind | outputs | floats |
|---|---|---|
| 4 | `[movenet]` (1 head, [1,6,56] = 336) `++ [bf0..bf3]` (4 heads, 15,232) | 15,568 |
| 5 | per person i: `[bf0..bf3]` | P x 15,232 |
| 6 | per face j: `[gender, age, desc]` (1 + 100 + 1024) | F x 1,125 |
| 4/5/6 | **`+ [srcRectEcho]`** — 4 float32 per cropped item, the frame-pixel rect Kotlin actually sampled | (P or F) x 4 |

The head counts are not guessed: `postReady` already carries each
model's output tensor names (`NativeInfer.kt:619-635`, parsed at
`native-frame.mjs:94-104`), so the client derives `outputsPerItem` from
the ready message and **throws** when `nOutputs` is not
`items * outputsPerItem (+1 echo)` — the same fail-safe contract as the
existing truncation throw (`native-frame.mjs:12-21`). Replies feed
`faceRowsFromOutputs` (`face-decode.mjs:126-142`, which sorts the 4 heads
by length) and `genderReadsFromOutputs` unchanged, so
`person-gate.parsePersons`, `facesFromRows` and the gender verdict see
exactly the arrays they see today.

### 1.1 The srcRect echo is the parity check that can fail on device

Every unit-test-only parity check between two languages is two typings
of the same arithmetic (ledger G5, H10). The echo makes it checkable in
production: the client recomputes the rect from the **shared JS module**
and compares. A mismatch beyond 0.5px is `noteFailure()` — it does
**not** return the reads. A squashed crop is not a degraded read, it is
J1: *"the findings-16a squash defect, alive on the per-person path since
2026-08-24"*, and a whole parity file measured the squash instead of the
port. Counted as `cropGeomMismatch` in the diag report.

### 1.2 Why three kinds and not one combined reply

One request cannot exist without moving `personNoFace`, `ownFaceIndex`
and `FACE_MIN_NATIVE_PX` into Kotlin. `ownFaceIndex`
(`init-entry.js:2995-3019`) reads `person.headX/headY` — MoveNet keypoint
derivations out of `parsePersons` — plus a `max(0.18, faceWidth)`
plausibility radius. Porting it means porting the head-anchor rungs
(`person-gate.mjs:1796-1821`, three rungs that disagree by 2x on a
turning head). That is the exact failure `CLAUDE.md:916-922` names, and
it would be **invisible**: a wrong own-face pick does not throw, it
stores the neighbour's descriptor on this person's track — the one input
`identityBroken` trusts (`init-entry.js:3168-3173`).

**If it were taken anyway**, this is what changes page-side, priced so
the refusal is informed: `observeCropped` / `classifyBest` /
`genderFromNativeFace` (`init-entry.js:3034-3177`) collapse into a reply
reader; `bumpLife('personNoFace')` and `'ownMissSkipped'` become counters
Kotlin reports; `FACE_MIN_NATIVE_PX` becomes a number in the request;
`desc` / `px` stamping moves into the decode. Saving: **one hop, ~12-16ms
p50** (§4.3). Cost: three shipped rules with no check that can go red on
the phone. **Refused.**

### 1.3 Which pass uses which request — the old kinds all stay

| pass | today | after |
|---|---|---|
| verdict, player, native live | `videoFrame` 2 req + `cropFaces` P + `cropGender` F | **kind 4 → 5 → 6** |
| position-only (`withFaces:false`, `init-entry.js:2333` `wantPersons`) | 1 x `MODEL_MOVENET` @256 | **unchanged** — 262KB vs a full frame, one readback either way |
| whole-blur fallback / `genderOnPixels` off the player | `MODEL_FACERES` @224 | **unchanged** |
| `auditRefusedFace` (`init-entry.js:2673`, `__TS_GATE_AUDIT` only) | `MODEL_FACERES` | **unchanged** |
| `tileProbe` (`init-entry.js:2713`) | `MODEL_BLAZEFACE` | **unchanged** |
| image path / Reddit-X-IG whole frame | `detector.js` tfjs | **unchanged** |
| WebGL worker fallback | `worker-client.mjs` | **unchanged** |

`NATIVE_SINGLE_FRAME = 0` ⇒ every verdict takes the current per-model
route. The old path IS the fallback, so it must keep working, and a test
pins that (§6.8).

---

## 2. Crop geometry parity — ported, never re-derived

### 2.1 The three rules that move to Kotlin

| # | rule | shipped site | port |
|---|---|---|---|
| G1 | **whole-frame resize** to 256x256, sampling where `tf.image.resizeBilinear` samples (`alignCorners:false`, `halfPixelCenters:false`, `src = dst*scale`) | `native-client.mjs:326-352`; `detector.js:633` | Kotlin bilinear, direct. J15: the canvas draw is an *approximation* of that rule (shifted source rect, mad 0.04 vs 4.8-5.7 plain). Native gets the rule itself — a fidelity **improvement**, and it must be shown to be one. |
| G2 | **per-person zoom crop**: `sw=max(1,(x2-x1)*vw)`, `scale=224/max(sw,sh)`, `dw=max(32,round(sw*scale))`, `dh` likewise; then the dw x dh crop is **squashed** to 256 for BlazeFace | `init-entry.js:2630-2634` + `native-client.mjs:478` | **two-step, exactly**: crop → dw x dh, then squash → 256. Collapsing to one resample changes the sampling grid, because `round` and the 32px floor sit in the middle. `dw`,`dh` go in the parity table. |
| G3 | **face square crop at native resolution**: `faceRegionInVideo` (square in native px via `min(w,h)`, centred on the box centre, **clamped** per edge — not slid) → `cropPersonPixels` (224 long side, min 32) → `squareBox` on the result → 224x224 with **black** outside | `init-entry.js:2910-2938`, `:2964`; `crop-geometry.mjs:34-45`; `native-client.mjs:359-374` | the same three steps. Black because `cropAndResize` extrapolates zero and `drawImage` clips rather than throwing (`native-client.mjs:355-358`). |

**Explicitly NOT ported:** the 10% pad in `faceInsideIndex`
(`person-gate.mjs:1890-1900`). It is a *face-to-person ownership* rule
about boxes MoveNet drew round keypoints, not a crop rectangle, and it
never touches a pixel — *"a head that leans past the shoulder line sits
slightly outside the person it plainly belongs to"*. It stays on the
page, and so do `personCropRegion` / `headCropRegion`: the page computes
the region, Kotlin only cuts it.

### 2.2 What a squashed crop costs (why this is not a refactor)

- **J1 (EXPOSURE)**: the worker's VIDEO gender path fed faceres a
  *normalised*-square crop — a 1.78:1 rectangle in pixels on 16:9,
  stretched to 224x224, across five call sites. *"Native squares in
  pixels, so every gender row of the first parity file measured the
  squash, not the port."* Descriptor cosine p50 **0.83 → predicted
  >= 0.98**.
- **`crop-geometry.mjs:1-20`**: a clear front-facing man measured **0.06**
  on the male head where the same face aspect-corrected measured
  **0.76**; four days and three model swaps during which every gender
  threshold (0.85, 0.25, 0.12) was calibrated against distorted inputs.
- **findings 16a** (`crop-geometry.mjs:76-83`): descriptor magnitude is
  higher undistorted on **17 of 18** faces, p50 +1.08, sign test
  p=1.45e-4; four faces cross `NULL_MINT_NM_FLOOR`; **2 of 13**
  solid-signal faces flip gender label, one moving raw 0.601 → 0.377.
- **findings 16b** (`crop-geometry.mjs:99-105`): MoveNet letterbox vs
  squash over 241 frames — persons admitted **219 → 269 (+22.8%)**,
  35 frames where the squash admits nobody and the letterbox admits
  someone against 4 the reverse, p < 1e-5.
- **E2 (DEAD-CHECK)**: the anti-squash guard matched *one spelling* of
  the four-argument `drawImage`; the fix parses every `drawImage` with
  balanced-paren argument splitting and asserts the complete set of
  whole-frame squashes equals the two deliberate ones. **T1 extends that
  parser to `native-client.mjs`** — after this change the page's draw
  sites move, and a re-introduced squash would be invisible again.
- **E3 (EXPOSURE)**: on Reddit/X/IG/FB the whole-frame boolean is the
  entire pipeline, so a blind frame is `cleanStreak++` and four in a row
  reach `clearEl`.

### 2.3 The parity artifact

1. `crop-geometry.mjs` gains **pure** `cropDims(srcWpx, srcHpx, longSide)`,
   `faceRegionInFrame(region, faceBox, vw, vh)` (returns `nativePx`) and
   `frameSizeFor(vw, vh, capW)`. `init-entry.js:2630-2634`, `:2910-2938`
   and the **third copy** at `:2679-2690` (`auditRefusedFace`, whose own
   comment says *"Same square-in-native-pixels crop as
   faceRegionInVideo"*) all call them. Copies deleted.
2. `app/gaze/bench/crop-parity.mjs` generates
   `app/gaze/test/fixtures/crop-parity.json` **from the shipped
   exports** — ~60 cases: 1280x720 / 640x360 / 854x480 frames at 16:9,
   4:3 and 9:16; regions at every edge and corner; degenerate 1px and
   out-of-frame regions; the R10 case (33 native-px face on a standing
   figure whose person box is 2.36:1); the `min 32` floor; `round` ties.
   Each row: `{frameW, frameH, region} → {dw, dh, srcRectPx, dstWH,
   faceFrameNorm, nativePx, squareRectPx, blackBars}`.
3. `test/crop-geometry.test.mjs` asserts the fixture against the shipped
   exports, so regenerating it is a deliberate act.
4. `CropGeometryTest.kt` reads the **same JSON** from test resources and
   asserts the Kotlin port. Red until the port matches.
5. The **srcRect echo** (§1.1) closes the loop on the device — the half a
   fixture cannot reach.

---

## 3. Sequencing on `ts-infer`

```
page                                   ts-infer
----                                   --------
readback frame ---- kind 4 --------->  retain(fid); resize->256 (G1);
                                       MoveNet; BlazeFace(mask)
  <---------------- movenet + bf ----
parsePersons, ghost gate, synthetic
bodies, zoomBudget/rotateBudget,
trackNeedsRead, knownFaceInCrop
   --- kind 5 [P regions] ---------->  per region: crop->dw x dh (G2),
                                       squash->256, BlazeFace
  <----------- P x bf + P x echo ----
facesFromRows; personNoFace;
ownFaceIndex; faceRegionInFrame;
FACE_MIN_NATIVE_PX
   --- kind 6 [F face rects] ------->  per rect: G3, faceres
  <----- F x (gender, age, desc) ----
classifyBest / descriptor pick / faceMeta
```

- **Three hops, one upload.** Kinds 5 and 6 are **batched across all
  persons**, where today they are serialised one person at a time
  (`init-entry.js:4338-4392`). The *"serial, not parallel: one GPU queue"*
  note at `:4369` is about the WebGL path; `ts-infer` is a single
  HandlerThread with one interpreter per model
  (`NativeInfer.kt:44-47, 84-86`), so a batch is what the queue already
  does.
- **The mid-verdict round trip is not avoidable and is not new.** Today
  the same decisions sit between the same two inferences — they just cost
  a *per-person* hop each instead of one batched hop.
- `P = 0` ⇒ no kind 5. `F = 0` ⇒ no kind 6.
- **The per-person watchdog must become a per-phase watchdog.**
  `VERDICT_TIMEOUT_MS = 900` (`init-entry.js:2033`) today races each
  person's own chain (`:2866-2876`) because *"createImageBitmap on the
  live video element can hang without ever settling — not reject, HANG"*
  and *"38 of 49 verdict passes never reaching the tracker"*. Batched,
  one hung phase stalls **everyone**, so the race moves to the phase and
  on expiry must resolve **every** pending person to the same
  `{flagged:true, certain:false}` unknown ⇒ covered. Getting this wrong
  re-opens R28's *"Linus is not clearing at all"*.
- **Order is preserved explicitly.** `observations` is pushed in
  completion order, which serial execution makes input order. Batched,
  it must be rebuilt in input order: `updatePersonTracks` is Hungarian
  and order-free (1091), but `assignFellBackGreedy` above
  `OPTIMAL_MAX_SIDE = 32` is greedy and order-dependent (F6), and the
  `dbg.cross` calibration pairs read positionally.
- **`yieldToBrowser`** (`init-entry.js:372`) keeps one yield between
  phases. The bar is *task length* — 2,329ms worst single task under a 6x
  throttle before the per-person split. Batching removes P+F readbacks
  from the main thread, which is task length going the right way, but
  decoding P x 15,232 BlazeFace floats lands in one task: measure it, and
  split the decode per person behind a yield if it exceeds ~16ms.
- **One engine per frame (J7).** `vid()` is read **once** per verdict and
  the answer carried; `fid` belongs to that client exactly as `cid` does
  today (`init-entry.js:2802-2803`, `:2269-2273`), and
  `native-wired.test.mjs`'s accessor test extends to it.

---

## 4. Cost model

### 4.1 Page → Kotlin bytes per verdict (P read, F native face reads)

| P/F | today | after, cap 1280x720 | after, cap 640x360 |
|---|---|---|---|
| 0 | 524,320 (the frame is sent **twice** — `native-client.mjs:424-425`) | 3,686,432 | 921,632 |
| 1 | 987,200 | 3,686,528 | 921,728 |
| 2 | 1,450,080 | 3,686,560 | 921,760 |
| 3 | 1,912,960 | 3,686,592 | 921,792 |

Bytes are **not** the win, and at P <= 1 they are a loss. Kotlin decode
is 0.297ms p50 per 262KB (BRIDGE-REPORT) ⇒ ~1.0ms at 640x360, ~4.2ms at
1280x720. **Reply bytes are unchanged** — the same tensors either way.

### 4.2 Main-thread readbacks (the actual win)

| P/F | `getImageData` today | after | p50 saved | p95 tail saved |
|---|---|---|---|---|
| 0 | 1 | 1 | 0 | 0 |
| 1 | 3 | 1 | ~40ms | up to ~400ms |
| 2 | 5 | 1 | ~80ms | up to ~800ms |
| 3 | 7 | 1 | ~120ms | up to ~1200ms |

At **17-24ms p50 / 150-200ms p95 per call**, size-insensitive
(BRIDGE-REPORT). `createImageBitmap` falls the same way (1+P+F → 1, at
0.9-1.1ms p50 each). Call sites removed from the main thread:
`native-client.mjs:340-352` (`drawTo`, once per person) and `:359-374`
(`drawSquareCrop`, once per face); `init-entry.js:2627-2647`
(`cropPersonPixels`) stops producing bitmaps on the native path.

### 4.3 Round trips

2+P+F → 3. At P=F=2: **6 → 3**. Transport is *not* the "~21ms" figure —
that number is `21.1ms page (create+draw+getImageData) + 0.30ms Kotlin
decode` and is **almost entirely the readback**. The port's own arrival
is 12-16ms p50 / 48-56ms p95 one way, measured as a wall-clock diff the
report itself says is *"Worth a controlled back-to-back A/B … before this
is trusted as a real cost of the port"*. So: three hops cost 36-48ms p50
of latency that is already being paid six times today. (Check the shape
before writing the number down — `CLAUDE.md:1141-1146`.)

### 4.4 Inference — unchanged

`spikes/native/GPU-REPORT.md:49`: MoveNet 160 + BlazeFace 19 + 2 x
faceres 76 = **~255ms** (p95 ~270) per verdict on the GPU delegate.
Kotlin adds P+F bilinear resamples writing 65,536 / 50,176 pixels each —
sub-ms. `fillInput` (`NativeInfer.kt:538-573`) writes the **same 65k
output pixels** whatever the source size, so its cost does not move.

### 4.5 Predicted verdict time

1094 ships **verdict p50 355ms**, gap 805 / 2353, 135 verdicts and 90
positions in 150s (`CLAUDE.md:602-606`). 355 − 255 inference ≈ **100ms of
non-inference**, which is five readbacks at ~20ms almost exactly.
Prediction: **p50 355 → 275-300ms**, with `effZoom = cost * VERDICT_DUTY`
pulling the gap down behind it (K7 — the duty dial is binding), and the
p95 tail improving far more than the p50 because the 150-200ms readback
spikes go from five chances per verdict to one.

**Falsifier** — run it, do not argue it: `probe_latency_ab.py --delay`,
150s, same video and seek, control vs `NATIVE_SINGLE_FRAME=1`, plus
`probe_drops_ab.py` (1098c control 12.05%). A p50 that does not move
refutes the readback model, and the dial does not go to 1.

**Counter-pressures to measure, not assume:** (a) one readback at
640x360 or 1280x720 instead of 256x256 — the bench never went above 256,
and 720p is 14x the pixels of 256x256; (b) 0.9-4.2MB messages are a
different allocation regime from 262KB; (c) two retained frames in Kotlin
= 1.8MB at 640x360, 7.4MB at 1280x720 — bounded, and J11 already records
that no RSS number exists for the resident model sets.

---

## 5. Fail-safe and the dials

- **Any** error in the combined path — `status != 0`, an output count
  that is not `items * outputsPerItem (+1)`, a decode throw, a
  **srcRect echo mismatch**, a timeout, an unknown `fid` — is
  `noteFailure()` (`native-client.mjs:169-173`). Three in a row and
  `die()` (`:138-163`) marks the client dead; `nativeVideo()`
  (`init-entry.js:587-599`) then returns false and the page runs the
  WebGL worker for the rest of its life, counting `nativeDead`. **No new
  failure machinery**, and the worst case is exactly today's behaviour.
- Kotlin's own side is unchanged: three consecutive inference errors on
  one model ⇒ `deadForThisPage` + `native-failed`
  (`NativeInfer.kt:490-498`).
- A verdict lost to a mid-phase failure resolves every pending person to
  unknown ⇒ **covered** — the fail-safe direction, and the same outcome
  `observeThrew` produces today (`init-entry.js:2847-2861`).
- **J10 stands as a known limit**: on 1 of 2 native device runs the WebGL
  worker was dead for the *entire* run, so the fallback the safety
  argument rests on did not exist. Not made worse here; named so the
  smoke checks `workerVideo()` in both arms.

**Dials** — `tuning.mjs` whitelist, same shape as `NATIVE_CPU_MASK`
(`:325`) and `NATIVE_NPU` (`:339`), each with its SPEC comment:

| dial | range | ships | effect |
|---|---|---|---|
| `NATIVE_SINGLE_FRAME` | [0,1] | **0** | 1 = verdicts use kinds 4/5/6; 0 = today's per-model requests, byte-identical |
| `NATIVE_FRAME_MAX_W` | [256,1920] | **1280** | frame width cap; height by aspect; never upscales |

`NATIVE_FRAME_MAX_W` **ships at 1280 (no downscale on his 1280x720
stream) because the cap is an exposure dial, not a perf dial.** The face
crop is cut from the frame that was sent, so a 640 cap **halves every
face's native pixels**, and `FACE_MIN_NATIVE_PX = 40`
(`gender-verdict.mjs:549`) gates on exactly that number —
`person-gate.mjs:1691` records `nativePx` landing at **64-83, right on
the floor**, which halves to 32-41 and straddles it. Below the floor the
read abstains ⇒ covered: safe for exposure, **paid in false cover and
phantom**, and unpriced. Pushing 640 is the owner's call after a corpus
row, exactly like the coast dial.

**Diag report** — the `native` block (`diag-report.mjs:410-418`) gains
`singleFrame` (0/1 in effect), `frameW` / `frameH` actually sent,
`frameBytes` p50, **`readbackMs` p50/p95** — the page has never had a
readback counter, and *a counter that does not exist reads exactly like a
counter at zero* (G8/F6) — `cropGeomMismatch`, `singleFrameFallback`, and
the per-phase `elapsedUs` the replies already carry, so Kotlin's own time
can be subtracted from the page's.

---

## 6. Tests — red first, on the `native-*.test.mjs` fake-port pattern

The fake port (`test/native-client.test.mjs:48-100`) records every
`ArrayBuffer` sent, splits CONFIG frames out by
`byteLength === 16 && modelId === 0`, and hands back synthetic replies
through `buildReply`. Every new test uses it; `FakeOffscreenCanvas`
(`:29-40`) already records `drawImage` args, smoothing and quality.

1. **Frame size cap.** `frameSizeFor(1280,720,640) → 640x360`;
   `frameSizeFor(640,360,1280) → 640x360` (never upscales); odd sizes;
   `w*h*4` equals what the encoder expects. Red against a cap that
   upscales or loses the aspect.
2. **Crop-local face box → frame coords.** `faceRegionInFrame` is square
   in **pixels** when unclamped (`pixelAspect === 1`) and reproduces the
   R10 case (person box 2.36:1, 33 native-px face) rather than the person
   box's aspect. Red against composing through `rw`/`rh` in normalised
   units — the exact bug `init-entry.js:2896-2909` documents.
3. **The parity table.** JS asserts `crop-parity.json` against the
   shipped `crop-geometry.mjs` exports; `CropGeometryTest.kt` asserts the
   same file. Red when either side moves alone.
4. **srcRect echo.** A reply whose echo differs by 1px ⇒ the client
   counts a failure and **returns no reads**. Red against a client that
   ignores the echo — without this test the parity fixture is two typings
   of one rule (G5, H10).
5. **Reply shape.** `nOutputs` not `items * outputsPerItem (+1)` throws;
   a truncated echo throws; the head counts come from the ready message,
   never from a literal.
6. **Three strikes.** Three kind-4/5/6 failures ⇒ `dead()`; extends the
   existing 3-strike test to the new kinds.
7. **The dial ships 0**, asserted against the **module declaration**, not
   the live binding (A8: reading `rules/tuning.json` alone left a flipped
   source default fully green), plus the SHIPPED map at
   `tuning.test.mjs:45-52`.
8. **The old kinds still work with the dial ON.** A `withFaces:false`
   pass still sends `MODEL_MOVENET` at 256x256; `genderOnce` still sends
   `MODEL_FACERES` at 224x224. Red against a change that routes
   everything through kind 4.
9. **Anti-squash parser extended.** E2's balanced-paren `drawImage`
   parser now covers `native-client.mjs`, and the complete set of
   whole-frame squashes must equal the documented deliberate ones.
10. **Structural wiring** (`native-wired.test.mjs`, comments stripped —
    G9): `fid` is read from, and released on, the client that minted it
    (J7); no `gazeWorker.<method>` bypasses `vid()`; the phase watchdog
    exists and resolves every pending person.
11. **`FACE_MIN_NATIVE_PX` is measured in the units that were sent.**
    When the cap downscales, `nativePx` must be computed from the frame
    **actually sent**, not from `video.videoWidth`. Red against the
    version that keeps the element's dimensions — otherwise the gate
    silently means something else and R15's *"the artifact promptly lost
    the very number that justifies it"* repeats.

---

## Tasks

### T0 — Measure the readback ceiling (**2h**, no product code)
Files: `spikes/native/` bench, `BRIDGE-REPORT.md` addendum.
- Extend the existing `TsFrameBench` recipe to 320x180 / 640x360 /
  854x480 / 1280x720: `createImageBitmap`, `drawImage`+`getImageData`,
  port send, Kotlin decode/copy, rAF Hz. Reset the Kotlin ring per
  variant (the report's own gotcha, or the stats lie).
- **Gate:** if 1280x720 readback p50 > ~40ms, `NATIVE_FRAME_MAX_W` ships
  640 and the `FACE_MIN_NATIVE_PX` consequence (§5) goes to the owner
  with a corpus row before anything is pushed.

### T1 — Extract the shipped crop geometry (**3h**)
Files: `crop-geometry.mjs`, `init-entry.js` (2627-2647, 2679-2690,
2910-2938), `native-client.mjs`, `bench/crop-parity.mjs`,
`test/fixtures/crop-parity.json`, `test/crop-geometry.test.mjs`.
- Add `cropDims`, `faceRegionInFrame`, `frameSizeFor`; the three copies
  call them; **delete the copies**. Generate and commit the fixture.
- Extend E2's `drawImage` parser to `native-client.mjs`.
- Lands **on its own, ahead of everything else**: a pure refactor whose
  bundle is number-identical for the shipped behaviour (D7 — number-,
  not byte-identical).

### T2 — Protocol (**2h**)
Files: `native-frame.mjs`, `test/native-frame.test.mjs`.
- `encodeFrameRequest`, `encodeCropRequest(kind, fid, boxes)`;
  `decodeReply` grows `itemsOf(reply, outputsPerItem)` and the echo
  split. Shape mismatch throws, same contract as truncation.

### T3 — Kotlin (**5h**)
Files: `NativeInfer.kt`, new `CropGeometry.kt`, `CropGeometryTest.kt`.
- Two-slot frame ring keyed by `fid`, TTL 8000ms, cleared on `bind` and
  `close`.
- `resizeBilinear(src, srcRect, dstW, dstH, blackOutside)` with
  `src = dst*scale` (the tf convention), used by G1/G2/G3.
- `cropDims` + `squareBox` ported; the parity fixture as a test resource.
- Kinds 4/5/6 in `handleFrame` (`:460-499`); per-item echo appended in
  `reply` (`:577-595`); `fillInput` unchanged per model id.
- Kind 4 still sets `realInput`, so the NPU arbiter keeps snapshotting a
  real frame (`:364-385`).

### T4 — `native-client.mjs` single-frame path (**4h**)
Files: `native-client.mjs`, `test/native-client.test.mjs`.
- `NATIVE_SINGLE_FRAME` / `NATIVE_FRAME_MAX_W` exports and setters.
- `videoFrame` draws at the capped size when the dial is 1 and keeps the
  `fid`; new `cropFacesBatch(fid, regions)` and
  `cropGenderBatch(fid, faceRects)`; echo verification; the `waitMs`
  contract unchanged (`:191-199` — J8 reads it from one engine at both
  ends).
- `releaseFrame(fid)`. The `crops` map, `drawTo` and `drawSquareCrop`
  stay for the dial-0 path.

### T5 — `init-entry.js` wiring (**3h**)
Files: `init-entry.js`, `test/native-wired.test.mjs`.
- `runPass` keeps the `fid`; the per-person chain (4338-4392) becomes two
  batched phases **with every page-side decision in the same order**
  (§0 table). `observations` rebuilt in input order.
- Watchdog moves from per-person to per-phase, resolving every pending
  person to unknown ⇒ covered.
- Counters unchanged: `cropHead` / `cropBody`, `personNoFace`,
  `ownMissSkipped`, `observeThrew`, `genderReadSkipped`.

### T6 — Dials and diag (**1.5h**)
Files: `tuning.mjs`, `rules/tuning.json`, `test/tuning.test.mjs`,
`diag-report.mjs`; run `scripts/gen-rules-manifest.mjs`.

### T7 — Build, Redmi smoke, critic, release (**3h**)
- `node app/gaze/build/build.js`; gaze + cargo tests; Android build.
- Smoke: control vs `NATIVE_SINGLE_FRAME=1` on `probe_latency_ab.py
  --delay` and `probe_drops_ab.py`; `probe_native_parity.py` re-run
  (descriptor cosine, face IoU, `faceCountMismatchFrames`) — the J1/K1
  gate, quoted at the bars a patch is **decided** at (K11).
- `cropGeomMismatch == 0` on device; both dials verified in the EMITTED
  bundle. Opus critic on the diff; ledger rows; release.

**Total ~23.5h.** T1 ships independently; T0 gates T3's cap default;
T2-T5 land together behind a dial that ships 0.

---

## Forward note

`docs/research/distill-2026-09-03/track-recipe.md:88-112` wants a
**320x192 16:9** student input for S1 (*"Never square-squash … the same
compute"*, and 25% more horizontal resolution with no 1.78:1
distortion) while keeping the **112x112 aspect-preserving face crop** for
S2 (*"it is cheaper than the fixed per-inference overhead on this GPU …
Keep the crop"*). Kinds 4/5/6 are exactly that shape: one frame in, crops
cut natively, per-face attributes on a separate head. The `modelMask`
field and the non-square frame cap exist so S1 can replace
MoveNet+BlazeFace behind this protocol without designing the round trips
again.
