# Native on-device inference (Android) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **The loop state lives at the bottom of this file (`## Loop state`) — read it first, update it last.**

**Goal:** Move the three player models (BlazeFace, faceres, MoveNet MultiPose) out of WebGL-in-a-WebView into the Android app itself (TensorFlow Lite / LiteRT with the GPU delegate), so one blur decision on the OLD Redmi (M2010J19SI, Snapdragon 662 / Adreno 610, adb `1ec2c48e0621`) costs a fraction of today's 922ms — and every faster phone is "blazing" by construction.

**Owner's words (2026-09-02):** "make it proper on my old Redmi. The idea is that if we get it correctly optimized on the old phone, other phones are just going to be blazing fast." Every number in this plan is measured on that device. Nothing is claimed from a faster one.

**Architecture:** The page keeps ALL policy — decode of raw detector outputs (anchors, NMS, `parsePersons`, gender/age/descriptor reads), tracking, cadence, rendering. Kotlin becomes a dumb, generic **tensor runner**: `run(modelId, inputBytes) → output tensors`, on its own thread, GPU delegate first, XNNPACK CPU fallback. Transport is a `WebMessagePort` carrying `ArrayBuffer`s (frames in, Float32 outputs back); `worker-client.mjs` gains a second transport (`native-client.mjs`) with the SAME message shapes the in-page Worker speaks today, so `init-entry.js` does not change. If native is unavailable for any reason (feature unsupported, model load failure, OTA kill switch), the existing Worker path runs exactly as in 1092 — fail-safe, never fail-open. Desktop is untouched.

**Tech Stack:** Kotlin (`MainActivity.kt` lives in `app/src-tauri/gen/android/app/src/main/java/app/tamescroll/client/`), `androidx.webkit` (WebMessagePort + ArrayBuffer), TensorFlow Lite (`org.tensorflow:tensorflow-lite` + `tensorflow-lite-gpu`, or LiteRT equivalents — Task 1 picks), `.tflite` assets under `app/src-tauri/gen/android/app/src/main/assets/models/`, vanilla ES modules in `app/gaze/src`, `node --test`, CDP probes in `spikes/gauntlet` (python, `emu_cdp.py`), build recipe from `spikes/gauntlet/barm-1092e.out`.

**Spec:** this plan is the spec; it is derived from the two spikes in `spikes/native/` (`REPORT.md` = model conversion + parity, `BRIDGE-REPORT.md` = page→Kotlin frame transfer cost) and the 1092 device rows in `spikes/gauntlet/latency-ab-stageB5.json` (verdict p50 922ms, gap p50 2000ms, rAF 34.3, coverage 0.628).

## iOS (owner, 2026-09-02: "we are making this app for Apple as well")

The seam is chosen so iOS is a second implementation of ONE small interface, not a second pipeline. All policy (decode, NMS, tracking, cadence, rendering) stays in the page; the native side is a tensor runner reached through a message port. On iOS that is a `WKScriptMessageHandler` (with `WKWebView` `postMessage` for results) running the same `.tflite` files through TensorFlow Lite's iOS pod with the Metal delegate (Core ML delegate as the alternative). The port protocol (Task 2) is therefore platform-neutral by construction: a 16-byte header + raw RGBA in, `[reqId,status,nOutputs,elapsedUs]` + Float32 tensors out; `native-client.mjs` must not know which platform answered. iOS work itself happens in the cousin's visit window (project CLAUDE.md); everything here must leave it a copy-the-protocol job.

## Global Constraints

- BLOCK-ONLY, NO NAGS, patches SOLID, player red line (`docs/VISION.md`). Never copy from HaramBlur or any AGPL/GPL source. TFLite/LiteRT are Apache-2.0; the models are MIT (Human) / Apache-2.0 (MoveNet) — add every new dependency to `NOTICE`.
- **Every number is measured on the old Redmi over CDP.** Nothing is rendered on the owner's desktop. The emulator cannot stand in (swiftshader, no real GPU delegate).
- **Fail-safe, never fail-open.** A native path that cannot answer must hand the request to the Worker path; a native path that answers WRONG is worse than no native path — Task 3's parity gate blocks Task 4.
- Every new test is RED-PROVED against the pre-change code; the red output goes in the commit body. Verify every constant in the EMITTED bundle (`node app/gaze/build/build.js`, grep `app/src-tauri/gaze-page.js`).
- A constant added in source is added to `rules/tuning.json` and `node scripts/gen-rules-manifest.mjs` re-run (`test/tuning.test.mjs` pins it).
- One writer in this checkout at a time. The loop takes `docs/native/LOCK` (see Loop state) before touching files and releases it after commit+push.
- Commit + push after every task. Release only at Task 8, and only if `node app/gaze/bench/critic-gate.mjs` exits 0.
- Sonnet for steps, Opus only for the critic (Task 7).

