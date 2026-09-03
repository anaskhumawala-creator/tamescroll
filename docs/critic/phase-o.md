# Phase O critic — the in-player tuning panel (5c105f8): a second writer into the protection constants

Subject: `git show 5c105f8` — `tuning.mjs` (+82), `tuning-override.mjs` (new, 184),
`tune-overlay.mjs` (new, 722), `auto-test.mjs` (new, 375), `diag-report.mjs` (+59),
`init-entry.js` (+83), `miniplayer.mjs` (+13), four new test files. HEAD is 5c105f8;
nothing after it existed while this ran.

Everything below was **RUN**, not argued. `cd app/gaze && npm test` → **817/817**,
which is the commit's own number. Eleven experiments were executed against the real
modules under a fake `window`; their output is pasted inline. **No device.** Four
claims I could not confirm from source are in NOT CONFIRMED at the bottom rather than
filed as rows.

The shape of the thing: before this commit exactly one writer could move a constant in
`tuning.mjs`, and it was `__TS_GAZE_TUNING__` — a string Rust injects at document start,
SHA-256-verified upstream, unreachable from the page. This commit adds two more writers
and puts both of them in **browser storage on the page YouTube's own scripts run in**.
Six of the thirteen rows below are consequences of that one decision.

Thirteen rows, most severe first. Nine things were attacked and not found; they are in
SURVIVES.

---

## O1 — EXPOSURE — every protection dial in the whitelist is now writable by any script on the page, persistently, and the panel only ever needed the perf half

`tuning-override.mjs:56` reads `localStorage['tamescroll.tuning']` and applies **every
key in `SPEC`**, not the ones the panel's Blur/Speed groups are for:

```js
var names = tunableNames();          // tuning-override.mjs:74 — the WHOLE whitelist
for (var i = 0; i < names.length; i++) { ... out[k] = v; }
```

`SPEC` (`tuning.mjs:70-363`) is not a perf table. It holds `GENDER_CLEAR_SCORE`,
`GENDER_CLEAR_SCORE_FEMALE`, `NULL_MINT_NM_FLOOR`, `DELAY_MS`,
`PTRACK_MIN_COAST_PASSES`, `GENDER_REFRESH_MS`, `VERDICT_MAX_INTERVAL_MS`,
`VERDICT_DUTY`, `PERSON_SKIP_EVERY`, `CUT_PERSON_LOOK`, `NATIVE_INFER` — the file's own
header says of them: *"EVERY RANGE BELOW IS A PROTECTION DECISION"* and *"Each one is
the point past which the dial stops being a tuning knob and becomes an exposure."*

`localStorage` on `m.youtube.com` is the **page's** storage. Our bundle runs in the page
world; so does YouTube's JS and everything it loads. Executed
(`scratchpad/exp1.mjs`, E2) — one `setItem` and one boot:

```
before: GENDER_CLEAR_SCORE 0.45 DELAY_MS 1500 coast 2
applied = { GENDER_CLEAR_SCORE: 0.36, GENDER_CLEAR_SCORE_FEMALE: 0.3,
            NULL_MINT_NM_FLOOR: 0, PERSON_SKIP_EVERY: 4,
            PTRACK_MIN_COAST_PASSES: 1.33, VERDICT_MAX_INTERVAL_MS: 4000,
            VERDICT_DUTY: 4, GENDER_REFRESH_MS: 4000, CUT_PERSON_LOOK: 0,
            DELAY_MS: 0, NATIVE_INFER: 0 }
after : GENDER_CLEAR_SCORE 0.36 DELAY_MS 0 coast 1.33
```

Every one of those is the **weakest edge the clamp allows**, and this repo priced each
edge itself: `DELAY_MS` 1500→0 is "blur one verdict late on every entry" (loop 49
handoff), coast 2→1.33 is "+5.0s man / +4.0s woman of exposure" (loop 42 table),
`GENDER_CLEAR_SCORE` 0.36 is one step off the value the comment says "starts clearing
misgendered women", `GENDER_REFRESH_MS` 4000 is I2's "+4.0s woman exposure",
`CUT_PERSON_LOOK` 0 gives up the I10 entrant. It survives every reload, and nothing
in the app ever removes it unless he presses "Reset to shipped" on a panel he has no
reason to open.

The clamp is not the answer to this and the file says so: the clamp bounds what a
**push we control** can do. It was never a threat model for an untrusted writer, because
until this commit there wasn't one.

**This repo has already made this exact call the other way.** N8 token-gated `PerfBridge`
because it was "a `@JavascriptInterface` on the WebView that loads YouTube — reachable by
every script on the page", and the fix was a one-shot non-configurable door so "page
scripts can no longer background the inference thread or change the display mode". Loop
37e wrote the rule down: *"`IDS.life` lives on `window` in the PAGE world, which YouTube's
script shares, so 'only our code writes it' is not something the report may assume."*
Backgrounding a thread got a token. Moving `GENDER_CLEAR_SCORE` to its floor got a JSON
blob in `localStorage`.

