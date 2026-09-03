# Dense optical flow between verdicts — priced

**Question.** Between two model verdicts (gap p50 **805ms**, p95 **2353ms** on
the Redmi, 1094 native build) the patch today either **lerps** between two
known verdict boxes (`track-timeline.boxesAt` rule 3) or **coasts** on a
decaying velocity (`person-track.coastStep`, `vx *= 0.7` per pass). Replace or
augment that with dense GPU optical flow computed in a WebGL fragment shader
over the delay ring's consecutive frames; move each patch by the robust median
flow inside its box.

**Verdict up front.** The algorithm is cheap enough — **~0.1ms per frame pair**
on the smoke device, two orders of magnitude under the ring copy it would ride
beside. Everything expensive about it is the **readback** and everything risky
about it is that **flow tracks texture, not identity**. The version worth
building is not the obvious one: not a per-frame dense field read back to JS,
but **one flow pass per captured frame kept on the GPU, integrated into a
per-track displacement path once per verdict** — which the delay ring makes
possible and which costs no per-frame readback at all (§4). Honest gain in the
repo's own units: **~1.0–1.5s of exposure and 1–3 false-cover rows per 180s
run; zero seconds of phantom** (§6). Effort **8–9 days**, and it is **gated on
`PRESENTER_GL` first earning its place** — the GL presenter this must live in
currently measures 12.57% drops against a 12.05% control (`drops-v1098c-*`).

---

## 0. What the code does today (the baseline being replaced)

| mechanism | file | behaviour between verdicts |
|---|---|---|
| rule 3, both endpoints known | `track-timeline.mjs:boxesAt` | `lerpBox(A, B, frac)` — linear, cannot overshoot |
| rule 1, no B yet (late) | same | holds A's box, padded outward up to `BIRTH_BACKDATE_PAD` 0.15 as lateness → `LATE_PAD_FULL_MS` 1000; gives up at `LATE_HOLD_MS` 3000 |
| rule 4, only in A (detector miss) | same | rides at A's box until B; dropped at a cut |
| rule 5, only in B (born) | same | back-dated to B's box, padded by `(1−frac)·0.15` |
| rule 6, dead coast | `markDeadCoasts` | a coast run that expired with no cut and nobody taking its box is presented **absent** — yield **8 of 83** coasting passes (critic L7) |
| tracker coast | `person-track.coastStep` | `dx = vx·dt/1000`, then `vx *= 0.7`; expires at `blurredCoastMs` (2.5× cadence, floored/capped by `PTRACK_MIN_COAST_PASSES` 2) |
| render smoothing | `video-region.lerpRect` | `MOVE_DEADBAND` 0.02, `RENDER_LERP` 0.25, `SHRINK_LERP` 0.06 |

Measured population the idea targets (Redmi, 180s, `probe_events.py` →
`events_reclass.py`, CLAUDE.md loops 49–50):

- **coasting passes 50 of 194 and 62 of 212** blurred track-passes (1095 runs
  a/b); **83 of 255** on 1094 run 3. Coast p50 **946ms**, max **2259–3305ms**.
- false cover **16 of 82** certain-male reads on the shipped 1096, decomposed:
  `neighbourMeasured` 4, `neighbourCoasting` 2, `neighbourSynthetic` 1,
  `pendingClearLadder` 3, `bornBlurredAtCut` 1, `demotedAtCut` 2,
  `clearedButTimelineBlurred` 2.
- exposure: `nPositive` **0** over 300ms windows; upper bound p90 ~200–260ms;
  the `DELAY_MS` 1500 arm read **uncovered frames 121** per run (189 at 1000).
- rule-1 late share: **6.9%** of presented frames ran past the newest snapshot
  (phase-K).

---

## 1. Algorithms that fit a WebGL fragment shader on these GPUs

### 1.1 The hardware

| GPU | device | FP32 | texture fill | clock | ALUs | source |
|---|---|---|---|---|---|---|
| Adreno 610 | older Redmi / SD665-class | 243.2 GFLOPS | **7.6 GTexel/s** | 950–1050 MHz | 128 | https://hmc-tech.com/gpus/qualcomm-adreno-610 |
| Adreno 613 | his Redmi 13, SM4450 | 244.5 GFLOPS | **not published** | 955 MHz | 128 | https://gadgetversus.com/graphics-card/qualcomm-adreno-613-specs/ |
| Mali-G52 MC2 | **the smoke Redmi 9, Helio G85** | ~96 GFLOPS (sources do not reconcile) | **3.4–3.8 GTexel/s** | 1000 MHz | 24–48 (sources disagree) | https://gadgetversus.com/graphics-card/arm-mali-g52-mc2-specs/ , https://cputronic.com/en/soc/mediatek-helio-g85 |

