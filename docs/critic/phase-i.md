# Phase I — critic report, Stage A + the unwired Stage B modules

Range `796f050..7ddfef1`: commits `53e003d` (Task 1), `548f35e`
(Task 2), `8fbf0f5` (Task 3), `514e09a` (Task 4), `7ddfef1` (device row),
and the unwired `96479f6`/`aa910f2` (delay-core), `5a0239a`
(delay-presenter), `e0099b1` (track-timeline), `7f6c49b` (video-region
timeline path). Work landed after `7ddfef1` (Tasks 7/9/10/11) is outside
this audit and was still in flight while it ran.

**15 findings — WRONG-NUMBER 4, EXPOSURE 4, DEAD-CHECK 3, NIT 4.**

Method: everything below was RUN. Three source mutations were made to
`app/gaze/src/init-entry.js` for the dead-checks; each was restored from
a scratchpad copy inside the same shell command and verified with
`git diff --quiet app/gaze/src/init-entry.js`. Two scratch benches live
in the session scratchpad (`gs-denom.mjs`, `regime.mjs`) and import the
repo's own modules by absolute `file://` URL, so no file under
`Z:\Apps\Disconnect` was added by this round. At the end of the audit
`npm test` was **633/633** and `bench/critic-gate.mjs` read **80 rows /
80 CONFIRMED**.

---

## I1

```
SEVERITY  WRONG-NUMBER
WHERE     app/gaze/bench/arch-arms.mjs:88 (`HIS_EFFZOOM = 2000`) and its
          justification in the comment above it; consumed by
          hisRegimeOpts, by CONTROL, by test/control-triple.test.mjs, by
          bench/gender-skip-arm.mjs, and by the warnDerivedCadence
          stderr block. Consequence: every corpus number in the repo,
          the control triple CLAUDE.md rule 2 tells the next session to
          self-check against, and the coast-dial ruling the owner has
          been asked for twice.
CLAIM     `HIS_EFFZOOM` is hard-coded 2000 and the comment above it says
          why that is safe: on his Redmi a verdict costs ~1250ms, so
          effZoom wants 5000 and THE CAP PINS IT AT 2000 IN EVERY ARM.
          The pin is `min(VERDICT_MAX_INTERVAL_MS, max(ZOOM_INTERVAL_MS,
          lastVerdictMs * VERDICT_DUTY))`. Task 3 halved VERDICT_DUTY
          (4 -> 2) and Tasks 1/2/4 cut the verdict cost, so the cap NO
          LONGER BINDS: `latency-ab-stageA.json` reads
          `verdictMsP50 705` and `toldMs 1589.4`. The one property the
          hard-coded 2000 rested on is exactly the property Task 3
          removed, and no Stage A commit touched arch-arms.mjs.
          The baseline is not insensitive to this. Re-running the
          SHIPPED control arm with `hisRegimeOpts(g, 1589)` instead of
          the default:

            MAN    told 2000 (pinned):  22.5 / 136.5 / 547.5
                   told 1589 (device):  26.5 / 129.0 / 442.0
                                        (+4.0 / -7.5 / -105.5)
            WOMAN  told 2000 (pinned):  25.5 / 201.5 / 628.0
                   told 1589 (device):  28.5 / 194.0 / 518.0
                                        (+3.0 / -7.5 / -110.0)

          +4.0s of man exposure and -105.5s of phantom is larger than
          almost every lever this repo has priced this month, and it is
          produced by correcting one number nobody edited.
FALSIFIER Show the triple does not move when `told` is corrected to the
          device's measured 1589.4. RUN (scratchpad `regime.mjs`,
          `hisRegimeOpts(g, told)` -- the arm's own documented override
          -- 18 windows, K_HIS=3, shipped module, no wrapper):

            K  told   arm            exposure falseCov  phantom
            3  2000   CONTROL           22.5   136.5    547.5
            3  1589   CONTROL           26.5   129.0    442.0
            2  2000   CONTROL           12.5   122.5    642.5
            2  1589   CONTROL           13.5   117.5    477.5
            2  1201   CONTROL           20.0   108.0    345.0
            (woman)
            3  2000   CONTROL           25.5   201.5    628.0
            3  1589   CONTROL           28.5   194.0    518.0
            2  1589   CONTROL           15.0   181.0    569.5
            2  1201   CONTROL           20.5   175.5    417.0

          The falsifier fails: the triple moves on every axis.
FIX       `HIS_EFFZOOM` must stop being a literal. Derive it the way the
          device does -- `min(VERDICT_MAX_INTERVAL_MS,
          max(ZOOM_INTERVAL_MS, HIS_VERDICT_MS * cadence.VERDICT_DUTY))`
          with `HIS_VERDICT_MS` a banked device measurement -- so a
          VERDICT_DUTY change re-derives it instead of silently
          invalidating it. Re-derive `CONTROL` at the corrected told,
          update `test/control-triple.test.mjs` and CLAUDE.md's
          self-check row, and re-price the pending coast ruling (see the
          CLEAN section, Q2b) before it is put to him a third time.
```

## I2

