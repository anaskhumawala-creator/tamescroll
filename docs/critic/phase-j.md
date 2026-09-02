# Critic phase J — the native on-device inference round

Subject: `git diff a37c76c..HEAD` — a3dcfba / 06edff8 (`NativeInfer.kt`,
`native-client.mjs`, `native-frame.mjs`, `face-decode.mjs`), 62a603d
(Task 4 wiring: `init-entry.js` `vid()`, `tuning.mjs`, `lib.rs`
`native_port_stash_script`), da197d2 (Kotlin bind generation).

Evidence read directly, never a summary:
`spikes/gauntlet/native-parity-1788345089.json`,
`native-port-1788344212.json`, `native-port-1788344790.json`,
`native-port-1788344973.json`, `spikes/native/REPORT.md`,
`spikes/native/GPU-REPORT.md`.

Rows are id / severity / status / finding. Nothing else in the repo was
edited and nothing was committed.

---

## J1 — EXPOSURE — CONFIRMED

**The two engines are not cropping the same face, and the parity gate as
written asks native to reproduce the 2026-08-28 squash defect.**

`app/gaze/src/face-decode.mjs:171-179` squarifies a BlazeFace box in
MODEL SPACE (256x256) and then divides by `FACE_INPUT_SIZE` — so a face
box is square in NORMALIZED units, which on a 16:9 source is a **1.78:1
rectangle in pixels**. Confirm it in the raw file: frame `t=30`,
`worker.faces[0]` is `x1 0.5930979937314987 / x2 0.7442434340715408`
(w 0.15114) and `y1 0.44336255788803103 / y2 0.5945079982280731`
(h 0.15114) — identical to 12 decimal places, i.e. square in normalized
space, 193x109 px on a 1280x720 frame.

`app/gaze/src/worker-entry.js:336` then calls
`detector.classifyFaceGenders(models.gender, null, msg.boxes, c.t)` —
**four positional arguments, `opts` undefined** — and
`detector.js:791` reads `var square = !!(opts && opts.square)`. So the
worker's video crop path feeds faceres a 193x109 rectangle stretched to
224x224. `worker-entry.js:351` (`handleGenderOnce`) is the same, and so
are the in-page fallbacks `init-entry.js:2526` and `:2689`. The only
call sites that DO pass `{square:true}` are the image path
(`init-entry.js:927`), the whole-frame video path
(`worker-entry.js:193`) and `detector.js:482/546`.