Mali-G52's texture unit is a **dual texture mapper, 2 texels/clock/core**
(https://chipsandcheese.com/p/arms-bifrost-architecture-and-the ; ARM Bifrost
Shader Core doc
https://documentation-service.arm.com/static/655f28652c8b3557fee70876), so MC2
@1GHz ≈ 4 GTexel/s — consistent with the 3.4–3.8 above.

**Cost model below: 3.4 GTexel/s (Mali-G52 MC2, the conservative floor) and 7.6
GTexel/s (Adreno 610).** These algorithms are *fetch*-bound, not ALU-bound —
243 GFLOPS against a few hundred thousand fetches means the arithmetic is free.
Source resolution is **426×240** (`vw: 426` in every `drops-v1098*.json` arm),
with 640×360 as the alternate. Pyramid sizes:

| level | 426×240 | 640×360 |
|---|---|---|
| 1/8 | 53×30 = **1590 px** | 80×45 = **3600 px** |
| 1/16 | 26×15 = **390 px** | 40×22 = **880 px** |

### 1.2 The five candidates

Fetches per output pixel, then total, then ms at 3.4 / 7.6 GTexel/s, at
426×240. Reference block read once into registers; candidate blocks re-fetched.

| algorithm | fetches/px | total (426×240) | ms Mali-G52 | ms Adreno 610 | RGBA8 only? | WebGL1? |
|---|---|---|---|---|---|---|
| **BM naive, ±8 texels @1/8, 5×5 SAD** | 25 + 289·25 = **7250** | 11.5M | **3.4** | 1.5 | yes | yes |
| **BM ±4 @1/8, 5×5** | 25 + 81·25 = **2050** | 3.26M | **0.96** | 0.43 | yes | yes |
| **BM coarse-to-fine: ±3 @1/16 (3×3), then ±1 @1/8 (3×3)** | 450 @1/16, 90 @1/8 | 0.32M | **0.094** | 0.042 | yes | yes |
| **Pyramidal Lucas–Kanade, 5×5 window, 3 iters, 3 levels** | ~156/level | 0.75M | **0.22** | 0.099 | with packing | needs `highp` check |
| **Census 5×5 + Hamming, ±3 @1/8** | 25 (signature) + 98 (match) | 0.20M | **0.059** | 0.026 | yes | **no** (needs int ops) |
| **Horn–Schunck, 100 iterations** | 5/px/iter | 0.8M | 0.24 fill | 0.11 fill | yes | yes |
| **Phase correlation, 64×64 FFT per patch** | ~24 passes/patch/frame | small | small fill | small fill | float or fixed point | marginal |

Add ~50k fetches for the 2–3 downsample passes that build the pyramid from the
ring texture — under 0.02ms either way.

**Reading the table.**

- **Naive ±8 at 1/8 is the trap.** 3.4ms/frame at 30Hz is **101ms/s = 10% GPU
  duty** on the smoke device, on top of a render loop that already owns ~5
  unattributed points of a 13-point drop budget. Do not build this shape.
- **Coarse-to-fine block matching is the pick.** ~0.1ms, RGBA8-only,
  WebGL1-safe, no extension, no integer ops. ±3 at 1/16 = ±48 source px between
  two 33ms frames = **1450 px/s** of tracked motion, far past anything a
  talking-head or vlog produces; the ±1 refine at 1/8 gives ½-source-pixel
  resolution.
- **Lucas–Kanade is second.** Cheaper per level in fetches, but it needs either
  a `highp` fragment accumulator or 16F render targets. `highp` in a WebGL1
  fragment shader is optional (`GL_FRAGMENT_PRECISION_HIGH`); this repo has
  already **measured Adreno 610 reporting `HIGH_FLOAT precision 23` (true fp32)
  in both fragment and vertex shaders** (`probe_glprec.py`, CLAUDE.md loop 38)
  — Mali-G52 is unmeasured here. LK's other cost is the **aperture problem** on
  a single-edge subject (§2.1 #7).
- **Census is cheapest and is illumination-invariant** — its entire selling
  point, and the one thing that matters when a subject walks through a lighting
  change. Blocked on WebGL1: GLSL ES 1.00 has no bit operators, so XOR/popcount
  must be emulated with `mod`/`floor` (≈10× the ALU, still free at these fetch
  counts) or the context must move to WebGL2.
- **Horn–Schunck is refused, and not on fill rate.** 100 iterations means 100
  draw calls and 100 FBO binds per frame — draw-call/state-change bound on
  mobile, not fill bound. Worse, its global smoothness term deliberately
  diffuses motion **across** object boundaries, dragging a patch toward the
  background it is supposed to be independent of. Exactly the wrong prior.
- **Phase correlation is refused for a per-frame path**, same reason: a 64×64 2D
  FFT is ~24 ping-pong passes; three patches is 72+ draw calls a frame. It is
  the only method that returns *one* translation per window rather than a field
  — attractive on paper for exactly our problem — and it becomes viable only in
  the once-per-verdict form of §4.2, where 72 draw calls once a second is
  nothing. Park it as the fallback if block matching's median proves noisy.

### 1.3 Float textures vs RGBA8

**Neither is a blocker, and RGBA8 is enough.**

- `EXT_color_buffer_float` is what makes R16F/RG16F/RGBA16F/R32F/RG32F
  color-*renderable*; core WebGL2 samples float but cannot render to it without
  the extension
  (https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float).
  It is a **WebGL2-only** extension.
- Live device reports on gpuinfo.org show **Adreno (TM) 610 and Mali-G52 MC2
  both supporting `GL_EXT_color_buffer_float` and
  `GL_EXT_color_buffer_half_float`** (Android 15/16 reports, device IDs
  8179/8173 and 8180/8181/8183) —
  https://opengles.gpuinfo.org/listreports.php?extension=GL_EXT_color_buffer_float ,
  https://opengles.gpuinfo.org/listreports.php?extension=GL_EXT_color_buffer_half_float .
  **No gpuinfo entry exists for Adreno 613** — his phone's GPU is unverified on
  this axis.
- **But we do not need it.** The output is two displacements bounded at ±8
  texels. One byte per axis at ±8/256 = 1/16 texel = **½ source pixel at the 1/8
  level** — finer than `MOVE_DEADBAND` (0.02 of the box span) can express. So:
  `R = dx`, `G = dy`, `B = confidence`, `A = 255`, in a plain RGBA8 render
  target, which the presenter's framebuffer path already proves complete at
  attach (`checkFramebufferStatus`, phase-n N4).
- `gl-presenter.mjs:164` requests **`webgl`, not `webgl2`** today, with
  `precision mediump float` in every shader. Block matching works there
  unchanged. Census and async readback (§1.4) would want WebGL2; note the known
  history of **"WebGL 2 broken in Android WebView on Mali GPUs"** (crbug
  934823, https://bugs.chromium.org/p/chromium/issues/detail?id=934823 — the
  tracker now requires sign-in, status not read), so a WebGL2 move needs its own
  device probe and a WebGL1 fallback, not an assumption.

### 1.4 The real cost is the readback, not the shader

`readPixels` is synchronous and **flushes the whole GPU pipeline**: every queued
command must complete before it returns. Chromium's own graphics list describes
the CommandBuffer flush this causes
(https://groups.google.com/a/chromium.org/g/graphics-dev/c/Q_29VVa-Vfc); MDN's
WebGL best practices puts a synchronous stall at **"as long as 1ms or even
longer"**
(https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices);
drivers emit an explicit *"GPU stall due to ReadPixels"* warning
(https://community.khronos.org/t/readpixels-performance-and-pipeline-stall/107644).

A dense 53×30 RGBA8 field is only **6.4 KB**, but at 30 reads/s that is
**~30ms/s of pipeline stall — 3% duty, for a 0.1ms shader.** The readback is
**300× the algorithm.** Any design that reads a flow field per frame has priced
the wrong thing.

Two escapes:

1. **WebGL2 async readback** — bind a `PIXEL_PACK_BUFFER`, `readPixels` into it
   with an offset, `fenceSync(SYNC_GPU_COMMANDS_COMPLETE)`, poll
   `clientWaitSync`, then `getBufferSubData`; MDN's documented pattern
   (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices ,
   https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/getBufferSubData).
   **The delay line makes the latency free**: we already present 1500ms (45
   frames) behind live, so a flow result arriving two frames late is still 43
   frames early.
2. **Do not read a field at all** — §4.2.

---

## 2. What flow buys, and what it cannot

**The one-line limit: flow tracks TEXTURE MOTION, not identity.** It answers
"where did these pixels go", never "is this the same person", never "which
gender". Two safety consequences follow, and both are load-bearing:

- **Flow may move a box; it may never change a state.** `boxesAt` decides
  `'blurred' | 'cleared'` through rules 3′, 3″ and `stateAt`; none of them reads
  a position. So flow **cannot** produce the dangerous exposure class (a covered
  person going sharp because a verdict flipped). It can only produce the
  positional class: the right patch in the wrong place.
- **Flow cannot license fewer verdicts.** The brief's "the model only needs to
  fire on cuts and on entries" is **false as stated**: (a) flow cannot detect an
  entry — a new person is new texture, indistinguishable from a pan revealing
  background; (b) a *cleared* man's clear ages out (`CLEARED_TTL_MS`,
  `clearAge` advanced inside `coastStep`) and must be re-earned; (c) the clear
  ladder (`clearPending`; `pendingClearLadder` is 3 of 16 false-cover rows)
  needs consecutive reads. Flow can defer **position** passes only, and those
  are the cheap ones. Skipping verdicts is wild-doc idea #18, an exposure dial,
  and it stays his call.

### 2.1 Failure-mode table

| # | situation | what flow does | class | what already bounds it |
|---|---|---|---|---|
| 1 | **Occlusion** — subject walks behind another person | box follows the occluder's texture | **PHANTOM** while they diverge, then **EXPOSURE** at re-emergence (the patch is elsewhere) | rule 3 re-pins exactly at B (≤2.4s p95); rule 6 retires the coast if it expires with nobody taking the box; while occluded there is nothing to expose |
| 2 | **Camera pan** — everything moves | moves the patch with the world; the case a decayed velocity gets *wrong* | **neither — a win** | rule 3's lerp already captures a *linear* pan; flow's gain is the non-linear part. Most pans never fire the gate — `CUT_DELTA` 60 sits well above the p90 ordinary-motion delta of 28.2 |
| 3 | **Zoom / subject walking toward camera** | a translation-only estimator returns ≈0 at the box centre while the subject grows | **EXPOSURE** at the edges | mitigate: never let flow *shrink* a box (grow-only is the SOLID-safe direction), and take scale from the mean radial component of the field |
| 4 | **Motion blur / low light** | gradients vanish, SAD surface flat, best-vs-second-best ratio → 1 | **neither** | confidence gate → fall back to today's lerp/coast |
| 5 | **Subject leaves frame, no verdict for 2s** | box pushed to the edge, clamped to [0,1] | **PHANTOM**, no worse than today | today's decayed velocity parks mid-frame after ~3 passes; flow parks at the edge — marginally *better*. `blurredCoastMs` expiry and rule 6 end it either way |
| 6 | **A cut inside the interval** | garbage: SAD floor enormous, confidence collapses | **neither** | confidence gate refuses; `pushCut` + rules 3c/4/5 already drop boxes across a cut. **Side benefit:** flow confidence is a *better* cut detector than the 16×16 luma grid, which `bench/cut-truth.mjs` measured catching only **45.5% of real cuts at `CUT_DELTA` 60** |
| 7 | **Aperture problem** — subject is one strong edge (a shoulder against a wall) | motion resolved along the edge only | **partial EXPOSURE / PHANTOM** (drift along the edge) | require both structure-tensor eigenvalues above a floor before a cell votes; robust median over the box; endpoints re-pin |
| 8 | **Box is mostly background** | the median is the *background's* motion | **EXPOSURE** — on a static camera the patch stops while the person walks | **the most dangerous mode, and it is common in this repo's own geometry**: `personFromFace` synthetic bodies are **27.5%** of bodies (phase-G G1) and run 6 face-heights tall. Mitigation: weight the median toward the head region — every timeline entry already carries `head` / `face` / `headX,W,Y,H` |
| 9 | **Low or repeated texture** (plain wall, green screen) | many equal SAD minima | **neither** | confidence gate (best-vs-second-best ratio) |
| 10 | **Codec blocking at 426p** | the 1/8 downsample is a low-pass; blocking is averaged out | **neither** | — |

### 2.2 Where flow adds value, given the delay line already knows both endpoints

This is the crux, and it narrows the claim a great deal.

**Case A — rule 3, both endpoints known (the common case).** The renderer is
*not* guessing. `lerpBox` is already exact at both ends. Flow's only possible
contribution is the **path deviation in the middle** — the difference between a
straight line and the subject's real trajectory over ≤2.4s. For a seated
talking head that deviation is smaller than `PATCH_MARGIN` 0.045 + `PTRACK_PAD`
0.04 and flow buys **nothing**. For a walking subject under a handheld pan it is
real.

  **And naive flow makes this case WORSE**, because integrating flow forward
  from A drifts and the endpoint at B no longer matches the measurement. The
  correct form is a **flow-guided, affine-corrected lerp**: integrate the flow
  path, then rescale it so the total displacement equals `B − A` exactly. That
  is strictly ≥ `lerpBox` — identical when the motion is linear, better when it
  is not, and **incapable of drift** because both ends are pinned. If this idea
  is built, this is the form.

**Case B — rule 1 / no B yet (late).** **6.9% of presented frames** ran past the
newest snapshot (phase-K); `boxesAt` holds A's box and grows a pad. Flow
extrapolates honestly here instead of padding blindly. Real, and the smaller
half.

**Case C — the coast (`coastStep`).** **50–83 of ~200 blurred track-passes per
run**, p50 946ms, max 3305ms. The velocity is a decaying guess; flow is a
measurement. **This is the largest single target and the strongest argument for
the idea.**

  But note precisely what it does *not* move: flow does **not reduce the number
  of coasting passes**. `coastingPasses` is the phantom instrument
  (`events_reclass.py`), and the track still coasts — it just coasts to a better
  place. **Expected phantom delta: zero seconds.** The gain shows up in
  `falseCover.why.neighbourCoasting` (2 of 16 rows on the shipped 1096) and in
  uncovered frames, not in the phantom column.

**Case D — rules 4 and 5 (only-in-A, only-in-B).** `BIRTH_BACKDATE_PAD` 0.15 is
already a crude swept-region approximation for the entrant case. Flow would make
the back-date follow the actual entry path rather than pad a circle around it.
Small, real.

**One regression risk to name.** `markDeadCoasts` decides retirement partly with
`boxesTouch(n.box, t.box)` — a flow-moved coast is *more* likely to be "taken"
by a new blurred track and therefore **not** retired. Rule 6's yield is 8 of 83
passes; flow could shave it. Small, but it is a real cost in the direction he
cares about.

---

## 3. Prior art and licences

Hard rule: **no GPL/AGPL, and no non-commercial weights.** MPL-2.0 binary,
Play Store + App Store.

### 3.1 Usable

| what | licence | shape | perf |
|---|---|---|---|
| **OpenCV** DIS / Farneback / PyrLK — https://github.com/opencv/opencv/blob/4.x/LICENSE | **Apache-2.0** since 4.5.0 (BSD-3 before), https://opencv.org/opencv-4-5-0/ | C++; Farneback dispatches to OpenCL via the T-API `UMat` path (https://github.com/opencv/opencv/wiki/OpenCL-optimizations), CUDA variant in contrib. **No WebGL path.** Relevant only if flow moves into the native/JNI layer beside `NativeInfer.kt` | **no citable ARM ms/frame at 640×360 found** — open gap |
| **glsl-optical-flow** — https://github.com/keeffEoghan/glsl-optical-flow | **MIT** (per repo licence badge; the raw LICENSE 404'd — treat as one-source) | renderer-agnostic GLSL fragment shader, npm `@epok.tech/glsl-optical-flow`. **The closest ready reference for this design** | none published |
| **optical-flow-web** — https://github.com/Volcomix/optical-flow-web | **MIT** | dense Farnebäck polynomial expansion in WebGL, explicitly WIP | none published |
| **jsfeat** — https://github.com/inspirit/jsfeat/blob/master/LICENSE | **MIT** | pyramidal Lucas–Kanade, **CPU-only typed arrays**. Useful as a correctness oracle for a shader, not as the runtime | — |
| **oflow** — https://github.com/anvaka/oflow | **MIT** | CPU JS block matching; the author calls it a toy | — |
| **jadarve/optical-flow-filter** — https://github.com/jadarve/optical-flow-filter | BSD-3-Clause | **CUDA only** — desktop/Jetson, not a browser | "300 Hz" on one camera rig |
| **RAFT / SEA-RAFT** — https://github.com/princeton-vl/RAFT , https://github.com/princeton-vl/SEA-RAFT/blob/main/LICENSE | **BSD-3-Clause** | learned; no browser/TFLite deployment path | **no RAFT-Small mobile ms found** |
| **NeuFlow v2** — https://github.com/neufieldrobotics/NeuFlow_v2 | **Apache-2.0** | learned | **>20 FPS at 512×384 on a Jetson Orin Nano** (https://arxiv.org/pdf/2408.10161) — Jetson, not a phone |
| **FastFlowNet** — https://github.com/ltkong218/FastFlowNet | **MIT** (LICENSE fetched) | 1.37M params | **176ms/frame (5.7 FPS) on a Jetson TX2** at ~1024×436. Not real-time, not a phone, no published TFLite conversion |

### 3.2 Blocked — as hard a no as GPL

- **PWC-Net** (NVlabs) — **CC BY-NC-SA 4.0, non-commercial**,
  https://github.com/NVlabs/PWC-Net/blob/master/LICENSE.md . **UNUSABLE.**
- **LiteFlowNet / v2 / v3** — **research-only**; commercial use requires the
  author's consent, https://github.com/twhui/LiteFlowNet3/blob/master/LICENSE .
  **UNUSABLE.**

No GPL/AGPL-licensed optical-flow code turned up at all — but the two above are
functionally just as blocking and must be treated with the same hard no.

### 3.3 Absent

- **TensorFlow.js has no optical-flow model**, official or community — checked
  https://github.com/tensorflow/tfjs-models . Confirmed negative.
- **No WebGL phase-correlation implementation exists** with a readable licence.
  The nearest prior art is GLFFT (https://github.com/Themaister/GLFFT), desktop
  GL compute shaders, not WebGL.
- **No census-transform flow shader exists for the browser.** The nearest number
  is academic and desktop: 75.7 fps at 640×480, disparity 50, on a GeForce GTX
  280 (https://www.researchgate.net/publication/224135288) — stereo, not flow.
- **No published mobile-phone ms/frame for any shader-based flow at 640×360**
  was found by either research track. **Every ms figure in §1.2 is my own
  fetch-count arithmetic against a published fill rate, not a measurement.**
  Device measurement is entirely on us.

### 3.4 Codec motion vectors — confirmed dead, again

- **MediaCodec exposes no motion vectors.** No `MediaFormat.KEY_*` for them
  anywhere in the documented surface
  (https://developer.android.com/reference/android/media/MediaFormat). The
  `MediaCodec.getMotionVectorList` hit the wild-performance doc flagged as a
  search-engine hallucination is confirmed absent from AOSP.
- **WebCodecs exposes none either** — **zero occurrences of "motion vector" in
  the whole spec text** (https://www.w3.org/TR/webcodecs/); `VideoFrame` carries
  timestamp, duration, dimensions, format, colorSpace, rotation, flip, layout.
- **ffmpeg is the only route**: `flags2 +export_mvs` →
  `AV_FRAME_DATA_MOTION_VECTORS` → `AVMotionVector`
  (https://github.com/FFmpeg/FFmpeg/blob/master/doc/examples/extract_mvs.c ,
  https://ffmpeg.org/pipermail/ffmpeg-devel/2014-August/160938.html). That is
  **libavcodec's own software decode**, not MediaCodec hardware decode — so it
  means a **second full software decode of the stream** running beside the one
  the page already pays for, on the cores the compositor uses. A worse deal than
  the shader by a wide margin, and unreachable from inside a WebView regardless:
  the page has a `<video>`, not a decoder handle.

---

## 4. Integration sketch — and the design that actually fits

### 4.1 The obvious design, and why it is wrong

Per presented frame: run the flow shader on (previous ring frame, this ring
frame) → `readPixels` a 53×30 RGBA8 field → median per track in JS → hand
displacements to `boxesAt`.

**0.1ms of shader and ~1ms of pipeline stall, 30 times a second.** The readback
is 300× the algorithm and lands squarely in the ~5 unattributed drop points.
Reject.

### 4.2 The design that fits — the ring makes it free

`ringBudget(426, 240, 30, 1500)` = **60 frames**; `presentTick` frees everything
older than the picked entry, so the live ring is
**[presented frame m … newest ≈ m+1500ms] ≈ 45 frames**. The verdict gap is p50
805ms. **So every frame between the presented frame and the next verdict B is
already sitting in the ring at once.** That is the whole trick, and it exists
only because of the delay line.

```
per captured frame (30Hz, in gl-presenter.onVideoFrame, after capture()):
  flowPass(ring[n-1].tex, ring[n].tex) -> flowRing[n]    // 26x15 RGBA8, ~0.1ms
  // stays on the GPU. 45 fields x 26x15x4 = 70 KB of VRAM. No readback.

per verdict (~1/s, where pushSnapshot already runs):
  for each track in the new snapshot B:
    integrateShader(flowRing, track.box, track.head) -> 45x1 RGBA8
    readPixels(45x1) = 180 bytes                        // one stall, ~1/s/track
  -> a displacement path: box(m) for every ring frame from m to B
  hand it to pushSnapshot as snapshot.path[]

per presented frame:
  boxesAt looks the path up.  ZERO extra GPU work, ZERO readback.
```

Costs: **~0.1ms/frame GPU, 70 KB VRAM, ~3 readbacks of 180 bytes per second** —
against the per-frame design's 30 stalls/s. This is the version to price.
`requestVerdictFrame()` already does a full-frame `readPixels` once per verdict
pass, so the stall cadence is one this presenter has already accepted.

### 4.3 Where each piece lands

| piece | file | change |
|---|---|---|
| flow shader `FS_FLOW`, pyramid build | `gl-presenter.mjs`, beside `FS_BLUR` / `FS_PATCH` | new program; reuses `program()`, `target()`, `drawQuad()`, `newTexture()`, the texture `pool`, and the `fbo` whose completeness is already probed at attach |
| flow ring | `gl-presenter.mjs` | parallel array to `ring`; entries freed in the same `freeTexture` loops in `presentTick` so it cannot leak |
| integration + tiny readback | `gl-presenter.mjs` | new export `trackPath(box, head, fromMediaTime, toMediaTime)` — sibling of the existing `locateCut(from, to, minDelta)`, same ring, same `readBack()` |
| consumption | `track-timeline.mjs` | `pushSnapshot(tl, m, tracks, path)`; rule 3 replaces `lerpBox(a,b,frac)` with `flowLerpBox(a,b,frac,path)`, the **affine-corrected** form of §2.2 Case A; rules 1/4 use the path's tail for extrapolation |
| coast | `person-track.coastStep` | `dx = path ? path.dx : (t.vx*dt/1000)` — flow when confident, today's decay otherwise. `vx *= 0.7` stays as the fallback |
| wiring | `init-entry.js` ~4627 (`pushSnapshot`) and ~1962 (the `setTimeline` closure) | pass the presenter's path through; both already have `presenter` in scope |
| dial | `tuning.mjs` SPEC | `FLOW_TRACK: [0, 1, function (v) { glPresenter.setFlowTrack(v); }]`, **ships 0** |

### 4.4 SOLID patches — how it composes

Flow **translates** a rectangle and may **grow** it. It never masks, never
splits, never subtracts, never windows. `mergePresented`, `body-clamp`,
`clipTopEdge` and `drawPatches`' rounded-rect shader all run downstream,
unchanged, on a rectangle. The **grow-only** rule from §2.1 #3 (a divergent
field may enlarge a box but never shrink it) is both the zoom mitigation and the
SOLID-safe direction — it can only ever cover more.

### 4.5 Fail-safe, one way

Every one of these falls back to **exactly today's behaviour**, never to "no
patch":

- `FLOW_TRACK` 0 → the shader never compiles, no flow ring is allocated.
- Not on the GL presenter (`PRESENTER_GL` 0, WebGL refused, context lost) → no
  flow; the 2D presenter behaves as today.
- Confidence below floor (flat SAD surface, best/second-best ratio → 1, or
  structure-tensor eigenvalues under floor) → that track uses `lerpBox` /
  `coastStep` for that interval.
- Any non-finite displacement, or `|dx|` past the search radius → discarded, and
  a discard is **counted**, never silently swallowed.
- A shader that will not compile or an FBO that will not complete → the existing
  `fail(reason)` / `onLost` path already detaches the whole GL presenter and
  re-attaches the 2D one. Flow inherits it for free.

---

## 5. Measurement plan — instruments that already exist

One planted `window.__TS_GAZE_TUNING__` **per invocation**
(`probe_drops_ab.py` header: one plant per process, or the first
non-configurable plant wins and the second arm silently measures the first —
that cost the `v1097-decomp` run).

| question | instrument | arms | the number that decides |
|---|---|---|---|
| **does it cost frames** | `probe_drops_ab.py <port> <label> 120`, `TS_ARMS=smart:plant-flow.js`, control in the same invocation | control, `PRESENTER_GL 1`, `PRESENTER_GL 1 + FLOW_TRACK 1` | `dropPct`, `rafHz`. Control has read 12.05–13.56 across sessions, so **anything under ~1.5 points is inside the session-to-session spread** — take control and arm in the same invocation, twice |
| **does it move accuracy** | `probe_events.py <port> <label> 180 NWoT1ZVd1Lo 55` → `events_reclass.py` | the same three arms, man mode, same video/seek | `falseCover.why.neighbourCoasting` / `neighbourMeasured`; `exposure.exposureUpperMs.nOver300`; `exposure.exposureLowerMs.nPositive`; `phantom.coastingPasses`; `phantom.coastMs.max` |
| **is the flow itself sane** | **new** `probe_flow_truth.py` — dump the per-track path, compare against the *next* verdict's measured box | one arm | `|Σflow − (B−A)|` as a fraction of box width. **This is the red-before-green: a flow that cannot beat a straight line on this metric is not worth wiring in. Run it before either of the above** |
| **render loop** | `__TS_GAZE_RENDER()` | all | `repositionErrors` must stay **0**; `timelineFallback` must not rise |
| **presenter** | `__TS_DELAY_STATS()` | all | `late`, `capFailed`, `presented` unchanged; `lost` null |

**New counters needed** (life counters, seeded to 0 on the first player pass —
CLAUDE.md loop 34: an absent key must not be confusable with an unhooked one):

- `flowApplied` — a track-interval where flow moved the box.
- `flowRefused` — confidence below floor. **This is the honest denominator:**
  `flowApplied` alone cannot tell "flow works" from "flow fires twice a run".
- `flowDiscarded` — non-finite or out-of-range displacement.
- `flowGrew` — the grow-only zoom path fired.
- Presenter stats: `flowPasses`, `flowReadbacks`, `flowMs` (a rolling p50 of the
  integration + readback, so §1.4's stall is measured rather than argued).

`diag-report.mjs` field names **are** enum keys — the walker looks strings up by
key. That cost one red run in the perf batch; add all five to the enum in the
same commit.

---

## 6. Effort and the honest expected gain

### Effort — 8–9 engineering days

| task | days |
|---|---|
| T1 flow shader + pyramid + confidence, standalone, plus `probe_flow_truth.py` proving it beats a straight line on the Redmi | 2 |
| T2 flow ring on the GPU + `trackPath()` integration shader + tiny readback | 2 |
| T3 `track-timeline` affine-corrected `flowLerpBox`, rules 1/4/5, `coastStep` fallback | 2 |
| T4 dial, fail-safe paths, counters, tests (red-proved against the pre-change source) | 1 |
| T5 device measurement, three arms × two runs, drops + events | 1 |
| Opus critic on the diff, ledger rows (an open EXPOSURE row blocks a release) | 1 |

**And it is gated.** This lives inside `gl-presenter.mjs`, which only owns a
video when `PRESENTER_GL` is 1 — and that arm currently measures **12.57%
against a 12.05% control** (`drops-v1098c-glpres` vs `drops-v1098c-control`).
Building flow on a presenter that is not yet a win is building on a foundation
that may be reverted. **Land `PRESENTER_GL` first, or do not start.**

### Gain — in the repo's own units, per 180s Redmi run

| column | today (1095/1096 measured) | after flow | reasoning |
|---|---|---|---|
| **phantom** (`coastingPasses`) | 50–83 of ~200 blurred passes | **unchanged — zero seconds** | flow moves a coast, it does not end one; the instrument counts passes, not misplacement. Possibly slightly *worse* — a flow-moved dead coast is more likely `boxesTouch`-taken and so escapes rule 6's 8-of-83 retirement |
| **false cover** | 16 of 82 certain-male reads | **13–15 of 82** | addresses `neighbourCoasting` (2 rows) and part of `neighbourMeasured` (4). Cannot touch `pendingClearLadder` (3), `demotedAtCut` (2), `bornBlurredAtCut` (1) — those are cadence and state, not position |
| **exposure** | uncovered frames **121** ≈ **4.0s** presented (30fps) | **−1.0 to −1.5s** | back-dating (`BIRTH_BACKDATE_PAD`) already owns the birth-latency share; flow owns the mid-interval position-error share, perhaps a third of it. `nPositive` over 300ms is already **0** and stays 0 |
| **drops** | 12.05–13.56% control | **+0.3 to +0.5 points** with §4.2; **+1 to +3** with the naive §4.1 | §1.2's shader is ~0.1ms/frame = 0.3% duty; the delta is the readback and the extra ring |

**So: roughly 1–1.5 seconds of exposure and two or three false-cover rows per
180s run, for eight or nine days and up to half a drop point.**

Compare the levers already on the shelf, measured on the same instrument:
`PTRACK_MIN_COAST_PASSES` 2 → 1.33 buys **141–156s of phantom** for +4–5s of
exposure and costs **one OTA push and zero engineering days** (it has been
awaiting his ruling since loop 42). `VERDICT_DUTY` and `GENDER_REFRESH_MS` are
the same shape. **Every one of them is a larger number than this entire round,
for a fraction of the cost.**

### The recommendation

**Do not build the dense-flow round now.** Three reasons, in order:

1. **The delay line already ate most of the prize.** The idea's strength is
   "the renderer is guessing between verdicts" — and since 1092 it mostly is
   not. `boxesAt` interpolates between two *measurements* on the majority of
   presented frames. Flow's remaining territory is the 6.9% late case, the
   coast, and mid-interval non-linearity — and only the coast is large.
2. **The phantom column does not move**, and phantom is his loudest complaint.
   The number this improves is exposure, on which `nPositive` already reads 0.
3. **It is downstream of an unproven presenter.**

**What is worth extracting from it now, cheaply:**

- **The affine-corrected flow-guided lerp is the right idea even at one
  sample.** A single flow estimate at the interval midpoint, computed once per
  verdict on two ring frames — ~0.1ms once a second, one 180-byte readback —
  turns `lerpBox` from a straight line into a two-segment path. That is
  **1–1.5 days, not 9**, and it captures most of Case A.
- **Flow confidence is a better cut detector than the 16×16 luma grid**, which
  `bench/cut-truth.mjs` measured at **45.5% recall at `CUT_DELTA` 60**. A frame
  pair with an enormous SAD floor and collapsed confidence is a cut — including
  the cuts between two similarly-lit shots that a luma mean is structurally
  blind to. That is a **separate, cheaper round with a clearer prize**: every
  missed cut lets a stale cleared track absorb a stranger, and every false cut
  costs a cleared man his clear.

Both of those deserve writing up before the dense round is reconsidered.

---

## 7. What this document did not do

No device run. No line of code. **Every millisecond in §1.2 is fetch-count
arithmetic against a published fill rate — not one of them is a measurement**,
and both research tracks confirmed that no published mobile-phone number exists
for shader-based flow at this resolution. The first thing any build of this must
produce is `probe_flow_truth.py` on the Redmi: does the flow estimate beat a
straight line between two known verdict boxes. If it does not, nothing after §4
matters.
