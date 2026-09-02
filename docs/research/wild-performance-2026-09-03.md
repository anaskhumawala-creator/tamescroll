# Wild performance ideas, ranked — 2026-09-03

Owner ask: *"stop working and do a research run on the wildest ideas ...
best optimization, best performance"*, after: *"analyze every decision
with the actual percentage of improvement we are gaining."*

Every row below carries a number and a tag. **M** = measured in this repo
on a device; **S** = a published source says so (link given); **G** = my
estimate, with the reasoning. A row with only a G is a hypothesis, not a
result. Nothing here was run on the phone tonight — he asked for no runs.

The four raw research tracks (decode path, inference, compositor/system,
algorithms) are in `wild-2026-09-03/` beside this file; every URL cited
below comes from one of them.

## 0. Where the 13 points go (the thing every idea is priced against)

Redmi 9 (Helio G85, Mali-G52, 60Hz), 426p, 120s, `probe_drops_ab.py`
(`spikes/gauntlet/drops-v1097-*.json`), all **M**:

| arm | dropped |
|---|---|
| blur off | 0.0% |
| smart, control | 13.24% |
| smart, `DELAY_MS 0` (no ring copy) | 9.28% |
| smart, `VERDICT_DUTY 4` (half the inference) | 11.47% |
| smart, solid patch (no backdrop-filter) | 12.40% |

