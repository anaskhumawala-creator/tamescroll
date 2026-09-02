# Research B — Faster On-Device Inference for tamescroll Gaze

Context: BlazeFace (256x256 fp32) + faceres (224x224 fp16 GPU) + MoveNet MultiPose Lightning
(256x256 fp32) via TFLite 2.16.1 GPU delegate, Kotlin engine, frames over WebMessagePort as RGBA.
Redmi 9 (Helio G85, Mali-G52 MC2, Android 12): verdict pass ~355ms p50, gap ~800ms.
Owner phone: Redmi 13 4G, Snapdragon 4 Gen 2 (SM4450), Adreno 613, Hexagon NPU, Android 16.

---

## 1. NPU access from a third-party app (2025-2026)

**Google LiteRT NPU delegate for Qualcomm — DOCUMENTED, chipset list does NOT include SM4450.**
- Maven coordinates confirmed: `com.qualcomm.qti:qnn-litert-delegate:2.34.0` and
  `com.qualcomm.qti:qnn-runtime:2.34.0`, hosted on Maven Central.
  https://developers.google.com/edge/litert/android/npu/qualcomm
- Explicitly supported chipsets on that page: **Snapdragon 8 Gen 1 (SM8450), 8 Gen 2 (SM8550),
  8 Gen 3 (SM8650), 8 Elite (SM8750)** — flagship tier only, "and more" linking out to Qualcomm's
  own compatibility doc (that doc returned no fetchable content in this session — could not
  confirm or rule out SM4450 from Qualcomm's own list). DOCUMENTED for the flagship set;
  **SPECULATIVE that SM4450/Snapdragon 4 Gen 2 is excluded** (absence from Google's own list is
  suggestive but not a confirmed exclusion).
- Google announced this as a new "LiteRT Qualcomm AI Engine Direct Accelerator" replacing the
  old TFLite QNN delegate, developed with Qualcomm. On Snapdragon 8 Elite Gen 5 NPU inference is
  quoted "up to 100x faster than CPU and ~10x faster than GPU" — flagship number, not applicable
  to 4 Gen 2. https://developers.googleblog.com/unlocking-peak-performance-on-qualcomm-npu-with-litert/
  https://www.edge-ai-vision.com/2025/11/google-announces-litert-qualcomm-ai-engine-direct-accelerator/
- LiteRT's general NPU overview page (2026): Qualcomm is the only NPU vendor with a currently
  shipping delegate; MediaTek's own NPU+LiteRT path exists as a separate track (see below);
  Google Pixel (presumably Tensor) and Samsung System LSI are listed as **"coming soon"**, i.e.
  not yet available. https://developers.google.com/edge/litert/android/npu/overview
- **Licensing risk (flag, not blocker, per your rules):** the underlying Qualcomm AI Engine
  Direct (QNN) SDK is proprietary — "access to and use of tools managed by the Qualcomm Package
  Manager are subject to the terms and conditions of the corresponding agreement(s) ... with
  Qualcomm Technologies, Inc." (DOCUMENTED, exact redistribution terms not found in this session —
  the Maven-hosted `qnn-runtime`/`qnn-litert-delegate` artifacts may carry a different, more
  permissive redistribution grant than the raw SDK download, but I could not confirm the artifact
  licence text itself). This needs a direct read of the Maven POM/licence file before shipping,
  not an assumption either way. https://mysupport.qualcomm.com/supportforums/s/question/0D5dK0000058pPNSAY/

**NNAPI status on Android 15/16 — DOCUMENTED, deprecated at the app-facing layer only.**
- "Starting in Android 15, the Neural Networks API (NNAPI NDK API) is deprecated. The Neural
  Networks HAL interface continues to be supported and NNAPI drivers aren't affected by this
  deprecation." I.e. the C API apps call is deprecated (still present, discouraged, will not get
  new features); the underlying vendor HAL driver plumbing is untouched.
  https://developer.android.com/ndk/guides/neuralnetworks
  https://source.android.com/docs/whatsnew/android-15-release
