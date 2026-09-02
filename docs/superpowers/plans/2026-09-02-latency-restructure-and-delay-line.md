# Player latency: restructure + delay line — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the in-player blur's two latencies on the owner's phone — blur arriving late on a new opposite-gender subject, blur lingering after the subject is gone — first by removing wasted inference (Stage A, "option 3"), then by presenting the video ~1s late from a frame ring so every frame is judged before it is shown (Stage B, "option 1"). One APK at the end (owner: "tired of installing").

**Architecture:** Stage A keeps the reactive pipeline and changes its *schedule*: MoveNet stops running where it has admitted nobody (100% of passes on his phone, 511ms each), position-only passes stop when MoveNet is not live (they produce zero observations there), gender is read only for face tracks that are new or unresolved, and the verdict interval becomes 2x cost instead of 4x. Stage B adds a delay presenter (hidden `<video>`, bitmap ring, canvas, delayed audio) and a track *timeline* so the renderer interpolates between two known verdicts instead of extrapolating past the last one. Both stages are measured on the arm64 Redmi (M2010J19SI, adb `1ec2c48e0621`, CDP forward port 9227) before anything is released.

**Tech Stack:** vanilla ES modules in `app/gaze/src`, `node --test` (`npm test` from `app/gaze`; `pretest` rebuilds the bench bundle), esbuild bundle via `node app/gaze/build/build.js`, Tauri v2 Android build, CDP probes in `spikes/gauntlet` (python, `emu_cdp.py`).

**Spec:** the owner's rulings in this session (2026-09-02): "I need a proper solution" to the two latencies; option 1 (delay ≈1s, seek blur accepted) chosen on recommendation, then "can we try both?" → build 3 then 1, 1 behind a switch, one build. Evidence: `spikes/delay-line/FINDINGS.md` (Android section), live Redmi stage split in CLAUDE.md session state.

## Global Constraints

