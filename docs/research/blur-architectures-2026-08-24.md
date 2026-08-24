# Novel blur architectures — deep research (2026-08-24, Fable agent)

Owner ask: "unique methodologies beyond what HaramBlur does — most accurate,
most instantaneous possible." Full agent report, verbatim below. Milestone
order at the bottom is the settled plan.

## Ground truth established (load-bearing facts, with sources)

1. **`tf.browser.fromPixels(videoElement)` on the webgl backend uploads via `texImage2D`/`texSubImage2D` — no `getImageData` readback.** The readback only exists if you draw to a 2D canvas and read pixels first. fromPixels accepts HTMLVideoElement and ImageBitmap directly; on webgpu it uses `copyExternalImageToTexture`. ([tfjs browser.ts](https://github.com/tensorflow/tfjs/blob/master/tfjs-core/src/ops/browser.ts), [webrtcHacks frame-processing survey](https://webrtchacks.com/video-frame-processing-on-the-web-webassembly-webgpu-webgl-webcodecs-webnn-and-webtransport/))
2. **`new VideoFrame(videoElement)` (WebCodecs) captures the current frame GPU-side**; VideoFrame works as a source for `importExternalTexture` and `copyExternalImageToTexture`. WebCodecs is in Chromium ≥94, present in Android WebView and WebView2 ([caniwebview WebCodecs](https://caniwebview.com/features/web-feature-webcodecs/)).
3. **`requestVideoFrameCallback` gives per-frame `mediaTime` + `presentationTime`** — exact frame identity for a delay-line ([spec](https://wicg.github.io/video-rvfc/)).
4. **WebGPU**: WebView2/desktop = Chromium 113+, shipped. Chrome on Android = 121+, **Android 12+ and Qualcomm/ARM GPUs only** (Helio G88 = Mali-G52 → ARM, qualifies if the phone is on Android 12+). **Android WebView support officially "unknown"** — feature-detect, never require. ([chromestatus](https://cr-status.appspot.com/feature/5119617865613312), [caniwebview](https://caniwebview.com/features/web-feature-webgpu/))
5. **WebNN = origin trial as of Chrome 146 (Feb 2026)** — OT-gated = not shippable offline. Revisit 2027. ([Phoronix](https://www.phoronix.com/news/Chrome-146-Beta))
6. **wasm threads need COOP/COEP cross-origin isolation** — cannot set headers on youtube.com. Single-threaded wasm+SIMD XNNPACK still often beats webgl for <5M-param models on low-end phones. ([web.dev COOP/COEP](https://web.dev/articles/coop-coep))
7. **Licenses verified**: ByteTrack MIT, OC-SORT MIT, RT-DETR Apache-2.0, PP-PicoDet Apache-2.0, YOLOX Apache-2.0, MediaPipe models Apache-2.0. Ultralytics YOLO (code AND weights) AGPL — off-limits. abewley/SORT GPL — clean-room only.
8. **PP-PicoDet-S: 0.99M params, 30.6 mAP COCO, 150 FPS mobile ARM CPU @320px** — far better small-object recall per FLOP than MoveNet-as-detector ([paper](https://arxiv.org/pdf/2111.00902)).
9. **LiteRT.js (Google, 2025-26)** runs .tflite in-browser with XNNPACK-wasm, WebGPU, WebNN backends — successor to stale tfjs-tflite.
10. **YouTube standard uploads are clear (unencrypted) MSE** — Widevine only on movies/rentals/premieres. MSE video does not taint canvas; `drawImage(video)` and `new VideoFrame(video)` work on normal content. EME content detectable via `encrypted` event → fall back.
11. **Critical negative: delaying `SourceBuffer.appendBuffer` does NOT delay what the user sees** — appends fill a buffer ahead of the playhead; throttling causes stalls, never a display offset. Look-ahead can only be built at the *presentation* layer.

## Ranked shortlist

### #1 — Zero-readback GPU sampling + event-driven scheduling ("make the current pipeline free")
(a) `tf.browser.fromPixels(video)` direct (or `createImageBitmap(video, {resize})`) — kills the 2D-canvas `getImageData` sync readback (~10-30ms → ~1ms texture import). (b) Sampling driven by `requestVideoFrameCallback` — fires only on real new frames, exact mediaTime, zero cost paused/static. (c) Scene-cut gate: 16×16 luma thumbnail per frame; histogram delta > threshold ⇒ immediate out-of-band detection pass; static scenes drop to 1-2Hz. Spend inference where pixels changed.
**Payoff**: 2-5x lower main-thread cost on Helio, cut-to-detection ~250ms → ~1 frame + inference. **Effort S (days). The "next week" win.**

### #2 — Delay-line presentation layer (the moonshot)
Leave YouTube's `<video>` playing but visually hidden under our layer; capture `new VideoFrame(video)` per rVFC into a ring keyed by mediaTime; our display canvas presents the frame from ~300-400ms ago; audio through `createMediaElementSource` → `DelayNode(0.35)`. Detection consumes the newest frame; when a frame surfaces its blur mask is already final. **Detection latency becomes invisible; zero-flash becomes a hard guarantee.**
Memory: 720p ≈ 15MB GPU ring; 1080p ≈ 33MB — viable, `close()` aggressively. DRM: `encrypted` event ⇒ fall back to today's path. Still block-only (re-presenting the page's own stream, delay is a cost not a perk).
**Kill-risks in order**: (1) YouTube player UI integration (controls/scrubber/fullscreen/SPA-nav/quality-switch — flush ring on discontinuity, blur-first during refill); (2) Helio sustaining capture+present at 30fps on Mali-G52; (3) YouTube may already attach WebAudio to the element (one MediaElementSource per element) — live probe needed; (4) battery. Can ship desktop-only if mobile fails.

### #3 — Per-frame track propagation: sparse LK optical flow + ByteTrack-style association (MIT)
Between detector samples, propagate boxes with sparse Lucas-Kanade flow on corner points (grayscale 160px pyramid, ~1-3ms/frame, JS/wasm; oflow is MIT). ByteTrack two-stage low/high-score association (MIT reference, safe to read). Kills "patch lags the face" with MEASURED motion instead of interpolation guesswork; lets detector Hz drop on weak phones invisibly. **Effort M.**

### #4 — Pixel-accurate silhouettes: MediaPipe Multiclass Selfie Segmentation (Apache-2.0)
Hair/face-skin/body-skin/clothes/background @256px, ~2-3MB tflite. Run only on already-flagged persons → alpha-mask blur instead of rectangles. Rendering upgrade, never in the critical path (rectangle first, silhouette refines frames later). **"HaramBlur can't do that." Effort M.**

### #5 — Better detector under LiteRT.js: PicoDet-S / YOLOX-Nano person-class @320
int8 tflite, XNNPACK wasm+SIMD on the Helio (CPU inference frees the Mali GPU for the page), WebGPU where present. Attacks small/distant misses; ~1-2MB model shrinks the 22.7MB bundle. Conversion pipeline (Paddle→ONNX→tflite) is real work; MoveNet keypoints (hands/backside coverage) must stay or be replaced by box-derived heuristics. **Effort M-L. Only if #1+#3 leave the phone short.**

Below the line: native `ort` sidecar (DirectML/NNAPI, MIT) — real but the frame capture stays in-page (readback returns), platform code ×2, NNAPI quality varies per SoC. Escape hatch only.

## Spike plans

**Spike A (#1)**: rVFC-driven sampler + fromPixels(video) direct + luma-delta gate + scene-cut instant pass. Measure: main-thread ms/sample old vs new; cut-to-overlay latency (known-cut test video); static-scene CPU. Pass: ≥50% cost cut, cut-to-overlay ≤120ms desktop, static ≈0. Fail path: fromPixels(video) forces hidden readback → createImageBitmap variant.

**Spike B (#2, desktop WebView2 first)**: ~200-line probe — VideoFrame ring off rVFC, display canvas over player, DelayNode audio, seek/quality flush, encrypted fallback stub. Measure: A/V sync (±80ms bar), <5% dropped frames @1080p30 with gaze bundle running, controls/fullscreen/SPA-nav checklist, does createMediaElementSource conflict with YouTube's own audio graph, GPU memory. Fail on audio alone → try captureStream() audio through the delay before killing. Phone repeat decides mobile shipping.

## Dead-ends — never re-litigate

- MSE appendBuffer shimming as delay-line (delays buffering, not display; timestampOffset desyncs A/V permanently).
- Fetching future segments ourselves (bandwidth ×2, signed throttled URLs; Spike B achieves it free).
- Workers on YouTube (Trusted Types blocks Worker creation AND createPolicy — verified in-app).
- wasm THREADS on platform pages (COOP/COEP unavailable; flag routes are debug-only on Android WebView).
- Ultralytics YOLO any version (AGPL code + AGPL-encumbered weights). HaramBlur code, abewley/SORT (GPL) — clean-room only.
- WebNN today (origin-trial, origin-bound tokens, expires — incompatible with offline embedding).
- MediaProjection/VirtualDisplay self-capture (permission dialog = parental-control smell; post-composite = blur races its own output).
- Requiring WebGPU (Android WebView unshipped/unknown; fast path only, feature-detected).
- Same-frame repeat inference (deterministic; multi-scale is the correct form, shipped).

## Milestone order (settled)

Spike A → ship #1 → Spike B (desktop) → #3 flow tracking in parallel → #4 silhouettes → ship #2 → #5 only if the Helio still can't hold frame budget.