**Fix.** Split the whitelist the override layer honours from the whitelist the OTA
channel honours. `readOverrides` should filter against an `OVERRIDABLE` subset — the
Speed/Blur perf dials the panel exists for (`RENDER_EVERY`, `BLUR_IN_FRAME`,
`PRESENTER_GL`, `NATIVE_CPU_MASK`, `NO_AV1`, `SUSTAINED_PERF`, `REFRESH_CAP_HZ`,
`THERMAL_DUTY`, `PERF_HINT`, `INFER_PRIO`, `PLAYBACK_SLOW`, `CODEC_PROBE`,
`NATIVE_NPU`) — and refuse the protection dials, which keep the OTA channel they were
designed for. Advanced then renders those rows read-only with "push this over the air".
If he wants them locally too, the storage has to stop being the page's: the same
`@JavascriptInterface`-plus-token door `perf_token_stash_script` already builds, or a
`__TS_TAKE_*` one-shot stash, gets him the panel without giving the page the dial. A
test should assert `OVERRIDABLE ∩ {the protection dials}` is empty, so a later "just add
one more" is red.

---

## O2 — EXPOSURE — an auto-test arm can be left applied indefinitely: the only thing that un-applies it is a reload driven from `attachRun`, and the watchdog that was built for exactly this compares two different documents' clocks

The arm is applied at boot, unconditionally (`init-entry.js:178`), on **every** document
in the session — feed, search, watch alike. Nothing subtracts it. The restore is a side
effect of `attachRun` finishing an arm and calling `reload()` (`auto-test.mjs:367-369`)
or of him pressing Stop (`abortRun`, `:284`). Three ways that never happens:

**(a) `attachRun` is only reachable from the pill block.** It is called at
`init-entry.js:5245`, inside `if (pillHost)`, inside `attachVideo`, which returns at
`:1796` when `!plan.faceGender`. So: a boot that lands on a page with no player, a boot
after he switched the launcher to off/blur mode, a boot where the player never attaches
— the arm is applied and there is no code path that can ever take it off. Executed (E8):

```
boot 1 applyPendingArm = { PRESENTER_GL: 1 }  PRESENTER_GL = 1
boot 2 (a page with no watch player, so attachRun never runs) = { PRESENTER_GL: 1 }  PRESENTER_GL = 1
run still pending after both boots: {"i":2,"mediaTime":30,"at":999999}
```

`sessionStorage` on Android WebView survives navigating away and back within the same
tab, and this app navigates ONE WebView in place. So a stuck run resumes the next time
he opens YouTube.

**(b) The watchdog cannot fire.** `staleRun` (`auto-test.mjs:145-148`) is
`nowMs - state.at > BOOT_TIMEOUT_MS`, and `now()` (`:239-244`) is
`performance.now()` — **a per-document clock that restarts at 0 on every navigation**.
`state.at` is a `performance.now()` from the *previous* document, taken after that
document had already run 8s of settle plus a 60s arm. Executed (E1):

```
staleRun({at:70000}, now=3000)  = false   (want true, an arm that never came back)
staleRun({at:70000}, now=40000) = false
BOOT_TIMEOUT_MS = 30000
```

The subtraction is negative for the whole life of the new document. The comment above it
— *"an arm armed and never reached a player closes the run rather than leaving an
experimental dial on his phone"* — describes something the code cannot do. And it is
checked at `:330`, **inside `attachRun`**, i.e. only once a player has already been
reached: the one case where it is not needed.

**(c) The pending timers outlive the page they were armed on, and reload whatever he is
looking at.** `attachRun` schedules `SETTLE_MS + ARM_SECS` = 68s of timers against the
current document (`:341-371`). Nothing cancels them — `tuneUi.destroy()` at
`init-entry.js:5260` does not touch `autoTest`. An SPA navigation away from `/watch`
leaves them armed; at T+68s they sample a detached video, `pushResult` a row
(`dropPct: null` because `totalD` is 0), and call `reload()` on whatever page he is now
on. Six times.

**(d) And on the way back it can measure a feed preview.** The pill block's only gate is
`isPlayer = dom.hasPlayerAncestor(video)` (`init-entry.js:1802`, `:5149`) — which is
**true for a feed preview**, because m.youtube plays previews into the shared
`#movie_player` (rules/youtube.txt, and `feedPreview()` at `:1806` exists precisely to
tell them apart; the pill block does not use it). So a run whose next boot lands on the
home feed will, the moment a preview autoplays, run `video.muted = true;
video.currentTime = st.mediaTime; video.play()` on a video the user did not open
(`auto-test.mjs:335-338`) and bank 60s of it as the arm.

**The severity.** The six arms move perf dials, not protection dials, so this is not a
gender bar left at its floor. It is EXPOSURE for two reasons the repo has already
written down: `PRESENTER_GL` is the dial the 1098 handoff says **"stays 0 until [a frame
capture] is read off the device"** and N12 records that "nothing in this batch has ever
rendered a GL pixel" — this leaves that unverified painting path holding the blur
indefinitely; and `BLUR_IN_FRAME` carries N4's latent row (a context that swallows
`ctx.filter` hides the divs and paints nothing). Neither is a state he chose.