`native-client.mjs:398` and `:432` apply `squareBox(b, bitmap.width,
bitmap.height)` **unconditionally**, in PIXELS. So native feeds an
undistorted 193x193 crop and the worker feeds a 1.78x-stretched one.
That is the exact defect measured in findings 16a (loop 43, "a clear
front-facing man read male at 0.06"), still alive on the worker's VIDEO
gender path, and it is the dominant explanation for the parity numbers
— not descriptor sensitivity.

What breaks and under what input: any 16:9 video frame handed to
`cropFaces` at full resolution — which is what the parity probe does,
and what `init-entry.js:2154` does whenever the crop source is the whole
frame rather than a near-square person region. The two engines are
compared on different pixels, so **every gender row in
`native-parity-1788345089.json` is measuring the squash, not the port**.

Consequence for the plan: Task 3's gate ("faceres gender raw within
0.03", "0 decision flips") cannot be met by a correct native client
while the worker arm is distorted, and *meeting it would require
shipping the distortion into the native path*. The gate is pointed the
wrong way.

**Settles it:** add `{square: true}` to `worker-entry.js:336` and `:351`
(and the two `init-entry` fallbacks), rebuild, re-run
`probe_native_parity.py` unchanged. Prediction, from 16a's own
direction: descriptor cosine p50 rises from 0.83 toward >= 0.98 and the
`t=30` / `t=60` / `t=330` label flips (all three on solid-signal reads,
norm 10.1-11.5) disappear. If cosine stays near 0.83 after that change,
J1 is wrong and the residual is J5's resampler. Offline first, no phone
needed: run `classifyFaceGenders` with and without `{square:true}` over
the banked `spikes/gauntlet/nmtruth-face.json` crops and compare
descriptor cosine — a pure-JS A/B of one model against itself.

---

## J2 — WRONG-NUMBER — CONFIRMED

**"Native MoveNet maxKp is systematically LOWER" is false. It is
uncorrelated, and the gate flips in BOTH directions.**

The banked summary quotes `maxKpAbsDiff.p50 0.056 / max 0.182` — an
ABSOLUTE difference, which cannot carry a sign. Computed signed
(native - worker) over the 16 frames:

`[-0.182, -0.175, -0.111, +0.085, -0.026, -0.075, -0.009, -0.008,
-0.176, +0.172, -0.050, -0.040, -0.039, -0.050, +0.056, -0.011]`

Native is HIGHER on 3 of 16 (t=120: 0.167 vs 0.082; t=300: 0.245 vs
0.073; t=540: 0.081 vs 0.025) and the pearson correlation between the
two engines' `maxKp` over the 16 frames is **-0.08**. Two engines
reading the same quantity on the same frame with r ~ 0 are not offset —
they are reading noise.

The `PFF_FRAME_KP_FLOOR 0.1` crossings are therefore bidirectional:
worker clears / native does not on t=30, 60, 90, 180, 270 (**5**
frames); native clears / worker does not on t=120, 300 (**2** frames).
The claim that this is one-directional and therefore EXPOSURE-shaped is
not supported by the file. What IS true and is worse: **the gate that
decides whether a detected face may mint a patch is being decided by a
quantity two engines cannot agree on to within its own threshold**, on
frames where MoveNet admits nobody at all (see J3).

**Settles it:** re-run the probe with 3 decimal places on `maxKp`
(`lastSlotDiag` rounds to 2dp — R21's own note) over >= 60 frames
spanning at least one video where MoveNet DOES admit persons, and report
the signed distribution plus the correlation, not the absolute p50. And
separately: measure the worker's OWN frame-to-frame `maxKp` variance
across two `createImageBitmap` calls of the same paused frame. If the
within-engine spread is comparable to 0.056, the cross-engine number is
not a parity result at all.

---

## J3 — WRONG-NUMBER — CONFIRMED

**The MoveNet half of the parity run measured zero admitted persons, so
Task 3's person gate passed vacuously.**

`native-parity-1788345089.json`, `summary.personIou` reads
`{"n": 0, "p50": null, "min": null}` and `personScoreAbsDiff` is
`{"p50": null, "max": null}`. Every one of the 16 frames has
`native.persons == []` and `worker.persons == []`. This is the R21 /
findings-36 regime — the same regime CLAUDE.md records as "100% of his
phone". `summary.personCountMismatchFrames: 0` is therefore `0 == 0`
sixteen times.

The plan's Task 3 gate is "MoveNet persons admitted (same count,
keypoint max within 0.02)". The count half is satisfied by a run that
never exercised `parsePersons`' slot-admission path, its box geometry,
its keypoint scaling, or `unpadPersons`. The keypoint half FAILS (J2:
p50 0.056, max 0.182 — nine times the tolerance) and the run reports it
as a summary line rather than as the gate failing.

Same class as phase-G's G3: an arm that is byte-identical to control
where MoveNet admits nobody proves nothing about the arm.

**Settles it:** select parity frames for MoveNet ADMISSION, not by
timestamp. Pick a video and timestamps where the worker admits >= 1
person on >= 15 frames (the `movenet-held` selection problem from
phase-G item 4), then compare person box IoU, per-keypoint score, and
`parsePersons`' admitted count. Until that exists there is no MoveNet
parity evidence in this repo.

---

## J4 — WRONG-NUMBER — CONFIRMED (and the real risk is elsewhere)

**"5 of 24 labels flip" overstates the behavioural cost; "descriptor
cosine p50 0.83 / min 0.44" understates a different one.**

Per-read, from the raw file:

| t | i | native raw / norm | worker raw / norm | cos | flip |
|---|---|---|---|---|---|
| 30 | 0 | 0.337 / 10.08 | 0.736 / 10.42 | 0.824 | X |
| 60 | 1 | 0.402 / 10.72 | 0.616 / 11.47 | 0.789 | X |
| 90 | 0 | 0.485 / **3.20** | 0.537 / **2.03** | 0.836 | X |
| 300 | 0 | 0.581 / **1.18** | 0.493 / **3.29** | 0.435 | X |
| 330 | 0 | 0.503 / 11.06 | 0.427 / 10.46 | 0.775 | X |

**Two of the five flips (t=90, t=300) are NULL READS by the shipped
`NULL_MINT_NM_FLOOR 5`** — the descriptor carried no signal in either
engine, so the label is the model's prior and comparing it is the
`face-recall`-style shape mistake this repo has already earned twice.
Those two also carry the two worst cosines in the whole file (0.435, and
0.622 at t=120 where the norms are 0.94 and 1.07) — i.e.
**`descCosine.min 0.435` is the cosine between two vectors of magnitude
~1 and ~3, noise against noise.** Quoting it as the parity floor is
wrong.

Worse for the headline: at the SHIPPED bar `GENDER_CLEAR_SCORE 0.45`
(score = 2|raw - 0.5|), **exactly ONE of the 24 reads changes decision**
— t=30 face 0, where the worker scores 0.473 and clears a man while
native scores 0.326 and does not. That is the FALSE-COVER direction, not
exposure. Every other flip is between two reads that are both under the
bar and therefore both leave the subject covered.

The number that actually matters and is **NOT in this file**: whether
the native descriptor's WITHIN-engine same-person / different-person
separation still straddles `MEM_SIM_CLEAR 0.60`. A cross-engine cosine
of 0.83 says nothing about that — production runs one engine — but it
does say the two descriptor spaces are not interchangeable, and the
identity memory (`MEM_SIM_CLEAR 0.60` / `MEM_SIM_UPDATE 0.45`) was
calibrated on the tfjs one.

**Settles it, and this is the gate Task 5/8 should carry instead of the
current one:** on the device, native only, over >= 100 face crops that
include repeat appearances of the same subject, report the cosine
distribution for same-subject pairs and for different-subject pairs and
show that 0.60 still separates them with the margin the tfjs arm has on
the same crops. Second gate: **0 decision changes at
`GENDER_CLEAR_SCORE 0.45` / `GENDER_MIN_SCORE 0.25` /
`GENDER_IMAGE_MIN_SCORE 0.4` across >= 100 reads** — the 2026-08-31
uint8 requant was refused at 8/100; 1/24 here is not a comparable
sample. Third: the fraction of reads each engine puts below
`NULL_MINT_NM_FLOOR 5` must match, or the null-mint gate fires on a
different population.

---

## J5 — DEFECT — PARTLY CONFIRMED; hypothesis (a) REFUTED as the dominant cause

**`drawTo`'s comment claims an equivalence it does not have — but the
resampler is not what produced the gender numbers.**

`native-client.mjs:231-239`:

```
  // Whole-frame squash to `size`x`size` -- same geometry as
  // detector.js's tensor path (resizeBilinear with no letterbox pad).
  function drawTo(size, bitmap) { ... ctx.drawImage(bitmap, 0, 0, size, size); ... }
```

The GEOMETRY matches (`detector.js:633` `resizeBilinear(..., [256,256])`,
`PERSON_LETTERBOX` off). The RESAMPLING does not, and the comment says
"same geometry" while the code is relied on for "same pixels".
`tf.image.resizeBilinear` at a 1280 -> 256 downscale is a
**point-sampling bilinear**: it reads ~4 source texels per output texel
and discards ~96% of the frame, aliasing heavily. Canvas `drawImage` at
the same ratio goes through Skia, which for large downscales does
mipmapped / area-averaged filtering. Two different images,
deterministically. `detector.js:729-730` (BlazeFace) and `:633`
(MoveNet) are both fed the aliased one; native is fed the filtered one.

That is a real and unmeasured divergence and it is the best available
mechanism for J2's uncorrelated `maxKp` — MoveNet noise on a
detail-preserving downscale versus an aliased one is exactly the shape
of "r ~ 0".

**REFUTED as the cause of the gender divergence.** The gender crop is an
UPSCALE (a ~193 px face region -> 224), where half-pixel-centre versus
corner-aligned costs a sub-pixel shift and cannot produce cosine 0.83 on
a 1024-d descriptor. J1 explains that one, and J1's test discriminates
between them cleanly.

**Settles it (offline, no phone):** in a desktop page, take one 1280x720
frame; arm A = `drawImage` to 256 + `getImageData`, arm B =
`tf.browser.fromPixels` + `resizeBilinear` to 256 + `.data()`; report
per-channel max-abs and mean-abs difference, then run BOTH through the
SAME tfjs MoveNet and report `maxKp` for each. If arm A/B `maxKp` differ
by the observed ~0.05 with one model, the transport is exonerated and
the resize is convicted. Either way the comment at line 231 must be
corrected — it currently tells the next reader the two paths see the
same pixels.

---

## J6 — EXPOSURE — CONFIRMED

**Any page-world script can hand the player path its own inference
engine. The `lib.rs` guard is decorative because `adoptNativePort` never
consults it.**

`app/src-tauri/src/lib.rs:1562` guards the incoming message:

```
        if (e.source !== null || e.origin !== "") return;
```

That half is sound — a `window.postMessage` from page script carries a
non-null `source` and a real `origin`, so it is refused. It is also not
over-tight: the device runs show `__TS_NATIVE_PORT_SEEN 1` and `adopted`
set in all three port JSONs, so the legitimate androidx delivery passes.

But the guard protects a global that is then read with **no provenance
check at all**. `init-entry.js:583-586`:

```
  function adoptNativePort() {
    var port = null;
    try { port = window.__TS_NATIVE_PORT || null; } catch (e) { port = null; }
```

and `:625` `window.addEventListener('ts-native-port', adoptNativePort)`.
Our bundle runs in the PAGE world (it must, to touch YouTube's DOM), and
this repo already recorded that consequence in loop 37e: *"IDS.life
lives on `window` in the PAGE world, which YouTube's script shares, so
'only our code writes it' is not something the report may assume."*
Two lines of page script:

```
window.__TS_NATIVE_PORT = myChannel.port1;
window.dispatchEvent(new CustomEvent('ts-native-port'));
```

and `createNativeClient` is built on the attacker's port. They then own
the player path: reply `status 0` with a zero-length BlazeFace output
and `facesFromRows` returns `[]` on every frame, `maxKp` null, `persons
[]` — **nothing is ever covered, and every counter reads healthy**
(`nativeReady 1`, `nativeDead 0`, `nativePasses` climbing). That is
fail-OPEN, which the plan's own Global Constraints forbid in capitals.
They also receive every 256x256 video frame and every 224x224 face crop
as raw RGBA.

The `e.source` / `e.origin` route is forgeable too — `new
MessageEvent('message', {data:'ts-native-port', source:null, origin:'',
ports:[p]})` dispatched on `window` satisfies both conditions, because
`MessageEvent`'s init dict takes `source`, `origin` and `ports` — but
that is the harder path and is not needed.

Honest bounds: this requires hostile or compromised script in the page,
and none is known to do it. It is filed EXPOSURE and not NIT because the
failure mode is silent, total, and indistinguishable from healthy
operation in every instrument we have.

**Settles it / fixes it:** the stash must not park the port on a global.
Capture it in the stash's own closure and expose a **one-shot,
non-configurable** retrieval that deletes itself
(`Object.defineProperty(window, '__TS_TAKE_NATIVE_PORT', {value: fn,
configurable: false})`, `fn` nulling the closure on first call) so the
bundle's first read wins and a second caller gets nothing. Better still,
move the listener into the bundle so there is no handoff at all. Then a
test: a page script that sets `window.__TS_NATIVE_PORT` before the
bundle boots must NOT be adopted — red-prove it against today's code,
where it will be.

---

## J7 — DEFECT — CONFIRMED

**A cid minted on one engine can be handed to the other mid-pass, and
the comment that says this is safe is wrong.**

`init-entry.js:576-581`:

```
  // The engine the player path talks to. Callers hold no reference across
  // a pass boundary; a cid minted by one engine is released on whichever
  // is current, and a release the other engine does not know is swept by
  // its own TTL.
```

Two things in that paragraph are false.

1. Callers DO hold a cid across an await. `init-entry.js:2154-2171`:
   `vid().cropFaces(pixels).then(function (r) { ... vid().cropGender(r.cid, faces) ... vid().releaseCrop(r.cid) })`,
   and the same shape at `:2676-2696` (`zcid`). If the native client
   dies between the `cropFaces` reply and the `cropGender` call — which
   is precisely when it dies, since death is three consecutive request
   failures — `vid()` is now `gazeWorker` and `cropGender` runs against
   a cid the worker never minted. `worker-entry.js:333` answers
   `error: 'crop gone'`, the promise rejects, and the pass produces no
   verdict. Fail-closed, so not an exposure, but it costs a whole
   verdict on the exact pass where the engine changed — and the
   symmetric case (a worker cid handed to a native client that came
   ready mid-pass) is the same shape.

2. "swept by its own TTL" is false for the native client.
   `native-client.mjs:96` `sweepCrops()` is called from exactly one
   place — `cropFaces` (line 361). A dead client never receives another
   `cropFaces`, so its `crops` map is never swept again and every held
   full-resolution `ImageBitmap` (~3.7 MB at 1280x720) leaks for the
   life of the page. `die()` (`:110-124`) rejects pending requests and
   does not touch `crops`.

**Settles it:** a test in `test/native-wired.test.mjs`'s shape — mint a
cid on a stub native client, mark it dead, then assert (a) the caller
does not hand that cid to the worker (bind the engine once per pass into
a local, not `vid()` per call) and (b) `die()` closes every held bitmap.
Both red-prove trivially against today's code.

---

## J8 — DEFECT — CONFIRMED

**The main-thread spend budget takes its baseline from one engine and
its delta from another.**

`init-entry.js:3720`: `var waitBase = workerVideo() ? vid().waitMs() : null;`
`init-entry.js:4651`: `var waited = vid().waitMs() - waitBase;`

`waitMs()` is a per-client cumulative counter — `native-client.mjs:82`
`waitTotal` starts at 0 for the native client, while `gazeWorker`'s has
been accumulating since page load because the IMAGE path uses the worker
all along. If native dies between those two lines, `vid()` changes
identity and the subtraction crosses two unrelated counters. The `if
(waited > 0)` guard at `:4652` catches the negative direction (the pass
is then charged in full, including its native wait, throttling position
passes), but not the positive one: worker cumulative minus native
cumulative is typically a large positive, so `mine = max(0, cost -
waited)` = **0** and the pass is charged nothing. Budget corruption in
both directions, bounded to the pass on which the engine changed.

Same class as loop 29's "the budget was charging the main thread for
worker time", one engine later.

**Settles it:** capture the engine once at the top of the pass (`var eng
= vid();`) and read `eng.waitMs()` at both ends. Test: a stub whose
`waitMs` jumps when the engine swaps must not move `noteSpend`'s
argument.

---

## J9 — DEFECT — CONFIRMED, with its own evidence in the banked file

**`nativePasses` counts intent, not work, and the broken run proves the
counter cannot tell them apart.**

`init-entry.js:2238-2239`:

```
            if (nativeVideo()) nativeLife('nativePasses');
            return vid().videoFrame(bmp, aspect, heldPersons, withFaces, askPersons);
```

The bump happens before the request and is never reversed on failure. It
is also bumped only on the `videoFrame` path — `cropFaces`,
`cropGender`, `genderOnce` and `releaseCrop` all go through `vid()` with
no counter — so the name suggests "native inferences" and the number is
"player passes that intended to use native".

`spikes/gauntlet/native-port-1788344212.json` — the run where the port
callback dropped every frame — reads `"nativePasses": 2` alongside
`"nativeDead": 1` and `"dead": 14969`. **Two passes counted, zero
replies ever received.** A counter whose purpose is to prove the native
path is doing work read 2 on a run where it did none. That is the
loop-34 "absent is not never-hooked" failure in its opposite form: a
non-zero that means nothing.

Note also that Task 5's gate as written ("read `nativeFallback` /
`nativeFailed`, must be 0/0") names a counter — `nativeFallback` — that
Task 4 deliberately did not build. The gate cannot be evaluated as
worded.

**Settles it:** bump on the RESOLVED reply, inside `native-client.mjs`'s
own `noteSuccess()`, so the counter is a property of the transport
rather than of the caller's intent; add `nativeErrors` on
`noteFailure()`. The correct reading of `native-port-1788344212.json`'s
regime is then `nativePasses 0, nativeErrors >= 2`.

---

## J10 — EXPOSURE — CONFIRMED

**On one of the two "native live" device runs the fallback engine did
not exist for the entire run, and it is recorded as a one-off to
watch.**

`spikes/gauntlet/native-port-1788344790.json`, every sample (`early`,
`t0`, `t1`): `"workerBackend": null, "workerDead": true`. The Loop state
calls this "One-off to watch: on the first native run the WebGL worker
died at 3.0s (`loadFailed:gender`, fetch 204ms) while Kotlin was
compiling GPU kernels ... n=1".

n=1 out of 2. The comparison run (`native-port-1788344973.json`) has
`"workerBackend": "webgl", "workerDead": false`. So the observed rate of
"the fallback is gone while native is running" on this device is **1 of
2 runs**, and the plausible mechanism is stated in the note itself: the
model fetches raced the GPU delegate's kernel compilation for the same
device resources.

The architecture's entire safety argument is "if native is unavailable
for any reason the existing Worker path runs exactly as in 1092". In
that run it would not have. `banWorkerVideo` would have driven the page
to the IN-PAGE pipeline (`ensureFaceModels` / `ensurePersonModel`) —
loading a second 22.7 MB of tfjs models on a Snapdragon 662, mid-video,
while the TFLite engine holds its own models and GPU kernels (J11).
That path has never been exercised on this device.

`workerVideo()` (`init-entry.js:648-650`) returns **true whenever native
is live**, so from inside the page the worker's death is invisible to
every readiness check; only the probe's separate `workerBackend` read
caught it.

**Settles it:** two measurements before Task 8. (1) Run the native build
5x on the Redmi and report `workerDead` for each — if it is > 0/5, the
fallback is not a fallback, and either the worker's model fetch must be
sequenced after `native-ready` or native must not be enabled until the
worker has reported `webgl`. (2) Force the failure: with native live,
kill the native CLIENT (pushing `NATIVE_INFER: 0` is NOT this test — it
leaves a healthy worker) and confirm on the device that the page still
covers subjects, with the patch counts to show it.

---

## J11 — DEFECT — CONFIRMED

**The native round ADDS an engine; it does not replace one. Both model
sets are resident for the life of the page and the memory cost is
unmeasured.**

`vid()` (`init-entry.js:580`) routes only the PLAYER path. Every image
verdict still goes through `gazeWorker` (the image drain in
`init-entry.js`, `handleImage` in `worker-entry.js`), so the worker
still loads BlazeFace + faceres + nsfw into WebGL. `NativeInfer` holds
all three interpreters for the **process** lifetime (`init { handler.post
{ loadAll() } }`, `NativeInfer.kt:81-83`; `MainActivity.kt:855` reuses
one engine across pages and only `close()`s it at `:831`), plus the GPU
delegate's compiled kernels — GPU-REPORT.md records init 1.4-3.9 s per
model, which is that compilation, and those kernels stay resident.

So the Redmi now carries the tfjs models in the WebView's WebGL context,
the TFLite models plus delegate in the app process, and — if the worker
dies (J10) — potentially a third in-page copy. The plan's Task 2 Step 4
records only the APK delta ("+10-15MB"), which is disk. **No RSS number
exists anywhere in `spikes/native/`.**

**Settles it:** `adb shell dumpsys meminfo app.tamescroll.client` on a
watch page, three samples, on 1092 and on the native build; report
`TOTAL PSS` and `Graphics`. The Redmi is the device this whole plan
exists for, and an OOM-kill there is worse than a slow verdict.

---

## J12 — NIT — REFUTED (Kotlin thread safety), with one thing to keep

The parent asked whether `port`, `bindGen` and `deadForThisPage` are
unsafe as non-`@Volatile` fields, and whether a reply can land on a port
replaced between request and reply. **Both refuted, and the reason is
worth writing down so it is not re-derived.**

Every mutation and every read of those three fields happens on the
single `ts-infer` `HandlerThread`. `bind()` is called on the UI thread
but its whole body is inside `handler.post { ... }`
(`NativeInfer.kt:91`); `loadAll()` is `handler.post`ed from `init`
(`:82`); `onMessage` is delivered with
`newPort.setWebMessageCallback(handler, ...)` (`:106`), i.e. onto the
same looper. `handleFrame` runs `fillInput` -> `run(model)` ->
`reply(...)` synchronously in one Runnable (`:220-228`), so a `bind()`
Runnable cannot interleave between a request and its reply. The
`gen == bindGen` check (`:107`, da197d2) correctly drops inbound
messages from a superseded port. `closed` IS `@Volatile` and is the only
field touched off-thread.

The `postFailed`-once concern is also refuted: `deadForThisPage` is
reset and every model's `consecutiveErrors` zeroed in `bind()`
(`:95-96`), so the next page gets a fresh engine. The `buf.size < 16 +
w*h*4` check (`:218`) is sound — it is computed in `Long` so it cannot
overflow, a short buffer is answered with status 1 rather than dropped,
and `w`/`h` are separately pinned to `model.inputW/H`, so a hostile or
corrupt header cannot reach `fillInput`.

Keep this row for one reason: the safety is entirely a consequence of
"one handler thread, `run()` synchronous". A future change that makes
inference async (a second interpreter thread, a batching queue) breaks
it silently, and a reply would then be able to cross a `bind()` and land
on the next page's port. A comment at `reply()` saying so, plus a test
that `bind` and the message callback are never posted to different
handlers, is cheap insurance.

---

## J13 — NIT — REFUTED (the OTA ship-1 is inert on 1092)

`rules/tuning.json:18` ships `"NATIVE_INFER": 1`. On a 1092 phone
`app/gaze/src/tuning.mjs:324-325` reads

```
    var spec = SPEC[key];
    if (!spec) { TUNE_REFUSED++; continue; }
```

and 1092's compiled `SPEC` has no `NATIVE_INFER` entry, so the key is
refused and counted, exactly as the loop-46 note claims. Nothing on a
1092 phone changes. Confirmed by reading the refusal path, not asserted.

Two things to keep an eye on rather than fix. The refusal is silent by
design (`TUNE_REFUSED` is a counter, not a log), so an OTA landing
`NATIVE_INFER` on a mixed fleet is invisible per device except through
that counter. And `NATIVE_INFER` is the ONLY kill switch: it is read at
`nativeVideo()` (`init-entry.js:572`) on every call, so pushing 0 does
take effect mid-page — which is the right shape, and is also the reason
J10's fallback test must kill the client rather than flip this key.

---

## J14 — DEFECT — CONFIRMED

**The parity probe's own limits, stated plainly, because the run is
being used as a gate.**

Sound, and explicitly REFUTED as concerns:

- **Index pairing.** `probe_native_parity.py`'s `ONE_JS` passes the SAME
  `boxes` array to both `n.cropGender` and `w.cropGender`, and both
  clients map boxes to reads in order (`native-client.mjs:397`
  `boxes.map`, `detector.js:800` loop over `boxes`). Pairing by index is
  correct here.
- **Four `createImageBitmap` calls of a paused video.** `wait_frame`
  asserts `!seeking && readyState >= 2 && |t - target| < 1.5` and the
  video is paused; four bitmaps of one paused frame are the same pixels.

Not sound, and each of these caps what the run can conclude:

- **n = 16 frames, 24 reads, one video** (`"video": "NWoT1ZVd1Lo"`),
  against a precedent — the 2026-08-31 uint8 requant refusal — that used
  **100 crops from 20 distinct images**. A 0-flip gate on 24 reads has a
  95% upper bound near a 12% flip rate even when it passes.
- **`boxesFrom` is decided per frame** (`'worker'` when the worker found
  any face, else `'native'`), so the gender comparison can silently
  change which engine's detector is upstream. In this file it is
  `'worker'` throughout, but the mirror of `t=90` — worker finds 0,
  native finds 1 — would compare a different pipeline with no flag in
  the summary.
- **Face COUNT differs on 2 of 16 frames** (`faceCountMismatchFrames:
  2` — `t=90` native 0 / worker 1, `t=360` native 3 / worker 2) and
  those unmatched faces are simply dropped from `faceIou` (n = 23 for
  what should be >= 24 pairs). The headline "faces IoU p50 0.93" is
  computed over the faces that matched; a face one engine does not see
  at all is the failure that matters most and it is not in the number.
- **Paused frames only.** `videoFrame`'s real input is a bitmap of a
  PLAYING video; nothing here exercises that timing.

**Settles it:** >= 100 reads across >= 5 videos including at least one
where MoveNet admits persons (J3); pin `boxesFrom` to one engine for the
whole run and report the other's detector separately; report unmatched
faces as a first-class row rather than as a shrunk denominator.

---

## J15 — WRONG-NUMBER — CONFIRMED, and it reverses J5's mechanism

**Read from `spikes/gauntlet/native-pixels-1788345747.json`, which
appeared in the working tree during this review (an in-flight run, tree
modified: `native-client.mjs`, `NativeInfer.kt`). Recorded because it
settles two of the three hypotheses outright.**

At `t=60`, 1280x720:

- `A_vs_webgl`: `"mad": [0, 0, 0]`, `"max": 0`. The canvas full-resolution
  `getImageData` and `tf.browser.fromPixels` of the same ImageBitmap are
  **byte-identical**. **Hypothesis (b) — colour/range conversion differs
  between canvas 2D and WebGL `fromPixels` — is REFUTED with a measured
  zero, not an argument.**
- `squash_canvas_vs_tfBilinear`: `"mad": [5.22, 4.97, 5.20]`, `"max":
  217`. The 1280 -> 256 downscale differs by ~5 levels on average and by
  **217 of 255** on the worst pixel. J5 is confirmed and is large.
- The `recipes` block identifies the mechanism exactly. `smoothHigh`
  (mipmap / high-quality filtering) only moves it 5.22 -> 4.82.
  **`lowShifted` reads `[0.04, 0.04, 0.04]`** — applying a half-pixel
  offset with ordinary `'low'` smoothing collapses the difference by
  **130x**. `nearestShifted` (0.68) beats every unshifted recipe too.

So J5's "Skia mipmap versus point-sampling bilinear" story is the WRONG
mechanism. The divergence is almost entirely the **half-pixel centre
convention**: `tf.image.resizeBilinear` is corner-aligned and canvas
`drawImage` samples at pixel centres. That matters because it is a
one-line fix with a measured target (mad 0.04, i.e. rounding), not an
architectural mismatch. `fullResGetImageDataMs 45.8` versus
`jsTfResizeMs 15.7` is also worth banking — the readback the Loop state
flagged as the real frame cost is confirmed as the expensive half.

**Settles it:** adopt the `lowShifted` recipe in
`native-client.mjs:233` `drawTo` and re-run `probe_native_pixels.py`;
the gate is mad <= 0.1 per channel and max <= 2 against the tfjs arm.
Then re-run parity. Until that lands, J2's "the two engines read
uncorrelated noise" has a fully identified cause and is not evidence
about either model.

---

## J16 — EXPOSURE — CONFIRMED (and it may reverse a standing finding)

**A second parity run in the same working tree shows native MoveNet
admitting people on 11 of 16 frames where the WebGL worker admits
NOBODY on all 16 — and the summary line records that as native being
wrong.**

`spikes/gauntlet/native-parity-1788345674.json`
(`native.ready` 2970 vs the earlier run's 1494 — a different build):

| t | native maxKp / persons | worker maxKp / persons |
|---|---|---|
| 30 | 0.723 / **2** | 0.202 / 0 |
| 150 | 0.841 / **2** | 0.044 / 0 |
| 217 | 0.822 / **2** | 0.033 / 0 |
| 240 | 0.844 / **2** | 0.032 / 0 |
| 420 | 0.828 / **2** | 0.063 / 0 |
| 600 | 0.805 / **2** | 0.052 / 0 |

`summary.personCountMismatchFrames: 12` (was 0), `maxKpAbsDiff.p50
0.581 / max 0.812` (was 0.056 / 0.182), `personIou.n: 0` — because the
worker never produces a box to match against.

The natural reading of a parity table is "native regressed". The data
does not support that reading. Native's `maxKp` sits at 0.72-0.84 on
frames with two visible people, which is the range CLAUDE.md records for
a real close-up (0.14-0.76) and far above `PFF_FRAME_KP_FLOOR 0.1`; the
worker sits at 0.03-0.20 and admits nobody, which is the R21 /
findings-36 regime this repo has attributed to the DEVICE for six loops
("all twelve slots n:0", "100% of his phone"). Combined with J15 — the
worker's MoveNet input differs from an aligned resize by up to 217
levels on a 5x downscale — the live hypothesis is that **the R21
"MoveNet admits nobody" regime is substantially an artifact of the
WebGL path's misaligned resize, and the native path is not diverging
from the worker so much as not reproducing its defect.**

Why EXPOSURE: if that is right, then the entire person path
(`clampBodies`, `personsLive()`, the `mnBody` extent source, the
`CUT_PERSON_LOOK` ruling, findings 21/21a/23, the `PERSON_LETTERBOX`
refusal) has been calibrated and priced in a regime the phone was never
truly in, and `frameHasNoHumanShape` — which refuses faces — has been
firing on a blinded model. It also means the current parity gate, if
enforced as written, would **block the fix by requiring native to
reproduce the blindness**. That is the same trap as J1, one model over.

**Settles it, and this is the highest-value measurement in the round:**
(1) Re-run `probe_native_pixels.py`'s `lowShifted` arm through the tfjs
MoveNet in page and report `maxKp` for the aligned and misaligned
resizes of the same frame — if aligned tfjs MoveNet also reads 0.7-0.8
where misaligned reads 0.05, the worker's blindness is the resize and
J16 is proved without the native engine being involved at all. (2) If it
is, re-open findings 36 and the `movenet-held` selection (phase-G item
4) before any of findings 21/21a/23's numbers are quoted again.
(3) Whatever the answer, the two parity runs disagree with each other by
an order of magnitude on `maxKpAbsDiff` with no recorded diff between
them — **bank the bundle hash and the Kotlin sha with every parity run**,
because `"bundle": "62a603d-dirty"` is the same string in both and it
identifies nothing.

---

## What blocks what

- **J1 blocks Task 5 and Task 8.** Every gender parity number in the
  banked file is measuring a crop-geometry difference. Fix
  `worker-entry.js:336/351`, re-run, then decide.
- **J6 blocks Task 8.** A silent fail-open reachable from page script is
  the one failure mode the plan's constraints name in capitals.
- **J10 blocks Task 8.** The fallback was absent on 1 of 2 device runs.
- **J3 + J14 together mean there is currently no parity evidence for
  MoveNet, and none for any regime with an admitted person.**
- **J16 blocks Task 5, Task 8, and any further quoting of findings
  21/21a/23.** Two parity runs on the same nominal bundle disagree by an
  order of magnitude, and the more recent one says the WebGL arm — not
  the native one — is the blind engine.
- **J15 supersedes J5's mechanism** and gives the resize fix a measured
  target (mad 0.04). Land it before re-running parity, or every parity
  number is measuring the resize.
- J2, J4, J9 are numbers to correct in place before anything is built on
  them. J2 in particular is fully explained by J15 and should not be
  quoted as a model-parity result.
- J7, J8, J11 are defects to fix at source; none blocks alone.
- J12, J13 are REFUTED and recorded so they are not re-attacked.
  Hypothesis (b) (colour/range conversion) is REFUTED by measurement in
  J15. Hypothesis (c) ("the descriptor is simply that sensitive") is
  REFUTED: J1 names a concrete geometric cause and J4 shows the worst
  cosines are null reads.

**Suggested order of work:** J15's resize fix, then J1's `{square:true}`
fix, then re-run pixels + parity with the bundle hash banked (J16.3),
then J6, then J10's 5-run fallback check. Nothing about Task 5's A/B is
interpretable before the first two land.

**The parity gate this round should carry**, replacing Task 3's: over
>= 100 reads on >= 5 videos, with both engines fed the SAME crop
geometry — 0 decision changes at `GENDER_CLEAR_SCORE 0.45`,
`GENDER_MIN_SCORE 0.25` and `GENDER_IMAGE_MIN_SCORE 0.4`; the same
fraction of reads under `NULL_MINT_NM_FLOOR 5` in both engines;
`PFF_FRAME_KP_FLOOR 0.1` crossed on <= 2% of frames in EITHER direction
over frames where MoveNet admits persons; and, native-only, the
same-subject / different-subject descriptor cosine separation around
`MEM_SIM_CLEAR 0.60` matching what the tfjs arm shows on the same crops.
