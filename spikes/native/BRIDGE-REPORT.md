# Frame-transport bench: page -> Kotlin, on the real device

Device: old Redmi, adb serial `1ec2c48e0621`, Snapdragon 662, Android 12,
WebView Chrome 151. App: debug build off current `main` (versionCode
1092 + the DEBUG-only bench code below), running the real
launcher -> `open_platform` -> watch-page path, video `NWoT1ZVd1Lo`
seeked to t=40s and playing.

Raw JSON: `spikes/native/bridge-20260902-144212.json` (40s/variant,
n=107-217 sent per variant, Kotlin ring capped at 200 and cleared
between variants -- see gotcha below). An earlier 15s/variant run
(`bridge-20260902-143929.json`) is banked too but its Kotlin-side stats
are cumulative across variants (blend of three frame-size populations)
-- superseded by the run below, kept only as evidence of the defect.

## Answer: the WebMessagePort/ArrayBuffer transport wins

`WEB_MESSAGE_ARRAY_BUFFER` (and `CREATE_WEB_MESSAGE_CHANNEL`,
`POST_WEB_MESSAGE`, `WEB_MESSAGE_CALLBACK_ON_MESSAGE`) are **all
supported** on this WebView (`TsFrameBench.portSupported()` returned
`true` live). The port avoids two costs the base64 path pays on every
single frame:

| stage (256x256 RGBA, 262144 bytes) | base64 path | port path |
|---|---|---|
| page: `createImageBitmap` p50 | 0.9ms | 0.9ms |
| page: `drawImage`+`getImageData` p50 | 20.2ms | 20.2ms |
| page: base64 encode p50 | **8.9ms** | -- |
| Kotlin: decode/copy p50 | **2.19ms** | **0.30ms** |
| **page+Kotlin total p50** | **~32.2ms** | **~21.4ms** |
| Kotlin decode/copy p95 | 4.88ms | 0.60ms |

The port path is **~11ms/frame cheaper end-to-end at this size**, and
the gap holds at the other two sizes tried:

| variant | bytes | page total (create+draw[+encode]) p50 | Kotlin decode/copy p50 | **combined p50** |
|---|---|---|---|---|
| 256x256 RGBA, base64 | 262144 | 30.0ms | 2.19ms | **32.2ms** |
| 256x256 RGBA, port | 262144 | 21.1ms | 0.30ms | **21.4ms** |
| 128x128 RGBA, base64 | 65536 | 31.6ms | 1.77ms | **33.4ms** |
| 128x128 RGBA, port | 65536 | 25.2ms | 0.24ms | **25.4ms** |
| 256x256 RGB packed, base64 | 196608 | 26.1ms | 1.98ms | **28.1ms** |
| 256x256 RGB packed, port | 196608 | 18.4ms | 0.26ms | **18.7ms** |

Kotlin-side decode/copy is **5-8x cheaper** on the port path at every
size (no text decoding, just a byte-array copy out of the transferred
ArrayBuffer) -- consistent with expectation and consistent across all
three variants, so this is not noise.

One caveat, not resolved this session: the port path's **arrival p95
tail is worse** than base64's (48-56ms vs 12-13ms, full numbers below).
`arriveMs` is a wall-clock diff (`System.currentTimeMillis()` at Kotlin
arrival minus `Date.now()` at page send) and both transports run on the
SAME tick in this probe, so it is not a controlled A/B of transport
alone -- but the p50s are close (5-16ms both directions, sub-resolution
noise at this clock precision) while the p95 gap is real and repeats
across all three variants. Plausible explanation: the base64 path is a
synchronous `@JavascriptInterface` call that blocks the calling JS
thread until Kotlin returns, so "arrival" is essentially the call
itself; a `WebMessagePort` message is posted and delivered
asynchronously through Chromium's own message-port plumbing, which can
queue behind other main-thread work with more jitter. **Worth a
controlled back-to-back A/B (one transport per run, not both per tick)
before this is trusted as a real cost of the port**, but it does not
change the recommendation: the p50 savings are consistent and larger
than the p95 tail difference, and a tail in the tens of ms is still far
below the real bottleneck below.