**Fix.** Four parts, all small. (1) Stamp the run with `Date.now()`, not
`performance.now()`, or carry `performance.timeOrigin + performance.now()`; a
cross-document deadline needs a wall clock. (2) Run the watchdog at **boot**, in
`applyPendingArm`, before the arm is applied — not inside `attachRun`. (3) Gate both
`beginRun` and `attachRun` on `location.pathname.indexOf('/watch') === 0` — reuse
`feedPreview()`. (4) Have `attachRun` return a cancel handle and call it from
`tuneUi.destroy()`/`pillWatch`, so a navigation kills the timers instead of reloading
under him. And a test that runs the restore path, which O13 says none of them do.

---

## O3 — WRONG-NUMBER — the report prints the raw store, not what the clamp let through, and nowhere in the report is the value the phone is actually running

`overrideBlock` (`tuning-override.mjs:170-173`) builds the report block from
`readOverrides`, which checks only "whitelisted key, finite number" — it does **not**
clamp. `applyOne` (`tuning.mjs:440-448`) clamps. The two disagree whenever the store
holds an out-of-range value, which is every store written by anything other than
`setOverride`: a page script (O1), a hand edit over adb, or a build whose `SPEC` range
has since narrowed. Executed (E4):

```
applyOverrides -> { CUT_DELTA: 75, GENDER_CLEAR_SCORE: 0.36 }
overrideBlock  -> {"count":2,"applied":{"CUT_DELTA":999,"GENDER_CLEAR_SCORE":0.01}}
module GENDER_CLEAR_SCORE = 0.36   spec = {"min":0.36,"max":0.9}
```

The artifact he sends back says the phone was running `GENDER_CLEAR_SCORE 0.01`. It was
running 0.36. That is not a cosmetic gap — it is the same class of unattributable ring
the OTA `TUNED`/`TUNE_CLAMPED` block was added to close (`init-entry.js:183-193`:
*"every ring read since the channel shipped has been unattributable"*).

Worse, the block that exists cannot be repaired by reading it more carefully, because
**the report has no field anywhere for the effective value**. `engine.tuning.applied` is
what the OTA push landed; `tune.applied` is the store; overrides win over OTA for their
own keys, so a reader must join two blocks by hand and will still be wrong for any
clamped key. `applyOne`'s comment defends not writing through `TUNED` (right call), but
nothing was put in its place.

And the layer that has the right answer is **dead code**: `ACTIVE` is populated with the
clamped return of `applyOne` at `tuning-override.mjs:110` and `:128`, exposed as
`activeOverrides()` at `:177`, and `grep -rn activeOverrides app/gaze/` returns exactly
one hit — its own definition. Nothing calls it.

**Fix.** `overrideBlock` returns `ACTIVE`, not `readOverrides` — one word. Better still,
add `tune.effective`: `currentValue(k)` for every `SPEC` key at report time, which
answers "which numbers is this phone running" for OTA, override and arm in one block and
would have caught this row by construction.

---

## O4 — WRONG-NUMBER — the `noAv1` arm cannot reach the calls that pick the codec, so its row is not the row `probe_drops_ab.py` produced and the module's whole premise is that they are comparable

`auto-test.mjs:11-14` states the design goal: *"the fields below are the ones
probe_drops_ab.py already prints, so a run off his phone and a run off the Redmi are
comparable rows."* For five of the six arms that holds. For `noAv1` it does not, and the
measurement that says so is already in this tree.

`perf.mjs:175-193`, MEASURED on the Redmi by `probe_av1_caps.py`:

> the player asks `navigator.mediaCapabilities.decodingInfo` for av01 at **~380ms** and
> `MediaSource.isTypeSupported` at **~530ms** after document start, and **this bundle
> boots at ~1100ms** — so a wrapper installed here is too late for the first stream

The wrappers therefore live in `lib.rs no_av1_script()` (`lib.rs:1609-1650`) and decide
at call time from **`window.__TS_NO_AV1` once the setter has run, and the
`__TS_GAZE_TUNING__` payload before that** (`:1617-1622`). `__TS_GAZE_TUNING__` is the
**OTA** string Rust injects at document start. The auto-test arm and the panel override
live in `sessionStorage`/`localStorage`, which `no_av1_script` does not read, and reach
`setNoAv1` only when the bundle boots at ~1100ms — after both decisions.

So the Redmi row the handoff banks (`NO_AV1 1`, 15.51% dropped, `player fmt 242 (VP9)`
vs base `395 (AV1)`, `av1Refused 10`) was a **whole-document** arm: the stream was VP9
from the first byte. The on-phone `noAv1` arm measures a stream that starts as AV1 and,
per the same comment, may switch "at the next quality step" somewhere inside the 60s
window — a mixed window, or no change at all. Two rows, one label, different
experiments.

