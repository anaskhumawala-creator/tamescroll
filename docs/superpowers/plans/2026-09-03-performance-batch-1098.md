# Performance batch 1098 — implementation plan

**Goal:** land every dial-able idea from
`docs/research/wild-performance-2026-09-03.md` in ONE release (1098),
each behind an OTA dial that ships at today's behaviour, so nothing changes
on a phone until a number is pushed.

**Spec:** the research doc (§1 table, §4 order). Revert point: tag
`checkpoint-1097` (06d9ea2).

**Rules that bound every task:** BLOCK-ONLY; NO NAGS; patches SOLID; no
exposure dial moves without the owner; nothing leaves the phone; every
dial in `tuning.mjs` SPEC + `rules/tuning.json` + the SHIPPED map in
`test/tuning.test.mjs`; run `scripts/gen-rules-manifest.mjs` after editing
`rules/`; constants verified in the EMITTED bundle before release.

## Held back (say so in the landing summary)
- #20 second 144p stream — YouTube ToS / block-only.
- #19 storyboard pre-scan — new capability, own spec.
- #16/#17/#18 motion, motion-masking skip, verdict-per-shot — exposure
  dials that need corpus pricing before they exist even inert.

## Tasks

### T1 — JS dials (RENDER_EVERY, NATIVE_CPU_MASK, perf bridge, NO_AV1, codec read, PLAYBACK_SLOW)
Files: `video-region.mjs`, `native-client.mjs`, `perf.mjs`, new
`codec-probe.mjs`, `tuning.mjs`, `rules/tuning.json`, tests, `diag-report.mjs`.
- RENDER_EVERY [1,4] ships 1 (video-region.setRenderEvery; rafSkipped counter).
- NATIVE_CPU_MASK [0,7] ships 0 (native-client CONFIG request modelId 0,
  header `[reqId, 0, mask, flags]`).
- NATIVE_NPU [0,1] ships 1 = auto-try (flags bit 0 in the same CONFIG).
- SUSTAINED_PERF [0,1] 0, REFRESH_CAP_HZ [0,120] 0, THERMAL_DUTY [0,1] 0,
  PERF_HINT [0,1] 0 (ADPF session), INFER_PRIO [0,2] 0 (0 default,
  1 = below compositor, 2 = background) — all through `window.TsPerf`.
- NO_AV1 [0,1] 0: `MediaSource.isTypeSupported` / `canPlayType` answer no
  for `av01`. Takes effect on the next player init.
- Codec read: wrap `addSourceBuffer` / `changeType`, keep the last video
  mime's codec family; report `player.codec` enum
  `['av01','vp09','avc1','other','none']` + `codecChanges`.
- PLAYBACK_SLOW [0,1] 0: poll `getVideoPlaybackQuality` every 5s; when the
  dropped share over the window exceeds 8% and the user's rate is 1, set
  0.95; restore at <3%. Never touches a user-chosen rate.

### T2 — Kotlin: TsPerf bridge, NativeInfer CONFIG, NPU auto-try
Files: `MainActivity.kt` (PerfBridge, `addJavascriptInterface(..., "TsPerf")`),
`NativeInfer.kt`, `build.gradle.kts`, NOTICE.
- `TsPerf.sustained(bool)` → `window.setSustainedPerformanceMode` (API 24+).
- `TsPerf.refreshCap(hz)` → pick the display mode with the same
  resolution and the highest refresh ≤ hz; `attributes.preferredDisplayModeId`
  (API 23+), plus `Surface.setFrameRate` on API 30+ where available. 0 = clear.
- `TsPerf.thermalHeadroom()` → `PowerManager.getThermalHeadroom(10)` API 30+,
  NaN otherwise.
- `TsPerf.hint(bool)` → `PerformanceHintManager` session on the `ts-infer`
  tid (API 31+), `reportActualWorkDuration` per inference.
- `TsPerf.inferPriority(int)` → `Process.setThreadPriority(tid, ...)`.
- NativeInfer: modelId 0 = CONFIG (`w` = cpu mask, `h` = flags). Rebuild
  the named interpreters on XNNPACK; reply empty outputs status 0.
- NPU: add `com.qualcomm.qti:qnn-litert-delegate` + `qnn-runtime`; at load,
  if flags allow, try the QNN delegate first per model; fall through to GPU
  then CPU. `postReady` carries `backends: {1:'npu'|'gpu'|'cpu', ...}`.
  READ THE ARTIFACT LICENCE FIRST; if redistribution is not permitted, do not
  add the dependency and write why in NOTICE.
- Must be safe on the MediaTek Redmi: delegate init fails → GPU as today.

### T3 — Blur drawn into the presented frame (BLUR_IN_FRAME [0,1] ships 0)
Files: `delay-presenter.mjs` (`paintPatches(list)`, `canPaint()`),
`video-region.mjs` (`setPainter(video, fn)`; when a painter is set and the
dial is 1, overlays are hidden and each frame's final drawn rect, converted
to video-normalized units plus blur radius in canvas px, goes to the
painter), `init-entry.js` wiring, tests.
- presentTick draws frame THEN patches, always, so a fresh frame is never
  shown without the last patches.
- Patch = roundRect clip (LOOK.radiusPx scaled), `ctx.filter = blur(B)`,
  drawImage of the frame region padded by 2B so edges stay solid.
- No painter or no `filter` support → overlays as today.

### T4 — WebGL presenter (PRESENTER_GL [0,1] ships 0) — after T3
New `gl-presenter.mjs` with the same interface as the 2D presenter:
texture ring via `texImage2D(video)`, textured-quad present, separable
blur shader for the patch list from T3. Context loss → detach and let the
2D presenter re-attach. Measured on the Redmi before it may ship 1.

### T5 — Build, smoke, critic, release
`node app/gaze/build/build.js`; cargo tests; gaze tests; Android build via
the recipe; Redmi smoke (`probe_drops_ab.py` control + one arm per new dial
that the Redmi can exercise: RENDER_EVERY 2, BLUR_IN_FRAME 1, NATIVE_CPU_MASK 1,
NO_AV1 1, PRESENTER_GL 1); Opus critic on the diff; release 1098; manifest.