---

## File structure

- `spikes/native/convert.py`, `parity.mjs`, `parity.py`, `out/*.tflite`, `REPORT.md` — Task 0a (running). Conversion + parity of the three models.
- `spikes/native/BRIDGE-REPORT.md`, `spikes/gauntlet/probe_frame_bridge.py` — Task 0b (running). Transport cost.
- `spikes/native/bench-android/` — Task 1. Standalone Gradle app: loads the `.tflite`s, times GPU vs CPU on the Redmi, logs JSON to logcat.
- `app/src-tauri/gen/android/app/src/main/java/app/tamescroll/client/NativeInfer.kt` — Task 2. Tensor runner + port protocol. Kept OUT of MainActivity so it can be unit-tested and reasoned about alone.
- `app/src-tauri/gen/android/app/src/main/assets/models/{blazeface,faceres,movenet}.tflite` — Task 2.
- `app/src-tauri/gen/android/app/build.gradle.kts` — Task 2. TFLite + webkit deps; `aaptOptions.noCompress("tflite")`.
- `app/gaze/src/native-client.mjs` — Task 2. Page side of the port protocol; exposes the same API surface as the Worker client (`videoFrame`, `faces`, `gender`, `release`, `waitMs`, `backend()`), built on raw-output decode that already exists in `detector.js` (`decodeBlazeFace`/NMS, `parsePersons`, faceres output reads).
- `app/gaze/src/worker-client.mjs` — Task 4. Transport selection: native (Android, port arrived, models loaded) → Worker → in-page.
- `app/gaze/src/tuning.mjs` + `rules/tuning.json` — Task 4. `NATIVE_INFER: [0, 1]`, ships 1 once Task 5 is green; OTA kill switch.
- `app/gaze/src/diag-report.mjs` — Task 4. `player.life.nativeUsed / nativeFailed / nativeFallback` and `worker.backend: 'native-gpu' | 'native-cpu' | ...`.
- `spikes/gauntlet/probe_native_parity.py` — Task 3. Same fixed inputs through both paths on the device.
- `spikes/gauntlet/probe_latency_ab.py` — Task 5. Unchanged; the A/B instrument.
- `docs/critic/phase-j.md`, `docs/critic/ledger.md` — Task 7.

---

### Task 0a: Model conversion + parity (DONE 15:05 -- see spikes/native/REPORT.md)

**Files:** `spikes/native/convert.py`, `spikes/native/parity.{mjs,py}`, `spikes/native/out/*.tflite`, `spikes/native/REPORT.md`.

**Produces:** three `.tflite` files (f32 and f16 each) plus a parity table (max-abs-diff, cosine per output tensor vs the tfjs original on a deterministic input). Names/shapes of every input/output tensor.