The panel repeats the error in words: `META.NO_AV1` carries `nextDoc: true`
(`tune-overlay.mjs:89`), rendered as **"applies on next video"** (`:568`). It does not
apply on the next video either — the next document also boots the bundle at ~1100ms.
Only an OTA push reaches the document-start path. `tune-overlay.test.mjs:114-117` pins
that false statement as an assertion.

**Fix.** Either give the local layers a document-start path — `no_av1_script`'s
`refuse()` reads `localStorage['tamescroll.tuning']` and `sessionStorage`'s arm as two
more fallbacks after `__TS_GAZE_TUNING__`, which is four lines and keeps the
decide-at-call-time shape — or drop `noAv1` from `ARMS` and label the panel row "over the
air only". What must not stand is a row printed beside five honest ones under a name that
implies the Redmi's arm.

---

## O5 — WRONG-NUMBER — a row carries no evidence that the arm, or the pipeline, or the video was running, and `bestRow` ranks on `dropPct` alone

`pushResult` (`auto-test.mjs:355-364`) banks eight fields: `arm, dropPct, rafHz,
mediaSecs, wallSecs, nativeBackend, codec, gl`. `bestRow` (`:206-215`) reads exactly one
of them and crowns the winner the panel prints with a ★ (`tune-overlay.mjs:599, 609`).
Executed (E6):

```
rows = [ {arm:0, dropPct:12.0, mediaSecs:60}, {arm:1, dropPct:0.4, mediaSecs:2.1} ]
bestRow = 1        (row 1 played 2.1s of video)
```

`mediaSecs` is banked and then ignored. Six ways an arm reads good because it did not
run, none of them recorded in the row:

- **The pill.** He taps "Blur off" mid-run and `init-entry.js:5206-5216` calls
  `delayDetach()`, `clearEl`, `videoRegion.clear`, `videoTracks = []`. The arm then
  measures a bare video with no delay line, no patches and no verdicts — the cheapest
  possible configuration. No field says the blur was on.
- **"Reset to shipped" mid-run.** Executed (E11):
  `arm 1 (blurInFrame) applied: BLUR_IN_FRAME = 1` → `after Reset to shipped:
  BLUR_IN_FRAME = 0, run still says arm 1` → the row is filed under "Blur into picture"
  with the dial at 0. The panel is open during a run (that is where the progress bar
  and Stop button live, `:583-595`) so the button is right there.
- **His own overrides make the control not a control.** `ARMS[0].over = {}` and the arm
  is applied *on top of* `applyOverrides`. Executed (E5): with `BLUR_IN_FRAME: 1` saved,
  `arm0 "control" BLUR_IN_FRAME = 1, arm1 "Blur into picture" BLUR_IN_FRAME = 1,
  identical: true` — two labels, one configuration. This is phase-C's "the A-series
  ladder was five labels on one arm" with the labels swapped.
- **Autoplay refused.** `attachRun:337-338` swallows the rejected `play()`. A paused
  60s gives `totalD === 0` → `dropPct: null`, which `bestRow` skips — that half is safe
  — but a partly-played arm gives a real small number over a short window and wins.
- **Miniplayer parked / app backgrounded / video ended.** All three shorten or change
  what is being composited. `rafHz` would show the last two; nothing shows the first.
- **Nothing records whether the panel was open**, and it rebuilds ~21 top-level nodes
  twice a second while measuring (O8).

**Fix.** Refuse a row rather than rank it: `bestRow` skips any row with
`mediaSecs < 0.9 * ARM_SECS`, and `pushResult` banks `blurOn` (the pill state),
`overrides` (a hash or the count at arm start), `paused`, `mini` and `hidden`
(`document.visibilityState` sampled at both ends). A row that cannot say it measured the
arm should print "—", not a number with a star next to it. And `beginRun` should freeze
the panel's steppers for the duration, or at minimum warn that a press invalidates the
run.

---

## O6 — DEFECT — the panel presents the temporary arm as the current setting, and one press promotes it to a permanent override

`rows()` reads `currentValue(key)` (`tune-overlay.mjs:258`), which is the live module
binding — OTA, then his overrides, then **the arm**. `stepKey` (`:492-501`) takes that
value as the base and writes the result through `setOverride`, which persists to
`localStorage`. During a run the panel therefore shows the experiment as if it were his
setting, and any press converts it. Executed (E10), booting arm 3 (`cpuMask`):

```
arm applied at boot: { NATIVE_CPU_MASK: 1 }   NATIVE_CPU_MASK now 1
panel shows NATIVE_CPU_MASK = 1   (the ARM, presented as the current setting)
after one "+" press, stored overrides = {"NATIVE_CPU_MASK":2}
  -> the temporary arm is now a PERMANENT override he never chose
```

