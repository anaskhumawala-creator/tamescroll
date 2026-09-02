# Track C — Rendering / compositor / system-level levers for the gaze delay-line

Context: Tauri v2 app hosting Android System WebView (Chromium ~151) on m.youtube.com.
Real `<video>` hidden; a 1.5s-delayed copy is presented via `<canvas>` + `drawImage(ImageBitmap)`
in the player; blur patches are absolutely-positioned divs with `backdrop-filter: blur(24px)`
repositioned by a ~50Hz rAF loop. Measured on Redmi 9 (Helio G85, Mali-G52, 60Hz, Android 12):
~13% dropped video frames with blur on, 0% off. Solid-colour patches instead of
`backdrop-filter` saved <1 point — **the filter itself is not the cost**. Owner's phone: Redmi 13
4G (Snapdragon 4 Gen 2, Adreno 613, 90Hz, Android 16).

Tags: **MEASURED-BY-SOURCE** (the source itself reports a number), **DOCUMENTED** (an API/behavior
Google/Chromium document states as fact), **SPECULATIVE** (my inference from adjacent facts, not
directly stated for this exact configuration).

---

## 1. Android WebView compositing cost of the rAF/div/canvas loop

- **DOCUMENTED.** Android WebView embeds the Chromium compositor directly inside
  `WebView.onDraw()`, so it draws in lockstep with the rest of the Android View tree rather than
  running its own independent vsync-driven pipeline the way tabbed Chrome for Android does.
  Source: "Android WebView embeds the Chromium compositor directly inside the
  `View.onDraw()` method of the WebView" — https://www.chromium.org/developers/androidwebview/
  and the "Synchronous compositing for WebView" design doc:
  https://docs.google.com/a/chromium.org/document/d/1jw9Xyuovw32NR73u6uQEVk7-fxNtpS7QWAoDMJhF5W8/edit
  Practical implication (**SPECULATIVE**, but well-grounded): WebView's synchronous-compositor mode
  means a rAF-driven layer update has to fit inside the same draw dispatch as the rest of the
  Android UI, with less of the triple-buffered/off-main-thread slack that standalone Chrome gets —
  this is a plausible reason a 50Hz JS loop costs more inside a WebView-hosted app than the same
  loop would in the Chrome app.