```
SEVERITY  EXPOSURE
WHERE     app/gaze/bench/gender-skip-arm.mjs (the acceptance block);
          plan Task 4's "Acceptance: exposure within +1.0s of CONTROL in
          both modes"; commit 514e09a's body.
CLAIM     Task 4 was accepted on an exposure delta of +1.0s (man) and
          -1.5s (woman) measured at `hisRegimeOpts(g)` -- i.e. told
          2000, K=3. That is the regime I1 shows his phone left. In the
          two corpus regimes that BRACKET the measured stage-A device
          (verdictGapP50 1201ms, toldMs 1589.4), the woman-mode exposure
          delta is not -1.5s:

            regime            man delta              woman delta
            K=3 told 2000     +1.0 / +34.0 / +29.0   -1.5 / +33.5 / +41.5  <- accepted here
            K=3 told 1589     +1.5 / +33.5 / +27.5   +0.0 / +32.0 / +36.5
            K=2 told 1589     +1.0 / +23.0 /  +7.0   +4.0 / +25.5 / +34.0
            K=2 told 1201     +0.5 / +21.0 / +10.0   +4.5 / +23.0 / +39.5

          At K=2 the woman-mode exposure delta is +4.0 to +4.5s against
          a stated budget of +1.0s -- four times over, and the plan says
          in that case to "raise nothing -- report the number and stop
          for a ruling". The gate did not fail because the arm was never
          run outside the regime the constant was already tuned in.
          Separately and in EVERY regime: false cover is +21 to +34s and
          phantom +7 to +42s, and NEITHER was gated at all. +34.0s on a
          CONTROL of 136.5s is +24.9% of false cover -- more than double
          the -12% that eleven releases (1080 -> 1091) bought, in the
          opposite direction, and phase G calls false cover the single
          biggest error left.
FALSIFIER Run the arm at a told and stride matching the device and show
          the woman delta stays <= +1.0s. RUN (scratchpad
          `regime.mjs`): it is +4.0s at K=2/told 1589 and +4.5s at
          K=2/told 1201. The two man rows stay inside budget.
FIX       Re-run `bench/gender-skip-arm.mjs` at the corrected regime
          from I1 and put the woman number to the owner -- it is an
          exposure trade and this repo's rule is that those are his.
          Independently: widen the acceptance to false cover and
          phantom, because on this lever they are 20-30x the exposure
          move and they are the two columns he actually complains about.
```

## I3

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/src/init-entry.js (the Task 1 gate, in sampleOnce);
          app/gaze/test/person-skip-live.test.mjs (the only test the
          commit cites).
CLAIM     Task 1's entire behaviour change is untested. `personsLive`
          appears in exactly one test file, which imports
          `src/person-skip.mjs` and asserts a pure function; it never
          loads init-entry.js. `positionPassSkipped` appears in ZERO
          tests (`grep -rn positionPassSkipped app/gaze/test/` -> no
          match). So the gate can be deleted outright and the suite is
          fully green. That includes the `sampling = false;` line, which
          the commit body itself identifies as the difference between "a
          skipped pass" and "a permanent freeze of every future pass on
          that video".
FALSIFIER Delete the gate and show the suite goes red. RUN:

            $ python -c "... remove the 5-line gate from init-entry.js"
            GATE DELETED
            $ grep -c positionPassSkipped src/init-entry.js
            0
            $ npm test
            i tests 633
            i pass 633
            i fail 0

          The falsifier fails. (Restored immediately;
          `git diff --quiet src/init-entry.js` -> clean.)
FIX       A behaviour test in the shape of `test/null-mint.test.mjs`:
          drive sampleOnce's guard chain, or at minimum a
          comment-stripped structural test in the shape of
          `person-skip.test.mjs`'s own loadstart test, asserting (a) the
          gate exists inside the player branch and after `wasVerdict`,
          and (b) `sampling = false;` is inside it. The second is the
          one that turns a defect into a dead player.
```

## I4

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/test/track-needs-read.test.mjs ("init-entry.js bumps
          genderReadSkipped inside the verdict branch").
CLAIM     The test locates the skip with
          `src.indexOf("bumpLife('genderReadSkipped')")` and
          `src.includes('trackNeedsRead(')` on RAW source. Comments are
          not stripped, so the check is satisfied by a commented-out
          call -- the ordinary way a call gets disabled, and the exact
          shape phase-g G9 named ("Comments stripped, only a bump SITE
          counts") and that `person-skip.test.mjs` strips comments for,
          in this same repo, with a comment saying why.
FALSIFIER Comment out the whole Task 4 skip block in init-entry.js and
          show the test goes red. RUN:

            $ python -c "... prefix the 5-line skip block with // ..."
            TASK 4 SKIP COMMENTED OUT
            $ node --test test/track-needs-read.test.mjs
            i tests 7
            i pass 7
            i fail 0
            $ npm test
            i tests 633
            i pass 633
            i fail 0

          The falsifier fails, on the file's own test AND on the whole
          suite. (Restored; `git diff --quiet` -> clean.)
FIX       Strip comments before the indexOf, the way
          `person-skip.test.mjs` does for the loadstart reset:
          `.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^[ \t]*\/\/.*$/gm,'')`
          over the sliced region, then match.
```

