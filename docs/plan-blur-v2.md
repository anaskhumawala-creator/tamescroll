# Blur v2 implementation plan (owner-approved 2026-08-24)

Source: docs/research/blur-architectures-2026-08-24.md (settled; dead-ends
listed there are final).

## Risks & mitigations (owner ask 2026-08-24, pre-build)

**Stage 1 — zero-readback**
- R: fromPixels(video) in WebView still does a hidden readback (webgl
  texture path varies per driver) ⇒ no win or a regression on the Helio.
  M: measure old-vs-new per-sample ms on desktop CDP BEFORE shipping;
  createImageBitmap fallback is pre-planned; ship only if ≥50% cut.
- R: createImageBitmap(video, crop) unsupported/slow in some WebViews.
  M: feature-detect at boot; keep the canvas path as runtime fallback,
  not a code delete — old path stays behind one flag until phone-proven.
- R: luma gate mistakes slow pans for "static" ⇒ blur lags a drifting
  person. M: gate only relaxes CADENCE (1Hz floor), never disables the
  tracker/coast; any track in 'blurred' state keeps full cadence.
- R: scene-cut instant pass fires on flashing edits (music videos) ⇒
  CPU spike. M: min 250ms between forced passes.
- R: accuracy regression from resize-in-graph vs canvas resize (different
  filtering). M: verify on the Linus video frames (same CDP evidence
  protocol) before release — recall must match v1011.

**Stage 2 — delay-line (spike only, nothing ships from it yet)**
- R: breaks YouTube player UI (controls/scrubber/fullscreen/SPA nav).
  M: spike is evidence-only via CDP eval; checklist gates any wiring.
- R: createMediaElementSource conflicts with YouTube's audio graph
  (one source per element, permanent) ⇒ muted video. M: probe on a
  THROWAWAY session first; captureStream() audio is the fallback; abort
  = tear down and the live path is untouched.
- R: DRM (`encrypted` event) ⇒ black canvas. M: fallback stub in the
  probe from day one.
- R: A 350ms delay reads as "laggy app". M: delay only ships if A/V
  stays ±80ms and it's framed as zero-flash mode; desktop-only is an
  acceptable end state.
- R: GPU memory (33MB ring @1080p) on 3-4GB phones. M: phone repeat
  measures; ring shrinks to ~250ms/720p on mobile.

**Cross-cutting**
- R: shipping a regression to the owner's working v1011 ("I do like it
  right now"). M: every stage is its own release; v1011 APK stays on
  GitHub Releases as instant rollback (manifest re-point).
- R: license contamination while porting flow/ByteTrack ideas.
  M: MIT/Apache references only; abewley/SORT + HaramBlur stay unread.

## Stage 1 — zero-readback + event-driven sampling (ship as v1012)

- Person pass: `tf.browser.fromPixels(video)` DIRECT (in-graph resize) —
  delete the person canvas + its getImageData (the big sync readback).
- Zoom crops: `createImageBitmap(video, sx, sy, sw, sh, {resizeWidth,
  resizeHeight})` — async GPU crop+scale, feeds fromPixels with no
  readback; replaces zoomCanvas + getImageData.
- Scene gate: 16×16 luma thumbnail per sample (tiny readback, ~0.1ms).
  Delta > CUT_THRESHOLD ⇒ sample IMMEDIATELY (bypass interval — cuts are
  where new people appear). Delta ≈ 0 ⇒ relax to 1Hz (static scene costs
  almost nothing). Normal motion ⇒ current adaptive cadence.
- Pass/fail (desktop CDP, then phone): ≥50% main-thread cost cut per
  sample; cut-to-overlay ≤120ms desktop; static-scene sampling ≈ 1Hz.
- Fallback: if fromPixels(video) is slow in WebView (hidden readback),
  use the createImageBitmap variant for the person pass too.

## Stage 2 — delay-line spike (desktop WebView2, evidence only)

Probe (spikes/delay-line/): YouTube's <video> keeps playing at opacity 0;
rVFC captures `new VideoFrame(video)` into a ring keyed by mediaTime;
display canvas inside #movie_player presents the frame from ~350ms ago;
audio via createMediaElementSource → DelayNode(0.35). Flush ring on
seek/quality change (mediaTime discontinuity); `encrypted` event ⇒ tear
down, fall back to live path.

Measure: A/V sync (±80ms bar), dropped frames <5% @1080p30 with gaze
bundle live, controls/scrubber/fullscreen/SPA-nav checklist,
createMediaElementSource vs YouTube's own audio graph, GPU memory.
Audio fail alone ⇒ try captureStream() audio route before killing.
Desktop pass ⇒ wire detection (verdict per mediaTime, mask final before
presentation) and repeat perf on phone; phone fail ⇒ desktop-only mode.

## Stage 3 — flow tracking (next session)

Sparse Lucas-Kanade on track corner points between detector passes
(~1-3ms/frame, MIT-cleanroom or oflow-MIT) + ByteTrack-style two-stage
association. Replaces velocity interpolation with measured motion.

## Stage 4 — silhouette blur (after Stage 3)

MediaPipe multiclass selfie segmentation (Apache, ~2-3MB) on flagged
persons only → alpha-mask blur instead of rectangles. Never in the
critical path: rectangle first, silhouette refines.

## Stage 5 (conditional) — PicoDet-S/YOLOX-Nano under LiteRT.js

Only if the Helio still misses frame budget after 1+3. int8 @320,
XNNPACK wasm-SIMD; keeps MoveNet for keypoint coverage or derives head
region from box.