- **DOCUMENTED.** The "cc" compositor (`docs/how_cc_works.md`,
  https://chromium.googlesource.com/chromium/src/+/HEAD/docs/how_cc_works.md) rasterizes,
  decodes/animates images into GPU textures and forwards them to the display compositor as a
  "compositor frame." Writing `transform` on a div calls `SetNeedsCommit`/`SetNeedsAnimate` on
  `LayerTreeHost` every rAF tick — i.e. every frame of the loop is a full compositor commit, not a
  free GPU-only update, unless the property is already isolated on its own layer with no other
  side effects.

- **DOCUMENTED — GPU memory cost of every layer.** "Every layer created requires memory and
  management that's not free... Every layer's textures need to be uploaded to the GPU... Creating
  too many layers or layers that are too big can exceed GPU memory budgets." —
  https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count . Also:
  "When cumulative allocations exceed per-process thresholds, the compositor triggers tile
  eviction. Evicted tiles are re-rasterized synchronously on a raster worker thread... breaking the
  16.6ms frame budget" — https://www.browser-rendering.com/compositing-and-gpu-acceleration/hardware-acceleration-limits/gpu-memory-limits-in-chrome-compositing/
  On a Mali-G52 device with modest VRAM/bandwidth this is a credible secondary cost source distinct
  from `backdrop-filter` sampling itself, since the owner's own A/B (solid colour vs blur) already
  ruled out the filter math.

- **DOCUMENTED — will-change / layer promotion.** "Modern browsers are pretty good at promoting
  layers automatically for transform and opacity animations... If an animation already looks
  smooth, adding `will-change` gives no additional benefit and costs GPU memory for nothing." —
  https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count . So
  `will-change: transform` on the patch divs is unlikely to be the missing lever if Chromium is
  already auto-promoting them (it almost certainly is, given they animate `transform` every frame);
  it mainly matters for avoiding a first-frame promotion stutter, not steady-state cost.

- **DOCUMENTED — canvas `drawImage(ImageBitmap)` is GPU-to-GPu, no readback.** ImageBitmap "was
  intended to be drawn 'without undue latency', which browsers could interpret as a pre-allocated
  GPU texture," and Chrome shows "0-0.1ms per render" using the
  `transferToImageBitmap`/`transferFromImageBitmap` GPU-texture path versus other engines doing a
  copy — https://bugzilla.mozilla.org/show_bug.cgi?id=1788206 . Readback (`getImageData`) is the
  expensive path, and the app does not appear to use it for the canvas presenter. So the canvas
  draw itself is plausibly cheap; the cost is more likely in what sits **on top of** the canvas
  (the backdrop-filter'd divs forcing the compositor to composite that region every frame) or in
  the div layer churn described above.

- **DOCUMENTED — `OffscreenCanvas` + `transferControlToOffscreen()` on Android WebView.**
  Supported: "OffscreenCanvas and DedicatedWorker.requestAnimationFrame is supported on all six
  Blink platforms including Android and Android WebView" (Intent to Ship) —
  https://groups.google.com/a/chromium.org/g/blink-dev/c/hRZ_P2o-aEk . MDN confirms the transfer
  API generally: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/transferControlToOffscreen
  **Caveat (DOCUMENTED, conflicting signal):** a WebView-hosted Chromium build (Cordova, not raw
  Chrome-for-Android) reported "OffscreenCanvas is not functional in Cordova Android, but
  functional in Chrome Mobile" — https://github.com/apache/cordova-android/issues/714 — and there's
  an open Chromium bug specifically titled "OffscreenCanvas support in WebView" —
  https://issues.chromium.org/issues/40609994 . Net: the *spec* says WebView supports it, but there
  is at least one first-party bug report suggesting embedding-specific gaps existed historically;
  worth a spike-test on the actual Redmi 13 rather than trusting the spec alone.
  What moving to `OffscreenCanvas` in a worker would buy: the `drawImage()` call and any per-frame
  canvas work move off the main thread, so they stop contending with the video decode, the app's own
  JS (person-tracking/inference) and Blink's main-thread style/layout/paint work for the divs — this
  is the standard OffscreenCanvas pitch (web.dev, https://web.dev/articles/offscreen-canvas):
  "operations applied to OffscreenCanvas will be rendered on the source canvas automatically" and
  the work happens "in a separate thread." It does **not** by itself reduce compositor/GPU cost —
  it only frees the main thread, which matters if main-thread contention (not GPU raster) is the
  bottleneck.

- **DOCUMENTED — hardware video overlay/underlay and occlusion.** "On Android, once the decoder has
  chosen to output zero-copy frames, they can only be displayed as hardware underlays, and any path
  that disables hardware overlays results in the video disappearing. Chromium forces this mode for
  fullscreen H.264 for power reasons," and more generally Chromium treats `<video>` as "a fixed-size
  hole with opacity" in the main render pipeline, using `SurfaceView`/`MediaCodec`-backed
  `AHardwareBuffer`s passed to the platform compositor as overlays — VideoNG deep-dive:
  https://developer.chrome.com/docs/chromium/videong . "Enabling overlays on macOS halved power
  consumption during fullscreen video playback" and similar ~50% reductions were seen on Android
  even in non-fullscreen cases (same source). **Relevance here (SPECULATIVE):** this app *hides* the
  real `<video>` and never displays it, so it should not be eligible for the on-screen hardware
  overlay/underlay path regardless of blur; MediaCodec decode itself is unaffected by what's drawn
  on screen. But it strongly explains **why the architecture chose canvas+drawImage in the first
  place** (a visible, occluded `<video>` with anything opaque or blurred on top would be knocked off
  the power-efficient overlay/underlay path and forced into full GPU compositing, which is far more
  expensive than compositing a canvas) — so the current design is directionally correct, not a
  design mistake to reconsider.

---

## 2. Native alternatives to CSS `backdrop-filter` blur

- **DOCUMENTED — `RenderEffect.createBlurEffect` (API 31+) blurs a View's *own* content, not what's
  behind it.** "SetRenderEffect will apply a visual effect to the results of the View before it is
  drawn... if createBlurEffect is provided, the contents will be drawn in a separate layer, then
  this layer will be blurred when this View is drawn." —
  https://blog.stylingandroid.com/rendereffect-blur/ and
  https://medium.com/prog-ramming-solutions/android-12-rendereffect-18b29860ca68 . This is a
  same-view frosted-glass-of-itself effect (e.g. blurring an ImageView's own bitmap). It is **not**
  a backdrop blur of content underneath a transparent View — Android has no first-class "blur
  whatever renders behind this View" primitive at the View level.

- **DOCUMENTED — the two APIs that DO blur "behind":**
  - `Window.setBackgroundBlurRadius(radius)` — blurs the screen **behind the window**, within the
    window's own bounds; requires the window to be translucent and floating. "This method blurs the
    screen behind the window within the bounds of the window... For the blur region to be visible,
    the window has to be translucent and floating." —
    https://learn.microsoft.com/en-us/dotnet/api/android.views.window.setbackgroundblurradius
  - `WindowManager.LayoutParams.FLAG_BLUR_BEHIND` + `setBlurBehindRadius()` — blurs the whole
    screen behind the window (broader than the window's bounds). AOSP:
    https://source.android.com/docs/core/display/window-blurs — "Window.setBackgroundBlurRadius
    blurs only within the bounds of the window, while blur behind blurs the whole screen behind the
    window." Also: **"Cross-window blur might not be supported by some devices due to GPU
    limitations"** — same AOSP page. This is the OEM-fragmentation risk for any native-blur plan on
    a Snapdragon 4 Gen 2 budget phone.
  - **SPECULATIVE synthesis:** to blur only the small rectangular patch region behind a person, the
    only architecture that fits Android's model is a **separate small translucent floating window**
    (added via `WindowManager.addView` with `TYPE_APPLICATION_OVERLAY`, which needs the
    `SYSTEM_ALERT_WINDOW`/"draw over other apps" permission) positioned and sized to the patch rect,
    with `FLAG_BLUR_BEHIND` + `setBlurBehindRadius()` (or `Window.setBackgroundBlurRadius` if the
    window itself is the boundary). This is real native GPU blur of the WebView's actual pixels
    (RenderEngine/SurfaceFlinger-level), not a CSS filter — but it costs: (a) a system permission
    prompt the app doesn't currently need, (b) `addView`/`updateViewLayout` calls at up to 50Hz
    (WindowManager layout updates are not cheap — SurfaceFlinger transaction per update), (c) OEM
    variance risk per the AOSP caveat above, and (d) a coordinate feed from page-space to
    screen-space that has to survive scroll/zoom/orientation and the delayed-frame video's own
    scaling.

- **DOCUMENTED — coordinate feed latency (`evaluateJavascript` / native overlay tracking a WebView
  region).** Not backdrop-filter-specific, but general Android graphics-stack findings: "TextureView
  adds 1-3 extra frames of latency to display updates" and "SurfaceView can be backed by a hardware
  overlay which uses less memory bandwidth and power compared to TextureView, which is always
  composited using GL" — cited in a RealtimeBlurView discussion thread (secondary source,
  aggregating well-known Android graphics behavior):
  https://groups.google.com/a/chromium.org/g/graphics-dev/c/Z0yE-PWQXc4 . Feeding rects from the
  page to native code means either (a) a JS→Kotlin bridge call every rAF tick (main-thread JNI/bridge
  overhead per call, plus the page's own layout read cost — same cost class as today's div
  repositioning, just relocated) or (b) `WebView.evaluateJavascript` polling, which is asynchronous
  and adds a full JS-eval round-trip (historically ~1 frame or worse; Chromium bug reports exist of
  `evaluateJavascript` occasionally not returning promptly — https://www.androidbugfix.com/2021/11/android-webview-evaluatejavascript.html
  is anecdotal but consistent with known bridge-call jitter). **Net judgment (SPECULATIVE):** a
  native overlay does not remove the coordinate-plumbing cost that already exists (rects still have
  to be read from the page's layout every frame); it only relocates the *paint* cost off the
  WebView's own compositor, at the cost of new latency and permission surface. Given the owner's own
  A/B already showed the filter/paint isn't the expensive part, this is a high-effort, likely-low-
  payoff change unless the real bottleneck (found by track A/B, not this track) turns out to be
  compositor-side GPU cost specifically from stacking backdrop-filter layers over the canvas.

---

## 3. Refresh rate / frame pacing

- **DOCUMENTED — `Surface.setFrameRate()` is the modern API (API 30/31+), preferred over
  `preferredDisplayModeId`.** "In general, use setFrameRate() instead of preferredDisplayModeId...
  the app doesn't need to search through the list of display modes." —
  https://developer.android.com/media/optimize/performance/frame-rate . SurfaceFlinger then picks a
  refresh rate that's a multiple of the requested layer rate(s): "if two active layers set their
  frame rate to 24 and 60 SurfaceFlinger will pick 120Hz if it is available" —
  https://source.android.google.cn/docs/core/graphics/multiple-refresh-rate .
  **Applicability to this app (DOCUMENTED nuance):** `Surface.setFrameRate` (API 31) and
  `SurfaceControl.Transaction.setFrameRate` (API 30) operate on an actual `Surface`/`SurfaceControl`
  object — e.g. a `SurfaceView`'s surface, or (API 31+) `AttachedSurfaceControl` reachable via
  `View.getRootSurfaceControl()` on the window's root view. A plain WebView-hosting Activity *does*
  have a root `Surface` (the whole window), so in principle `getWindow().getDecorView().getRootSurfaceControl()`
  → `applyTransactionOnDraw()` with a `setFrameRate` transaction could hint the whole window (WebView
  included) to run at 60Hz instead of 90Hz while a 30fps-delayed video is on screen. This is a
  window-wide hint, not something scoped to just the canvas/video region, so it would also throttle
  the blur-patch rAF loop's effective vsync cadence. **SPECULATIVE on the actual win:** capping a
  90Hz panel to 60Hz would cut roughly a third of the compositor's expected draw/vsync work for
  everything sharing that window (the divs' rAF and the canvas draw), for content that's only ever
  presenting ~30fps video content — real headroom, but I found no source measuring this exact case.

- **DOCUMENTED — Android 15 Adaptive Refresh Rate (ARR) and the View voting mechanism.** "In
  Android's View system, each View can express its preferred frame rate through a voting
  mechanism, with votes combined to determine a final frame rate which is sent to the lower-level
  layer as a hint" — https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate .
  This exists for **native Views**, e.g. `View.setRequestedFrameRate()`/`setFrameContentVelocity()`
  family (Android 15, API 35). It is not documented as reachable from inside WebView's own rendering
  (Blink doesn't currently expose a "this content is 30fps" hint to Android's ARR voting mechanism
  that I could find sourced). The owner's phone is Android 16, so ARR exists on it, but there's no
  found evidence WebView content participates in the vote automatically. **SPECULATIVE:** even if
  the WHOLE ACTIVITY's window voted low (via the `Surface.setFrameRate` route above), that's a
  blunt, page-content-unaware hint — good enough as a coarse "cap this window to 60Hz" lever, not a
  fine per-video-element one.

- **No source found** for "does capping to 60Hz reduce compositor *work* for a WebView showing
  30fps video" as a directly measured Chromium/Android claim — flagged as an open question, best
  answered empirically on-device (toggle `Surface.setFrameRate(60)` on the window vs. leaving the
  panel at 90Hz, re-run the owner's existing drop-rate probe).

---

## 4. Power / thermal / scheduling APIs

- **DOCUMENTED — `PerformanceHintManager` / ADPF.** Java SDK `createHintSession` requires **API 31**
  (Android 12) per its `@ApiSince` annotation (found via
  https://developer.android.com/reference/android/os/PerformanceHintManager and cross-checked
  against the NDK docs, which list the native `APerformanceHint` group as introduced in **API 33**
  for the NDK surface — https://developer.android.com/ndk/reference/group/a-performance-hint ). So:
  Java-level Session creation from API 31+, native/NDK from API 33+. Both the Redmi 9 (Android 12 =
  API 31) and Redmi 13 4G (Android 16) qualify for the Java path.
  "ADPF is a set of APIs that allow games and **performance-intensive apps** to interact more
  directly with power and thermal systems" — https://developer.android.com/games/optimize/adpf —
  explicitly not games-only. "With ADPF, an app can send an additional signal about its performance
  and deadlines. This helps the system ramp up more aggressively... and lower the clocks quickly
  when the workload is complete" (same source). **Fit for this app (SPECULATIVE but well-supported):**
  a `PerformanceHintManager.Session` wrapping the inference/render loop's worker thread(s), fed
  `reportActualWorkDuration()` each frame, is exactly the documented use case (deadline-based
  variable workload) — this targets *inference/compute* jank, not directly the compositor drop-frame
  number, but on SoCs where the scheduler under-clocks between bursts (common on budget Snapdragon
  4-series parts) it can reduce frame-to-frame latency variance.
  **No source found** stating Chromium/WebView itself already calls ADPF internally on Android 14+;
  this is an open question — if Chromium's renderer process already creates its own hint sessions,
  an app-level session for a *separate* worker thread doing the ML/tracking work would still be
  additive, not redundant, since they'd be different sessions.

- **DOCUMENTED — `PowerManager.getThermalHeadroom(forecastSeconds)`.** "Introduced in API level 30."
  "There is no benefit to calling this function more frequently than about once per second... more
  frequently may result in the function returning NaN." "If getThermalHeadroom(30) returns 0.8...
  there is 0.2 distance away from severe throttling." —
  https://developer.android.com/games/optimize/adpf/thermal (cross-referenced via
  https://learn.microsoft.com/en-us/dotnet/api/android.os.powermanager.getthermalheadroom ). Both
  target devices are API 30+, so available. Practical use: poll ~1/s, and when headroom crosses a
  threshold, drop inference cadence or verdict duty *before* the OS starts hard-throttling the CPU —
  this is a preventative lever against exactly the kind of sustained-inference thermal throttling
  this repo's session log already suspects (repeated notes about phone-side cadence/duty tuning).

- **DOCUMENTED — `Window.setSustainedPerformanceMode()`.** Exists since Android 7.0 (N):
  "In Android 7.0 and later, OEMs can implement support for sustained performance hints that enable
  apps to maintain a consistent device performance and specify an exclusive core to improve
  performance for CPU-intensive, foreground apps." Also documented via the Google VR SDK wrapper
  (`AndroidCompat.setSustainedPerformanceMode`), which just calls the same underlying
  `Window.setSustainedPerformanceMode`. **Caveat (DOCUMENTED):** this is an **OEM-optional**
  hardware feature (`PowerManager.isSustainedPerformanceModeSupported()` must be checked) — MediaTek
  (Redmi 9's Helio G85) and Qualcomm (Redmi 13 4G's Snapdragon 4 Gen 2) budget SoCs are exactly the
  tier where this is least likely to be implemented; no source found confirming support on either
  named chip specifically. Effect when supported: locks clocks to a sustainable (non-boost, non-
  throttled) level rather than the burst-then-throttle pattern — trades peak speed for consistency,
  which is more often what a real-time 50Hz render loop wants than a burst clock.

- **DOCUMENTED — thread priority.** `Process.setThreadPriority()` plus the
  `THREAD_PRIORITY_LESS_FAVORABLE`/`THREAD_PRIORITY_MORE_FAVORABLE` increments —
  https://developer.android.com/topic/performance/threads : "Your app can use the
  THREAD_PRIORITY_LESS_FAVORABLE and THREAD_PRIORITY_MORE_FAVORABLE constants as incrementers to set
  relative priorities." `HandlerThread`s default to background priority already: "For the most part,
  the Android APIs already assign worker threads a background priority for you (for example, see the
  source code for HandlerThread and AsyncTask)" (same source) — so if the inference thread is a
  default `HandlerThread`, it may be running at a *lower* priority than intended without an explicit
  `setThreadPriority(THREAD_PRIORITY_DEFAULT)` or better call.
  **No public API for big.LITTLE core pinning** was found — `cpuset`/`taskset`-level affinity is not
  exposed to normal (non-root, non-system) apps on Android; the *closest* public levers are thread
  priority (which influences the scheduler's core-migration heuristics indirectly) and ADPF hint
  sessions (which are explicitly designed to let the SoC vendor's own scheduler pick appropriate
  cores/clocks for a hinted workload, i.e. ADPF is the sanctioned replacement for manual affinity).

---

## 5. WebView settings affecting rendering cost

- **DOCUMENTED — `WebSettings.setOffscreenPreRaster(boolean)`.** "related to rendering when a
  WebView is offscreen to avoid flickering" (Android docs, paraphrased via search — the canonical
  doc says it controls whether WebView rasterizes content even when the WebView is not attached to a
  window, trading memory for avoiding a blank flash on first attach). **Relevance here
  (SPECULATIVE):** likely irrelevant to steady-state dropped-frame rate, since the WebView here is
  the sole foreground surface, not a hidden/reused view being warmed up.

- **DOCUMENTED — `WebView.setRendererPriorityPolicy(rendererPriority, waivedWhenNotVisible)` (API
  26+).** "used to determine whether an out of process renderer should be considered to be a target
  for OOM killing" —
  https://learn.microsoft.com/en-us/dotnet/api/android.webkit.webview.setrendererprioritypolicy .
  This is an **OOM-killer priority knob**, not a scheduling/CPU-priority knob — it affects whether
  Android reclaims the renderer process under memory pressure, not how fast it runs while alive.
  Setting `RENDERER_PRIORITY_IMPORTANT` (or `_HIGH`, in newer API surfaces) with
  `waivedWhenNotVisible=false` is cheap insurance against the renderer being killed mid-session on a
  budget phone, but is not expected to move the dropped-frame percentage.

- **DOCUMENTED — multiprocess WebView / `android:hardwareAccelerated`.** Since Oreo (API 26),
  WebView runs "a single out-of-process renderer (multiprocess mode)... enabled for all 64-bit
  devices, for 32-bit devices with high memory, and for all devices starting in Android 11 (API 30)."
  "the service's memory, CPU and battery usage are correctly attributed to the application" — so on
  both target devices (API 31/API 36) multiprocess mode is already on, not a toggle to add.
  "More renderer processes would increase the memory overhead" — i.e. there isn't a documented lever
  to add *more* renderer processes for this use case anyway; multiprocess here is single-renderer,
  already default. `android:hardwareAccelerated="true"` is required for WebView to composite via GPU
  at all — check the manifest has it (it's the default for API 14+, but worth confirming it isn't
  disabled at the Activity/Application level, since disabling it would force the backdrop-filter
  region to software raster, which would be catastrophic and should already show up as far worse
  than 13% if that were the case).

- **DOCUMENTED — `WebView.setLayerType()` is legacy (View-level hardware/software/none layer
  type), largely superseded by the compositor's own layer promotion; **no source found** describing
  a beneficial use of `setLayerType(LAYER_TYPE_HARDWARE)` on the WebView itself beyond what Chromium
  already does internally — flagged low-value / likely no-op for this problem.

- **DOCUMENTED — `enableSlowWholeDocumentDraw()` is a *static, one-time, process-lifetime* toggle
  that must be called **before any WebView is created**, and it forces Chromium to draw the entire
  document rather than using tiled/visible-region drawing — this is explicitly a compatibility
  fallback for content whose invalidation bounds are wrong, and would generally make performance
  **worse**, not better, for a modern SPA like m.youtube.com. Not recommended to touch; included
  here only because it was named in the brief.

- **DOCUMENTED — `/data/local/tmp/webview-command-line` and `--enable-features`.** "WebView always
  looks for the same file on the device... regardless of which package is the WebView provider," and
  "WebView supports the same syntax for toggling Features as the rest of chromium:
  `--enable-features=feature1,feature2`." **Critical caveat, DOCUMENTED:** "While WebView supports
  toggling arbitrary flags on debuggable devices, we also support toggling a curated set of
  experimental flags/features on production Android devices... you need a debuggable device to use
  the full range of command-line flags." — https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/commandline-flags.md
  So this is a **development/debug-only lever** for the owner's own testing (his phone would need to
  be a debuggable build or the app itself debuggable, and the flags file must be pushed via adb) —
  **it cannot ship to end users** as a way to enable Chromium features at runtime; anything found
  useful this way has to be re-obtained via a real code-level equivalent (a `WebViewCompat`/
  `ProcessGlobalConfig` API, or simply relying on it being default-on in a future Chromium release)
  before it can matter for the shipped app. Also: "it's important to always kill the WebView-based
  app... after modifying commandline flags" — flags only apply at next cold start.

- **DOCUMENTED — `WebViewSurfaceControl`.** The Chromium feature flag itself is
  `base::FEATURE_DISABLED_BY_DEFAULT` in `gpu/config/gpu_finch_features.cc`, **but** "WebView
  hardcodes this as enabled in `AwMainDelegate`" (found via the `android_webview/common/aw_features.cc`
  source browsing) — i.e. despite reading "disabled by default" in the generic feature table,
  **Android WebView itself force-enables `SurfaceControl`-based compositing** already, on any modern
  WebView build (this is old enough behavior that Chromium 151 almost certainly has it). Practical
  meaning: WebView already composites via `SurfaceControl` (the same primitive
  `SurfaceFlinger`-level overlays use), so there is likely **no separate opt-in switch left to flip
  for this** — it's already the active path, not an untried lever. There's also a related, still
  `DISABLED_BY_DEFAULT` `WebViewSurfaceControlForTV` (TV-specific, irrelevant here).

---

## 6. Video overlay disabled by on-top content / SurfaceControl compositing

- Covered above (§1, §6 overlap): Chromium prefers a zero-copy hardware overlay/underlay path for
  `<video>` when it can — "on Android, once the decoder has chosen to output zero-copy frames, they
  can only be displayed as hardware underlays, and any path that disables hardware overlays results
  in the video disappearing" (VideoNG, https://developer.chrome.com/docs/chromium/videong). Content
  drawn **on top of a visible `<video>`** (semi-transparent, blurred, or otherwise) is the classic
  trigger that knocks a video off this path and forces full GPU composition, at a real, documented
  power/perf cost (~50% power difference cited for fullscreen). **This app already avoids that
  failure mode by design** — the real `<video>` is hidden and never shown with anything drawn over
  it; the *canvas* (not the video) receives the drawImage copy, and the canvas is a normal
  compositor layer, not video-overlay-eligible in the first place, so there is nothing to "lose" on
  that axis. This confirms the delayed-canvas architecture sidesteps the video-overlay-occlusion
  penalty rather than being blind to it.
- `WebViewSurfaceControl` (above) means WebView's own layers (potentially including the canvas
  layer) may already be composited through `SurfaceControl`/hardware-overlay-capable paths where
  eligible — but a canvas with per-frame CPU/GPU-drawn content updated at ~30fps, sitting under
  divs that themselves update at ~50Hz, is a poor candidate for overlay promotion regardless (overlay
  promotion generally wants a stable, infrequently-changing or app-opaque surface, not one stacked
  under other frequently-changing translucent content) — **SPECULATIVE**, no source directly
  measured this exact stack.

---

## Ranked table

| Idea | Expected gain (dropped-frame points) | Effort | Risk |
|---|---|---|---|
| **Cap window refresh rate to 60Hz via `Surface.setFrameRate`/root `AttachedSurfaceControl`** while video is delay-presented | Speculative **3-8 pts** — reasoning: owner's phone panel is 90Hz vs the 60Hz device already showing 13% drops; a 90Hz device asks the WebView compositor to hit vsync 50% more often for content that's fundamentally ~30fps video + ~50Hz div writes, so trimming to 60Hz removes real wasted vsync attempts on the 90Hz phone specifically (no measured gain on the 60Hz Redmi 9, since it's already at 60) | Low-Medium (a few lines, API 31 `getRootSurfaceControl()` + a `SurfaceControl.Transaction`) | Low — reversible, no permission needed, but window-wide (also throttles UI chrome) and unverified for this exact stack |
| **Move canvas `drawImage` to `OffscreenCanvas` in a worker via `transferControlToOffscreen`** | Speculative **1-4 pts** — only helps if main-thread contention (not GPU compositing) is part of the 13%; frees the canvas draw + associated main-thread paint scheduling from competing with inference/tracking JS and Blink's own div-layout work each frame | Medium (real code restructuring: presenter becomes worker-driven, frame data must transfer via `transferToImageBitmap`) | Medium — historical WebView-embedding gaps reported for OffscreenCanvas (Cordova bug, open Chromium WebView issue); needs an on-device spike before committing |
| **ADPF `PerformanceHintManager` session around the inference/tracking worker thread(s)** | Speculative **0-3 pts** direct effect on drop-rate, but real value against *latency variance/thermal throttling* over a long viewing session, which compounds into dropped frames over time on budget SoCs | Low-Medium (Java API, min API 31, both target devices qualify) | Low — additive, no permission, OS-level no-op if unsupported |
| **`PowerManager.getThermalHeadroom()` polling → back off verdict cadence pre-emptively** | Speculative **0-5 pts**, concentrated in long sessions where the SoC would otherwise hit sustained thermal throttling (which drops frames hard, not gradually) | Low (poll ~1/s, feed into existing cadence dial already in the codebase per session notes) | Low — API 30+, no permission, graceful no-op (NaN) if over-polled |
| **`Window.setSustainedPerformanceMode()`** | Speculative **0-2 pts** — OEM-optional, budget MediaTek/Qualcomm SoCs are the least likely tier to implement it; must runtime-check `isSustainedPerformanceModeSupported()` | Very low (one call, one capability check) | Low — safe no-op if unsupported, but likely unsupported on both named SoCs |
| **Explicit `Process.setThreadPriority()` on the inference `HandlerThread`** | Speculative **0-2 pts** — only helps if the thread is currently sitting at Android's default background-ish `HandlerThread` priority rather than an explicitly elevated one | Very low (one line per thread) | Very low |
| **`WebView.setRendererPriorityPolicy(IMPORTANT, waivedWhenNotVisible=false)`** | ~0 pts on drop-rate; protects against renderer-process OOM-kill on a budget phone during long sessions | Very low | Very low |
| **Native `SurfaceView`/`TYPE_APPLICATION_OVERLAY` window with `FLAG_BLUR_BEHIND`, coordinates fed from JS** | Speculative **0-2 pts**, possibly **negative** — owner's own A/B already showed removing `backdrop-filter` (solid color) barely helped, meaning the *filter math* is not the cost; a native blur only relocates paint cost while adding coordinate-bridge latency (historically ~1+ frame per `evaluateJavascript`/bridge round trip per known Android graphics-stack behavior), a new runtime permission (`SYSTEM_ALERT_WINDOW`), and documented OEM cross-window-blur support gaps ("might not be supported by some devices due to GPU limitations") | High (new permission flow, new window management, coordinate sync, orientation/scroll edge cases) | High — permission friction, OEM fragmentation, latency regression risk, and targets a cost source the owner's own measurement already excluded |
| **`enableSlowWholeDocumentDraw()`** | Negative expected — this is a compatibility fallback that forces whole-document redraw instead of tiled/visible-region draw | N/A | Do not use |
| **`/data/local/tmp/webview-command-line` `--enable-features=...`** | N/A directly shippable | N/A | Debug/dev-only; requires a debuggable device/app; cannot reach end users as-is — useful only to *discover* a win to then hard-code via a real API |
| **`WebViewSurfaceControl` opt-in** | 0 pts — already hardcoded enabled inside WebView (`AwMainDelegate`) on modern builds; not an available lever | — | — |

## Bottom line for the caller
The owner's own A/B (solid color vs. blur, <1 point difference) already rules out `backdrop-filter`
sampling cost as the dominant factor, which narrows this track's most promising levers to
**(1) compositor/vsync load from the 90Hz panel** (cap to 60Hz — cheap, reversible, worth trying
first) and **(2) main-thread contention** (OffscreenCanvas-in-worker — higher effort, needs an
on-device spike given a documented history of WebView-embedding gaps for that API). The
native-blur-overlay idea should be deprioritized: it targets a cost source the owner's own
measurement already excluded, and carries the highest effort/risk in this track. Thermal/ADPF levers
are worth adding regardless as cheap insurance against long-session degradation, but are unlikely to
explain a steady-state 13% baseline drop rate on a cold/warm device.