## The real bottleneck is neither transport: `getImageData` readback

`drawImage`+`getImageData` (the GPU-readback stage, common to both
transports since both need decoded pixels) costs **17-24ms at p50 but
150-200ms at p95** in every variant -- 5-20x the entire transport cost,
either path. Frame size barely moves it (128x128 is not cheaper than
256x256: 24.1ms vs 20.2ms p50), which says the cost is dominated by a
roughly fixed GPU-sync/readback overhead at this scale, not by pixel
count. **This is where a native-inference pipeline's real frame-rate
ceiling is set, not the choice of bridge.** If the plan needs a tighter
budget than ~20ms/frame just to get pixels off the GPU, the next
question is whether `createImageBitmap`+`OffscreenCanvas` can be
replaced with something that skips the CPU readback entirely (e.g.
`ImageBitmap` transferred straight into a texture on the native side,
if such a path exists) -- out of scope for this bench, flagged for the
plan.

## rAF Hz

- Idle control (nothing of ours running, video just playing): **25.8Hz**.
- Bench active, 256x256 RGBA (first variant run): **31.2Hz** -- higher
  than idle, most likely because idle was sampled right after the SPA
  nav/seek settled and YouTube's own page was still busier then.
- Bench active, 128x128 RGBA (second variant): **12.1Hz**.
- Bench active, 256x256 RGB packed (third variant): **12.6Hz**.

rAF roughly **halves** once the bench has been running continuously for
40+ seconds, independent of which variant is running second/third --
consistent with either thermal throttling on the Snapdragon 662 after
sustained per-250ms GPU readbacks, or accumulated main-thread
contention from the readback stalls themselves (the 150-200ms p95
`getImageData` spikes are long enough to directly cost rAF frames).
Not isolated further this session (would need a longer idle recovery
window between variants, or per-variant device temperature reads) --
flagged as an open question, not a conclusion.

## Full numbers (40s/variant, from `bridge-20260902-144212.json`)

```
pre: video 1280x720 playing, hasBridge=true, portSupported=true, portArrived=true
rafHzIdleControl: 25.79

256x256 RGBA (n=107 sent, both transports; Kotlin ring capped/cleared per variant):
  page  create p50/p95: 0.90 / 5.40 ms
  page  draw+getImageData p50/p95: 20.20 / 169.40 ms
  page  base64 encode p50/p95: 8.90 / 17.60 ms
  kotlin base64 arrive p50/p95: 7 / 13 ms   decode p50/p95: 2.19 / 4.88 ms
  kotlin port   arrive p50/p95: 16 / 48 ms  decode p50/p95: 0.297 / 0.599 ms
  rafHzActive: 31.25

128x128 RGBA (n=202 sent, ring capped at 200):
  page  create p50/p95: 1.10 / 4.80 ms
  page  draw+getImageData p50/p95: 24.10 / 159.20 ms
  page  base64 encode p50/p95: 6.40 / 15.20 ms
  kotlin base64 arrive p50/p95: 5 / 12 ms   decode p50/p95: 1.77 / 5.09 ms
  kotlin port   arrive p50/p95: 14 / 56 ms  decode p50/p95: 0.235 / 0.440 ms
  rafHzActive: 12.08

256x256 RGB packed (n=217 sent, ring capped at 200):
  page  create p50/p95: 0.90 / 3.30 ms
  page  draw+getImageData p50/p95: 17.50 / 159.70 ms
  page  base64 encode p50/p95: 7.70 / 14.70 ms
  kotlin base64 arrive p50/p95: 8 / 13 ms   decode p50/p95: 1.98 / 5.06 ms
  kotlin port   arrive p50/p95: 12 / 53 ms  decode p50/p95: 0.262 / 0.518 ms
  rafHzActive: 12.58
```

## Gotchas