The module's own header (`auto-test.mjs:24-29`) says *"a run that finishes restores
nothing because it never overwrote anything"*. It does not overwrite; it seeds. Same for
a switch — `stepKey`'s bool branch is `row.value > 0 ? 0 : 1`, so pressing "GPU blur"
during the `presenterGl` arm saves `PRESENTER_GL: 0` forever, and pressing it during any
other arm saves 1 — the dial the handoff says must stay 0.

**Fix.** `rows()` takes the arm's keys from `pendingArm(win)` and renders those rows as
"under test", disabled, showing the shipped/override value with the arm value beside it.
Or simply: while `readRun(win)` is non-null, the steppers are inert and say so.

---

## O7 — DEFECT — a non-integer arm index passes `readRun`'s guard and throws out of `applyPendingArm`, taking `codecProbe.install` and the OTA tuning report block with it

`readRun` (`auto-test.mjs:107-112`) validates the index as
`typeof st.i !== 'number' || !isFinite(st.i) || st.i < 0 || st.i >= ARMS.length` and its
comment claims: *"An index off the end — an older build reading a newer store — reads as
no run at all, never as arm NaN."* It checks range, not integrality. Executed (E3) with
`sessionStorage['tamescroll.autotest'] = {"i":2.5,...}`:

```
readRun         = {"i":2.5,"mediaTime":10,"at":0}
pendingArm      THREW: TypeError Cannot read properties of undefined (reading 'over')
applyPendingArm THREW: TypeError Cannot read properties of undefined (reading 'over')
progress        THREW: TypeError Cannot read properties of undefined (reading 'label')
```

The boot consequence is bigger than the throw. `applyPendingArm` is at
`init-entry.js:178`, inside the try that ends at `:194`, and the comment three lines
above it asserts *"All three go through the same SPEC clamp; none of them can throw a
boot."* It does not fail the boot — the catch swallows it — but everything after it in
that try is **skipped**:

- `:182` `if (codecProbe.CODEC_PROBE === 1) codecProbe.install(window)` — the codec probe
  silently never installs, and N13 already established that "none" cannot be told from
  "never installed" without `codec.hooked`, which also never gets set;
- `:192-193` `ids.tuning = { applied: TUNED, refused: TUNE_REFUSED, clamped: TUNE_CLAMPED }`
  — the OTA attribution block the whole 1086 channel was instrumented for is absent from
  the report.

`progress` throwing is the other half: it is called from `runProgress` → `testBlock` →
`build` → `render`, which is on a 500ms interval (`tune-overlay.mjs:685`), so the panel
throws twice a second for as long as it is open.

**Fix.** `st.i !== Math.round(st.i)` in `readRun`'s guard, and `if (!ARMS[st.i]) return
null` in `pendingArm`/`progress` — a bounds check that reads the array is worth more than
one that reasons about it. Independently, `applyPendingArm` and `codecProbe.install`
should not share a try: a diagnostic must not be able to take a page mutation with it.

---

## O8 — DEFECT — the panel replaces its entire subtree twice a second, so the sheet cannot be scrolled and it perturbs the number it is displaying

`render()` (`tune-overlay.mjs:669-677`) builds a whole new panel and swaps it in;
`open()` arms it on a `setInterval` at `REFRESH_MS` 500 (`:37`, `:685`), and every
stepper press calls it too (`:499`). Executed (E9):

```
a 500ms refresh is armed: true
same node after one refresh tick? false   (the scrolled sheet is rebuilt from the top)
rows rebuilt per tick: 21 top-level children
```

21 with Advanced collapsed; the panel is `max-height:60vh; overflow-y:auto` (`:388`) over
28 dials, so on a 412px phone almost everything is below the fold. A fresh node has
`scrollTop` 0. **The panel scrolls back to the top twice a second**, and again on every
press — so tuning anything in Advanced means chasing the row back up the sheet between
ticks. This is the one surface in the commit whose entire justification is that he can
actually use it on the phone.

The second half is a measurement problem. The readouts (`:317-375`) report dropped frames
and rAF Hz **while the panel tears down and rebuilds a few hundred nodes inside
`#player-container-id` at 2Hz**, over a playing video, on a Helio-class phone. The panel
is open during an auto-test run (that is where the progress bar is), so arms are measured
under a load the closed-panel arms do not carry, and nothing records which. I cannot
price it without a device, so I am not claiming a magnitude — the mechanism is enough to
file, because the whole point of the panel is the number in it.

**Fix.** Build once; on a tick update only the seven readout text nodes and the progress
bar. Keep `build()` for open/step/group-toggle. That also removes the perturbation.

---

## O9 — DEFECT — the open panel paints over the blur pill, which the same commit argues at length must not be compromised

From the CSS literals, `tune-overlay.mjs:386-391` and `init-entry.js:5171`:

| element | position | z-index |
|---|---|---|
| pill | `top:48px; right:8px` | 2147483645 |
| gear | `top:48px; right:112px` | 2147483645 |
| panel | `top:48px; right:8px; left:8px` | **2147483646** |