## I5

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/gender-skip-arm.mjs ("RED-PROOF, BUILT IN" /
          "This is the property the whole design rests on -- so it is
          asserted, not eyeballed").
CLAIM     The @0 arm cannot fail. `trackNeedsRead` reads
          `if (nowMs - t.readAt >= GENDER_REFRESH_MS) return true;` and
          the arm's clock only advances, so at 0 that comparison is
          unconditionally true and the skip BRANCH IS NEVER ENTERED. The
          arm therefore proves only that its own `{...o, at: nowMs}`
          spread is transparent -- nothing about whether the conversion
          it performs when the skip DOES fire resembles what
          init-entry.js does. It is also outside the OTA clamp
          ([1000, 4000] in tuning.mjs), so it is not a shippable
          control point either.
FALSIFIER Break the skip path deliberately and show @0 notices. RUN
          (scratchpad `gs-denom.mjs`, the arm's wrapper with the skipped
          observation returned WITHOUT its `at` field -- a real fidelity
          bug, since both the app and the arm push `at`):

            MAN   @0 with the skip path DELIBERATELY BROKEN:
                  reproduces CONTROL = true, fired = 0   <- still PASSES
            WOMAN @0 with the skip path DELIBERATELY BROKEN:
                  reproduces CONTROL = true, fired = 0   <- still PASSES

          The falsifier fails in both modes.
FIX       Replace the @0 point with one that exercises the branch. Two
          that would: (a) assert that at a huge refresh the arm's
          `fired` equals an independently counted "settled track present
          at a verdict observation" from the banked tracks; (b) assert
          the arm reproduces CONTROL when `trackNeedsRead` is stubbed to
          always return true WHILE the wrapper still rewrites every
          observation -- that isolates the conversion from the
          predicate, which is what @0 was trying and failing to do.
```

## I6

```
SEVERITY  WRONG-NUMBER
WHERE     app/gaze/bench/gender-skip-arm.mjs (`fired=` printed with no
          denominator); commit 514e09a's body quotes `fired=345` /
          `fired=355`.
CLAIM     `fired=345` is unreadable as published: the arm never prints
          how many verdict observations it could have fired on, so the
          corpus rate cannot be compared to the device's
          `genderReadSkipped 18` over 117 verdicts. Measured, the
          denominator is 1218 (man) / 1215 (woman), so the corpus rate
          is 28.3% / 29.2%. And that rate is not a smooth property of
          the constant -- it is a STEP FUNCTION of the bench's own
          verdict spacing (`dt * stride` = 500 * 3 = 1500ms):

            refreshMs  exposure falseCov phantom  fired/eligible  rate
            0            22.5    136.5   547.5      0/1218        0.0%
            500          22.5    136.5   547.5      0/1218        0.0%
            1000         22.0    138.5   545.5     11/1218        0.9%
            1500         21.0    139.0   553.0     25/1218        2.1%
            2000         23.5    170.5   576.5    345/1218       28.3%
            3000         22.0    171.5   572.0    345/1218       28.3%
            4000         20.0    179.5   588.0    465/1218       38.2%
            1e9          14.0    245.5   645.5    650/1218       53.4%

          The shipped 2000 sits one step above a cliff at exactly the
          bench's 1500ms spacing. On the device the spacing is 1201ms
          (stage A) with p95 2315ms, so on ~5% of passes the gap already
          EXCEEDS 2000 and the skip is off. GENDER_REFRESH_MS is
          therefore not an independent dial: its intensity is
          `P(verdict gap < GENDER_REFRESH_MS)`, i.e. a function of
          VERDICT_DUTY, which Task 3 moved in the same session. Under
          1091's 2075ms gap the skip would have fired almost never.
          Note also two settings with an IDENTICAL fired count (2000 and
          3000, man, 345 both) that produce different triples
          (23.5/170.5/576.5 vs 22.0/171.5/572.0) -- a 1.5s exposure
          swing, larger than the +1.0s acceptance budget the arm gates
          on.
FALSIFIER Show the rate is stable across the dial. RUN (scratchpad
          `gs-denom.mjs`): it is 0.9% at 1000 and 28.3% at 2000, a 31x
          step across one OTA range. Falsifier fails.
FIX       Print the denominator and the arm's own verdict spacing beside
          `fired`. Then state GENDER_REFRESH_MS's contract in terms of
          the cadence it is relative to (e.g. "skip while the last read
          is younger than N verdict intervals") rather than in absolute
          ms, or the constant silently changes meaning every time
          VERDICT_DUTY or the device's pass cost moves.
```

## I7

```
SEVERITY  WRONG-NUMBER
WHERE     spikes/gauntlet/probe_latency_ab.py (`st.vAt.push`);
          app/gaze/src/init-entry.js (the `.finally` that pushes `stage`
          with `stage.v = wasVerdict ? 1 : 0`) and the `passDropped`
          early return, which sets `lastZoomAt = 0`; commit 7ddfef1's
          headline "verdict gap 2075 -> 1201ms" and "Verdicts 74 -> 117".
CLAIM     `stages` is pushed in `.finally`, so a pass DISCARDED by the
          epoch guard still records `v:1` and the probe counts it as a
          verdict. Stage A's own row reports `passDropped 19` of 117
          (16%) and the 1091 row `passDropped 23`. A dropped pass
          produces no observations AND zeroes `lastZoomAt`, so the very
          next pass is a verdict with a near-zero gap. The scene gate
          does the same on a cut (`lastSample = 0; lastZoomAt = 0`), 34
          of them in the stage-A window. So `verdictGapP50` is a mixture
          of cadence gaps, cut-forced gaps and drop-forced gaps, in
          proportions that DIFFER between the two arms (1091: 23 drops +
          35 cuts over 74 verdicts; stage A: 19 + 34 over 117).
          Independent arithmetic says the published p50 is below what
          the shipped cadence permits: effZoom is `max(ZOOM_INTERVAL_MS
          400, verdictMs * VERDICT_DUTY 2)` and the same row reports
          `verdictMsP50 705` -> effZoom p50 1410ms, with `toldMs` read
          off the device at 1589.4. A p50 gap of 1201ms is 15% below the
          floor the clock allows, which is only possible because ~45% of
          the gaps are forced ones.
          The direction of the improvement survives (useful verdicts 98
          vs ~51, i.e. 1.53s vs 2.94s per useful verdict) -- it is the
          DIGITS that do not.
FALSIFIER Show `stages` excludes dropped passes. It does not:
          `stage.v = wasVerdict ? 1 : 0; dbgSt.stages.push(stage);`
          sits inside `.finally(...)`, downstream of the
          `myEpoch !== passEpoch` return.
FIX       Stamp the drop on the stage object (`stage.dropped = 1` before
          the early return) and have the probe report verdicts, useful
          verdicts, and three gap series -- all, cut-forced, and
          free-running. The free-running p50 is the number Task 3's
          acceptance ("gap p50 <= 1000ms") was actually about, and it
          has never been measured. Secondary: `vAt` is stamped by a
          200ms `setInterval` that is starved for the whole duration of
          a pass, so every gap carries up to ~200ms of quantisation --
          harmless for the p50 comparison, not harmless for the p95 the
          coast margin (CLEAN section, Q2b) is judged against.
```

## I8

```
SEVERITY  EXPOSURE
WHERE     app/gaze/src/track-timeline.mjs (the "only in B" branch);
          plan Task 8's rule text: "Track only in B (born by B): ... ->
          B's box, B's state, back-dated to A (zero exposure, one
          interval of false cover at most)."
CLAIM     "Zero exposure" is false for a moving subject, which is the
          only interesting case. The back-dated entry pushes
          `{ id: tb2.id, box: tb2.box, state: tb2.state }` -- B's box,
          held constant, NOT lerped (there is no A box to lerp from).
          So for every presented frame in `(A.mediaTime, B.mediaTime]`
          the patch sits where the subject will be at B, not where they
          were at m. A person entering from frame-left and walking right
          is covered at their arrival position and SHARP at their actual
          position for up to one verdict interval -- the same interval
          the delay line exists to remove. The symmetric branch ("only
          in A", a detector miss) has the same shape: it holds A's box,
          so a subject who kept moving is sharp where they now are,
          which is exactly what the rule's own justification ("a
          detector miss must not uncover") claims to prevent. Neither
          branch is bounded by anything except the snapshot spacing --
          there is no cap in the module.
          Not yet shipped at the time of audit: Task 10 was not done, so
          no caller reached `boxesAt`. That is what keeps this out of a
          release, not anything in the module.
FALSIFIER Point at the lerp on the only-in-B branch. There is none:

            for (var k = 0; k < B.tracks.length; k++) {
              var tb2 = B.tracks[k];
              if (seenB[tb2.id]) continue;
              if (cutBetween(tl, mediaTime, B.mediaTime)) continue;
              out.push({ id: tb2.id, box: tb2.box, state: tb2.state });
            }

          `lerpBox` is called only in the both-branch.
FIX       Cover the SWEPT region, not the endpoint: on the only-in-B
          branch emit the union of B's box with B's box translated back
          along the track's own velocity (or, with no velocity, an
          outward pad proportional to the interval). Patches stay SOLID
          -- a union is one rectangle. Same on the only-in-A branch.
          Then correct the plan's rule text, which currently promises a
          guarantee the code does not provide.
```

## I9

```
SEVERITY  EXPOSURE
WHERE     app/gaze/src/delay-presenter.mjs (`var ASSUMED_FPS = 30;`,
          `currentBudget`, the `pick < 0` branch);
          app/gaze/src/delay-core.mjs (`ringBudget`, `pickPresent`).
CLAIM     The ring length is sized from a hard-coded 30fps and nothing
          measures the real frame rate. `ringBudget(w,h,30,1000)` gives
          `frames = ceil(30*1500/1000) = 45`. On a 60fps stream 45
          captured frames span 0.75s of media time, so the oldest ring
          entry is always NEWER than
          `presentTarget(currentTime, 1000, 1) = currentTime - 1.0`.
          `pickPresent` then returns -1 on every tick, and the presenter
          does `stats.late++; return;` -- it never calls `applyCover()`
          and never reaches `refillStep(state,'picked')`. Two
          consequences, both permanent and neither recovering on its
          own: the canvas is stuck on whatever was last drawn, and
          `refillState` never leaves `'refilling'`, so the initial
          `applyCover()` leaves the WHOLE VIDEO covered for ever. The
          device this ships to decodes 1280x720 on the stage-A run
          (`latency-ab-stageA.json.video_state` `w:1280 h:720`) and
          YouTube serves 60fps at that size.
          The safe half is that the failure is toward covering, not
          exposing. The unsafe half is that a user whose video is
          permanently blurred turns the feature off, which is the
          exposure that matters.
FALSIFIER Point at a measurement of fps, or at a recovery path from a
          sustained `pick < 0`. Neither exists:
          `grep -n "fps\|ASSUMED_FPS" app/gaze/src/delay-presenter.mjs`
          returns only the constant and the two `currentBudget` uses;
          `applyCover` is called from `attachDelay`, `flush`, `cover`
          and the SUCCESS branch of `presentTick` only.
FIX       Measure fps from consecutive `requestVideoFrameCallback`
          `mediaTime` deltas (a rolling median over ~20 frames) and
          re-run `ringBudget` when it changes by more than ~20%; and
          make a sustained `stats.late` run (say > 1s of ticks) either
          shrink the effective delay to what the ring can serve or
          `cover(true)` and say so, rather than freezing silently. Both
          need a test that drives the stub at 60fps -- the current suite
          only drives it at the assumed rate.
```

## I10

```
SEVERITY  EXPOSURE
WHERE     app/gaze/src/person-skip.mjs (`PERSON_SKIP_EVERY = 4`, Task 2);
          bench/arch-arms.mjs (`hisRegimeOpts` sets no
          `mnBody`/`ssdPersons`/`ssdMin`, so CONTROL never builds
          `ssdBoxes` -- phase-g G3);
          spikes/gauntlet/latency-ab-stageA.json (`slotsN [0,0,0]`).
CLAIM     Task 2's only cost is unmeasurable by either instrument the
          repo owns, and the commit does not say so. The cost is: on
          footage where MoveNet IS the detector for somebody BlazeFace
          cannot see (back of head, occluded face), the model is now
          asked one pass in four, so that person is uncovered until the
          next MoveNet pass. Measured on the device that is
          `personPassSkipped 89 of 117` over 150.1s -- MoveNet ran 28
          times, once every **5.4s**. So the exposure window for a
          faceless subject is up to ~5.4s where 1091's window was one
          pass. Neither instrument can see it: the corpus CONTROL arm
          never builds `ssdBoxes` (its persons come from faces only), so
          `PERSON_SKIP_EVERY` is byte-inert there; and his own footage
          reads `slotsN [0,0,0]` in BOTH arms, so there is no MoveNet
          admission to lose. The change is measured to be free in
          exactly the two regimes where it cannot cost anything.
          Task 1 compounds it in a way nothing records: `notePersons` is
          only called by a pass that RUNS, and Task 1 stops position
          passes, so `skipsSince` now advances once per VERDICT rather
          than once per pass. MoveNet's real-time cadence is therefore
          4 x the verdict gap, not 4 x the pass gap.
FALSIFIER Show a corpus arm in which PERSON_SKIP_EVERY changes a number.
          `grep -n "ssdBoxes\|mnBody\|ssdPersons" bench/arch-arms.mjs`
          -> every construction site is gated on `o.mnBody`, `o.ssdMin`
          or `o.ssdPersons`, none of which `hisRegimeOpts` sets. The
          falsifier cannot be constructed with CONTROL.
FIX       Do not tune it further on either instrument. The honest test
          is `bench/movenet-held.mjs` / `movenet-gated.mjs` (which
          decode video) on a clip selected for BACK-TURNED or occluded
          subjects -- the same selection problem the handoff already
          names for `movenet-held` ("must select runs for LOW CONTROL
          COVERAGE"). Until then, record the ~5.4s window in
          person-skip.mjs beside the constant: the comment there
          currently says only that the model "still runs every ~6s ...
          which is the slowest it can go and still notice a person
          walking into frame", an assertion with no measurement behind
          it and no statement of what the four passes cost.
```

## I11

```
SEVERITY  WRONG-NUMBER
WHERE     app/gaze/src/init-entry.js
          (`if (wasVerdict) lastVerdictMs = cost; else lastPassMs = cost;`)
          read against the Task 1 early return and the only consumer,
          `effInterval`.
CLAIM     `lastPassMs` has exactly one write site and it is the `else`
          (position-pass) branch. Task 1 guarantees that branch never
          runs on the player once MoveNet has backed off -- and
          `latency-ab-stageA.json` proves not one position pass
          completed in the whole 150.1s window (`"positions": 0`,
          `"positionMsP50": null`). So `lastPassMs` is frozen for the
          life of the video at whatever the last completed position pass
          cost, and `POSITION_DUTY` -- the throttle whose own comment
          calls the resource budget "the one that actually binds" -- has
          no live input any more. Its frozen value is a race: it depends
          on whether the last position pass before the back-off happened
          to run MoveNet (Task 2 skips 3 in 4), so `effInterval` on the
          player is now somewhere between 120ms and 1000ms, decided at
          video start and never corrected.
          The stage-A row says which way it fell. `sampleOnce` is driven
          by `setInterval(..., VIDEO_PLAYER_SAMPLE_INTERVAL_MS = 120)`,
          so 150.1s is ~1250 ticks. Admissions past `lastSample = now`
          are `positionPassSkipped 414 + verdicts 117 = 531`. The 719
          that did not get through are almost exactly accounted for by
          `if (sampling) return;` during 117 verdict passes at
          `verdictMsP50 705ms` (~6 ticks each, ~700). That is only
          consistent with `effInterval == 120`, i.e. `lastPassMs == 0`
          -- its initial value, never written. Under 1091 the same body
          ran ~150 times in 150s.
          Effect today is small (the extra admissions early-return at
          the new gate), but the number is not reproducible by
          construction, which makes `verdictGapP50` in I7 depend on a
          race nothing records.
FALSIFIER Find a second write to `lastPassMs`:
          `grep -n "lastPassMs" app/gaze/src/init-entry.js` -> one
          declaration (`var lastPassMs = 0;`), one read (inside
          `effInterval`), one write (the `else` branch), and the write
          is unreachable in his regime.
FIX       Write `lastPassMs = cost` for a SKIPPED position pass too (the
          skip's real cost, a fraction of a millisecond), or drop the
          `lastPassMs` term from `effInterval` on the player and let
          `overBudget` be the budget it already claims to be. Either
          way, add `lastPassMs` and `effInterval` to what
          `probe_latency_ab.py` banks, so the cadence row stops
          depending on an unrecorded value.
```

## I12

```
SEVERITY  NIT
WHERE     app/gaze/test/track-needs-read.test.mjs.
CLAIM     `GENDER_REFRESH_MS`'s shipped default 2000 is not pinned to a
          literal anywhere. The behaviour test computes its own
          expectations from the constant
          (`1000 + GENDER_REFRESH_MS - 1`, `1000 + GENDER_REFRESH_MS`),
          and the tuning test compares `rules/tuning.json` to the module
          (`assert.equal(obj.GENDER_REFRESH_MS, GENDER_REFRESH_MS)`).
          Move the source default to 4000 and regenerate tuning.json and
          the file stays green. Compare the two sibling constants
          shipped in the same session: `person-skip.test.mjs` asserts
          `/^export var PERSON_SKIP_EVERY = 4;/m` FROM THE DECLARATION
          and explains at length that it was rewritten precisely because
          checking only tuning.json "left this file fully green" while
          the module said 3; `cadence-duty.test.mjs` asserts
          `cadence.VERDICT_DUTY === 2`. Task 4 reintroduced the shape
          the sibling test's own comment warns about.
FALSIFIER Find a literal `2000` pinned against GENDER_REFRESH_MS:
          `grep -rn "GENDER_REFRESH_MS" app/gaze/test/` -> only the two
          derived comparisons above.
FIX       One line, same shape as person-skip.test.mjs: match
          `/^export var GENDER_REFRESH_MS = 2000;/m` against the source
          text.
```

## I13

```
SEVERITY  NIT
WHERE     app/gaze/test/cadence-duty.test.mjs (the structural test and
          its `restore` helper).
CLAIM     Two things. (a) The claim-site check
          `assert.match(src, /lastVerdictMs \* cadence\.VERDICT_DUTY/)`
          runs on raw source, so it is satisfied by a comment -- the
          same G9 shape as I4, in a test whose whole purpose is to prove
          the constant is READ. (b) `restore` is
          `applyTuning({ VERDICT_DUTY: cadence.VERDICT_DUTY === 2 ? 2 : 2 })`
          -- a ternary with identical branches, i.e. dead code in a file
          about not shipping dead constants.
FALSIFIER Neutralise the claim site while leaving the text in a comment
          and show the test goes red. RUN:

            $ python -c "... replace the read with `lastVerdictMs * 4`
                         and keep the original line as a comment ..."
            DUTY CLAIM SITE COMMENTED, HARDCODED 4
            $ node --test test/cadence-duty.test.mjs
            i tests 4
            i pass 4
            i fail 0

          The falsifier fails. (Restored; `git diff --quiet` -> clean.)
          Note the test DOES catch the commoner regression -- a plain
          rewrite to `lastVerdictMs * 4` with no comment goes red -- so
          this is a NIT, not a dead check.
FIX       Strip comments before both assertions; delete the ternary.
```

## I14

```
SEVERITY  NIT
WHERE     app/gaze/test/delay-presenter.test.mjs ("detach removes the
          canvas and restores opacity even after frames have been
          presented").
CLAIM     The test's scenario never presents a frame: it drives one
          frame at `mediaTime 0` with `video.currentTime` still 0, so
          `presentTarget(0, 1000, 1) = -1`, `pickPresent` returns -1 and
          the presenter takes the `stats.late++` path. The title's
          premise is untested. Worse, its third assertion
          `assert.equal(presenter.presentedMediaTime(), null)` cannot
          fail either way, because `detach()` sets
          `presentedMediaTimeVal = null` unconditionally. The other two
          assertions in the test (canvas removed, opacity restored) are
          real.
          Related gap in the same file: the DOM stub records every
          `drawImage` into `canvas._ctx.calls`, and no test ever reads
          it -- every "presented" assertion checks bookkeeping
          (`presentedMediaTime()`, `stats().presented`) and never that
          the right bitmap was painted.
FALSIFIER Show the test presents a frame: set `video.currentTime` to
          something >= 1.0 before driving, or read `stats().late`. As
          written `stats().late` is 1 and `stats().presented` is 0.
FIX       Advance `video.currentTime` past the delay in that test so a
          pick lands, assert `presentedMediaTime()` is non-null BEFORE
          `detach()`, and assert `canvas._ctx.calls` records the draw.
```

## I15

```
SEVERITY  NIT
WHERE     app/gaze/src/person-skip.mjs (`emptyRun`/`skipsSince` are
          module-level) consumed by init-entry.js per video element.
CLAIM     `personsLive()` reads module-global state, and Task 1 gives
          that global authority over a new per-video decision. On a page
          with two attached videos (desktop www.youtube, or a feed
          preview alongside the player) one video's MoveNet emptiness
          silences the OTHER video's position passes. The back-off state
          itself was already global, so this is an extension rather than
          a new defect -- but it is the same class as the R21 defect
          this repo records, where `lastSlotDiag` was read as a module
          global inside a promise and "one detector instance serves
          EVERY video element" made it read the wrong pass.
FALSIFIER Show the state is per-video:
          `grep -n "^var emptyRun\|^var skipsSince" app/gaze/src/person-skip.mjs`
          -> `var emptyRun = 0; var skipsSince = 0;` at module scope.
FIX       Only if a two-video page is reachable in smart mode. If it is,
          key the skip state by video element the way the delay graph is
          keyed on the element in delay-presenter.
```

---

# Checked and CLEAN

Each of these is a question from the brief that was RUN and found sound.
A clean result is a result.

**Q1(a) — Task 1 does not starve a coasting track.** With `personsLive()`
false the position pass is `runPass(withFaces=false)` over an empty
person list, and the position branch returns
`persons.map(p => ({box: p, positionOnly: true}))` -- literally `[]`. So
the skipped pass could only ever have called `updatePersonTracks` with
zero observations, which advances the coast rather than refreshing it;
skipping it makes tracks live LONGER (phantom, not exposure). Three
adjacent hazards checked and all clean: `gateTick(now)` is called BEFORE
the gate, so the scene gate's cadence is untouched; `emptyFrame` is only
computed inside the verdict branch, so `wipeIfEmpty` cannot be starved by
a skipped position pass; and `lastSample = now` precedes the early
return, so there is no retry loop. The `sampling = false;` the commit
added is present and necessary -- every other reset sits inside a
callback the early return bypasses.

**Q1(c), the cut half — a cut always forces a read.** `demoteTracks` sets
`lastVerdict: 'uncertain'` and `state: 'blurred'`, and `trackNeedsRead`'s
last clause is `if (t.state === 'blurred' && t.lastVerdict !==
'flag-certain') return true`. So a cleared track that survives a cut is
always re-read on the next verdict, and the swap-across-a-cut case the
brief asks about cannot happen. The non-cut swap CAN go unread for up to
GENDER_REFRESH_MS -- including the identity-continuity check, which only
runs on a verdict observation -- but the corpus prices that path
(descriptors are carried in the arm's `obsOf`) and it is inside the
exposure numbers in I2.

**Q2(a) — the probe cannot double count.** `stages` is a 120-entry ring
and the probe marks `__seen` on the entry OBJECT; a shifted-out entry is
never re-added. At a 200ms poll against a 1.28s verdict gap the ring
cannot overflow between polls either. The real defect in that number is
what it COUNTS (I7), not double counting.

**Q2(b) — Task 3 does not re-introduce the loop-41 defect.** The
arithmetic reproduces exactly: `setVerdictCadence` computes
`cap = max(PTRACK_MAX_COAST_MS 2000, PTRACK_MIN_COAST_PASSES 2 * ms)` and
`blurredCoastMs = min(cap, max(900, 2.5*ms))`. At the device's
`toldMs 1589.4` that is `min(3179, 3974) = 3179`, which is the
`coastMs 3179` the row reports; at 1091's told 2000 it is
`min(4000, 5000) = 4000`, which is that row's `coastMs 4000`. The margin
against the measured gap IMPROVED slightly: 3179 / gapP95 2315 = 1.37
against 4000 / 2997 = 1.33. No track expires between verdicts at p95.
**One consequence worth carrying to the owner's pending decision:** at
`PTRACK_MIN_COAST_PASSES 1.33` the coast becomes
`max(2000, 1.33*1589.4) = 2114ms`, which is BELOW the measured
`verdictGapP95 2315`, so ~5% of gaps would kill a blurred track between
verdicts and re-mint it as a fresh blurred birth. The 2 -> 1.33 numbers
he has been quoted twice (+5.0s man / +4.0s woman exposure for 141.0s /
156.5s of phantom) were measured at told 2000 and are stale for the same
reason as I1.

**Q3, the other new tests.** `person-skip.test.mjs`'s new default test is
genuinely behavioural -- it reads the DECLARATION out of the source AND
`rules/tuning.json` AND runs 20 passes through `wantPersons` /
`notePersons` asserting the exact 1-in-4 cycle. `track-needs-read.test.
mjs`'s end-to-end stamp test drives the real `updatePersonTracks` and
would catch the dangerous mutation (a positionOnly observation stamping
`readAt`, which would make a skipped track never read again).
`delay-core.test.mjs`'s four tests all use literal expectations,
including `assert.equal(b.bytes, 90*640*360*4)` written out rather than
re-derived from the module. `track-timeline.test.mjs`'s ten tests use
hand-computed literals (`0.25/0.25/0.45/0.45` for the lerp) and
boundary-exact cut times. `video-region-timeline.test.mjs`'s central test
distinguishes the two paths with two different numbers -- 256px under the
timeline against ~0px under the velocity path, checked as
`left > 200 && left < 300`, a window the fallback cannot satisfy. Two
minor couplings, neither vacuous: that file's fallback test hand-derives
~115.2px from the module's own `MAX_EXTRAPOLATE_MS = 1200`, and
`reposition is exported for tests` is an existence check (it did
red-prove).

**Q4(b) — the presenter's cover logic is right.** `applyCover` is
`canvas.style.filter = refillState === 'refilling' || externalCover ?
COVER_FILTER : ''`, a plain OR, and `cover(v)` touches only
`externalCover` -- so a `cover(false)` from `clearEl` cannot uncover
during a refill. `detach()` is idempotent (`if (detached) return;`), the
rVFC callback bails on `detached` before re-registering, and a capture
already in flight closes its own bitmap and returns before touching the
cleared ring. Every bitmap the module owns is closed on every path --
eviction, present, flush, detach. `visibilitychange` to hidden flushes
and covers, and the canvas stays covered until the first pick after the
page is visible again.

**Q4 — the renderer's timeline path is not a bypass.**
`reconcileOverlays` is a full rebuild every frame, so
`entry.overlays.length === timelineTracks.length` exactly after each call
-- neither a stale visible overlay nor a missing one is reachable. Both
paths call the same `renderTrackOverlay`, so `boxToHostRect` ->
`clipToBounds` -> `toLocalRect(drawn, hs)` and the clip layer apply
identically.

**Q5 — all four constants are READ in the emitted bundle, not merely
emitted.** From `app/src-tauri/gaze-page.js`:

    w2=3,Rb=4                                       PERSON_EMPTY_STREAK / PERSON_SKIP_EVERY
    function T2(){return Rb<=1||mf<w2?!0:Zh>=Rb-1}  wantPersons, and it is CALLED: `Ke=T2()`
    Qh=2e3;Ob=2                                     VERDICT_MAX_INTERVAL_MS / VERDICT_DUTY
    Math.max(he,hp*Ob)                              the effZoom claim site reads Ob
    function C2(){return mf<w2}                     personsLive
    if(Z&&!Xe&&!C2()){pn("positionPassSkipped"),Rn=!1;return}
    $j=2e3                                          GENDER_REFRESH_MS
    function Dj(t,e){return!t||!(t.readAt>0)||e-t.readAt>=$j||...}
    if(vr&&!Dj(vr,ae)){pn("genderReadSkipped"),it.push({box:rt,positionOnly:!0,at:ae});return}
    PERSON_SKIP_EVERY:[1,4,...] VERDICT_DUTY:[1.5,4,...] GENDER_REFRESH_MS:[1e3,4e3,...]

`Rn=!1` is the minified `sampling = false`. The working tree's
`gaze-page.js` differed from HEAD by one minifier-local rename inside a
tfjs string and nothing else.

---

# Appendix — commands

    # baseline
    cd app/gaze && npm test                       # 633/633
    node bench/gender-skip-arm.mjs                # reproduces 514e09a's table exactly
    node bench/critic-gate.mjs                    # 80 rows / 80 CONFIRMED

    # I3 (gate deleted), I4 (skip commented), I13 (duty claim site dead):
    # each mutation applied with a python in-place edit preserving CRLF,
    # the file restored from <scratchpad>/init-entry.js.bak, and verified
    # with `git diff --quiet app/gaze/src/init-entry.js`.

    # I5, I6: <scratchpad>/gs-denom.mjs   (denominator, sweep, broken-skip @0)
    # I1, I2: <scratchpad>/regime.mjs     (CONTROL and the arm at 5 regimes)
    # Both import the repo's modules by absolute file:// URL; nothing was
    # written under Z:\Apps\Disconnect by this round.