- **The Kotlin ring is process-global and must be reset between
  variants, or the stats lie.** The first run of this bench (15s/variant,
  `bridge-20260902-143929.json`) left `TsFrameBench.stats()` cumulative
  across all variants (ring cap 200, only 41-123 samples total, so
  nothing ever evicted) -- so "128x128" stats were actually a blend of
  41 samples at 262144 bytes and 41-82 at 65536 bytes, and decode-ms
  scales with byte count, so the blend understates/overstates depending
  on which population dominates the percentile index. Added
  `FrameBenchRing.clear()` + a `TsFrameBench.reset()` bridge call, and
  the probe now calls it at the start of every variant. The superseded
  run is kept in `spikes/native/` as evidence, not as a result.
- **Clock domains.** `System.nanoTime()` (Kotlin) and
  `performance.now()` (page) have no defined common origin, so
  `decode-ms` is a pure Kotlin-side duration (nanoTime diff, safe) but
  `arrive-ms` had to be computed from wall-clock milliseconds instead
  (`System.currentTimeMillis()` at arrival vs `Date.now()` at send,
  ~1ms resolution) -- adequate for tens-of-ms transport costs, not for
  sub-millisecond timing. If a future round needs finer transport
  timing, it would need a same-clock-domain trick (e.g. a fixed offset
  measured once via a synchronous round-trip) rather than trusting
  wall-clock diffs directly.
- **`Page.addScriptToEvaluateOnNewDocument` is required for the port
  handshake to land.** Kotlin posts the `ts-frame-port` message from
  `onPageFinished`, which fires after the page's own scripts have
  already run once -- registering the page's `message` listener from
  inside the watch-page's own script would race it and could miss the
  port entirely (a plain `postMessage` with no listener registered yet
  is simply dropped, not queued). The probe registers the listener via
  CDP `Page.addScriptToEvaluateOnNewDocument` on the tab BEFORE
  navigating anywhere, so it is present on every subsequent document
  including the m.youtube.com nav.
- **`setWebMessageCallback` is an instance method on
  `WebMessagePortCompat`**, not a `WebViewCompat.setWebMessageCallback(...)`
  static (unlike `createWebMessageChannel`/`postWebMessage`, which ARE
  `WebViewCompat` statics) -- checked against the actual class file in
  the `androidx.webkit:webkit:1.14.0` AAR (`javap` on the extracted
  `.class`) before writing the call, rather than guessing from memory.
- **Sample counts ran ahead of the nominal 250ms cadence at times**
  (202-217 sent over what should be ~148 ticks at exactly 250ms across
  ~37s of active sampling) -- not chased further given the time budget;
  worth a look if the plan ends up caring about exact per-frame cadence
  rather than aggregate cost.
- `androidx.webkit:webkit:1.14.0` and `buildFeatures { buildConfig = true }`
  were already present in `app/build.gradle.kts` -- no Gradle changes
  needed for this bench.
- Build/install recipe used (Kotlin-only change, so the Rust step was
  skipped): `gradlew :app:assembleArm64Debug -x :app:rustBuildArm64Debug -q`
  from `app/src-tauri/gen/android`, then `adb -s 1ec2c48e0621 install -r
  <apk>`. No `node gaze/build/build.js` needed (no JS changed) and no
  `llvm-strip` needed (jniLibs already held today's stripped `.so` from
  an earlier build this session).

## Code

- `app/src-tauri/gen/android/app/src/main/java/app/tamescroll/client/MainActivity.kt`
  -- `FrameBenchRing`, `FrameBenchBridge` (`TsFrameBench` JS interface:
  `postBase64`, `portSupported`, `stats`, `reset`), and
  `maybeSetupFrameBenchPort` (wired from `installBlockingClient`'s
  `onPageFinished`, host-gated to `m.youtube.com`). All of it guarded by
  `BuildConfig.DEBUG` -- none of this exists in a release build.
  **Left uncommitted in the tree for review**, per instructions.
- `spikes/gauntlet/probe_frame_bridge.py` -- the CDP probe. Drives
  launcher -> `open_platform` -> watch page (same recipe as
  `probe_latency_ab.py`/`probe_phone_cold2.py`), registers the port
  listener via CDP before navigating, runs three frame-size/format
  variants, banks page-side and Kotlin-side stats plus rAF Hz to
  `spikes/native/bridge-<label>.json`.