The panel spans the full width of the host from the same top edge and outranks both. So
while it is open, **the pill is unreachable** — and the gear with it, so the
toggle-to-close at `:466-470` cannot fire either (only the X at `:626` and the tap-away
handler at `:476`).

The commit's own reasoning is why this is a row and not taste: it declines a long-press
opener because *"the pill is his escape hatch from a wrong verdict and a control that does
two things is one you stop trusting"* and `tune-overlay.test.mjs:170-190` exists to keep a
listener off it. The listener stays off it; the panel covers it anyway. A wrong verdict
while the panel is open is two taps from gone, and the first tap is the one that is not
where he expects it.

**Fix.** `top: 92px` on the panel, or reserve the pill's row: `padding-top` on the panel
and let the pill sit above it. Either is one declaration.

---

## O10 — DEFECT — the arm row records `native.backend` only, and drops the two fields that say whether `NATIVE_CPU_MASK` took and whether native was alive

`attachRun` banks `nativeBackend: (native && native.backend) || 'none'`
(`auto-test.mjs:361`). `snapshot()` returns four fields
(`native-client.mjs:577-579`):

```js
return { backend: state.backend, npu: state.npu, backends: state.backends, dead: state.dead };
```

`backends` is the per-model map, and it is **the only evidence the `cpuMask` arm did
anything** — `NATIVE_CPU_MASK` is a bitmask that rebuilds individual interpreters on
XNNPACK (`native-client.mjs:57-66`), which is exactly why the Redmi table in the handoff
carries a per-model column: *"face cpu / gender gpu / person gpu, 286"*. A top-level
`backend` of `gpu` is what the mask arm reports whether or not the mask arrived.

`dead` is worse to drop. Native dying mid-run is not hypothetical here — the first 1098
build read *"26.5% drops, native dead"* because the NNAPI arbiter blew the 15s ready
timeout. That is a doubling of the number this whole instrument measures, and it is
invisible in the row. A reader comparing 12.05% against 26.5% has no field telling them
the second row was a different engine.

Nothing else in the row covers it: the panel's table prints only Mode/Dropped/Frame rate
(`tune-overlay.mjs:602`), so the codec field — the only per-arm sanity check that did
survive — is not on screen either.

**Fix.** Bank `nativeDead: native && native.dead ? 1 : 0` and the three per-model
backends as three more enum fields (`faceBackend`/`genderBackend`/`personBackend`, all
named after the existing `nativeBackend` enum so the walker keeps working), plus
`npu`, which already has an enum. Show `dead` in the panel's table — a row measured with
native dead should be struck through, not ranked.

---

## O11 — NIT — two dials need a fresh document and are not tagged "applies on next video"

`META.nextDoc` is set on `DELAY_MS`, `PRESENTER_GL`, `NO_AV1`, `CODEC_PROBE`
(`tune-overlay.mjs:53, 68, 89, 195`) and pinned by
`tune-overlay.test.mjs:114-117`. Two more belong there:

- `setNativeCpuMask` (`native-client.mjs:66`) sets a module variable and nothing else.
  The mask reaches the engine as a CONFIG request *"on EVERY native-ready"* (`:63-64`) —
  i.e. at the next attach of a native client, not now. Pressing "Models on the CPU" moves
  a number in the panel and changes nothing in the running document.
- `setNativeNpu` (`:81`) likewise: it feeds `configFlags()` (`:82`), read when CONFIG is
  built at ready.

(`NO_AV1` is a third, and a worse case — O4: it is not "next video" either.)

**Fix.** `nextDoc: true` on both, and extend the test's expected list. If a live effect is
wanted, `setNativeCpuMask` can push a CONFIG immediately when a client exists.

---

## O12 — NIT — `tuneBlock` claims `lifeCounters`' standard and does not implement it

`diag-report.mjs:605-608` states the rule for itself:

> Same rule as tuningBlock and lifeCounters: the SHAPE is the guarantee, never an
> assumption about who wrote the object — both of these are read back out of browser
> storage, which any script on the page can write.

`lifeCounters` (`:554-572`) enforces that on **keys**: `/^[A-Za-z][A-Za-z0-9]{0,31}$/`, no
trailing `R`, and a `LIFE_MAX_KEYS` cap with the refusals counted as `lifeDropped`.
`tuneBlock` (`:610-618`) filters values only and caps nothing. Executed (E7c):

```
tune = {"overrides":1,"applied":{"drop tables; --":5},"autotest":[]}
violations = []
```

A free-text key reaches the shared artifact and the invariant passes it. It fails **safe**
in the real app for a reason that lives in another file — `readOverrides` whitelists
first — and the string-level scan in `reportViolations` (`:130-135`) does cover the
serialized keys, so a url- or hostname-shaped key would refuse the whole report rather
than leak (E7b: `["contains a hostname-shaped token: evil.com"]`; E7e, a video id as a
key: `["contains a run of location.href"]`). But that also means the commit message's
*"object keys are never walked, so no new enum"* is only true of `walk()`; the report as a
whole does inspect them, in a way that would make the artifact unshareable rather than
unsafe. Worth saying out loud so the next round does not rely on the shorter claim.