- BLOCK-ONLY, NO NAGS, patches SOLID (never a hole or a split), player integrity red line (`docs/VISION.md`, project CLAUDE.md).
- Never copy from HaramBlur or any AGPL/GPL source.
- A constant changed in source must change in `rules/tuning.json` too (test `tuning-json` pins it) and `node scripts/gen-rules-manifest.mjs` must be re-run.
- Every new test must be RED-PROVED against the pre-change code (this repo has shipped checks that could not fail three times). Paste the red output in the commit body.
- Verify constants in the EMITTED bundle (`app/gaze/build/build.js` then grep `app/gaze/dist` or the include_str'd artifact), never only in source.
- Pin the cadence in any bench arm: `hisRegimeOpts(g)` + `thinFrames(w, K_HIS)`; the control triple must read man 22.5 / 136.5 / 547.5, woman 25.5 / 201.5 / 628.0 (`test/control-triple.test.mjs`).
- Nothing rendered on the owner's desktop screen. Device runs go through CDP on the Redmi or the emulator; evidence screenshots deleted after reading.
- Commit after every task; do not release until Task 12.

---

## File structure

- `app/gaze/src/person-skip.mjs` — MoveNet skip policy (exists). Gains `personsLive()`.
- `app/gaze/src/person-track.mjs` — tracker (exists). Gains `readAt` stamp, `trackNeedsRead(track, nowMs)`, `GENDER_REFRESH_MS`.
- `app/gaze/src/cadence.mjs` — verdict clock (exists). Gains `VERDICT_DUTY` + setter.
- `app/gaze/src/tuning.mjs` + `rules/tuning.json` — OTA whitelist (exist). Gain `VERDICT_DUTY`, `DELAY_MS`; `PERSON_SKIP_EVERY` default moves to 4.
- `app/gaze/src/init-entry.js` — player loop (exists). Position-pass gate, resolved-track gender skip, delay wiring.
- `app/gaze/src/delay-core.mjs` — NEW, pure: ring pick, ring budget, refill state machine.
- `app/gaze/src/delay-presenter.mjs` — NEW, DOM: canvas + ring + audio + video events.
- `app/gaze/src/track-timeline.mjs` — NEW, pure: verdict snapshots keyed by mediaTime, `boxesAt`.
- `app/gaze/src/video-region.mjs` — renderer (exists). Gains `setTimeline(video, timelineFn)`.
- `app/gaze/bench/gender-skip-arm.mjs` — NEW bench arm pricing the gender skip on the corpus.
- `spikes/gauntlet/probe_latency_ab.py` — NEW device probe: entry latency, exit hang, cadence, rAF.

---

## Stage A — restructure (option 3)

### Task 1: Position passes stop when MoveNet is not live

**Files:**
- Modify: `app/gaze/src/person-skip.mjs`
- Modify: `app/gaze/src/init-entry.js` (inside `sampleOnce`, just after `var wasVerdict = ...` at ~3424)
- Test: `app/gaze/test/person-skip-live.test.mjs`

**Interfaces:**
- Produces: `export function personsLive()` in person-skip.mjs → `boolean`, true while `emptyRun < PERSON_EMPTY_STREAK`.
- Produces: life counter `positionPassSkipped` (via `bumpLife`).

Why: a position pass is `runPass(withFaces=false)` = MoveNet only. Where MoveNet has admitted nobody for `PERSON_EMPTY_STREAK` passes it returns `[]` and the pass yields zero observations (`persons.map(... positionOnly)` over an empty list). On the Redmi that was 31 of 66 passes at 511ms each doing nothing, and each one blocks the GPU queue a verdict is waiting on.

- [ ] **Step 1: Write the failing test**

```js
// app/gaze/test/person-skip-live.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ps from '../src/person-skip.mjs';

test('personsLive is true until PERSON_EMPTY_STREAK empty passes, then false, and one admitted person revives it', () => {
  ps.resetPersonSkip();
  assert.equal(ps.personsLive(), true);
  for (let i = 0; i < ps.PERSON_EMPTY_STREAK; i++) {
    assert.equal(ps.personsLive(), true, 'still live before the streak completes');
    ps.notePersons([], false);
  }
  assert.equal(ps.personsLive(), false, 'dead after the streak');
  ps.notePersons([], true); // a skipped pass is not evidence either way
  assert.equal(ps.personsLive(), false);
  ps.notePersons([{ x1: 0, y1: 0, x2: 1, y2: 1 }], false);
  assert.equal(ps.personsLive(), true, 'one admitted person revives');
  ps.resetPersonSkip();
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd app/gaze && node --test test/person-skip-live.test.mjs` → `TypeError: ps.personsLive is not a function`.

- [ ] **Step 3: Implement**

In `person-skip.mjs` after `wantPersons`:

```js
/**
 * True while the person model has admitted somebody within the last
 * PERSON_EMPTY_STREAK passes. A position-only pass (MoveNet, no faces)
 * can only produce observations from MoveNet, so where this is false
 * that pass costs a full inference and yields nothing.
 */
export function personsLive() {
  return emptyRun < PERSON_EMPTY_STREAK;
}
```

In `init-entry.js`, immediately after `var wasVerdict = !verdictBusy && now - lastZoomAt >= effZoom;`:

```js
        // A POSITION PASS WHERE MoveNet IS NOT LIVE IS 511ms OF NOTHING.
        // Measured on the arm64 Redmi 2026-09-02: 31 of 66 passes were
        // position passes, every one 511ms of MoveNet admitting nobody
        // (all twelve slots n:0, his regime), yielding zero observations
        // while a verdict waited on the same GPU queue. Patches keep
        // riding the renderer's velocity between verdicts exactly as
        // they did, because those passes never moved a track here.
        if (isPlayer && !wasVerdict && !personSkip.personsLive()) {
          bumpLife('positionPassSkipped');
          return;
        }
```

(`personSkip` is whatever name init-entry already imports `person-skip.mjs` under — check the import at the top of the file and use that identifier.)

- [ ] **Step 4: Run** `npm test` → all green, new test passes.

- [ ] **Step 5: Verify in the emitted bundle** — `node build/build.js` then `grep -c positionPassSkipped dist/*.js` ≥ 1.

- [ ] **Step 6: Commit** — `git commit -am "player: position passes stop while MoveNet is not live (511ms of nothing per pass on arm64)"`.

### Task 2: MoveNet skip ON by default (PERSON_SKIP_EVERY 1 → 4)

**Files:**
- Modify: `app/gaze/src/person-skip.mjs` (`PERSON_SKIP_EVERY = 4`)
- Modify: `rules/tuning.json` (`"PERSON_SKIP_EVERY": 4`), then `node scripts/gen-rules-manifest.mjs`
- Modify: `app/gaze/test/person-skip.test.mjs` (whatever test pins the default; read it first)

Pre-condition to assert BEFORE changing anything (the 1070 regression): the ghost gate must be a counter, not a refusal. Run `grep -n "noHumanShape" app/gaze/src/init-entry.js app/gaze/src/person-gate.mjs` and confirm no path drops a face on `noHumanShape`/`skipped` — 1078 made `faceEvidence = faces.length`. Quote the lines in the commit body. If any refusal path remains, STOP and report.

- [ ] **Step 1: Update the pinned-default test** so it asserts `PERSON_SKIP_EVERY === 4` and that `wantPersons()` is true for the first `PERSON_EMPTY_STREAK` empty passes, then true once in every 4 passes.
- [ ] **Step 2: Run, expect FAIL** (default still 1).
- [ ] **Step 3: Set the constant in `person-skip.mjs` and `rules/tuning.json`; run `node scripts/gen-rules-manifest.mjs`.**
- [ ] **Step 4: `npm test` green; `cargo test` in `app/src-tauri` green (rules manifest test).**
- [ ] **Step 5: Commit.**

### Task 3: Verdict interval = 2x cost, on the OTA channel

**Files:**
- Modify: `app/gaze/src/cadence.mjs` — add `export var VERDICT_DUTY = 2; export function setVerdictDuty(v) { VERDICT_DUTY = v; }`
- Modify: `app/gaze/src/init-entry.js:3273` — delete the local `var VERDICT_DUTY = 4;` and read `cadence.VERDICT_DUTY` at the use site (~3418), the same way `VERDICT_MAX_INTERVAL_MS` is read from the module at every use.
- Modify: `app/gaze/src/tuning.mjs` — whitelist row `VERDICT_DUTY: [1.5, 4, function (v) { cadence.setVerdictDuty(v); }]` with the reason: below 1.5 the GPU is busier with verdicts than free, and §10i measured the freed GPU going to the render loop.
- Modify: `rules/tuning.json` — `"VERDICT_DUTY": 2`; regen manifest.
- Test: `app/gaze/test/cadence-duty.test.mjs` — asserts the source of `init-entry.js` contains no `VERDICT_DUTY =` declaration and contains `cadence.VERDICT_DUTY`; asserts `tuning.mjs` clamps 1.0 → 1.5 and 9 → 4 (use the existing tuning apply helper the other tuning tests use).

Why 2: on the Redmi the verdict after Tasks 1-2 is ~830ms (BlazeFace ~290 + gender ~536), 4x = 3.3s clamped to 2000; 2x = 1660. After Task 4 (~300ms on 1-2 known faces) 2x = 600ms. Coast windows derive from the cadence in `setVerdictCadence`, so phantom shrinks with it and a track still survives ≥2 passes (`PTRACK_MIN_COAST_PASSES` unchanged).

- [ ] Steps: failing test → implement → `npm test` → bundle grep `VERDICT_DUTY` read at the claim site → commit.

### Task 4: Gender only for tracks that need a read

**Files:**
- Modify: `app/gaze/src/person-track.mjs` — in `newTrack` add `readAt: obs.positionOnly ? 0 : (obs.at || 0)`; in `matchedStep`, when `!obs.positionOnly`, set `t.readAt = obs.at || t.readAt`. Add:

```js
export var GENDER_REFRESH_MS = 2000;
export function setGenderRefreshMs(v) { GENDER_REFRESH_MS = v; }
/**
 * Does this track need a gender read on this pass? A read costs ~536ms
 * of faceres on the arm64 Redmi and a track whose verdict is settled
 * gains nothing from one more. Unsettled = blurred without a certain
 * flag (still on the clear ladder), or cleared (must re-confirm inside
 * CLEARED_TTL_MS or it reverts), or simply old.
 */
export function trackNeedsRead(t, nowMs) {
  if (!t) return true;
  if (!(t.readAt > 0)) return true;
  if (nowMs - t.readAt >= GENDER_REFRESH_MS) return true;
  if (t.state === 'blurred' && t.lastVerdict !== 'flag-certain') return true;
  return false;
}
```

- Modify: `app/gaze/src/init-entry.js` at the verdict branch (~3600, after `picked`/`rest` are computed): before zooming each picked person, find its track by IoU (`iou(person, track.box) >= PTRACK_IOU_MIN`, best match) and if `!trackNeedsRead(track, now)` emit `{ box: person, positionOnly: true }` for it instead of a crop, and `bumpLife('genderReadSkipped')`. Observations must carry `at: now` (check `obs.at` exists; if not, add it where verdict observations are built).
- Modify: `app/gaze/src/tuning.mjs` + `rules/tuning.json` — `GENDER_REFRESH_MS: [1000, 4000, ...]` default 2000.
- Test: `app/gaze/test/track-needs-read.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackNeedsRead, GENDER_REFRESH_MS } from '../src/person-track.mjs';

test('a settled flag-certain blurred track read just now needs no read', () => {
  assert.equal(trackNeedsRead({ state: 'blurred', lastVerdict: 'flag-certain', readAt: 1000 }, 1500), false);
});
test('a blurred track still on the ladder needs a read every pass', () => {
  assert.equal(trackNeedsRead({ state: 'blurred', lastVerdict: 'uncertain', readAt: 1000 }, 1500), true);
});
test('a cleared track needs a read once GENDER_REFRESH_MS has passed', () => {
  assert.equal(trackNeedsRead({ state: 'cleared', lastVerdict: 'clear-certain', readAt: 1000 }, 1000 + GENDER_REFRESH_MS - 1), false);
  assert.equal(trackNeedsRead({ state: 'cleared', lastVerdict: 'clear-certain', readAt: 1000 }, 1000 + GENDER_REFRESH_MS), true);
});
test('no track, or never read, always reads', () => {
  assert.equal(trackNeedsRead(null, 0), true);
  assert.equal(trackNeedsRead({ state: 'cleared', readAt: 0 }, 5000), true);
});
```

- Bench: `app/gaze/bench/gender-skip-arm.mjs` — copy the shape of `bench/mnbody-ab.mjs` (it runs `arch-arms` CONTROL against a variant). The variant drops the gender read from any banked verdict observation whose matched track reports `!trackNeedsRead(track, frameMs)`, turning it into `positionOnly`. Print CONTROL and the arm as `exposure / falseCover / phantom` for man and woman with `hisRegimeOpts`. Acceptance: exposure within +1.0s of CONTROL in both modes; if it is not, raise nothing — report the number and stop for a ruling.

- [ ] Steps: failing test → implement → red-prove the bench arm reproduces CONTROL with `GENDER_REFRESH_MS = 0` (every track needs a read → identical triple) → run the arm at 2000 → `npm test` → commit with both triples in the body.

### Task 5: Stage A device measurement (gate before Stage B)

**Files:**
- Create: `spikes/gauntlet/probe_latency_ab.py`

Drive the Redmi (port 9227, app on `https://m.youtube.com/watch?v=NWoT1ZVd1Lo`, seek to t=55, man mode via the launcher's `open_platform` as `probe_phone_cadence.py` does). Over 150s collect from `__TS_GAZE_IDS.stages` (first-seen tagging): verdicts, positions, verdict `end` p50, gap p50 between verdict `end` marks; rAF Hz in page; coverage fraction; `life.positionPassSkipped`, `life.genderReadSkipped`, `life.personPassSkipped`, `life.coastExpired`, `life.birthFresh`. Run it on the SHIPPED 1091 bundle first (the Redmi is on 1091) and bank as `latency-ab-1091.json`, then build an x86_64 APK for the emulator AND an arm64 APK for the Redmi from HEAD (release recipe in CLAUDE.md, strip the .so, `-x :app:rustBuildArm64Debug`), install on the Redmi (`adb -s 1ec2c48e0621 install -r`; this device accepts adb installs), re-run, bank as `latency-ab-stageA.json`.

Acceptance: verdict gap p50 ≤ 1000ms (was 2140), positions 0 in his regime, rAF not below the 1091 run by more than 20%, coverage not below the 1091 run in man mode by more than 0.02. Paste both rows in the commit body and in CLAUDE.md session state.

---

## Stage B — delay line (option 1)

### Task 6: `delay-core.mjs` — pure ring logic

**Files:**
- Create: `app/gaze/src/delay-core.mjs`
- Test: `app/gaze/test/delay-core.test.mjs`

**Interfaces (Produces):**

```js
export var DELAY_MS = 1000;            // OTA; 0 = presenter off
export function setDelayMs(v) { DELAY_MS = v; }
export var RING_BYTES_MAX = 64 * 1024 * 1024;
/** Given source size and fps, the ring length and the capture scale that
 *  fit RING_BYTES_MAX for delayMs + 500ms of slack. scale is 1 or the
 *  factor that brings width to 640. */
export function ringBudget(w, h, fps, delayMs) // -> { frames, scale, w, h, bytes }
/** Index of the newest ring entry with mediaTime <= target, or -1. ring is
 *  sorted by mediaTime ascending. */
export function pickPresent(ring, targetMediaTime)
/** Target media time for presentation. */
export function presentTarget(currentTime, delayMs, playbackRate) // -> currentTime - (delayMs/1000)*rate
/** Refill state: 'live' | 'refilling'. A flush moves to refilling; the
 *  first successful pick after a flush moves back to live. */
export function refillStep(state, event) // event: 'flush' | 'picked' -> next state
```

- [ ] **Step 1: Failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ringBudget, pickPresent, presentTarget, refillStep, RING_BYTES_MAX } from '../src/delay-core.mjs';

test('ringBudget keeps native size when it fits and downscales to 640 wide when it does not', () => {
  const a = ringBudget(640, 360, 30, 1000); // 45 frames x 0.92MB = 41MB
  assert.equal(a.scale, 1); assert.equal(a.frames, 45); assert.ok(a.bytes <= RING_BYTES_MAX);
  const b = ringBudget(1280, 720, 60, 1000); // 90 x 3.7MB does not fit
  assert.equal(b.w, 640); assert.equal(b.h, 360); assert.equal(b.frames, 90); assert.ok(b.bytes <= RING_BYTES_MAX);
});
test('pickPresent returns the newest entry at or before target, -1 when none', () => {
  const ring = [{ mediaTime: 1.0 }, { mediaTime: 1.033 }, { mediaTime: 1.066 }];
  assert.equal(pickPresent(ring, 0.9), -1);
  assert.equal(pickPresent(ring, 1.04), 1);
  assert.equal(pickPresent(ring, 5), 2);
});
test('presentTarget scales the delay by playback rate', () => {
  assert.equal(presentTarget(10, 1000, 1), 9);
  assert.equal(presentTarget(10, 1000, 2), 8);
});
test('refillStep: flush -> refilling, picked -> live, picked while live stays live', () => {
  assert.equal(refillStep('live', 'flush'), 'refilling');
  assert.equal(refillStep('refilling', 'picked'), 'live');
  assert.equal(refillStep('live', 'picked'), 'live');
});
```

- [ ] **Step 2: Run, expect FAIL** (module missing).
- [ ] **Step 3: Implement** exactly the four functions; `ringBudget`: `frames = ceil(fps * (delayMs + 500) / 1000)`, `bytes = frames * w * h * 4`; if bytes > RING_BYTES_MAX and w > 640 then `scale = 640 / w`, `w = 640`, `h = round(h * scale)`, recompute bytes; if still over, reduce `frames` to floor(RING_BYTES_MAX / (w*h*4)).
- [ ] **Step 4: `npm test` green. Step 5: commit.**

### Task 7: `delay-presenter.mjs` — DOM half

**Files:**
- Create: `app/gaze/src/delay-presenter.mjs`
- Test: `app/gaze/test/delay-presenter.test.mjs` (DOM stub in the style of `test/video-region.test.mjs:46`)

**Interfaces (Produces):**

```js
/** Attach to a playing player video. Returns null if unsupported
 *  (no requestVideoFrameCallback, no createImageBitmap, video not in host). */
export function attachDelay(video, host, opts /* { delayMs, onFrame(bitmapClone, mediaTime, atMs) } */)
// -> {
//   cover(bool),                 // whole-blur the canvas (blur-first / refill)
//   flush(why),                  // close every ring frame, enter refilling
//   detach(),                    // remove canvas, restore video opacity, delay 0, keep audio graph
//   presentedMediaTime(),        // mediaTime of the frame on the canvas, or null
//   stats(),                     // { captured, presented, refills, flushes, capFailed, ring, late }
//   requestVerdictFrame(),       // returns a Promise<{bitmap, mediaTime, atMs}> for the NEWEST ring frame (a clone)
// }
```

Behaviour, each a test:
1. `attachDelay` appends `<canvas class="ts-gaze-delay">` to `host` with `position:absolute;inset:0;z-index:15;pointer-events:none` and sets `video.style.opacity='0'`; `detach()` reverses both.
2. Every rVFC tick: `createImageBitmap(video, {resizeWidth, resizeHeight})` per `ringBudget`; push `{bitmap, mediaTime, at}`; evict oldest when over `frames` (close the bitmap); then `pickPresent(ring, presentTarget(video.currentTime, delayMs, video.playbackRate))` and `drawImage` the pick; close everything at or before the pick. NEVER `new VideoFrame(video)` — measured to starve the Android decoder (`spikes/delay-line/FINDINGS.md`).
3. `seeking`, `loadstart`, `resize`, `ratechange` → `flush(why)` + `cover(true)`; the first pick afterwards → `cover(false)` unless an external cover is held (`cover(true)` from init-entry sets `externalCover`; refill cover and external cover are OR-ed).
4. Audio: one `AudioContext` + `createMediaElementSource(video)` + `createDelay(5)` per video element, stored on `video.__tsDelayGraph`; `delayTime = delayMs/1000`; `pause` → `ctx.suspend()`, `play` → `ctx.resume()`; `detach` sets delayTime 0 and resumes (the graph is permanent per element).
5. `requestVerdictFrame()` clones the newest ring bitmap with `createImageBitmap(bitmap)` and resolves `{bitmap, mediaTime, atMs}`; the ring keeps its own copy.
6. When `document.hidden` becomes true, flush (mediaTime will jump).

The test stub needs: `document.createElement`, a fake `video` with `requestVideoFrameCallback(cb)` you invoke by hand with `(now, {mediaTime})`, `addEventListener` that records listeners you can fire, `currentTime`, `playbackRate`, `videoWidth/Height`; global `createImageBitmap` returning `{ close() {}, width, height }`; `AudioContext` stub recording `createMediaElementSource`, `createDelay`, `suspend`, `resume`. Assert ring length, eviction closes, pick, cover flags, listeners fired.

- [ ] Steps: failing tests for each behaviour → implement → `npm test` → commit.

### Task 8: `track-timeline.mjs` — verdict snapshots and the interpolation rules

**Files:**
- Create: `app/gaze/src/track-timeline.mjs`
- Test: `app/gaze/test/track-timeline.test.mjs`

**Interfaces (Produces):**

```js
export function makeTimeline(keepMs)                       // keepMs: how far back to keep (delayMs + 2000)
export function pushSnapshot(tl, mediaTime, tracks)        // tracks: [{id, box:{x1,y1,x2,y2}, state:'blurred'|'cleared'}]
export function pushCut(tl, mediaTime)                     // scene gate cut at this media time
export function boxesAt(tl, mediaTime)                     // -> [{id, box, state}] for presentation, or null if no snapshot at/after mediaTime exists (LATE)
export function latestSnapshot(tl)                         // for the late fallback
```

Rules of `boxesAt(tl, m)` with `A` = newest snapshot with `mediaTime <= m`, `B` = oldest with `mediaTime >= m`, `cut` = any cut in `(A.mediaTime, B.mediaTime]`:
- No `B` → return `null` (caller falls back to extrapolating `latestSnapshot`, bumps `delayVerdictLate`).
- No `A` → return `B`'s tracks as they are (blur-first: cover before the first verdict).
- Track in both A and B → box lerped by `(m - A.t) / (B.t - A.t)`; state = `blurred` if either says blurred (covering direction), else `cleared`.
- Track only in A (gone by B): if `cut` and `m >= cut` → omitted (ended at the cut); else → A's box, A's state, until B (a detector miss must not uncover; phantom is bounded by one verdict interval).
- Track only in B (born by B): if `cut` and `m < cut` → omitted (they were not in the previous shot); else → B's box, B's state, back-dated to A (zero exposure, one interval of false cover at most).
- Snapshots older than `keepMs` behind the newest are dropped by `pushSnapshot`.

- [ ] **Step 1: Failing tests, one per rule above**, e.g.

```js
test('a track present in the next verdict is covered back to the previous verdict when there was no cut', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, []);
  pushSnapshot(tl, 11.0, [{ id: 7, box: { x1: 0.4, y1: 0.1, x2: 0.6, y2: 0.9 }, state: 'blurred' }]);
  const out = boxesAt(tl, 10.2);
  assert.equal(out.length, 1); assert.equal(out[0].id, 7); assert.equal(out[0].state, 'blurred');
});
test('...but not across a cut that happened after the presented frame', () => {
  const tl = makeTimeline(3000);
  pushSnapshot(tl, 10.0, []); pushCut(tl, 10.5);
  pushSnapshot(tl, 11.0, [{ id: 7, box: { x1: 0.4, y1: 0.1, x2: 0.6, y2: 0.9 }, state: 'blurred' }]);
  assert.equal(boxesAt(tl, 10.2).length, 0);
  assert.equal(boxesAt(tl, 10.6).length, 1);
});
test('a track missing from the next verdict ends at the cut, and without a cut survives to the next verdict', () => { /* symmetric */ });
test('state is blurred if either bracketing verdict says blurred', () => { /* ... */ });
test('boxesAt returns null when no verdict at or after the frame exists', () => { /* ... */ });
```

- [ ] Steps: run red → implement → green → commit.

### Task 9: Renderer reads the timeline

**Files:**
- Modify: `app/gaze/src/video-region.mjs` — add `export function setTimeline(video, boxesFn)` storing `entry.boxesFn` (and `clearTimeline`); in `reposition`, when `entry.boxesFn` is set, call `var live = entry.boxesFn(); if (live) { tracks = live; elapsed = 0; }` and render those boxes with `interpolateBox(track, 0)` (no velocity — the timeline already interpolated); when `live` is null fall back to the existing `entry.tracks` + `elapsed` path. Overlay count must follow the timeline's track list (reuse the existing overlay-count reconciliation in `setTracks`; factor the "ensure N overlays" part into a helper both paths call).
- Test: `app/gaze/test/video-region-timeline.test.mjs` — with the DOM stub: after `setTracks`, call `setTimeline(video, () => [{id:1, box:{...}, state:'blurred'}])`, run one `reposition` (export it for tests if it is not), assert the overlay rect follows the timeline box rather than the track's velocity; then make `boxesFn` return null and assert the velocity path is used.

- [ ] Steps: red → implement → green → commit.

### Task 10: Wire the presenter into the player loop

**Files:**
- Modify: `app/gaze/src/init-entry.js` (attachVideo scope)
- Modify: `app/gaze/src/tuning.mjs` + `rules/tuning.json` — `DELAY_MS: [0, 2500, function (v) { delayCore.setDelayMs(v); }]` default `1000`.
- Test: `app/gaze/test/delay-wired.test.mjs` — a source-structure test in the style of `test/null-mint.test.mjs`'s marker slicing: asserts (a) `attachDelay(` is called only inside a block guarded by `isPlayer && useRegionVideo && delayCore.DELAY_MS > 0 && !feedPreview()`; (b) `pushSnapshot(` appears after `videoTracks = updatePersonTracks(` in the verdict branch and is passed the pass frame's `mediaTime`; (c) `gateTick` cut → `pushCut(`; (d) `markFlagged(video)` and `clearEl(video)` for the player route through `presenter.cover(`; (e) `PERSON_SKIP_EVERY`-style bump `delayVerdictLate` exists.

Wiring, in order:
1. On `start()` for a player in smart mode with `DELAY_MS > 0`: `presenter = attachDelay(video, host, { delayMs: cadence-safe DELAY_MS, onFrame: null })`; `timeline = makeTimeline(DELAY_MS + 2000)`; `videoRegion.setTimeline(video, function () { var m = presenter.presentedMediaTime(); if (m == null) return null; var b = boxesAt(timeline, m); if (!b) { bumpLife('delayVerdictLate'); return null; } return b; })`.
2. `runPass` takes its frame from `presenter.requestVerdictFrame()` instead of `createImageBitmap(video)`; the pass carries `passMediaTime`.
3. After `videoTracks = updatePersonTracks(...)` on a verdict, `pushSnapshot(timeline, passMediaTime, videoTracks.map(t => ({id: t.id, box: t.box, state: t.state})))`. Position passes (if any) also push, with the same shape.
4. Scene gate: where `sceneState === 'cut'` is detected, `pushCut(timeline, video.currentTime)` (the gate reads the live video, which is the newest media time).
5. Whole blur: the two player sites calling `markFlagged(video)` / `clearEl(video)` additionally call `presenter.cover(true/false)`; while `presenter` is attached the CSS blur on the hidden video is invisible, so the canvas must carry it.
6. Pill off (`playerBlurOn = false`) → `presenter.detach()`; pill on → re-attach on next `start()`. `loadstart` → presenter handles its own flush; `videoTracks = []` sites also `timeline = makeTimeline(...)`.
7. `setVerdictCadence(effZoom)` unchanged — the coast still bounds the tracker; the timeline bounds the picture.

- [ ] Steps: red structure test → wire → `npm test` → `node build/build.js` and grep the bundle for `ts-gaze-delay`, `delayVerdictLate`, and the `DELAY_MS` read → commit.

### Task 11: Device verification of Stage B

Extend `spikes/gauntlet/probe_latency_ab.py` with a `--delay` arm and two direct measurements on the Redmi, 150s, same video and seek:
- **entry latency**: for every `birthBlurred`, the media-time gap between the frame the tracker first observed the subject and the first presented frame carrying a patch at that box (read `presenter.stats()` + timeline via a `__TS_DELAY_STATS` hook that Task 10 exposes read-only, like `__TS_GAZE_VTRACKS`). Expect p50 ≤ 0 (patch on the first presented frame).
- **exit hang**: for every track death, presented frames between the death media time (or the cut) and the last presented frame carrying its patch. Expect p50 ≤ 1 verdict interval, 0 across cuts.
- `delayVerdictLate` count against `presented`; if > 5%, raise `DELAY_MS` to 1200 over OTA and re-run before touching code.
- Seek: refill window length; pause: `AudioContext` state and presented frame frozen; fullscreen and mini-player: canvas rect equals the video rect (one CDP read each, after the transition); rAF and coverage as in Task 5.
- The existing `probe_stray`-style geometry check: every patch inside the player, 0 outside.

Bank as `latency-ab-stageB.json`. Then update CLAUDE.md session state with the three rows (1091, stage A, stage B).

### Task 12: One release

Release recipe from CLAUDE.md (bump `tauri.conf.json` + `appupdate.rs` + `tauri.properties` to 1092, `node app/gaze/build/build.js`, rust build, strip, `:app:clean :app:assembleArm64Debug -x :app:rustBuildArm64Debug`, hash-verify the served asset, manifest, push `rules/tuning.json` + manifest). Verified R15-style in the served APK's bundle: `DELAY_MS` default, `PERSON_SKIP_EVERY` 4, `VERDICT_DUTY` 2. Pre-authorised (memory: publishing releases is pre-authorized).

---

## Self-review

- Spec coverage: latency on entry → Task 8/10 (back-dating) + Task 3/4 (cadence); latency on exit → Task 8 (ended at cut / one interval) + Task 3 (coast follows cadence); "try both, switch, one build" → `DELAY_MS` 0/1000 over OTA + Task 12; mobile performance → Tasks 1, 2, 4; evidence on device → Tasks 5, 11.
- Placeholders: Task 8's symmetric tests are named with their rule; the executor writes them from the rule list above. No TBDs.
- Names: `personsLive`, `trackNeedsRead`, `GENDER_REFRESH_MS`, `VERDICT_DUTY`, `DELAY_MS`, `attachDelay`, `makeTimeline/pushSnapshot/pushCut/boxesAt/latestSnapshot`, `setTimeline` used consistently across Tasks 1-11.