- Google's migration guidance: move off NNAPI toward "TensorFlow Lite in Google Play Services"
  and/or the TFLite GPU delegate for hardware acceleration — i.e. Google is steering away from
  NNAPI toward exactly the GPU-delegate path you already use, not toward a still-recommended NPU
  path for non-Qualcomm/non-flagship chips. https://developer.android.com/ndk/guides/neuralnetworks/migration-guide
- No source found confirming or denying whether Android 16 removes/changes vendor NNAPI HAL
  routing specifically. Treat "NNAPI still reaches the vendor driver on Android 16" as
  DOCUMENTED for the HAL layer, un-confirmed for any Android-16-specific regression.

**MediaTek / Helio G85 (the dev/bench phone, not the owner's) — DOCUMENTED, has an APU.**
- Helio G85 does have a built-in APU (AI Processing Unit): "The built-in APU (AI Processing Unit)
  facilitates features like scene recognition in cameras, background blur, and charge
  optimization." 2x Cortex-A75 @2.0GHz + 6x Cortex-A55 @1.8GHz, Mali-G52 @1GHz, 12nm.
  https://www.91mobiles.com/processor/mediatek-helio-g85-pdp
  https://cpu-monkey.com/en/cpu-mediatek_helio_g85
- MediaTek NeuroPilot (their AI SDK) is NNAPI-compliant and routes work across CPU/GPU/APU/DSP;
  Helio G85 "supports MediaTek NeuroPilot and full compliance with Android NNAPI."
  https://www.mediatek.com/products/smartphones/mediatek-helio-g85
- Google/MediaTek also announced a LiteRT+MediaTek NPU delegate track (parallel to the Qualcomm
  one), but no chipset list or G85-tier support was found in this session — treat as
  SPECULATIVE whether the bench phone's APU is reachable through it.
  https://developers.googleblog.com/mediatek-npu-and-litert-powering-the-next-generation-of-on-device-ai/
- **Not directly relevant to the shipping target** (owner's phone is Qualcomm), but relevant if
  the Redmi 9 stays the bench/dev device.

**Bottom line for track 1:** the owner's Snapdragon 4 Gen 2 has a Hexagon NPU in silicon, but
Google's own currently-documented LiteRT Qualcomm NPU delegate chipset list is flagship-only
(8-series) and does not name SM4450. No source found in this session confirms SM4450 works or is
blocked. This is the single highest-value fact to verify directly (flash a QNN-delegate test APK
on the owner's phone and read the delegate's own capability query / error) before spending any
engineering time on the NPU path — everything else here is downstream of that unknown.

---

## 2. GPU delegate tuning + XNNPACK vs GPU for tiny models

**OpenCL vs OpenGL backend — DOCUMENTED.**
- TFLite GPU delegate "attempts to initialize the OpenCL context and falls back to OpenGL only if
  it fails." OpenCL is the fast path when available.
  https://groups.google.com/a/tensorflow.org/g/tflite/c/omkz-T4I_nI
- "OpenCL on Adreno is able to greatly outperform OpenGL's performance by having a synergy with
  physical constant memory and native FP16 support... optimizing the OpenCL backend was much
  easier than OpenGL, because OpenCL offers good profiling features and Adreno supports them well."
  https://blog.tensorflow.org/2020/08/faster-mobile-gpu-inference-with-opencl.html
- Adreno 613 (owner's phone) supports OpenCL 2.0, OpenGL ES 3.2, Vulkan 1.1, 955MHz max clock —
  entry-level Adreno tier. https://www.notebookcheck.net/Qualcomm-Adreno-613-Benchmarks-and-Specs.855460.0.html
  MEASURED-BY-SOURCE only for the clock/API-support facts, not for any TFLite latency number —
  no published TFLite-on-Adreno-613 latency figures were found in this session.
- Mali-G52 (bench phone) OpenCL support is standard for that GPU family but specific
  TFLite-on-Mali-G52 latency numbers were not found either. **This is a gap**: neither device has
  a directly cited TFLite/BlazeFace/MoveNet ms number in the literature — your own on-device
  probes remain the only ground truth for these two GPUs specifically.

**`setPrecisionLossAllowed` / GPU delegate options — DOCUMENTED, thin.**
- Default is `allow_precision_loss = false`; setting true lets the delegate use fp16 math
  internally for speed (this is presumably why your MoveNet fp16 run went blind on the Adreno
  610 GPU delegate — a device-specific fp16 correctness bug class, not unique to your app).
  Source only confirms the option exists and its default, not a Mali/Adreno-specific corpus of
  known-bad ops. https://discuss.ai.google.dev/t/tflite-gpu-delegate-issue/16020
- GPU delegate **serialization/kernel cache**: "load from pre-compiled kernel code and model data
  serialized and saved on disk from previous runs... can reduce startup time by up to 90%,"
  configured via serialization directory + model token, available in Java/C++.
  https://developers.google.com/edge/litert/performance/gpu — **DOCUMENTED, directly actionable**:
  this is a distinct optimization from anything already in your gauntlet notes (which discuss a
  tfjs/WebGL shader-compile warm-up on the web-worker side, not the native TFLite GPU delegate's
  own serialization cache). If not already wired into the Kotlin `NativeInfer.kt`, this is free
  cold-start latency on every app relaunch, though it doesn't touch the 355ms/800ms steady-state
  numbers you're trying to cut.

**XNNPACK (CPU) vs GPU for small models — DOCUMENTED, model-size-dependent, directly relevant.**
- "TensorFlow Lite benefits the most from the XNNPACK backend on small neural network models and
  low-end mobile phones." https://blog.tensorflow.org/2020/07/accelerating-tensorflow-lite-with-xnnpack-integration.html
- "For FP32-based models, GPU can bring inference speedup by 1.4x-1.9x compared to CPU, but in
  certain cases like MobileNetV1 and VGG16, GPU even runs slower than CPU (up to 2.3x). On
  INT8-based models, GPU can hardly bring any benefit." "Mobile GPUs are mainly designed for
  rendering... computing power highly constrained due to battery life considerations." Also: "GPU
  backend... requires OpenGL ES 3.1 or higher, which is only available on ~2/3 of all Android
  devices." (Both Adreno 613 and Mali-G52 comfortably exceed that floor, so device-compat isn't
  the concern here — throughput is.) Source: arXiv 2202.06512, "Benchmarking of DL Libraries and
  Models on Mobile Devices." **This directly questions your architecture's premise**: BlazeFace
  at 256x256 fp32 is a genuinely tiny model (sub-1M-typical-param face detectors), and the cited
  literature says exactly this class of model is where XNNPACK-on-CPU can match or beat the GPU
  delegate, especially once GPU dispatch/readback overhead (which your own gauntlet notes already
  measured as costly on the web/WebGL side) is counted. No source gives a BlazeFace-specific
  XNNPACK-vs-GPU number on your exact hardware — this is a hypothesis worth a same-device A/B, not
  a proven win.

**INT8 quantization — DOCUMENTED, gains real but GPU delegate doesn't benefit today.**
- "TFLite INT8 quantization reduces latency by approximately 60-80%... 2x-4x [theoretical]...
  real-world results ... 0.8x-3.0x... in certain cases INT8 is even slower than FP32." Model size
  drops ~4x. https://apxml.com/courses/advanced-tensorflow/chapter-6-model-deployment-optimization/optimizing-on-device-inference
- Critical caveat for your stack specifically: **"INT8 quantization has been primarily studied on
  mobile CPUs because using 8-bit integers can cause significant overhead in the current
  implementation of the TFLite GPU delegate."** — i.e. INT8 is an XNNPACK/CPU-path win, not a
  free win if you stay on the GPU delegate. This matches your own repo history: your hybrid
  uint8/f16 MoveNet requant (`requant-uint8.py`) already found full-uint8 depthwise convs go dead
  on your GPU path — same failure class this source predicts.
- Accuracy: "accuracy loss can be minimized by using QAT (quantization-aware training)... post-
  training quantization does not work smoothly for complex models like RetinaNet." For a
  gender/age head like faceres (already a source of measured accuracy drift in your own repo when
  you tried post-hoc uint8), this is a real risk, consistent with what you already measured
  (parity failures, 2 sign flips, cosine 0.5962 vs a 0.60 threshold) when you tried a naive
  per-tensor uint8 requant on faceres.

---

## 3. Smaller/faster model alternatives (licence-checked)

| Model | Task | Params / size | Input | Licence | Latency (cited) | Notes |
|---|---|---|---|---|---|---|
| MediaPipe BlazeFace (current) | face det | ~0.1-0.2M (typical) | 256x256 (full) | Apache-2.0 (MediaPipe) | — | baseline, already smallest-class |
| **YuNet** (OpenCV Zoo) | face det | small, exact size not found this session | dynamic, works 10x10-300x300 faces | **MIT** | not found (only AP: 0.834/0.824/0.708 easy/med/hard on WIDER) | "several times faster than most other models" per source claim, but no hard ms figure found. Detects tiny faces natively — could remove your face-min-px floor headaches. https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md |
| **RetinaFace (MobileNet-0.25 backbone)** | face det | **1.7M params** | flexible | **MIT** | **23ms** (hardware unspecified, likely desktop CPU — treat as DOCUMENTED not MEASURED-for-mobile) | 80.99% WIDER-hard (notably more accurate on hard/small faces than typical BlazeFace numbers); also emits 5-pt landmarks. Heavier than BlazeFace by param count — likely a mobile-CPU/GPU loss unless it also lets you drop a separate landmark step. https://github.com/biubug6/Pytorch_Retinaface |
| **SCRFD-0.5g** (insightface) | face det | designed for edge/mobile budget | VGA-scale FLOP budget ("0.5G" = 0.5 GFLOPs) | **Code MIT**, but **pretrained weights are "non-commercial research purposes only"** | not found | **Licence blocker as shipped** — insightface's own model zoo weights explicitly restrict commercial use; you'd have to retrain from scratch on your own/licensed data to use the architecture, which defeats the "just swap the model" premise. https://github.com/deepinsight/insightface/tree/master/detection/scrfd |
| MoveNet SinglePose Lightning | single-person pose | smaller than MultiPose | **192x192** | Apache-2.0 (TF Hub) | "runs faster than real time (30+ FPS) on most modern phones" (no ms figure) | Wrong shape for your use case — you need multi-person; SinglePose would require you to already know a person ROI (i.e. only useful *after* a person/face detector already ran), not a drop-in MultiPose replacement. https://www.tensorflow.org/hub/tutorials/movenet |
| MoveNet MultiPose Lightning (current) | multi-person pose | — | 256x256 (dynamic-capable) | Apache-2.0 | "number of detected persons does not impact inference speed" | Already your choice; no cheaper same-capability alternative surfaced. |
| **BlazePose / MediaPipe Pose Landmarker Lite** | single-person pose+landmarks | 815K (detector) + 3.37M (landmark), **Lite ~3MB total** | 256x256 landmark stage | **Apache-2.0** (MediaPipe/Google AI Edge) | "up to 31 FPS on a Pixel 2" (old device, CPU); Lite model ~3MB is smallest of the 3 tiers | Also single-person (needs an ROI first) — same shape mismatch as SinglePose MoveNet for your multi-person requirement, but notably lighter than MoveNet MultiPose. Could pair with a cheap person detector for ROI-based multi-person if you're willing to re-architect. https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker |
| **RTMPose-t** (OpenMMLab) | multi-person pose (top-down) | "t/s/m/l/x" sizes, t = tiny, exact params not found this session | not confirmed | **Apache-2.0 (mmpose/OpenMMLab repos are Apache-2.0)** — not independently re-verified in this session, flag as DOCUMENTED-not-confirmed | RTMPose-s: 72.2% AP COCO, 70+FPS on Snapdragon 865 via **ncnn** (not TFLite) | Real numbers exist only for -s on ncnn/Snapdragon 865 (a 2020 flagship, NOT your target chips), not -t nor TFLite/GPU-delegate. Porting cost (need ONNX->TFLite conversion, retuning) is real and unquantified. https://arxiv.org/abs/2303.07399 |
| YOLOv8-pose | multi-person pose | — | — | **AGPL-3.0** by default, Enterprise licence required for closed/commercial redistribution of model+weights | — | **Confirmed blocker as flagged in your brief** — AGPL compliance would require "publicly releasing the complete corresponding source code for the entire derivative work," incompatible with keeping any part closed, and licensing cost for Enterprise is the alternative. Your app is already MPL-2.0 open source, which *might* satisfy AGPL's source-availability spirit, but AGPL's network-copyleft "conveying" trigger and Ultralytics' own Enterprise-License-for-commercial-use posture make this a real legal question, not a green light — do not vendor without a lawyer-reviewed answer. https://github.com/ultralytics/ultralytics/issues/19390 |
| faceres (HSE FaceRes, current) | gender/age/descriptor | — | 224x224 | MIT (per your own NOTICE) | — | baseline |
| **MiVOLO / MiVOLO v2** | age & gender (transformer) | — | **384x384 face/body crop** | **Apache-2.0** | not found (transformer-class, almost certainly heavier and slower than faceres on this hardware) | Larger input (384 vs your 224) and transformer architecture strongly suggest this is a *slower*, more accurate alternative, not a speed win — likely wrong direction for your latency problem. https://github.com/WildChlamydia/MiVOLO |

**Track 3 takeaway:** No licence-clean model surfaced that is both smaller AND already
benchmarked faster than your current trio on comparable mobile silicon. YuNet (MIT, tiny-face
native) and RetinaFace-mobile0.25 (MIT, 1.7M params, well-documented accuracy) are the two
plausible face-detector swaps worth a same-device bake-off; SCRFD is a licence dead-end as
pretrained weights; YOLOv8-pose is an AGPL dead-end without an Enterprise licence; RTMPose-t and
MiVOLO both lack mobile/TFLite-GPU numbers on hardware anywhere near yours, so they're
speculative wins that would cost a conversion+retune cycle to even measure.

---

## 4. Batching/scheduling tricks

**Split cadence (MoveNet slower than BlazeFace) — already partially your architecture.**
No new external source found beyond general principle; your own repo's `cadence.mjs` /
`VERDICT_DUTY` / position-vs-verdict split already implements exactly this idea end-to-end on the
web side. No additional citation found specific to native TFLite scheduling of this kind — this
remains an engineering pattern, not something the literature quantifies for your model set.

**ROI-only inference / crop-around-track — DOCUMENTED as a standard practice, not benchmarked for
your models specifically.**
- "Cropping only the area of interest of an image can be used as a preprocessing step, with the
  output stream of detected objects taken as input for [tracking] purposes." General
  tracking-by-detection literature confirms the pattern is standard, but no source in this
  session gives a BlazeFace/MoveNet-specific ROI-crop speedup number. SPECULATIVE magnitude: for
  MoveNet re-inference on a known-track ROI vs full 256x256 frame, the win is bounded by how much
  smaller the crop can be made while still meeting the model's fixed input size — since MoveNet
  MultiPose has a **fixed 256x256 input**, an ROI crop still gets resized back up to 256x256
  before inference, so **there is no FLOP saving unless you also switch to a model that accepts
  variable/smaller input** (e.g. MoveNet SinglePose at 192x192, or YuNet's dynamic-shape ONNX).
  This is an important correction to the "just crop the ROI" intuition: with a fixed-input-size
  TFLite graph, cropping only helps if the crop is genuinely used at a smaller effective
  resolution, not merely a tighter framing at the same tensor size.

**Cheap trackers between detections (KCF/MOSSE/CSRT) — DOCUMENTED, Apache-2.0 (OpenCV), real
numbers exist but not on your hardware.**
- Licence: OpenCV core (incl. these trackers, all patent-expired classical CV, no ML weights) is
  **Apache 2.0**. Clean.
- Published desktop-class comparison: "KCF operates at ~30fps, CSRT and MedianFlow at ~4fps,
  though MOSSE is fast and works well in high-frame-rate scenarios... MOSSE, MedianFlow, and KCF
  are the best three trackers in terms of update times, followed by CSRT." "CSRT is one of the
  most accurate... MOSSE is fast but its accuracy is limited." https://www.sighthound.com/blog/opencv-object-tracking-algorithms
  https://answers.opencv.org/question/201685/
  These numbers are **not mobile-specific and not sourced to a paper with a defined benchmark
  machine** — treat as indicative ordering (MOSSE > KCF > CSRT for speed; CSRT > KCF > MOSSE for
  accuracy) rather than portable ms figures.
- Directly relevant self-critique: **you already have exactly this pattern**, just implemented as
  a hand-rolled luma-delta scene-cut gate plus IoU/Hungarian-assignment coasting between verdict
  passes (`person-track.mjs`, `assign.mjs`, `cadence.mjs`), which is architecturally closer to
  MOSSE-class correlation tracking than to full re-detection. Swapping in a literal OpenCV MOSSE
  tracker (native, on the Kotlin side) instead of coasting via predicted boxes on the JS side is a
  plausible win **only if** the current coast/lerp math is measurably worse at holding a box on a
  moving subject than a real correlation tracker would be — no evidence either way was found, and
  your own gauntlet logs show the coast/lerp approach already tuned extensively for this exact
  problem. This is a genuine "maybe," not a clear win — the coasting math you have is free
  (no extra inference), while MOSSE/KCF still cost real per-frame CPU time.
- Optical flow (Lucas-Kanade) on a small luma grid: "computationally intensive and too slow for
  real time performance" in naive form; a **pyramidal Lucas-Kanade** variant is the standard
  mobile-viable form. https://www.researchgate.net/publication/265269977 No ms figure found for a
  16x16/64x64 grid specifically — but note your own `scene-gate.mjs` already runs a 16x16 luma-
  delta cut detector at <=10Hz, which is a cheaper, coarser cousin of this idea already shipped
  and tuned. A true per-pixel LK flow field would be considerably more expensive than your
  existing gate and would need to run in the Kotlin engine (native) to be worth it at all — doing
  it in JS on a video frame at any useful resolution would almost certainly cost more than it
  saves versus your current architecture.

---

## 5. Zero-copy frame delivery

**Current path (RGBA over WebMessagePort) — cost not independently sourced in this session**, but
your own repo notes already establish the WebView-side capture/serialize cost is non-trivial
(this is exactly the kind of thing your existing gauntlet probes should already be timing on the
JS side — no new external figure to add here).

**AHardwareBuffer — DOCUMENTED as zero-copy, but wrong shape for this pipeline.**
- "All operations involving AHardwareBuffer and HardwareBuffer are zero-copy... passing
  AHardwareBuffer to another process creates a shared view of the same region of memory... can be
  bound to EGL/OpenGL and Vulkan primitives." https://developer.android.com/ndk/reference/group/a-hardware-buffer
- No source found describing a supported path for a **Chromium WebView page's `<video>` element**
  to hand its decoded frame to native code as an `AHardwareBuffer` — this is not an exposed
  WebView API. AHardwareBuffer is a Camera2/MediaCodec/Vulkan/EGL-interop primitive, not something
  a web page's JS can produce. **This whole avenue is a dead end for a WebView-hosted `<video>`**
  unless you abandon the "read pixels from a running YouTube page" architecture entirely (which
  is your whole gaze-on-third-party-page model — not viable to change).

**PixelCopy from Kotlin, bypassing the page's own JS copy — DOCUMENTED as existing, latency
numbers not found.**
- `PixelCopy` (API 24+) "allows direct pixel copying from the surface to a Bitmap... the last
  queued buffer is peeked and rendered to a GL texture which is then copied to the Bitmap." Used
  specifically because `SurfaceView`/`VideoView`-class content renders to a separate hardware
  surface that ordinary `Canvas` capture can't see — i.e. **it is a real candidate for grabbing a
  video frame without the page itself doing a canvas `drawImage`/`toDataURL`-class copy.**
  https://webarchive.library.unt.edu/web/20160706180231mp_/https://developer.android.com/reference/android/view/PixelCopy.html
- **Critical open question, not resolved by any source found**: does `PixelCopy.request()` work
  against Android's Chromium-based `WebView` at all, and specifically against the WebView's
  internal video-playback surface (which is composited by Chromium's own GPU process, not a plain
  app-owned `SurfaceView`)? No source in this session confirms `PixelCopy` can target a `WebView`
  or its embedded `<video>` surface — WebView's rendering pipeline (SurfaceControl-based hardware
  compositing in modern Chromium/WebView) is architecturally different from a simple app
  `SurfaceView`, and `PixelCopy`'s documented use cases are all app-owned surfaces (`SurfaceView`,
  `Window`, `Surface`). **Mark this SPECULATIVE/unresolved** — it needs a direct spike (call
  `PixelCopy.request()` on the `WebView`'s `Surface`/`Window` in your actual app and see if it
  returns real pixels or a black/empty buffer) before it can be counted as a real lever. If it
  does work, cost is still unknown — no published fps/ms figures for `PixelCopy` at 30-60Hz were
  found; it is documented as synchronous-with-optional-callback, which suggests a per-call
  overhead that would need to be measured directly, not assumed free.
- **SharedArrayBuffer**: correctly ruled out by your own framing — it is a same-process,
  same-origin JS heap-sharing primitive; it cannot cross the WebView-process/Kotlin-process
  boundary and does nothing for JS-to-native transfer. No new information found; this is a dead
  end, confirmed by first principles rather than a specific citation.

**Track 5 takeaway:** No zero-copy path from a Chromium WebView's rendered `<video>` to native
Kotlin code was found to be documented and confirmed working. `PixelCopy` targeting the WebView's
surface is the only plausible avenue surfaced, and it is unverified for WebView specifically —
this needs a cheap same-day spike (not more research) to resolve, since no source will settle it.
AHardwareBuffer and SharedArrayBuffer are both dead ends for this exact pipeline shape.

---

## Ranked table

| # | Idea | Expected gain (estimate + reasoning) | Effort | Licence/risk |
|---|---|---|---|---|
| 1 | **GPU delegate kernel serialization cache** (native TFLite, not the web/tfjs warm-up you already have) | Cold-start only, "up to 90%" of shader-compile time per DOCUMENTED source — does not touch steady-state 355ms/800ms verdict numbers. Est. saves ~1-2s on app cold start per device, zero steady-state change. | Low (few lines of Kotlin/C++ config, TFLite API already documents it) | None — first-party Google API |
| 2 | **Verify SM4450 NPU delegate support directly on owner's phone** (flash a minimal QNN-delegate probe APK, read the delegate's own capability/init result) | Unknown until measured — if it works, NPU is documented at "up to 100x CPU / 10x GPU" on flagship chips; even a fraction of that on a budget NPU could eliminate the whole latency problem. If it doesn't initialize, this whole track is closed and you stop chasing it. | Low-Medium (small standalone spike, not a real feature build) | **QNN runtime redistribution licence unconfirmed** — read the Maven artifact's licence file before shipping even if it works technically |
| 3 | **XNNPACK CPU path A/B for BlazeFace specifically** (same-device test: current GPU delegate vs `Interpreter.Options().setUseXNNPACK(true)` CPU-only, multi-threaded) | DOCUMENTED literature says small models like BlazeFace are exactly XNNPACK's strong case and GPU dispatch/readback overhead can make GPU a net loss for tiny models. No hardware-specific number exists — could be a genuine win or a wash. Plausible range: 0-100ms saved per pass if GPU dispatch overhead is currently significant for the smallest of your three models. | Low (config flag change + your own benchmark harness, which you already have from the gauntlet work) | None |
| 4 | **YuNet or RetinaFace-mobile0.25 as a BlazeFace replacement** | RetinaFace: MIT, 1.7M params, 23ms (unverified hardware) — could be slower given more params, but scores materially higher on small/hard faces (80.99% WIDER-hard) which might let you retire some of the small-face fallback logic in your pipeline. YuNet: MIT, no ms figure, natively handles down to ~10x10px faces. Net verdict-pass time change is unknown without a same-device conversion+bench cycle. | Medium (convert to TFLite, wire into engine, re-run your accuracy gauntlet — this is the same class of work as your past faceres/MoveNet model swaps) | Clean (MIT both) |
| 5 | **INT8 quantize BlazeFace/MoveNet for an XNNPACK/CPU path** (only pairs sensibly with idea 3 — INT8 gives little/nothing on your current GPU delegate per DOCUMENTED source) | 60-80% latency reduction is the headline number for CPU/XNNPACK, but real-world range cited as 0.8x-3.0x — could be a wash or a big win. Accuracy risk is real without QAT (your own faceres uint8 attempt already produced measurable parity failures). | Medium-High (requires a calibration/QAT pipeline your repo doesn't currently have, plus the full accuracy-parity gauntlet you already run for model changes) | None (licence), but real engineering/accuracy risk |
| 6 | **`PixelCopy` spike to bypass page-side frame copy for the video region** | Unknown/unverified whether it even works against a WebView's internal video surface — if it does, it could remove whatever cost currently exists in the JS-side RGBA extraction + WebMessagePort transfer (magnitude not established anywhere in your own docs or in sources found this session). | Low to spike, unknown to productionize (depends entirely on spike result) | None, but pure Kotlin/Android API risk (may simply not work on WebView) |
| 7 | **MoveNet ROI-crop-on-track ("run MoveNet only over the region near known people")** | **Likely near-zero gain as commonly imagined** — MoveNet MultiPose has a fixed 256x256 input, so a crop still gets resized to 256x256 before inference; no FLOP reduction unless paired with a variable-input model swap. Reclassify this idea's premise before investing effort. | N/A — mostly a dead end as stated; only useful if paired with idea 4/8 | — |
| 8 | **Native (Kotlin-side) MOSSE/KCF tracker replacing part of your JS-side coast/lerp logic between verdict passes** | Unclear — your existing coast/lerp math is architecturally similar and already extensively tuned (per your own session logs) and costs zero extra inference; a real correlation tracker costs real CPU per frame. Could improve tracking *quality* during long gaps more than it improves *speed*, which is a different axis than what Track B was asked to optimize. | Medium (native OpenCV dependency, new code path, full track-accuracy regression suite) | Apache-2.0 (OpenCV), clean |
| 9 | AGPL models (YOLOv8-pose) | N/A | N/A | **Blocked** without an Enterprise licence purchase — do not pursue for a free/open-source app unless the owner is willing to buy a commercial licence |
| 10 | SCRFD-0.5g pretrained weights | N/A | N/A | **Blocked** — non-commercial-only pretrained weights; would require training your own weights from scratch to use the architecture at all |

## Single highest-priority next step
Item 2 (verify NPU delegate actually initializes on the SM4450) gates everything else in
significance — if it works even partially, it likely dwarfs every other optimization on this
list combined (100x/10x class numbers, even heavily discounted for a budget SoC, are an order of
magnitude beyond anything else here). It is also cheap to test. Recommend doing that spike before
committing engineering time to items 3-8.
