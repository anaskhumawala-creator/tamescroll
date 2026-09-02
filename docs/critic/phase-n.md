# Phase N critic — the performance batch (1098): twelve dials, one of which is on

Subject: `git diff checkpoint-1097..HEAD`, which is **six commits, not the four the
brief named** — `601a93f` ("NPU trials run after ready on their own thread; 1098 smoke
found the arbiter killing the client") landed after `7bc6cd2` while this run was
reading. Everything below is against **HEAD = 601a93f**, re-read after that was
noticed; where an earlier form of a claim only held against `bcd5cc5` it is not
filed.

Everything was **RUN**, not argued: `cd app/gaze && npm test` → **784/784**;
`cd app/src-tauri && cargo test` → **61/61**; `node scripts/gen-rules-manifest.mjs`
→ no diff (the manifest is regenerated and matches); the three new diagnostics
blocks driven through the real `buildReport`/`reportViolations` on three snapshots;
and every constant checked in the **emitted bundle**, which is where the first
finding lives.

**A 1098b device smoke landed on disk while this was being written** —
`spikes/gauntlet/{drops,diag}-v1098b-{control,render2,blurframe,noav1,cpumask1}.json`,
five 120s arms on the Redmi, `bundle: "601a93f-dirty"`. It was not mine and I did
not run it. Three rows below are upgraded from reasoned to **measured** on it, and
**one of my own numbers was wrong and is corrected in place** (N5's rAF figure).

Thirteen rows, most severe first. Two claims were withdrawn rather than hedged and
are recorded in SURVIVES.

---

## N1 — EXPOSURE — the NNAPI arbiter checks ONE of faceres' three output heads, on an all-zero input, at 10% tolerance, and it ships ENABLED

`NativeInfer.kt`, `outputsAgree`:

```kotlin
private fun outputsAgree(a: LoadedModel, b: LoadedModel): Boolean {
  if (a.outputBuffers.isEmpty() || b.outputBuffers.isEmpty()) return false
  val fa = a.outputBuffers[0]. ... ; val fb = b.outputBuffers[0]. ...
  ...
  return maxDiff <= 0.1f * (maxRef + 1e-3f)
}
```

Index `[0]`. Only. `native-client.mjs:367` names what the other indices are:

> `// faceres' 3 outputs (gender [N,1], age [N,100], descriptor [N,1024])`

So for faceres **two of three heads are never compared**, and for BlazeFace one of
two. Those two heads are not decoration:

- the **age head** is the child gate — `isAdultRead` / `GENDER_CHILD_MASS`, the
  branch that decides whether a child carrying no signal gets a patch (loop 37b);
- the **1024-d descriptor** is the identity memory (`MEM_SIM_CLEAR` 0.60) *and*
  `nm`, whose floor `NULL_MINT_NM_FLOOR` 5 decides whether an observation may
  **mint a track at all**. A driver that shifts descriptor magnitude down pushes
  real reads under the floor, `nullMint` refuses the birth, and a real face gets
  no patch. That is loop 38's own mechanism, running in the exposure direction,
  behind a gate that cannot see it.

The input is degenerate. `buildModel` allocates `inputBuffer` with
`ByteBuffer.allocateDirect` (zero-filled), and `decideNpu` explicitly re-zeroes the
live model's buffer before the comparison:

```kotlin
val ib = candidate.inputBuffer
ib.clear()
while (ib.hasRemaining()) ib.put(0)
```

A black frame is the one input on which BlazeFace finds nothing, MoveNet admits
nobody, and faceres' heads sit on their priors. Every gate in this repo —
`PFF_FRAME_KP_FLOOR`, the person score floor, the clear bar, the nm floor — was
calibrated on real crops precisely because that is where the models differ.

**And the tolerance admits differences this repo has already refused.**
`maxDiff <= 0.1 * (maxRef + 1e-3)`. On a zero input faceres' gender sigmoid sits
near its prior, so `maxRef ≈ 0.5` and an absolute sigmoid difference of **0.05**
passes. Loop 34 killed the faceres uint8 requant on a *measured* p50 0.0234 /
max 0.1042 — 17/100 decision flips at `GENDER_MIN_SCORE`, 8/100 at
`GENDER_IMAGE_MIN_SCORE`, 11 crossings of the isNullRead band, descriptor cosine
**min 0.5962 against MEM_SIM_CLEAR 0.60** — with the summary "alive is not
correct". The arbiter's gate is **looser than the thing that was refused**, on
**one head instead of three**, on **one degenerate input instead of 100 real
crops** — and, unlike the requant, it is **on by default**: `rules/tuning.json`
ships `"NATIVE_NPU": 1`, and `NativeInfer.kt` defaults `flags = 1`, so
`scheduleNpuTrials()` runs from `loadAll` on every phone at every load with
nothing pushed.

**And the gate has never been exercised in the direction that matters.** All five
1098b arms read `"npu": "failed"` — the Helio G85 has no APU, so NNAPI loses the
clock and the arm is closed, exactly as the handoff predicted. That confirms the
arm fails safe on a device with no accelerator; it also means **nobody has ever
seen `npu: "ok"`**, so `outputsAgree` has never once returned true on hardware.
The weakest link in the batch is the one link no run has exercised — a gate nobody
has seen pass is a claim, which is this repo's own standard.

**Smallest remedy:** ship `"NATIVE_NPU": 0` in `rules/tuning.json` (one number,
travels OTA, no install) until the arm is priced the way this repo already prices
a new numeric backend for faceres — `spikes/gauntlet/probe_faceres_parity.py`
plus `app/gaze/bench/` on real thumbnails, all three heads. If he wants it on
before that, the second-smallest is two lines in `outputsAgree`: loop
`0 until minOf(a.outputBuffers.size, b.outputBuffers.size)`, and run the
comparison on a captured crop rather than zeros.

---

## N2 — WRONG-NUMBER — "all twelve dials ship inert / at today's behaviour" is false; `NATIVE_NPU` ships 1 and starts new work on every phone

The claim is in three places at once — `CLAUDE.md`'s handoff ("11 inert OTA
dials", "all at today's value"), the plan, and `tuning.mjs`'s own
`// PERFORMANCE BATCH (2026-09-03), all shipped inert. ... none moves a verdict,
a bar or a coast.` `rules/tuning.json` disagrees two lines down:
`"NATIVE_NPU": 1`.

It is not a paper difference. At `NATIVE_NPU` 1 (engine default `flags = 1`),
every load now:

- builds a **second Interpreter per model** with an `NnApiDelegate` on a new
  `ts-npu-trial` HandlerThread;
- runs `bestRunMs(nn, 3)` on it — and `bestRunMs` is **one warm run plus three
  timed**, i.e. 4;
- then, on `ts-infer`, runs `bestRunMs(candidate, 3)` — **4 more inferences of
  the live model**, serialised with the page's own requests.

1097 ran **one** warm inference per model and built one interpreter. So the
per-model cost of the shipped default is **+1 interpreter build and +7 model
runs**, not the handoff's "~3 extra timed runs per model at load".

**Measured:** all five 1098b arms report `"npu": "failed"` — not `"disabled"`,
which is what `NATIVE_NPU` 0 would give. The trial ran, on every arm, on a phone
that cannot win it, with nothing pushed. That is the dial being on, on the device,
three times over.

**Smallest remedy:** say it plainly — eleven inert, one on — and correct the run
count; or ship 0, which N1 asks for anyway and would make the sentence true.

---

## N3 — DEFECT (release-blocking) — the emitted bundle committed at HEAD is 1097's, and the version was bumped to 1098 without it

```
$ git show HEAD:app/src-tauri/gaze-page.js | grep -o '__TS_GAZE_BUNDLE__="[^"]*"'
__TS_GAZE_BUNDLE__="48b7c0d"          <- the 1097 release bundle (commit 06d9ea2)

$ for k in RENDER_EVERY BLUR_IN_FRAME PRESENTER_GL NO_AV1 TsPerf rafSkipped native-backends; do
    git show HEAD:app/src-tauri/gaze-page.js | grep -c "$k"; done
0 0 0 0 0 0 0
```

Zero occurrences of the entire batch. Meanwhile `7bc6cd2` bumped
`app/src-tauri/tauri.conf.json` and `app/src-tauri/src/appupdate.rs` to **1098**.

`gaze-page.js` is `include_str!`d into `lib.rs` (CLAUDE.md loop 23: *"a bundle
change needs the RUST rebuild... `gradlew :app:assemble...` alone ships the
PREVIOUS bundle"*). So an APK built from a **clean checkout of HEAD** ships the
1097 page stamped `versionCode 1098`: `applyTuning` would refuse all twelve new
keys (`TUNE_REFUSED` 12), none of `perf.mjs`, `codec-probe.mjs`,
`gl-presenter.mjs`, the painter path or the CONFIG request would exist, and the
About report would say 1098.

The working tree carries a rebuilt bundle (uncommitted, `M app/src-tauri/gaze-page.js`,
marker `7bc6cd2`, +21,285 bytes) and **that one does read the constants at their
call sites**, checked R15-style rather than by presence:

```
function C2(t){var e=kp.get(t);if(e){if(yt.raf++,e.frameNo=(e.frameNo||0)+1,T2>1&&e.frameNo%T2!==0){yt.rafSkipped++,e.raf=requestAnimationFrame(...);return}...
function Xye(t){return pZ!==1?null:Wb.get(t.video)||null}          // painterFor: BLUR_IN_FRAME read
...t.paintList.push({x:(u.left-c)/e.width,...,br:xZ(u,gZ())/e.width,rr:Sg.radiusPx/e.width})...
```

`T2` = RENDER_EVERY, `pZ` = BLUR_IN_FRAME, both **read**, not merely emitted.
Note the working bundle's marker is `7bc6cd2`, one commit behind HEAD, though its
content does contain `native-backends` — so the marker is not a reliable stamp of
what was built either.

**And the 1098b smoke confirms which bundle is real:** every arm stamps
`"bundle": "601a93f-dirty"` — the *dirty working tree*, not the committed tree.
Every number in those five files describes a bundle that does not exist in git.

**Smallest remedy:** `node app/gaze/build/build.js` at HEAD, commit the bundle,
and assert `__TS_GAZE_BUNDLE__` equals HEAD before any 1098 artifact is produced.
Until then no release-time check in this repo — including "verify every new
constant in the EMITTED bundle" in the handoff's own step 3 — can be run against
the committed tree.

---

## N4 — EXPOSURE (latent, at `BLUR_IN_FRAME` 1) — `canPaint()` tests only that `ctx.filter` EXISTS; a context that accepts the assignment and ignores it draws every patch region SHARP with the divs hidden

`delay-presenter.mjs`:

```js
function canPaint() {
  try { return !!ctx && 'filter' in ctx; } catch (e) { return false; }
}
```

`'filter' in ctx` is a prototype-property probe. It cannot tell a context that
applies the filter from one that accepts the string and drops it. And when the
filter is a no-op, `drawPatches` is an **identity copy**:

```js
ctx.filter = 'blur(' + b + 'px)';
ctx.drawImage(bitmap, x - pad, y - pad, w + 2*pad, h + 2*pad,
                      x - pad, y - pad, w + 2*pad, h + 2*pad);
```

— same source rect, same destination rect, same bitmap that was just drawn. It
redraws the subject's own pixels over the subject.

Nothing else covers, because the paint branch in `video-region.mjs`
`renderTrackOverlay` hides the div **unconditionally** on the same path:

```js
if (entry.paintList) {
  entry.paintList.push({ ... });
  if (entry.overlays[index].__tsDisp !== 0) { ... style.display = 'none'; __tsDisp = 0; }
  return;
}
```

And it is invisible from outside: `stats.patchesDrawn` counts *draws*, not blur,
and presenter stats never reach `buildReport` at all (`grep -n "presenter\|delay"
app/gaze/src/diag-report.mjs` → nothing) — they live only on the
`window.__TS_DELAY_STATS` probe hook. The one artifact he can send would look
perfect.

The GL presenter is weaker still: `gl-presenter.mjs` `canPaint()` is
`return !detached;` — **no capability test of any kind**, and there is no
`gl.checkFramebufferStatus` call anywhere in the file.

`presenter-paint.test.mjs` pins the weak version by name
(`test('canPaint is true when the 2D context has a filter property')`), so the
test moves with the fix.

**Smallest remedy**, one write, once, at attach:

```js
function canPaint() {
  try {
    if (!ctx || !('filter' in ctx)) return false;
    var save = ctx.filter;
    ctx.filter = 'blur(1px)';
    var ok = ctx.filter !== 'none' && ctx.filter !== '';
    ctx.filter = save;
    return ok;
  } catch (e) { return false; }
}
```

---

## N5 — WRONG-NUMBER — `RENDER_EVERY`'s ceiling of 4 is justified by an unmeasured assertion, and the lag it quotes is understated by 2-3x

`tuning.mjs`:

> `// 1 = every frame, as every release so far; 4 = ~13Hz, the most a patch may`
> `// lag the picture before the pad stops covering the trail.`

`video-region.mjs`, above `setRenderEvery`:

> `// at 2 it does that 25-30 times and a moving subject's patch trails the`
> `// picture by one extra presented frame (~16-33ms, one to two pixels at`
> `// ordinary motion, inside the pad).`

Three things are wrong with that as the justification for a *range edge* in a file
whose stated rule is that every edge is a protection decision with its reason
beside it.

1. **The unit is rAF frames, not presented frames.** The skip is on the rAF loop
   (`loop(video)`), so the gap between repositions is `(RENDER_EVERY - 1)` rAF
   periods. The 1098b arms measure **rafHz 49.2-50.5** on the Redmi (older runs
   with the presenter attached read 34-44Hz). At RENDER_EVERY 4 that is
   **~61ms** at 49.5Hz and up to ~100ms at the older rates — 2-3 presented frames
   at 30fps, not "one extra presented frame". *(I first wrote 68-100ms off the
   older CLAUDE.md tables; the batch's own smoke says 49-50Hz, so the low end is
   61ms. Corrected here rather than left standing — direction and conclusion
   unchanged.)*
2. **The pad it is claimed to sit inside is a few pixels.** `PTRACK_PAD` 0.04 /
   `PTRACK_PAD_TOP` 0.06 plus `PATCH_MARGIN` 0.045. On a 120px-wide face box that
   is roughly 5px on the side. A head crossing frame at a modest 160 px/s moves
   ~13px in 80ms.
3. **Nothing in this batch measured 4, and 2 bought nothing.** The only planted
   arm is `plant-render2.js` (RENDER_EVERY **2**); there is no RENDER_EVERY 4 arm
   on the corpus or the device. And the 2 arm, measured:

   | arm | dropPct |
   |---|---|
   | control | 13.71 |
   | **render2 (RENDER_EVERY 2)** | **14.51** |
   | noav1 | 14.75 |
   | cpumask1 | 12.24 |
   | blurframe | 10.96 |

   RENDER_EVERY 2 is **+0.80 points against control** — the wrong direction, and
   inside the run-to-run spread this repo has already banked between nominally
   similar arms (13.24 vs 12.40 on the 1097 solid-patch pair, 0.84 points). So the
   research doc's #4-ranked lever measures as *indistinguishable from noise at 2*,
   while its range reaches 4 on a sentence nobody has tested. (Two arms did move:
   `BLUR_IN_FRAME` -2.75 and `NATIVE_CPU_MASK` -1.47, both n=1.)

**Smallest remedy:** clamp the ceiling to 2 (the only value with an arm), or
replace the sentence with "UNMEASURED above 2" so the next round does not push 4
on the strength of a guess written as a bound.

---

## N6 — DEFECT — `renderStats.raf` now counts frames the renderer did not render, and the A/B arm this batch ships is the one that reads it

`video-region.mjs` `loop`:

```js
renderStats.raf++;
entry.frameNo = (entry.frameNo || 0) + 1;
if (RENDER_EVERY > 1 && entry.frameNo % RENDER_EVERY !== 0) {
  renderStats.rafSkipped++;
  entry.raf = requestAnimationFrame(...); return;
}
```

`raf` is the number phase-M's loop-death fix was verified on, the "raf/3min"
column in CLAUDE.md's own tables, and the liveness signal `stale_target.py` and
`probe_drops_ab.py` read.

**MEASURED, on the 1098b arms, and it is exactly the predicted failure:**

| arm | rafHz reported |
|---|---|
| control | **49.9** |
| render2 (RENDER_EVERY 2) | **49.4** |

Half the render work, and the instrument reports a 1% difference. If `raf` meant
"frames the renderer rendered", render2 would read ~25Hz. `rafSkipped` is emitted
and would close the gap, but `probe_drops_ab.py` does not subtract it and the
banked arm above proves nobody did.

**Smallest remedy:** bump `raf` *after* the skip and keep `rafSkipped` as the
total, or one line in the counter's comment naming the subtraction.

---

## N7 — DEFECT — for two of the twelve new dials the "code agrees with tuning.json" check cannot fail

`tuning.test.mjs`'s `SHIPPED` map reads the live module constant for every new
dial except two:

```js
RENDER_EVERY: 1,                              // literal
SUSTAINED_PERF: perf.SUSTAINED_PERF,
...
BLUR_IN_FRAME: 0,                             // literal
PRESENTER_GL: glPresenter.PRESENTER_GL,
```

They are literals because `video-region.mjs` exports only the setters —
`grep -n "export" app/gaze/src/video-region.mjs | grep -i "RENDER_EVERY\|BLUR_IN"`
returns exactly one line, `export function setRenderEvery(n)`. So the "shipped
tuning.json equals the shipped constants exactly" assertion compares `1` against
`rules/tuning.json`'s `1` — a hand-written number against a hand-written number.
The companion guard (every tunable name must appear in SHIPPED) is satisfied and
measures nothing for these two.

This is the class `tuning.mjs`'s own header exists to stop —

> *"A CONSTANT CHANGED IN SOURCE AND NOT IN THAT FILE WOULD SILENTLY REVERT ON
> EVERY DEVICE THE MOMENT THE OTA LANDED — that test is the only thing standing
> between here and that"*

— and the class phase-G named: an instrument that re-derives the rule it is
checking is a check that cannot fail.

**Red-proof, by construction, no edit to the tree:** the test file contains no
reference to `video-region`'s `RENDER_EVERY`. Change the module default and all
784 tests still pass:

```js
// app/gaze/src/video-region.mjs
- var RENDER_EVERY = 1;
+ var RENDER_EVERY = 2;
// cd app/gaze && npm test  ->  784/784, green
// A phone with no rules cache now repositions every other frame, forever,
// and rules/tuning.json still says 1.
```

**Smallest remedy:** `export var RENDER_EVERY` and `export var BLUR_IN_FRAME` from
`video-region.mjs`, read them in `SHIPPED`, as every other new entry does.

---

## N8 — DEFECT — `PerfBridge` is a `@JavascriptInterface` on the WebView that loads YouTube, and it is installed whatever the dials say

`MainActivity.kt`, in `onWebViewCreate`, unconditional:

```kotlin
webView.addJavascriptInterface(PerfBridge(), "TsPerf")
```

Our bundle runs in the page's own JS world (CLAUDE.md hard rules: *"it runs inside
YouTube's page"*), so `window.TsPerf` is reachable by every script on
m.youtube.com, reddit, x, instagram and facebook. The dials shipping inert does
not make the bridge inert — `perf.mjs`'s `bridge()` just reads `window.TsPerf`,
and so can anything else.

The comment beside the registration argues the surface is harmless:

> `// Perf dials (PerfBridge): every dial ships inert on the OTA`
> `// channel, so this interface being reachable from a remote platform`
> `// page can at most toggle a throttle/hint back to Android's own`
> `// default -- never anything destructive.`

That is not what the methods allow:

- `TsPerf.inferPriority(2)` → `Process.setThreadPriority(tid, THREAD_PRIORITY_BACKGROUND)`
  on `ts-infer`. Background priority moves a thread into the background cpuset on
  most Android devices (little cores only). A slower verdict is a wider gap, a
  wider coast and more exposure — chosen by the page.
- `TsPerf.refreshCap(48)` changes the **user's display mode** for the window.
- `TsPerf.sustained(true)` caps the SoC's clocks.

The same file already knows how to reason about this: `DiagBridge` carries an
explicit *"a hostile page cannot turn it into anything but a wasted disk write"*
argument, and the native port is one-shot — the page's copy is taken through a
non-configurable `__TS_TAKE_NATIVE_PORT` getter precisely so a script cannot grab
it.

**Smallest remedy:** the pattern that already exists in the same file. Have the
document-start script take a token, and make every `PerfBridge` method's first
argument that token; a call without it returns.

---

## N9 — DEFECT — `decideNpu` blocks `ts-infer` for four inferences of the live model per model, and the page kills the native client after three 4s timeouts

`native-client.mjs:40` `DEFAULT_REQUEST_TIMEOUT_MS = 4000`; a timeout calls
`noteFailure()`, and **three consecutive failures call `die()`**, which takes the
player off the native engine for the page and back onto the WebGL worker — verdict
p50 922ms instead of 355ms (the 1092 regime).

`decideNpu` runs on the ts-infer handler and does:

```kotlin
val candMs = bestRunMs(candidate, 3)     // 1 warm + 3 timed = 4 runs of the LIVE model
```

At MoveNet's measured ~350ms that is ~1.4s of blocked handler, once per model,
while the `ts-npu-trial` thread is concurrently running NNAPI inferences for the
same accelerator. `handleConfig` can be worse: it rebuilds on the same handler,
and a rebuild is a full `loadModel` per changed model.

This is **not hypothetical** — commit `601a93f`'s own message is *"1098 smoke found
the arbiter killing the client"*. The fix moved the trial off `ts-infer` and gave
`handleConfig` a real mitigation (it now only rebuilds models whose mask bit
actually changed). What is left on `ts-infer` is the four live-model runs.

**Smallest remedy:** one timed run of the candidate instead of `bestRunMs(...,3)`,
or build a second candidate interpreter on the trial thread and time it there, so
`ts-infer` is never blocked by a measurement.

---

## N10 — NIT — the two dials with the largest visual risk report nothing in the artifact he can send

The report gained `codec`, `native` and `perf` blocks. It gained nothing about
painting: `repaints`, `patchesDrawn`, `blurLevel`, `gl`, `lost` and the presenter
`errors` live only on `window.__TS_DELAY_STATS`, and `buildReport` has no
delay/presenter block at all. After pushing `BLUR_IN_FRAME` or `PRESENTER_GL` the
only evidence available without adb is his eyes — on the two dials that change
what a patch looks like.

Cheap: a `paint: { repaints, patchesDrawn, gl }` block beside `perf`, all numeric,
which the invariant already accepts (proved in SURVIVES).

---

## N11 — NIT — the codec probe is the only page mutation in the batch with no kill switch

`init-entry.js`, unconditional, on all five platforms:

```js
codecProbe.install(window);
```

It permanently replaces `MediaSource.prototype.addSourceBuffer` and
`SourceBuffer.prototype.changeType` with wrappers. It is read-only and calls
through, and the risk is genuinely low — but every other item in this batch is
behind an OTA dial *precisely* so a bad one is one push away from off, and this is
the one that touches the player's own API surface. If it ever breaks playback the
only remedy is a 56MB install.

---

## N12 — NIT — nothing in this batch has ever rendered a GL pixel

`gl-presenter.test.mjs`'s stub answers **every** uniform lookup with a truthy
object:

```js
getUniformLocation: (p, name) => ({ name: name }),
```

so `if (prog.flip)` is truthy even for `progPatch` and `progBlur`, which have no
`flip` uniform, and nothing rasterises. The file is a plumbing test: it asserts
calls were made and the fail-safe doors work. It cannot see a wrong uniform, a
wrong sub-quad, an inverted texture or an incomplete framebuffer.

The geometry is in fact correct — traced below, and it survives — but the point
stands for the next session: `PRESENTER_GL` must not be pushed on the strength of
a green suite. The `plant-glpres.js` arm is the only instrument that can answer,
and it has not been run.

---

## N13 — DEFECT — the codec probe answered "none" on 4 of 5 device arms, and "none" cannot be told from "never installed"

The batch's #1 research finding is that *nobody has checked which codec his phone
gets*. The probe built to answer it reported, on five 120s runs of the same video
on the same phone:

| arm | codec | changes |
|---|---|---|
| control | **none** | 0 |
| render2 | **av01** | 1 |
| blurframe | **none** | 0 |
| noav1 | **none** | 0 |
| cpumask1 | **none** | 0 |

One arm in five saw anything. And `"none"` is ambiguous by construction —
`codec-probe.mjs:9` initialises `var lastFamily = 'none';` and `served()` returns
it whether or not `install()` ever succeeded, while `install()`'s own boolean is
**thrown away at the call site**:

```js
// init-entry.js:156
codecProbe.install(window);          // returns false when the page has no MediaSource
```

So `codec: "none"` conflates *at least* three states: the probe never installed;
it installed and `addSourceBuffer` was never called after it; and a mime that did
not start `video/` (`codec-probe.mjs:15`). That is loop 34's rule verbatim — *"an
absent key could not be told from a missing hook, which is exactly the ambiguity
that let the regression hide"* — reintroduced in the one field the round was built
to read.

I am deliberately **not** naming the mechanism behind the four blind arms. The data
cannot distinguish "installed too late" from "not MSE on that load", and this repo
has been burned before by a commit message that asserted the wrong transition
(loop 37f). What is provable from the source is that the value cannot be read.

**Smallest remedy:** record the install result and separate the states —
`codec: 'none' | 'unseen' | 'nohook'`, or a sibling `codecHooked: 0|1` beside
`changes`. Both are numeric/enum and pass the report invariant.

---

## SURVIVES — attacked and clean

**The GL orientation chain is correct end to end.** This was the largest exposure
candidate in the brief (an upside-down verdict frame puts every box on the wrong
person) and it holds at every link:

- `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)` ⇒ texture memory row 0 is the
  video's **top** row.
- `present`: `drawQuad(progCopy, entry.tex, /*flip*/ true, ...)`, and `FS_COPY`
  does `if (flip > 0.5) uv.y = 1.0 - uv.y` ⇒ canvas top samples memory row 0.
  Correct.
- `copyInto` (the blur chain) passes `flip=false` and the blur passes sample `v`
  directly, so every level preserves the same memory-row convention. Consistent.
- `FS_PATCH` samples `texture2D(t, vec2(v.x, 1.0 - v.y))` — the same flip — and
  converts to y-down canvas pixels with `f = vec2(gl_FragCoord.x, H - gl_FragCoord.y)`.
  Correct (a half-texel offset from pixel-centre sampling, nothing more).
- The sub-quad: `q.x ∈ [2x/W-1, 2(x+w)/W-1]`, `q.y ∈ [1-2(y+h)/H, 1-2y/H]` — the
  y-down rect mapped into y-up clip space, exactly.
- `readBack`: the texture is bound as an FBO colour attachment, so framebuffer row
  0 **is** memory row 0 **is** the video's top row, and `readPixels(0,0,...)`
  walks from row 0 up. GL's bottom-up readback and the un-flipped upload cancel,
  and the bytes come back in ImageData order. The comment at `readBack` is right.

**`attachDelayGl` never returns null after it has hidden the video.** Every
`return null` site is before `host.appendChild(canvas)` / `video.style.opacity = '0'`
— checked in order: the four guards, the canvas create, `if (!gl) return null`, and
the program/quad/fbo `try` (which returns before the append). So the fallback can
never land on a player with a stray black canvas and an invisible video.

**`onLost` cannot recurse and is not dead.** `glRefused = true` is set before
`delayDetach(); delayAttach();`, and the re-attach's `PRESENTER_GL === 1 && !glRefused`
is then false. *I withdrew a claim that `bumpLife` was undefined in `init-entry.js`* —
it is imported from `person-track.mjs` at `init-entry.js:89` and appears in the
emitted bundle as `Ir`:
`onLost:function(it){as=!0,Ir("presenterGlLost"),bt===he&&(Om(),Pm())}`.

**The three new diagnostics blocks pass `reportViolations`.** Driven through the
real `buildReport`/`reportViolations` on an empty, a full and a hostile snapshot:

```
empty    violations= []   codec={"codec":"none","changes":null}
                          native={"nativeBackend":"none","npu":"none","models":{...all "none"},"dead":false}
full     violations= []   native={"nativeBackend":"gpu","npu":"ok","models":{"face":{"nativeBackend":"npu"},...}}
hostile  violations= []   (backend "quantum" -> "none"; npu {a:1} -> "none"; slowed "x" -> null)
```

The field-names-are-enum-keys rule is respected, and `npuState()`'s `"pending"`
**is** in `ENUMS.npu` (`diag-report.mjs:101`) — *I withdrew a claim that it was
missing*; it was added in `601a93f`, after the commit I first read. *I also
withdrew a claim that the report goes stale after a CONFIG* — `postBackends()`
exists, `native-frame.mjs` parses `native-backends`, and `native-client.mjs`
applies it.

**A 1097 phone refuses per key, not per payload.** `applyTuning`'s loop `continue`s
on an unknown key (`TUNE_REFUSED++; continue;`), so a 1097 build fetching this
`tuning.json` applies the sixteen keys it knows and refuses twelve. Nothing else
changes. The push is safe.

**The manifest is regenerated and matches.** `node scripts/gen-rules-manifest.mjs`
produces no diff against the committed `rules/manifest.json`.

**THERMAL_DUTY's "never below the tuned duty" is true.**
`Math.min(THERMAL_DUTY_CEIL 4, baseDuty * 2) >= baseDuty` for every value the
`VERDICT_DUTY` clamp `[1.5, 4]` allows, and `setBaseDuty` is called from the
`VERDICT_DUTY` spec entry so a restore lands on the tuned value, not a module
default. `stopWatch()` also restores on the way to 0.

**`rectsDirty` is not consumed on a skipped frame** — the `RENDER_EVERY` skip
returns before the `if (rectsDirty)` block, so a scroll's refresh lands on the
frame that renders. The comment claiming this is correct.

**`NO_AV1` at 0 never patches.** `setNoAv1(0)` calls `av1Unpatch()`, which returns
immediately on a null `av1Saved`; nothing is written to `MediaSource` or
`HTMLMediaElement` until the dial is 1. `isAv1Type` does not match `vp09`/`avc1`,
and the original still answers everything else.

---

## A NOTE ON THE RING, NOT FILED AS A ROW

Both presenters can evict `lastPresented` — `while (ring.length > budget.frames)
freeTexture(ring.shift())` (GL) and `closeBitmap(ring.shift())` (2D) — and in the
GL case the freed texture goes to a LIFO pool that the **next** capture reuses.
If `paintPatches` ran while `lastPresented` held a recycled texture,
`present(lastPresented)` would draw a frame `DELAY_MS` newer than anything a
verdict has seen. It cannot today: `capture()` and `presentTick()` run back-to-back
inside the same `onVideoFrame`, so `lastPresented` is reassigned before control
returns to the event loop, and the `pick < 0` early-return can only happen when the
ring is *under* budget (an over-budget ring takes the `collapsed` branch and
presents). The invariant is real but undocumented and one early-return away from
being a frame of live video on screen. Worth a sentence next to `lastPresented`.

---

## Ledger rows

| id | date | trigger | severity | claim | falsifier | verdict | resolution | evidence |
|---|---|---|---|---|---|---|---|---|
| N1 | 2026-09-03 | phase-n (6) | EXPOSURE | The NNAPI arbiter's correctness gate compares only `outputBuffers[0]` (`NativeInfer.kt` outputsAgree), on an all-zero input (`decideNpu` re-zeroes `candidate.inputBuffer`), at `maxDiff <= 0.1*(maxRef+1e-3)` — and ships ENABLED (`rules/tuning.json` `NATIVE_NPU: 1`, engine default `flags = 1`). faceres has three outputs (gender/age/descriptor, `native-client.mjs:367`): the **age head** (child gate) and the **1024-d descriptor** (identity memory, and `nm` → `NULL_MINT_NM_FLOOR`, whose failure REFUSES a patch birth) are never compared. On a zero input maxRef≈0.5, so a 0.05 absolute sigmoid difference passes — looser than the faceres uint8 requant this repo REFUSED at p50 0.0234 / max 0.1042 with 8/100 decision flips and descriptor cosine min 0.5962. | Log line in `decideNpu` prints `agree=` per model; add the other heads to `outputsAgree` and re-read it on the Redmi, or run `spikes/gauntlet/probe_faceres_parity.py` against an NNAPI-won model. | OPEN | Smallest: push `"NATIVE_NPU": 0` (OTA, no install) until the arm is priced on real crops across all three heads. If kept on: loop `0 until minOf(a.outputBuffers.size, b.outputBuffers.size)` and compare on a captured crop, not zeros. | `NativeInfer.kt` outputsAgree/decideNpu, `rules/tuning.json`, `native-client.mjs:367`, CLAUDE.md loop 34 |
| N2 | 2026-09-03 | phase-n (1) | WRONG-NUMBER | "Twelve dials all shipping INERT / at today's behaviour" (CLAUDE.md handoff, plan, `tuning.mjs` header) is false: `NATIVE_NPU` ships **1**, so every load builds a second Interpreter per model on `ts-npu-trial` and runs `bestRunMs(...,3)` **twice** (trial + live candidate). The handoff's "~3 extra timed runs per model" is wrong for the shipped code: `bestRunMs(m,3)` is 1 warm + 3 timed, so it is **+1 interpreter build and +7 model runs per model** against 1097's single warm run. | `NativeInfer.kt` `bestRunMs` / `scheduleNpuTrials` / `decideNpu`; `rules/tuning.json`. | OPEN | Either ship `NATIVE_NPU: 0` (see N1) or restate as "eleven inert, one on" and correct the run count in CLAUDE.md and the plan. | CLAUDE.md HANDOFF 2026-09-03, `docs/superpowers/plans/2026-09-03-performance-batch-1098.md`, `rules/tuning.json` |
| N3 | 2026-09-03 | phase-n (1) | DEFECT | The `app/src-tauri/gaze-page.js` committed at HEAD carries `__TS_GAZE_BUNDLE__="48b7c0d"` — the 1097 bundle — and **zero** occurrences of RENDER_EVERY / BLUR_IN_FRAME / PRESENTER_GL / NO_AV1 / TsPerf / rafSkipped / native-backends, while `7bc6cd2` bumped `tauri.conf.json` and `appupdate.rs` to 1098. `gaze-page.js` is `include_str!`d into `lib.rs`, so a build from a clean checkout of HEAD ships the 1097 page stamped 1098: `TUNE_REFUSED` 12 and none of the batch exists. | `git show HEAD:app/src-tauri/gaze-page.js \| grep -o '__TS_GAZE_BUNDLE__="[^"]*"'` → `48b7c0d`; `\| grep -c RENDER_EVERY` → 0. | OPEN | `node app/gaze/build/build.js` at HEAD and commit the bundle before any 1098 artifact; assert the marker equals HEAD in the release recipe. (The uncommitted working-tree bundle is fresh and DOES read `T2`/`pZ` at their call sites — verified R15-style.) | `git show HEAD:app/src-tauri/gaze-page.js`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/src/appupdate.rs` |
| N4 | 2026-09-03 | phase-n (2) | EXPOSURE | At `BLUR_IN_FRAME` 1, `canPaint()` is `!!ctx && 'filter' in ctx` — a property probe. A context that accepts `ctx.filter` and ignores it makes `drawPatches` an identity copy (same src and dest rect, same bitmap), while `renderTrackOverlay`'s paint branch hides the div unconditionally: every patch region drawn SHARP with nothing else covering. `stats.patchesDrawn` counts draws, not blur, and presenter stats never reach `buildReport`, so the About report shows nothing. `gl-presenter.canPaint()` is `return !detached` — no capability test at all, and no `checkFramebufferStatus` anywhere in the file. | Stub a 2D context whose `filter` setter is a no-op and run `presenter-paint.test.mjs`'s repaint test: the patch pixels equal the frame pixels and `patchesDrawn` still counts them. | OPEN | One write at attach: set `ctx.filter='blur(1px)'`, read it back, restore. `presenter-paint.test.mjs` pins the weak version by name and moves with the fix. | `delay-presenter.mjs` canPaint/drawPatches, `video-region.mjs` renderTrackOverlay paint branch, `gl-presenter.mjs` canPaint, `diag-report.mjs` (no delay block) |
| N5 | 2026-09-03 | phase-n (5) | WRONG-NUMBER | `RENDER_EVERY`'s ceiling of 4 is justified by "the most a patch may lag the picture before the pad stops covering the trail" (`tuning.mjs`) and "one extra presented frame (~16-33ms, one to two pixels ... inside the pad)" (`video-region.mjs`). The skip is on rAF, and this repo's measured rAF with the presenter attached is 30-44Hz, so RENDER_EVERY 4 leaves **~61ms** (at the 1098b-measured 49.5Hz) to ~100ms (older 34-44Hz runs) between repositions — 2-3 presented frames at 30fps. The only value ever planted is 2, and it measures **+0.80 drop points against control** (14.51 vs 13.71), inside this repo's own 0.84-point spread between similar arms — i.e. no measurable gain at 2, and 4 untested. `PTRACK_PAD` 0.04 / `PTRACK_PAD_TOP` 0.06 + `PATCH_MARGIN` 0.045 is ~5px on a 120px box; 160 px/s of head motion covers ~13px in 80ms. No RENDER_EVERY 4 arm exists on the corpus or the device — only `plant-render2.js`. | `probe_drops_ab.py` with a RENDER_EVERY 4 plant beside control, reading the presented-vs-drawn offset; or replay the timeline at 1/4 reposition rate against banked snapshots. | OPEN | Clamp the ceiling to 2 (the only value with an arm), or mark the range "UNMEASURED above 2" so it is not pushed on a guess. | `tuning.mjs` RENDER_EVERY, `video-region.mjs` setRenderEvery comment, `person-track.mjs` PTRACK_PAD, `spikes/gauntlet/plant-render2.js` |
| N6 | 2026-09-03 | phase-n (5) | DEFECT | `renderStats.raf++` happens BEFORE the RENDER_EVERY skip, so `raf` counts frames the renderer did not render. `raf` is phase-M's loop-liveness signal, CLAUDE.md's "raf/3min" column, and what `probe_drops_ab.py` reads — the planted RENDER_EVERY 2 arm reports the same `raf` as control with half the render work. `rafSkipped` is emitted but nothing says a reader must subtract it. MEASURED on the 1098b arms: control rafHz **49.9**, render2 rafHz **49.4** — half the render work, 1% apparent difference. | OPEN | Bump `raf` after the skip and keep `rafSkipped` as the total, or one line in the counter's comment. | `video-region.mjs` loop, `spikes/gauntlet/plant-render2.js` |
| N7 | 2026-09-03 | phase-n (1) | DEFECT | `tuning.test.mjs`'s `SHIPPED` map hand-writes both sides for `RENDER_EVERY: 1` and `BLUR_IN_FRAME: 0` because `video-region.mjs` exports only `setRenderEvery` — so the "shipped tuning.json equals the shipped constants" guard compares a literal to a literal for two of the twelve new dials, and the "every tunable is in SHIPPED" guard is satisfied while measuring nothing. Same class as phase-G's "an instrument that re-derives a shipped rule is a check that cannot fail", guarding the one thing `tuning.mjs`'s header says would silently revert on every device. | Set `var RENDER_EVERY = 2` in `video-region.mjs`; `cd app/gaze && npm test` stays 784/784 green while `rules/tuning.json` still says 1. | OPEN | `export var RENDER_EVERY` / `export var BLUR_IN_FRAME` and read them in `SHIPPED`, like every other new entry. | `app/gaze/test/tuning.test.mjs` SHIPPED, `app/gaze/src/video-region.mjs` exports |
| N8 | 2026-09-03 | phase-n (6) | DEFECT | `webView.addJavascriptInterface(PerfBridge(), "TsPerf")` is unconditional in `onWebViewCreate`, and our bundle shares the page's JS world — so every script on m.youtube.com can call it. The comment claims a hostile page "can at most toggle a throttle/hint back to Android's own default"; `TsPerf.inferPriority(2)` sets `ts-infer` to `THREAD_PRIORITY_BACKGROUND` (little cores on most devices) — a slower verdict, a wider gap, a wider coast — and `refreshCap(48)` changes the user's display mode. The dials being inert does not make the bridge inert. | From the page console on a watch page: `TsPerf.inferPriority(2)`, then read `player.verdictP50` in `__TS_DIAG_NOW()` over 90s against control. | OPEN | Use the pattern already in the same file: a one-shot token taken by the document-start script, required as the first argument of every `PerfBridge` method (cf. `__TS_TAKE_NATIVE_PORT`). | `MainActivity.kt` PerfBridge + onWebViewCreate |
| N9 | 2026-09-03 | phase-n (6) | DEFECT | `decideNpu` runs `bestRunMs(candidate, 3)` — 4 inferences of the LIVE model — on the `ts-infer` handler, once per model (~1.4s for MoveNet), while `ts-npu-trial` competes for the same accelerator. `native-client.mjs:40` times a request out at 4000ms and `die()`s after 3 consecutive failures, taking the player back to the WebGL worker (verdict p50 922 vs 355). Commit `601a93f`'s own message is "1098 smoke found the arbiter killing the client"; the trial moved off `ts-infer` but the four live-model runs did not. | Push `NATIVE_CPU_MASK: 1` on the Redmi and read `life.nativeDead` and `native.dead` in `__TS_DIAG_NOW()`. | OPEN | One timed run instead of `bestRunMs(...,3)`, or time a second candidate interpreter on the trial thread so `ts-infer` is never blocked by a measurement. | `NativeInfer.kt` decideNpu/handleConfig, `native-client.mjs:40` + noteFailure/die |
| N10 | 2026-09-03 | phase-n (7) | NIT | `repaints`, `patchesDrawn`, `blurLevel`, `gl`, `lost` and the presenter `errors` reach only `window.__TS_DELAY_STATS`; `buildReport` has no delay/presenter block, so after pushing `BLUR_IN_FRAME` or `PRESENTER_GL` the About report he can actually send carries no evidence about the two dials that change what a patch looks like. | `grep -n "presenter\|delay" app/gaze/src/diag-report.mjs` → nothing. | OPEN | A `paint: { repaints, patchesDrawn, gl }` block beside `perf`; all numeric, and the invariant already accepts that shape (proved this round). | `diag-report.mjs`, `init-entry.js` __TS_DELAY_STATS hook |
| N11 | 2026-09-03 | phase-n (1) | NIT | `codecProbe.install(window)` runs unconditionally on all five platforms and permanently replaces `MediaSource.prototype.addSourceBuffer` and `SourceBuffer.prototype.changeType`. It is the only page mutation in the batch with no OTA kill switch — and the only one that touches the player's own API surface. If it ever breaks playback the remedy is a 56MB install. | `init-entry.js` install site; `rules/tuning.json` has no key for it. | OPEN | A `CODEC_PROBE` dial shipped at 1, or gate the install on `NO_AV1 \|\| DELAY_MS > 0` so there is at least one reachable off state. | `init-entry.js` codecProbe.install, `codec-probe.mjs`, `rules/tuning.json` |
| N12 | 2026-09-03 | phase-n (3) | NIT | `gl-presenter.test.mjs`'s stub answers every `getUniformLocation` with a truthy object and rasterises nothing, so `if (prog.flip)` is truthy for `progPatch`/`progBlur` which have no such uniform, and no shader math is exercised. Nothing in this batch has rendered a GL pixel. The geometry IS correct on reading (traced: UNPACK_FLIP_Y false ⇒ memory row 0 = video top row; present/FS_PATCH flip; `H - gl_FragCoord.y`; readPixels from framebuffer row 0 ⇒ top-down ImageData) — the point is that a green suite is not evidence for this file. | Run `plant-glpres.js` on the Redmi and read the patch positions off a captured frame. | OPEN | Do not push `PRESENTER_GL` on tests. The `plant-glpres.js` arm is the instrument; it has not been run. | `app/gaze/test/gl-presenter.test.mjs` makeGl, `spikes/gauntlet/plant-glpres.js` |
| N13 | 2026-09-03 | phase-n (1) | DEFECT | The codec probe answered `"none"` on **4 of 5** 1098b device arms (only `render2` saw `av01`), and `"none"` is ambiguous by construction: `codec-probe.mjs:9` initialises `lastFamily = 'none'` and `served()` returns it whether or not `install()` succeeded, while `init-entry.js:156` **discards** `install()`'s boolean. So the field built to answer the batch's #1 research question conflates "never installed", "installed but nothing seen", and "non-video mime" — loop 34's absent-key-vs-missing-hook ambiguity, reintroduced. | `spikes/gauntlet/diag-v1098b-*.json` `codec` blocks; `codec-probe.mjs:9,15,41-45`; `init-entry.js:156`. | OPEN | Record the install result and split the states — `'none' \| 'unseen' \| 'nohook'`, or a sibling `codecHooked: 0\|1` beside `changes`. Both pass the report invariant. Mechanism behind the four blind arms deliberately NOT named — the data cannot separate "installed too late" from "not MSE on that load". | `spikes/gauntlet/diag-v1098b-{control,render2,blurframe,noav1,cpumask1}.json`, `codec-probe.mjs`, `init-entry.js:156` |

---

**State at the end of this run:** gaze **784/784**, cargo **61/61**, manifest
regenerated and matching, nothing in the repo edited except this file, nothing
committed, nothing run on the device by me. The 1098b arms quoted throughout were
already on disk, written by another writer; they are read, never re-run.

**Blocking for the 1098 release, in order:** N3 (the committed bundle is 1097's),
N1 (`NATIVE_NPU` ships 1 behind a one-head zero-input gate), N4 (`canPaint` before
`BLUR_IN_FRAME` is pushed — and `BLUR_IN_FRAME` is the arm that measured best, so
it is the one most likely to be pushed).