**Fix.** Four lines: apply `lifeCounters`' key regex and a cap inside `tuneBlock`, count
the drops as `tuneDropped`. And correct the comment to "keys are not enum-checked, but
they are in the serialized scan".

---

## O13 — DEAD-CHECK — three of the new tests cannot fail for the property they are named after, and nothing forbids an arm from moving a protection dial

`auto-test.test.mjs`'s header sets the bar itself: *"the ONLY thing standing between a
half-finished run and a phone stuck on somebody's experimental dials is the restore path
— so that is what these tests are about."* The restore path is never executed. No test
calls `attachRun`. No test asserts that a dial goes back after `endRun`. The test named
for it, *"a run that does not come back is aborted rather than left armed"*
(`:67-77`), calls `staleRun(startRun(30, 1000), 1000 + BOOT_TIMEOUT ± 1)` — **both
arguments from the same clock**, which is the one configuration production never
produces (O2b). It is arithmetic on a pure function, passing while the mechanism it
guards is inert.

`tune-overlay.test.mjs:208-213` reads `miniplayer.mjs` as text and greps the
`var OUR_CONTROLS` line for `ts-gaze-gear`. The guard `onDown` actually consults is
`onAControl` (`miniplayer.mjs:655-665`), which has two branches — the `closest()` path
at `:657` (which does read `OUR_CONTROLS`, so the constant is not dead) and a manual
ancestor walk at `:658-664` that the test does not see at all. Deleting `onAControl`'s
call site leaves this test green. This is the loop-42 A5 shape (a source match a comment
satisfied) and phase-G G9's ("matched text, not writes"), one round later.

`tune-overlay.test.mjs:114-117` pins `nextDoc` as exactly
`['CODEC_PROBE','DELAY_MS','NO_AV1','PRESENTER_GL']` — a set that is wrong in both
directions (O4, O11). A test that encodes a false statement is worse than no test,
because the next round has to argue with it.

And the property the brief cares about most is unpinned: `auto-test.test.mjs:26-34`
checks every arm key is *on the whitelist*, which every protection dial also is. Adding
`{ DELAY_MS: 0 }` to `ARMS` — the arm somebody will want the moment drops are the topic —
passes that test.

**Fix.** (1) A test that drives `attachRun` with fake timers, a fake video and a fake
`location.reload`, and asserts the dial is back on the next boot and that a run that
never reaches a player is dead by boot N+1. (2) Replace the grep with a call:
`installMiniplayer` on the DOM stub, fire a touchstart on an element classed
`ts-gaze-gear`, assert no drag armed. (3) A test asserting
`ARMS.every(a => Object.keys(a.over).every(k => PERF_ONLY.indexOf(k) !== -1))`.

---

## SURVIVES — attacked and not found

Each of these was a candidate row that the evidence killed.

1. **No new page-reachable function surface.** `grep -n "window\.__TS\|win\.__TS\|g\.__TS"`
   over the three new modules returns three hits, all **reads** (`__TS_GAZE_IDS.stages`,
   `__TS_GAZE_RENDER`, `__TS_DELAY_STATS`). Nothing in `tune-overlay`, `auto-test` or
   `tuning-override` is published on `window`. The attack in O1 is the storage key, not a
   callable.

2. **No arm moves a protection dial, as committed.** `ARMS`
   (`auto-test.mjs:45-52`) touches `BLUR_IN_FRAME`, `PRESENTER_GL`, `NATIVE_CPU_MASK`,
   `RENDER_EVERY`, `NO_AV1` and `{}`. All five are perf. (What is missing is the test that
   keeps it that way — O13.)

3. **The whitelist and clamp hold on the apply path.** Every hostile value in E2 landed
   on a range edge; an unknown key is dropped at `readOverrides` and refused again at
   `applyOne`; a string, a `null`, an array payload and malformed JSON all read as `{}`.
   The layer is exactly as strict as the OTA one. O1 is about *who may write*, not about
   the filter.

4. **`shippedTuning` is right when the OTA payload is absent.** `applyTuningFromWindow`
   with no `__TS_GAZE_TUNING__` leaves the constants alone, so the snapshot at
   `init-entry.js:174-176` is the build defaults, which is what "shipped" means on a
   phone whose rules refresh never landed. The snapshot is taken between layer 1 and
   layer 2 as the comment claims, and "Reset to shipped" therefore restores OTA values,
   not override values — verified in E11 (`BLUR_IN_FRAME` 1 → 0).

5. **The happy path really does restore.** Last arm → `endRun(); markShow(); reload()`
   (`auto-test.mjs:367-369`) → next boot finds no run, applies no arm, and the dials are
   OTA + his overrides. `abortRun` does the same. The failure in O2 is every path that is
   not this one.