So: the ring copy ~4 points, inference ~3.5 (two duty halvings would
not reach zero — the presenter's own capture still runs), the blur
filter under 1, and the remaining ~5 points are the rAF/div/canvas
render loop plus whatever the page itself does with a hidden `<video>`
and a live canvas. **The last number is the one nobody has decomposed**,
and three of the ideas below attack it blind.

Two structural facts from the research that reframe the whole list:

- **Inline WebView video was never on a hardware overlay plane.** A
  Chromium WebView engineer states inline video is composited through
  `SurfaceTexture`/GPU textures because WebView must composite
  synchronously with the page DOM; only real HTML5 fullscreen gets a
  `SurfaceView` ([android-webview-dev thread](https://groups.google.com/a/chromium.org/g/android-webview-dev/c/hS_dNQXQLcY)).
  So covering the video with our canvas is not "falling off" a fast
  path in the windowed player. It may be in FULLSCREEN — untested.
- **YouTube serves AV1 to Android 12+ devices without an AV1 hardware
  decoder and lets dav1d decode it in software** (Play System Update,
  March 2024, [androidpolice](https://www.androidpolice.com/youtube-google-av1-codec-android-video/)).
  Neither the Helio G85 nor the Snapdragon 4 Gen 2 has AV1 hardware
  decode (S: [nanoreview G85](https://nanoreview.net/en/soc/mediatek-helio-g85),
  [notebookcheck Adreno 613](https://www.notebookcheck.net/Qualcomm-Adreno-613-Benchmarks-and-Specs.855460.0.html)).
  If either phone is being served AV1, the decoder is eating the same
  CPU cores our page runs on, and the "blur off = 0% drops" baseline
  only says the decoder keeps up when nothing else runs.

## 1. The ranked list

Gain is in **points of dropped frames** on the Redmi unless it says
otherwise; his 90Hz phone is noted where it differs. "Rules" = the
hard rules (block-only, never impersonate, nothing leaves the phone, no
GPL/AGPL, solid patches).

| # | idea | gain | how sure | effort | rules |
|---|---|---|---|---|---|
| 1 | **Read the codec YouTube actually serves us** (hook `MediaSource.addSourceBuffer(mime)` in the page, or read the DASH manifest in the request interceptor we already own). Diagnostic. | gates #2 | — | hours | none |
| 2 | **Refuse AV1** so the player takes hardware VP9/H.264. Two levers: YouTube's own `localStorage['yt-player-av1-pref']` (first-party, but the documented value only suppresses AV1 *above* 480p, so likely a no-op at 426p), or the h264ify pattern: `MediaSource.isTypeSupported` / `canPlayType` answer false for `av01` (MIT source read, ~15 lines, [enhanced-h264ify](https://github.com/alextrv/enhanced-h264ify)). | **0 if we already get VP9; 5-10 if we get AV1** (G: a software AV1 decode at 426p30 is a full core on an A55-class cluster; the ring copy and inference then queue behind it) | S+G | day | low: same class as the request shaper; it is a capability answer, not a modification of content |
| 3 | **Cap the display to 60Hz on the 90Hz phone** (`Surface.setFrameRate` / `AttachedSurfaceControl`, API 31+, or `preferredDisplayModeId`). The video is 30fps and the patch loop ~50Hz; at 90Hz the compositor attempts vsync 50% more often for nothing. | **his phone 3-8, Redmi 0** (G: compositor attempts scale with vsync; content does not) | G | hours | none |
| 4 | **Keep the ring on the GPU**: WebGL `texImage2D(gl.TEXTURE_2D, video)` is the documented GPU-to-GPU path from a `<video>` ([chromium-dev](https://groups.google.com/a/chromium.org/g/chromium-dev/c/OSxkwV-h-_M)); a ring of 45 textures at 426p is ~18MB of VRAM; present by drawing the texture into a WebGL canvas. Replaces `createImageBitmap`, whose allocation-per-frame is what we pay today. **Not** the rejected `VideoFrame` ring — no decoder buffer is held, the copy happens at capture. | **2-4 of the 4-point ring cost** (G: the copy stays, the per-frame ImageBitmap allocation and 2D-canvas upload go) | G | days; needs one device run to prove `texImage2D(video)` is not a readback on Mali | none |
| 5 | **Draw the blur INTO the presented frame** instead of divs over it: the presenter already owns the pixels; a clipped `ctx.filter='blur()'` (or the downscale-upscale of #6) in the same draw. Removes every overlay div, the rAF transform writes, and backdrop-filter's forced re-read of the compositor stack ([Chromium/Mozilla blur bugs](https://bugzilla.mozilla.org/show_bug.cgi?id=1498291)). Patches stay solid rectangles. | **1-3** (G: the solid-patch arm proved the filter math is <1 point, so this buys the div/layer/rAF churn, which is inside the unattributed 5) | M+G | days | none; look unchanged |
| 6 | **Pixelate instead of blur**: downscale the patch region to 1/16 area and draw it back with `imageSmoothingEnabled=false`. Two `drawImage`s, no blur kernel. | **<1 on top of #5** (M: the filter itself is <1 point) — this is a LOOK change, not a speed lever | M | hours | none, but his call on the look |
| 7 | **Render the patch loop every 2nd frame** (`RENDER_EVERY`, OTA dial; half-built in the parked batch). | **1-2** (G: half the transform writes; patch trails the picture by one presented frame, inside the pad) | G | hours | none |
| 8 | **Present from a Worker** (`transferControlToOffscreen`, presenter in a worker). Frees the main thread of the per-frame draw; WebView has documented gaps ([Chromium WebView issue](https://issues.chromium.org/issues/40595450)). | **1-4** (G: only if the 5 unattributed points are main-thread contention rather than GPU) | G | days + a spike | none |
| 9 | **BlazeFace on the CPU** (XNNPACK, 4 threads) while the GPU keeps faceres/MoveNet. Literature: tiny models are XNNPACK's strong case and GPU dispatch can be a net loss ([arXiv 2202.06512](https://arxiv.org/abs/2202.06512)). `NATIVE_CPU_MASK` dial, half-built. | **0-1**, and up to ~30ms off each verdict (G) | S+G | hours | none |
| 10 | **NPU on his phone** via Google's LiteRT Qualcomm delegate (`com.qualcomm.qti:qnn-litert-delegate:2.34.0`). Google's list names 8-series only ([LiteRT NPU page](https://developers.google.com/edge/litert/android/npu/qualcomm)); SM4450 is absent, not refused. Redmi (MediaTek APU) has no shipping delegate. | **unknown; on flagships 10x GPU (S). Gated on one spike: does the delegate initialise on SM4450 at all.** Would cut the 3.5 inference points to ~0.5 on his phone and nothing on the Redmi | S | day for the spike; licence of the Maven runtime must be read before shipping | licence flag; nothing leaves the phone |
| 11 | **Play at 0.95x under load** for a few seconds when drops climb (`preservesPitch` defaults true, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)). | **caps at ~5 points of headroom**; a UX change | S+G | hours | a player mutation; his call |
| 12 | **Thermal duty**: `PowerManager.getThermalHeadroom` (API 30) doubles the verdict interval while the SoC is near throttling; restores when cool. | **0-5, long sessions only** (G: throttling drops frames hard, not gradually) | G | hours (half-built) | none |
| 13 | **ADPF `PerformanceHintManager` session** around the inference thread (API 31, both phones). Chromium does not appear to use it for WebView. | **0-3** (G: variance, not the mean) | G | hours | none |
| 14 | **Sustained performance mode** (`Window.setSustainedPerformanceMode`). OEM-optional; budget MediaTek/Qualcomm are the least likely to implement it. | **0-2, may be negative** (G) | G | minutes (half-built) | none |
| 15 | **Inference thread below the compositor** (`Process.setThreadPriority` on `ts-infer`). | **0-2** (G) | G | minutes | none |
| 16 | **Block-matching motion on the 16x16 luma grid** we already compute at 10Hz, to move coasting patches by measured displacement instead of a decayed velocity. Sub-millisecond. | **0 drops; accuracy: fewer phantom/false-cover between verdicts** (G) — and it is the prerequisite for #17 | G | days | none |
| 17 | **Motion masking**: during high-motion, non-cut frames (large luma delta under `CUT_DELTA`) the viewer cannot resolve edges ([Springer, motion masking effect](https://link.springer.com/chapter/10.1007/11581772_12)); skip the verdict and widen the patch instead. | **1-2** (G: a quarter of verdicts on handheld footage land in that regime; the gate already measures it) | S+G | days | exposure-class dial, his call |
| 18 | **Verdict-per-shot** on long shots: talking-head content has 4-8s shots (S: Cutting/Cornell shot-length corpus); one verdict after the cut plus one every N seconds instead of one every 0.8s. | **content-dependent, up to 2 on vlogs, 0 on fast cuts** | S+G | days | exposure-class dial |
| 19 | **Storyboard pre-scan**: YouTube's scrub-preview sprites (`storyboards` in the player response, 48-320px tiles every 5-10s) through the image pipeline once at load, as a prior for who is in the video. Same public image URL the player fetches for hover preview. No prior art found. | **0 drops; latency: first verdict pre-seeded; accuracy: a warm prior for `identityMemory`** | G | days | low (an image the page already loads) |
| 20 | **Second 144p stream for inference only** (the presented stream untouched). | **2-3** (G) | G | days | **HIGH**: YouTube ToS ("no automated means", undocumented API) and our own block-only rule; his call, not mine |
| 21 | **Single-shot `VideoFrame.copyTo()` per tick** (allocate, copy, close — never hold a ring of live frames). Structurally different from the rejected live ring. | **unknown** | G | a bounded spike | none |
| 22 | **Measure fullscreen separately**: the one player state where a real `SurfaceView` overlay exists and our canvas might genuinely knock the video off it. | diagnostic | — | hours | none |

## 2. Dead, with the reason, so nobody re-derives them

- **Codec motion vectors.** No API exposes them on Android, WebCodecs or
  Chromium (the `MediaCodec.getMotionVectorList` hit is a search-engine
  hallucination — absent from AOSP). Only ffmpeg `export_mvs` or a patched
  dav1d do, which means a second full software decode. Dead.
- **A ring of live `VideoFrame`s.** Measured 2026-09-02: holds MediaCodec
  output buffers, stalls the decoder (`delay-presenter.mjs` header).
- **Chromium command-line flags** (`/data/local/tmp/webview-command-line`).
  userdebug/eng devices only ([Chromium docs](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/android_webview/docs/commandline-flags.md)).
  `WebViewSurfaceControl` is already hardcoded on in `AwMainDelegate`.
- **NNAPI** (deprecated at API 35, Google steers to the GPU delegate),
  **WebNN** (Android removed from the trial), **AHardwareBuffer** (not
  reachable from a page's `<video>`), **SharedArrayBuffer** (same
  process only).
- **MoveNet ROI crops.** Fixed 256x256 input: a crop is resized back up;
  no FLOPs saved unless the model changes.
- **Cloud.** Nothing leaves the phone (VISION.md), and storage math
  killed it anyway.
- **Native blur overlay window** (`FLAG_BLUR_BEHIND`): a second window
  with `SYSTEM_ALERT_WINDOW`, OEM "may not be supported", a bridge
  round-trip per frame, and it targets the filter math the solid-patch
  arm already cleared. Negative expected value.
- **YOLOv8-pose** (AGPL), **SCRFD** weights (non-commercial). Blocked.

## 3. If all of it landed (the honest sum)

Do not add the column. The gains overlap: #4, #5, #7 and #8 all eat from
the same ~9 points (ring + render), and #2 is either 0 or the biggest
row on the page. Realistic ceilings, G:

| phone | today | after #2-#9 | after #10 as well |
|---|---|---|---|
| Redmi 9 (60Hz, no NPU delegate) | 13% | **4-6%** | 4-6% |
| his Redmi 13 (90Hz, SM4450) | unmeasured | **3-5%** | **1-2%** |

Zero is not on the table with a blur on: the presenter's capture is a
copy and the page keeps a hidden `<video>` decoding beside a live canvas.

## 4. The order to build, for one 1098

1. **#1 codec read** — one probe, decides whether #2 is worth a line.
2. **#2 refuse AV1** if it is in play — one scriptlet, OTA-switchable.
3. **#3 60Hz cap** — a Kotlin bridge call behind an OTA dial (the
   `REFRESH_CAP_HZ` half of the parked batch).
4. **#5 blur into the presented frame** — the largest render-side
   change, and it retires the overlay divs the timeline path renders
   into today. Deserves its own round and critic.
5. **#4 GPU ring** — after #5, because #5 decides what the presenter
   draws with.
6. **#7, #9, #12-15** — the dials already half-built; ship inert.
7. **#10 NPU spike** on his phone, one afternoon: does the delegate
   initialise on SM4450. If yes, it is the biggest number on his device
   and nothing else on the list competes.
8. **#16 then #17** — accuracy first, then the verdict skip it licenses.
9. **#19 storyboard prior** — new capability, its own spec.

Everything from #1 to #9 is invisible when switched off, so the whole
set can ride one build with every dial at today's value, and he flips
them from `rules/tuning.json`.

## 5. What this run did not do

No device run (his instruction). No number above is new evidence; the
M rows are the last two days' probes and the S rows are other people's
hardware. The first thing the next session should measure is #1, because
it is the one row that can move every other estimate by an order of
magnitude.