- [ ] Agent reports. Read `REPORT.md`. **Gate:** each model converts with TFLITE_BUILTINS only (no SELECT_TF_OPS — the GPU delegate cannot run those) and parity cosine ≥ 0.999 on every output. A model that fails gets ONE more attempt with a different converter route (tfjs→Keras via `tensorflowjs` for faceres; the pre-requant MoveNet original if the hybrid uint8 manifest confuses the converter — check `git log -- app/gaze/models/movenet-multipose.bin` for where it came from; Kaggle/tfhub fetch is DEAD, needs auth). If it still fails, that model stays on the Worker path and the plan continues with the others — say so in Loop state.
- [ ] Commit `spikes/native/` (scripts + REPORT, NOT the venv, NOT the .tflite outputs if > 20MB total — bank those under `Z:\Apps\Disconnect\spikes\native\out\` and add `out/` to `.gitignore` with a note in REPORT.md on how to regenerate).

### Task 0b: Frame transport bench (DONE 15:05 -- see spikes/native/BRIDGE-REPORT.md)

**Files:** `MainActivity.kt` (debug-only `TsFrameBench`), `spikes/gauntlet/probe_frame_bridge.py`, `spikes/native/BRIDGE-REPORT.md`, `spikes/native/bridge-*.json`.

**Produces:** p50/p95 per stage (createImageBitmap, draw+getImageData, encode, transfer, decode) for base64-via-JavascriptInterface vs ArrayBuffer-via-WebMessagePort, at 256x256 RGBA / RGB / 128x128; rAF Hz during vs idle; whether `WEB_MESSAGE_ARRAY_BUFFER` is supported on this WebView (Chrome 151 — expected yes).

- [ ] Agent reports. Read `BRIDGE-REPORT.md`. **Decision:** transport = ArrayBuffer port if supported and its transfer p50 < 10ms at 256x256 RGBA; else base64 JSI. Record the choice and the number in Loop state.
- [ ] Review the Kotlin diff. Keep the port plumbing (Task 2 builds on it); delete the base64 bench path unless it won. Commit.

### Task 1: GPU delegate bench on the Redmi (DONE 15:20, GATE PASSED -- see spikes/native/GPU-REPORT.md)

**Files:** `spikes/native/bench-android/` (new standalone Gradle project: one Activity, no UI, `assets/` holds the three `.tflite`s from Task 0a), `spikes/native/GPU-REPORT.md`, `spikes/native/gpu-bench.json`.

**Interfaces:**
- Consumes: `spikes/native/out/{blazeface,faceres,movenet}[-f16].tflite`, tensor names/shapes from `REPORT.md`.
- Produces: per model × {GPU delegate, CPU XNNPACK 4 threads} × {f32, f16}: init ms, warm-up ms (first inference), steady p50/p95 over 100 runs, and whether the GPU delegate accepted the WHOLE graph (`GpuDelegate` falls back per-op silently — read `Interpreter` logcat for "not supported by GPU delegate" lines and count them).

- [ ] **Step 1: Project.** `spikes/native/bench-android/` with `settings.gradle.kts`, `app/build.gradle.kts` (compileSdk 36, minSdk 24, deps `org.tensorflow:tensorflow-lite:2.16.1`, `org.tensorflow:tensorflow-lite-gpu:2.16.1`, `org.tensorflow:tensorflow-lite-gpu-api:2.16.1`; `aaptOptions { noCompress += "tflite" }`), `BenchActivity.kt`:

```kotlin
class BenchActivity : Activity() {
  override fun onCreate(s: Bundle?) {
    super.onCreate(s)
    Thread {
      val out = JSONArray()
      for (m in listOf("blazeface", "faceres", "movenet")) for (f16 in listOf(false, true)) {
        val name = if (f16) "$m-f16.tflite" else "$m.tflite"
        for (gpu in listOf(true, false)) {
          val opts = Interpreter.Options()
          var delegate: GpuDelegate? = null
          if (gpu) {
            val cl = CompatibilityList()
            if (!cl.isDelegateSupportedOnThisDevice) { out.put(JSONObject().put("model", name).put("gpu", true).put("skipped", "delegate unsupported")); continue }
            delegate = GpuDelegate(cl.bestOptionsForThisDevice); opts.addDelegate(delegate)
          } else opts.setNumThreads(4).setUseXNNPACK(true)
          val t0 = SystemClock.elapsedRealtimeNanos()
          val interp = Interpreter(loadModel(name), opts)
          val initMs = (SystemClock.elapsedRealtimeNanos() - t0) / 1e6
          val input = allocInput(interp)   // ByteBuffer sized from getInputTensor(0), filled with a fixed pattern
          val outputs = allocOutputs(interp) // HashMap<Int, Any> sized from getOutputTensor(i)
          val warm = timeMs { interp.runForMultipleInputsOutputs(arrayOf(input), outputs) }
          val runs = DoubleArray(100) { timeMs { input.rewind(); interp.runForMultipleInputsOutputs(arrayOf(input), outputs) } }
          runs.sort()
          out.put(JSONObject().put("model", name).put("gpu", gpu).put("initMs", initMs).put("warmMs", warm)
            .put("p50", runs[49]).put("p95", runs[94]).put("min", runs[0]))
          interp.close(); delegate?.close()
        }
      }
      Log.i("TSBENCH", "RESULT " + out.toString())
    }.start()
  }
}
```

- [ ] **Step 2: Build + run.** `JAVA_HOME` as in the recipe; `./gradlew :app:assembleDebug -q`; `adb -s 1ec2c48e0621 install -r`; `adb shell am start -n app.tamescroll.bench/.BenchActivity`; `adb logcat -d | grep TSBENCH` (also grep `tflite` for delegate fallback lines). Repeat the whole run TWICE (the device throttles; report both).
- [ ] **Step 3: GPU-REPORT.md** with the table, delegate-coverage lines, and the sum for ONE verdict pass in the app's shape: MoveNet once + BlazeFace once + faceres × 2 crops. **Gate for Task 2:** that sum on the GPU delegate ≤ 300ms steady-state on the Redmi (today's WebGL equivalent is ~700-900ms). If it is not, stop, write why in Loop state, and try f16 + `setPrecisionLossAllowed(true)` / NNAPI delegate (`NnApiDelegate()`) as the second attempt before declaring the approach dead.
- [ ] Commit `spikes/native/bench-android/` (source only; add `build/`, `.gradle/` to `.gitignore`).

### Task 2: `NativeInfer.kt` tensor runner + `native-client.mjs` (Sonnet, one task per side, timebox 90m each)

**Interfaces:**
- Consumes: the port from Task 0b; `.tflite`s from Task 0a; delegate choice from Task 1.
- Produces (Kotlin): a `WebMessagePort` protocol. Every message from the page is an `ArrayBuffer` whose first 16 bytes are a header `[u32 reqId, u32 modelId, u32 width, u32 height]` followed by RGBA bytes (`width*height*4`). Reply is an `ArrayBuffer`: `[u32 reqId, u32 status(0 ok / 1 error), u32 nOutputs, u32 elapsedUs]` then for each output `[u32 byteLength]` + raw little-endian Float32 data in the order `Interpreter.getOutputTensor(i)`. `modelId`: 1 blazeface, 2 faceres, 3 movenet. A one-time string message `{"type":"native-ready","models":[...],"backend":"gpu"|"cpu"}` is posted when all interpreters are loaded; `{"type":"native-failed","why":"..."}` if any is not — the page then never uses the port.
- Produces (JS): `native-client.mjs` exporting `connectNative()` → `{ ready: Promise<{backend}>, run(modelId, rgba, w, h) → Promise<Float32Array[]>, waitMs(), backend() }`, and the same higher-level functions `worker-client.mjs` exposes today (read it: `videoFrame`, `faces`, `gender`/`gender1`, `release`), implemented as run() + the existing decode functions imported from `detector.js`.

- [ ] **Step 1 (JS, TDD): the framing.** `test/native-frame.test.mjs`: `encodeRequest(reqId, modelId, w, h, rgba)` produces a buffer of `16 + w*h*4` bytes with the header in little-endian; `decodeReply(buf)` returns `{reqId, status, elapsedUs, outputs: Float32Array[]}`; a truncated reply throws rather than returning a short array (fail-safe). Run → red → implement in `native-client.mjs` → green.
- [ ] **Step 2 (Kotlin): `NativeInfer.kt`.** `class NativeInfer(ctx: Context, port: WebMessagePortCompat)`: a `HandlerThread("ts-infer")`; on construction loads the three interpreters (GPU delegate via `CompatibilityList().bestOptionsForThisDevice`, else XNNPACK), posts `native-ready`/`native-failed`. `port.setWebMessageCallback(handler)` → on `ArrayBuffer` message: parse header, copy RGBA into the model's input `ByteBuffer` (BlazeFace + faceres take float32 normalised to the range their tfjs preprocessing used — READ `detector.js` for each: BlazeFace `[0,1]`? faceres `[-1,1]`? MoveNet uint8/int32 raw — copy the exact constants and cite the line), run, serialise outputs, `port.postMessage(WebMessageCompat(bytes))`. Any exception → status 1 reply, and after 3 consecutive errors on one model post `native-failed` so the page falls back for the rest of the page. Never call WebView APIs off the UI thread except `WebMessagePortCompat.postMessage` (verify in the androidx source whether it is thread-safe; if not, marshal through `runOnUiThread`).
- [ ] **Step 3 (Kotlin): wiring.** In `MainActivity`, on `doUpdateVisitedHistory`/`onPageStarted` for a `youtube.com` host (same hook the rules script uses), if `WebViewFeature.isFeatureSupported(WEB_MESSAGE_ARRAY_BUFFER)`: create the channel, post port[1] to the page with the string `ts-native-port`, construct `NativeInfer` on port[0]. One instance per page load; `close()` the previous one first. Guarded so a failure here can never throw into WebView callbacks.
- [ ] **Step 4: assets + gradle.** Copy the winning `.tflite` variants to `assets/models/`, add the deps, `noCompress("tflite")`. Build with the recipe; APK size delta recorded in Loop state (expect +10-15MB; the JS bundle still ships the tfjs models for desktop and fallback — shrinking that is out of scope).
- [ ] **Step 5 (JS): `native-client.mjs` high-level calls.** Mirror `worker-client.mjs`'s functions one by one, reusing `detector.js`'s decode (export what is not exported yet, with a test that the exports exist). Frames arrive as `ImageBitmap` today → `drawImage` into an `OffscreenCanvas(256,256)` (fitBox letterbox — `crop-geometry.fitBox`, the 1089 rule) → `getImageData` → `encodeRequest`. Gender crops likewise at 224.
- [ ] **Step 6: red-proof + commit.** `npm test` green; bundle rebuilt; `native-client` present in the emitted bundle. Commit both sides.

### Task 3: Parity on the device (Sonnet, timebox 60m) — GATE

**Files:** `spikes/gauntlet/probe_native_parity.py`, `spikes/native/PARITY-DEVICE.md`, `spikes/native/parity-device.json`.

- [ ] On the Redmi, with a debug hook `window.__TS_NATIVE_PARITY` (flag-gated, nothing in the app sets it, a test pins that), feed 20 banked thumbnails (the ids in `spikes/gauntlet/probe_faceres_parity.py` — reuse its serving trick over `adb reverse tcp:8899`) through BOTH paths: Worker (WebGL) and native. Compare: BlazeFace boxes after NMS (IoU ≥ 0.9 per matched box, same count), MoveNet persons admitted (same count, keypoint max within 0.02), faceres gender raw within 0.03, age within 1.0 year, descriptor cosine ≥ 0.98. **Gate:** 0 decision flips at `GENDER_MIN_SCORE` 0.25 and `GENDER_IMAGE_MIN_SCORE` 0.4 across all faces (the 2026-08-31 uint8 requant was refused at 8/100 flips; the bar here is the same). If f16 flips any, use f32 for that model and re-measure Task 1's sum.
- [ ] Commit the probe + report.

### Task 4: Transport selection, kill switch, counters (Sonnet, timebox 60m)

- [ ] `worker-client.mjs`: prefer native when `window.__TS_NATIVE_PORT` arrived AND `native-ready` was posted AND `NATIVE_INFER` (tuning) is 1; otherwise today's path. A native request that errors falls back to the Worker for THAT request and bumps `nativeFallback`; three in a row → native off for the page (`nativeFailed`).
- [ ] `tuning.mjs` + `rules/tuning.json`: `NATIVE_INFER: [0, 1, setter]`, default **1**. Regenerate the manifest. Test pins the default and the emitted constant.
- [ ] `diag-report.mjs`: `worker.backend` gains `native-gpu`/`native-cpu`; `player.life.nativeUsed/nativeFallback/nativeFailed` seeded to 0 on the first player pass (loop-34 rule: absent ≠ never hooked).
- [ ] Tests red-proved; bundle rebuilt; commit.

### Task 5: Device A/B (Sonnet, timebox 45m) — GATE

- [ ] Build, install on the Redmi, `python spikes/gauntlet/probe_latency_ab.py 9227 native 150 --delay`, TWICE. Bank as `latency-ab-native.json` / `-native2.json`. Compare with `latency-ab-stageB5.json` (1092). **Gate:** verdict p50 ≤ 350ms and gap p50 ≤ 800ms with `worker.backend` reading `native-gpu`, coverage within 0.03 of 1092, rAF ≥ 1092's 34. Also read `nativeFallback`/`nativeFailed` (must be 0/0) and the delay arm (entry lag should FALL — the verdict now lands well inside the 1s delay, so `delayVerdictLate` should approach 0).
- [ ] Kill-switch check: push `NATIVE_INFER: 0` to a scratch tuning (or set it via `__TS_TUNING` in page), confirm `worker.backend` returns to `webgl` and the run is 1092's numbers. Restore.
- [ ] Record both rows in Loop state.

### Task 6: Fullscreen + miniplayer + seek with native on (Sonnet, timebox 45m)

- [ ] Real input events over CDP (`Input.dispatchMouseEvent` for the fullscreen button — see loop 18's note about asserting the button is hittable), drag-to-mini via `probe_mini_yt.py`'s gesture: the native path keeps answering across both (`nativeUsed` rising, patches present, 0 outside the player). Seek: refill + first native verdict within 3.5s.

### Task 7: Adversarial critic (Opus)

- [ ] Launch the critic against the diff since `f422be2` and the raw JSON in `spikes/native/` + `spikes/gauntlet/latency-ab-native*.json`. Deliverable `docs/critic/phase-j.md`; rows into `ledger.md`; fix at source; `critic-gate` must exit 0. An open EXPOSURE row blocks Task 8.

### Task 8: Release 1093

- [ ] Bump `appupdate.rs` CURRENT_VERSION_CODE 1093, `tauri.conf.json` 0.1.93, `tauri.properties` (gitignored) 1093/0.1.93. Build, install on the Redmi, one last `probe_latency_ab` row, `gh release create app-v0.1.93`, `node scripts/gen-app-manifest.mjs`, commit+push manifest, re-download the served APK and compare its sha to the manifest, `isDraft` false. Update CLAUDE.md session state with the table. `NOTICE` carries TFLite.

---

## Loop state

Updated by whoever finishes a task. The loop reads this section first.

- **Lock:** `docs/native/LOCK` (contents: ISO time + who). Take it before editing, delete it after push. A lock older than 90 minutes is stale — delete it and say so here.
- **Current task:** 2 (NativeInfer.kt + native-client.mjs), two Sonnet agents started 2026-09-02 15:25 local, timebox 90m each, this session integrates.
- **Decisions so far:** transport = **WebMessagePort + ArrayBuffer** (0b, Redmi: WEB_MESSAGE_ARRAY_BUFFER supported; Kotlin copy 0.30ms p50 vs base64 decode 2.19ms; page+Kotlin 21.4ms vs 32.2ms at 256x256 RGBA). delegate = **TFLite GPU delegate, XNNPACK auto-fallback** (1: one verdict pass MoveNet 160 + BlazeFace 19 + 2x faceres 76 = ~255ms on the Redmi against 922ms on WebGL today; CPU fallback ~510ms; two runs within 1ms). models = **all three builtin-only** (0a): the first blazeface/movenet 'conversions' were Flex models, cause was tfjs-graph-converter's own grappler 'remap' pass; f32 parity 1.000000 on all outputs, f16 parity descriptor 0.9973 on one face -- **f16 ships only if Task 3's corpus parity holds**. MoveNet is 112/237 nodes on the GPU (decode tail on CPU) -- fine for the gate, a later win. GPU init 1.4-3.9s per model, once per process, must be off the critical path.
- **THE REAL FRAME COST IS THE READBACK, NOT THE BRIDGE (0b):** `drawImage`+`getImageData` is 17-24ms p50 and **150-200ms p95** on the Redmi, size-independent (128px no cheaper than 256px). Task 2 must move that off the page's main thread: `createImageBitmap(video)` (0.9ms) -> transfer the ImageBitmap to a Worker (the existing gaze Worker already receives bitmaps) -> `OffscreenCanvas` + `getImageData` THERE -> post the ArrayBuffer to Kotlin from the Worker over a `MessagePort` handed in at start (WebMessagePort ports are transferable to a Worker). Measure p95 there before wiring. The Kotlin bench bridge (base64 + port, `TsFrameBench`) is left UNCOMMITTED on purpose: our releases are DEBUG builds, so `BuildConfig.DEBUG` is not a guard; Task 2 replaces it with `NativeInfer` and no page-exposed `@JavascriptInterface` is added.
- **Device rows:** 1092 = verdict 922 / gap 2000 / rAF 34.3 / coverage 0.628 (`latency-ab-stageB5.json`). TFLite GPU per model p50: blazeface 19 / faceres 38 / movenet 160 (`gpu-bench-1.json`, `gpu-bench-2.json`).
- **Preprocessing the Kotlin side must reproduce (read off detector.js):** BlazeFace float32 `(x/127.5)-1` at 256; faceres float32 RAW 0..255 at 224 (the page does the square crop); MoveNet int32 raw 0..255 at 256. TFLite outputs are read BY NAME (`PartitionedCall:N` order is signature-key order, not tfjs order); `native-ready` carries each model's output names.
- **Blocked / needs owner:** nothing yet.
- **Bench scaffold:** `spikes/native/bench-android/` written (Task 1 Step 1 done); `run.sh` builds+installs+runs and writes `gpu-bench.json`. Waiting on `.tflite`s from 0a.
- **Log:**
  - 2026-09-02 14:45 plan written; spikes 0a/0b in flight; gauntlet cron deleted.
  - 2026-09-02 15:05 0b done (report committed); 0a two of three models; bench app compiles; GPU bench running on the Redmi for blazeface+movenet.
  - 2026-09-02 15:20 0a REDONE (the two 'converted' models were Flex; faceres fixed by the same cause) -- all three builtin-only, parity green. Task 1 gate passed on the Redmi, twice. Task 2 started.