6. **A hostile results row cannot put free text in the report.** E7d: a row with
   `nativeBackend: 'https://evil.example/x'` and `codec: 'zzz'` came back as `'none'` and
   `'none'` with `violations = []`. `enumOr` (`diag-report.mjs:646-649`) validates against
   `ENUMS`; `normalizeRow`'s permissive `typeof === 'string'` is caught downstream. The
   12-row cap holds (E7 / `autotest-report.test.mjs:51`).

7. **The gear and the panel cannot arm the miniplayer drag.** `onDown` calls
   `onAControl(target)` and returns **before** `bindHost` and before `start` is set
   (`miniplayer.mjs:706-711`), and `OUR_CONTROLS` at `:652` is live at `:657`. Two
   independent reasons cover the panel: its root carries `ts-gaze-tune`, and its steppers
   are `<button>`, which `PAGE_CONTROLS` already refused. The 1061/1062/1063 class does not
   recur here.

8. **No new scroll-blocking listener.** The only document-level listener the panel adds is
   a capture-phase `click` (`tune-overlay.mjs:485`) which never calls `preventDefault`.
   `click` is not in the scroll path. The 2026-08-30 regression (a non-passive document
   `touchmove`) is not repeated.

9. **The miniplayer CSS really does hide all three.** The concatenated selector at
   `miniplayer.mjs:248-251` resolves to
   `html.ts-mini .ts-gaze-pill,html.ts-mini .ts-gaze-gear,html.ts-mini .ts-gaze-tune{display:none !important;}`
   — the comment sits between two string fragments and does not break it.

---

## NOT CONFIRMED — attacked, no evidence either way, needs the device

Listed so the next round does not mistake them for cleared.

- **Does `#player-container-id` clip a 60vh panel?** The panel is `position:absolute`
  inside a container that is ~232px tall in portrait. If that container ever computes
  `overflow: hidden`, most of the sheet — including the buttons at the bottom — is
  unreachable. Nothing in our CSS sets it; YouTube's is unread. One `getComputedStyle`
  on the device settles it.
- **Does `video.muted = true` (`auto-test.mjs:335`) persist?** It is never restored
  in-document, and YouTube mirrors player state into its own storage. If it persists, a
  six-minute run leaves his audio off with nothing saying why.
- **What a 2Hz full-subtree rebuild costs in dropped frames** (O8, second half). The
  mechanism is confirmed; the magnitude is not, and it is exactly the quantity the panel
  claims to report.
- **Whether a `noAv1` arm's ABR step actually switches codec mid-window** (O4). The row's
  `codec` field would show it. Nobody has run it.

---

## Ledger rows

| id | severity | one line |
|---|---|---|
| O1 | EXPOSURE | Every protection dial is writable by any page script via `localStorage['tamescroll.tuning']`; the override layer honours the whole OTA whitelist, not the perf subset the panel needs. |
| O2 | EXPOSURE | An auto-test arm survives indefinitely: restore only happens inside `attachRun`, the staleness watchdog compares two documents' `performance.now()` clocks, and the arm can be measured on a feed preview. |
| O3 | WRONG-NUMBER | `overrideBlock` reports the raw store, not the clamped value that took effect; the report has no field for the value the phone is running; `activeOverrides()` is dead. |
| O4 | WRONG-NUMBER | `NO_AV1` from a local layer cannot reach the document-start wrappers, so the `noAv1` arm is not the Redmi arm it is printed beside, and "applies on next video" is false. |
| O5 | WRONG-NUMBER | A row records no evidence the arm/pipeline/video ran (pill off, mid-run reset, his own overrides, short playback), and `bestRow` ranks on `dropPct` alone. |
| O6 | DEFECT | The panel renders the temporary arm as the current setting; one press promotes it to a permanent override. |
| O7 | DEFECT | A non-integer arm index passes `readRun` and throws out of `applyPendingArm`, skipping `codecProbe.install` and the OTA tuning report block. |
| O8 | DEFECT | The panel replaces its whole subtree every 500ms: the sheet cannot be scrolled, and it perturbs the drops figure it displays. |
| O9 | DEFECT | The open panel paints over the blur pill and over its own gear. |
| O10 | DEFECT | The arm row drops `snapshot().backends` and `.dead` — the evidence that `NATIVE_CPU_MASK` took and that native was alive. |
| O11 | NIT | `NATIVE_CPU_MASK` and `NATIVE_NPU` need a fresh document and are not tagged "applies on next video". |
| O12 | NIT | `tuneBlock` claims `lifeCounters`' shape guarantee and filters values only — no key regex, no cap. |
| O13 | DEAD-CHECK | The staleness test tests arithmetic not the restore path, the OUR_CONTROLS test is a source grep, the `nextDoc` test pins a false set, and nothing forbids a protection dial in `ARMS`. |

**13 rows: 2 EXPOSURE, 3 WRONG-NUMBER, 5 DEFECT, 1 DEAD-CHECK, 2 NIT — all CONFIRMED by
executed evidence. 9 attacked and not found; 4 could not be settled without the device.
`npm test` 817/817 at 5c105f8.**
