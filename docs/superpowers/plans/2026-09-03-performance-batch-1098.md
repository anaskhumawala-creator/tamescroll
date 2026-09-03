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

## Loop state 2026-09-03 03:10 — T5 in flight

- First 1098 build (601a93f): control 26.5% drops, native dead — the NNAPI
  arbiter ran inside loadAll (19s) against the client's 15s ready timeout.
  Moved after ready onto `ts-npu-trial`; control 13.71% (1097: 13.2%).
- Six arms on that build (`drops-v1098b-*`): control 13.71 / noav1 14.75 /
  render2 14.51 / blurframe **10.96** / cpumask1 12.24 / glpres **11.75**.
  NO_AV1 inert (codec still av01); cpumask1's mask leaked into the glpres
  page (native read cpu).
- `probe_av1_caps.py`: YouTube asks `mediaCapabilities.decodingInfo` at
  ~380ms and `isTypeSupported` at ~530ms; the bundle boots at ~1100ms. The
  wrappers moved to `lib.rs no_av1_script` (document start) and cover
  decodingInfo; decided at call time from `__TS_NO_AV1` / the tuning payload.
- Phase-n critic: 13 rows, all landed (ledger N1-N13), critic-gate clear.
  NATIVE_NPU ships 0 (N1); TsPerf token (N8); CONFIG on every ready.
- Next: rebuild (85d1152 + bundle commit), re-smoke control / cpumask1 /
  control-after / noav1 / glpres / blurframe, release 1098 + manifest.

## T5 DONE 2026-09-03 03:40 -- 1098 PUBLISHED (sha e69297ff)

- Build at 85d1152 (bundle commit 2eaa243): marker == HEAD, every batch
  constant present in the emitted `gaze-page.js`, APK versionCode 1098.
- Redmi smoke (`drops-v1098c-*`, `diag-v1098c-*`): control 12.05 /
  cpumask1 11.65 / control-after 12.26 / noav1 15.51 / glpres 12.57 /
  blurframe 12.34. Native alive in all six; leak closed; NO_AV1 proven by
  the player's own itag (395 av01 -> 242 vp9, `probe_served_codec.py`)
  and it costs drops on the Redmi. No arm separates from control.
- Release: `app-v0.1.98`, isDraft false, served APK re-downloaded and
  hashed against the raw manifest. Tree in sync with origin.
- Next: OTA pushes one at a time against a drops read on HIS phone.

## 1098d smoke 2026-09-03 04:30 -- the six dials 1098c did not exercise

control 13.56 / SUSTAINED_PERF 12.07 / REFRESH_CAP_HZ 60 12.29 (60Hz panel,
no-op) / THERMAL_DUTY 11.46 (not hot, inert) / PERF_HINT 11.59 /
INFER_PRIO 2 12.25 (`ts-infer` nice 10 vs 0 on the control, read from
/proc during the arm) / PLAYBACK_SLOW **10.17** (slowed 3, restored 2,
114.4s media in 120s wall -- works, visibly slows the video, stays 0).
Native alive in every arm. The per-document perf token was claimed by
the stash and consumed by perf.mjs (claim() returns "", the door null).
Bank: `drops-v1098d-*.json`, `diag-v1098d-*.json`, plants `plant-{sustained,
refreshcap,thermal,hint,inferprio,slow}.js`.
