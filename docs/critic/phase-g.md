# Phase G — critic report, PHASE A (independent)

Range `9f46330..ea02431`. Packet `critic-packet-9f46330` (assembled
2026-09-02 09:15).

Produced with no access to any summary, CLAUDE.md entry or commit body.
Every finding below was reached by running something, and every falsifier
below was run by me with the raw output pasted.

**11 findings — WRONG-NUMBER 4, DEAD-CHECK 3, NIT 4. No EXPOSURE.**

Working method: the repo was read and run, never edited. Two mutations
were needed and neither touched tracked content — an instrumented COPY of
`arch-arms.mjs` and of `movenet-gated.mjs` in the session scratchpad with
`node_modules` junctioned, and `touch src/tuning.mjs` (mtime only; `git
status` verified clean throughout). One byte was appended to
`app/src-tauri/gaze-page.js` to test the build marker's pathspec and
reverted in the same command; `git status --porcelain` is empty at the
end of this run and `npm test` is **576/576**.

---

## G1

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md §20 (the reach table + "five faces in
          six" + "genuinely synthetic 194 (16.8%)"); §21 opening
          paragraph; app/gaze/bench/extent-reach.mjs:38-41 (`inside`);
          spikes/gauntlet/extent-reach.txt
CLAIM     `extent-reach.mjs` re-implements the app's face-to-person test
          instead of calling it, and misses BOTH halves of the shipped
          rule -- `faceInsideIndex` (init-entry.js:1765) admits a face
          within a 10% MARGIN of the box, and the caller's `claimed` map
          (init-entry.js:1712-1717) lets at most ONE face take each
          admitted person, so every extra face in the same box falls to
          `personFromFace`. Through the shipped rule the app would take a
          measured body for 836 of 1153 faces (72.5%) and a synthetic one
          for 317 (27.5%), not 959 (83.2%) and 194 (16.8%).
FALSIFIER cd app/gaze && node --input-type=module -e "<re-derive with the
          shipped predicate; full script in this report's appendix>"

            banked faces 1153
              bench inside()  (no margin)                   959 83.2%
              shipped faceInsideIndex (10% margin)          977 84.7%
              ...AND the shipped one-face-per-person claim  836 72.5%
              => share the APP would put on personFromFace  317 27.5%

COST       Nothing on his screen -- nothing shipped. It costs the
           accuracy of §20's own headline, in the direction that makes
           the alarm louder than the evidence: the corpus instrument is
           64% closer to the app than §20 says (27.5% of faces really are
           on the fallback, not 16.8%). Every downstream sentence keyed to
           "five faces in six" and "83.2% of observations" is off by the
           same factor, including §21's opening. It is also the exact
           defect class `iou-ab.mjs`'s own header records ("IT HAND-ROLLED
           `thin`. A private copy is a second implementation that can
           drift") reappearing in a bench written to bound every other
           bench.
```

---

## G2

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md §21, bullet 2: "THE FACE-WIDTH FLOOR
          DOES NOT RESCUE IT. faceW 2.0 and 3.0 move exposure 53.0 ->
          48.5 -> 49.0, so most of the cost is NOT a too-narrow body. It
          is height and it is occlusion."
CLAIM     Height is 1.6% of the cost, not most of it. `ssdUnionH` already
          exists in `arch-arms.mjs` and unions the measured box's height
          with the guess's, i.e. removes ALL height shrinkage; run on the
          same arm it recovers 0.5s of the 30.5s (man) and 0.5s of the
          18.5s (woman). Widening the box makes exposure WORSE, not
          better, because `ssdMinFaceW` re-centres on the BOX centre and
          clips at the frame edge -- so the residual cost is horizontal
          POSITION, which §21 does not name.
FALSIFIER cd app/gaze && node --input-type=module -e "<mnBody ladder with
          ssdUnionH / ssdMinFaceW; appendix>"

            -- MAN --
            CONTROL (guess)                     22.5    136.5    547.5
            mnBody s>=0                         53.0    129.5    371.5
              + unionH  (height floored)        52.5    130.0    365.0
              + faceW 4.0 (width floored)       72.0    127.5    309.0
              + unionH + faceW 4.0              71.5    127.5    304.0
              + unionH + faceW 6.0             142.5    105.0    251.5
            -- WOMAN (unionH row) --
            mnBody s>=0                         44.0    186.5    466.5
              + unionH                          43.5    184.0    476.0

COST       It sends the next round at the wrong dial. §21 names the height
           and the occlusion, so the obvious follow-up is a height floor
           -- which is measured here to buy 0.5s of 30.5s. The lever that
           would actually matter (where the measured box sits relative to
           the face, and what `ssdMinFaceW`'s re-centring does at a frame
           edge) is not mentioned at all, and the arm that is supposed to
           test it moves exposure the WRONG way by 89.5s at faceW 6.0.
```

**CORRECTED (phase-h H1, percentages superseded).** `bodyFromSsd`
carried no head anchor, so the +30.5s (man) / +18.5s (woman) excess
above was itself the measured body's DELETED OBSERVATIONS, not its
geometry -- H1 traces the mechanism. With the head fields restored the
excess this bullet is dividing shrinks to **+1.5s (man) / +2.0s
(woman)**, and the percentages recompute against that: `ssdUnionH`
recovers **100% of the man excess (+1.5 -> +0.0)** and **0% of the
woman excess (+2.0 -> +2.0)** -- not "0.5s of 30.5s (1.6%)" and "0.5s
of 18.5s" against the old, much larger denominator. `faceW 6.0` now
**reduces** exposure (-2.5s man / -13.5s woman) rather than costing
142.0s (+119.5) -- the "swallows the neighbour's track" mechanism this
row named was the missing head anchor, not the width. The conclusion
this row exists for -- "it is not height, and a real mechanism is
still unmeasured" -- is unaffected; only the numbers behind it moved.
Re-run: `docs/engine-findings.md` §21, corrected table.

---

## G3

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md §21 ("MAN (his setting)", "his
          regime"), §21a (same); spikes/gauntlet/mnbody-ab.txt and
          spikes/gauntlet/mnedge-where.txt (both open "his regime" and
          "CONTROL must read ..."); bench/mnbody-ab.mjs:66-74 and
          bench/mnedge-where.mjs:57-64 (the CONTROL guards)
CLAIM     Every mnBody row in §21 and §21a is byte-identical to CONTROL
          when `parsePersons` admits nobody -- which is the regime
          findings 36 measured on his device (all twelve slots `n:0`,
          `faceNoShape` 121 of 184 passes, engine-findings.md:3207). The
          CONTROL guard both raw files print as their regime certificate
          scores only the CONTROL row, so it is structurally blind to the
          one dimension these two sections are about, and it passes
          unchanged while every arm row is a no-op on his phone.
FALSIFIER Emulate n:0 by putting the body floor above the corpus's own
          maximum slot score (0.618, extent-reach.txt) so no admitted
          person is usable anywhere:
          cd app/gaze && node --input-type=module -e "<appendix>"

            MAN
              CONTROL                 {"exposureS":22.5,"falseCoverS":136.5,"phantomS":547.5}
              mnBody s>=0.70 (n:0)    {"exposureS":22.5,"falseCoverS":136.5,"phantomS":547.5}
              mnBody EDGE s>=0.70     {"exposureS":22.5,"falseCoverS":136.5,"phantomS":547.5}
              mnBody s>=0.40 (ref)    {"exposureS":28.5,"falseCoverS":137.5,"phantomS":501.5}
            WOMAN
              CONTROL                 {"exposureS":25.5,"falseCoverS":201.5,"phantomS":628}
              mnBody s>=0.70 (n:0)    {"exposureS":25.5,"falseCoverS":201.5,"phantomS":628}
              mnBody EDGE s>=0.70     {"exposureS":25.5,"falseCoverS":201.5,"phantomS":628}
              mnBody s>=0.40 (ref)    {"exposureS":30.5,"falseCoverS":192,"phantomS":603}

COST       §21 leaves `s >= 0.40` standing as "the only defensible
           body-source row", priced at -46.0s / -25.0s of phantom for
           +6.0s / +5.0s of exposure and explicitly compared against the
           coast dial as a buy the two "compose". On the footage his
           complaints were measured on, it buys and costs NOTHING -- the
           phantom he is promised does not arrive. §20 states the
           forward-facing half of this ("the moment his device admits
           persons, every absolute corpus number stops describing his
           screen") and never the half that bites here: today his device
           does NOT admit, so this whole section describes a change that
           cannot happen on it. §21a then spends a section REFUSING an arm
           that is already inert on his phone.
```

---

## G4

```
SEVERITY  WRONG-NUMBER
WHERE     app/gaze/package.json (`--test-concurrency=1`);
          app/gaze/bench/arch-arms.mjs:32-38 (its justifying comment);
          docs/engine-findings.md §19, last bullet
CLAIM     The flag does not produce a suite that passes on a correct
          change. `_build.mjs` THROWS in every process that imported a
          stale bundle by design ("AND THROWING IS THE POINT"), and node
          links before it evaluates, so serialising turns three failures
          into ONE, not zero. Measured: default concurrency 3 failures /
          561 tests reported; `--test-concurrency=1` 1 failure / 565
          tests; and the suite still has to be re-run to go green.
FALSIFIER cd app/gaze && touch src/tuning.mjs && npm test | grep -E "^. (tests|pass|fail)"

            ℹ tests 565
            ℹ pass 564
            ℹ fail 1

          npm test | grep -E "^. (tests|pass|fail)"

            ℹ tests 576
            ℹ pass 576
            ℹ fail 0

          touch src/tuning.mjs && node --test "test/**/*.test.mjs" | grep -E "^. (tests|pass|fail)"

            ℹ tests 561
            ℹ pass 558
            ℹ fail 3

          and the standing price:
            serial (shipped)      real 0m16.584s
            default concurrency   real 0m12.782s

COST       ~30% of every suite run, forever, for a fix that leaves the
           behaviour its own comment says is "worse than a slow suite"
           intact: the suite still fails once on a correct change and
           still teaches a re-run. Worse, the residual failure still
           silently DROPS 11 tests (576 -> 565) -- the "worst shape a
           failure can take" that §19's own last-but-one bullet is about.
```

---

## G5

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/movenet-gated.mjs:115-137 (the `raw` block in
          `run()`) and :183-203 (the SANITY loop)
CLAIM     Phase-f F4 moved the inverse-map sanity check off `parsePersons`'
          clamped output and onto a PRIVATE RE-IMPLEMENTATION of the map
          computed inside the bench. It therefore does not read
          `unpadPersons` at all: break the shipped function by exactly the
          factor F4 red-proved (sx/3) and the row still prints "(the
          inverse map holds)". The check is also one-sided -- it only
          detects OVERSHOOT outside 0..1 -- so a map wrong by 3x in the
          shrinking direction (sx*3) also reads clean.
FALSIFIER Scratch copy of the bench with the SANITY inverse left correct
          and `unpadPersons` wrapped to divide dw by 3 (nothing else
          changed), N=4:

            -- ADMISSION, through the SHIPPED gate, 5 frames --
              persons admitted   squash 8   letterbox 6   (-25.000%)
            -- GEOMETRY, 4 matched people --
              IoU between the two arms' boxes   p05 0.250  p50 0.423  p95 0.522
            -- SANITY --
              unclamped inverse boxes checked: 15  (6 at or above PERSON_MIN_SCORE 0.35)
              worst overshoot outside 0..1   all slots 0.069   scored slots 0.024   (tol 0.05)  (the inverse map holds)
            EXIT=0

          (control, unbroken: IoU p50 0.915, admitted 8 vs 9.)
          And the one-sided half, breaking only the bench's own inverse:

            sx = (FIT.dw / S)*3 :
              worst overshoot outside 0..1   all slots 0.069   scored slots 0.024   (tol 0.05)  (the inverse map holds)
            sx = (FIT.dw/S)/3 :
              worst overshoot outside 0..1   all slots 1.938   scored slots 1.938   (tol 0.05)  *** THE INVERSE MAP IS WRONG ***

COST       Nothing today -- `pde=!1` in the emitted bundle, verified. It
           costs the round that flips `PERSON_LETTERBOX` on: the one check
           this repo has designated as guarding "the failure that is worse
           than the defect" cannot see a defect in the function it names,
           and cannot see a shrinking map in either. A shrinking map is
           the direction F2 itself showed uncovers a crown.
```

---

## G6

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/movenet-gated.mjs:246-255
CLAIM     The sanity block exits **2** when it is merely VACUOUS (zero
          scored boxes checked) and exits **0** when it declares
          "*** THE INVERSE MAP IS WRONG ***". The more severe outcome is
          the one a caller cannot detect, in the same range that added
          `process.exit(2)` guards to three other benches for exactly this
          reason (`births.mjs` mode, `mnbody-ab` CONTROL, `mnedge-where`
          CONTROL).
FALSIFIER Scratch copy with the bench's own inverse broken (sx/3):
          N=4 node mg-broken.mjs > /dev/null 2>&1; echo $?

            EXIT with a PROVABLY WRONG inverse map = 0

COST       A scripted or piped run of this bench reports success on the
           one condition it exists to catch. Everything else in this
           range signals through the exit status; this does not.
```

---

## G7

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/arch-arms.mjs:848-856 (`mnEdgeInert`);
          app/gaze/bench/mnedge-where.mjs:12-15 (its stated decision
          rule); docs/engine-findings.md §21a ("the arm is nearly inert
          -- 67 moves against 947 (6.6%)")
CLAIM     `mnEdgeInert` fires whenever the edge branch is reached and the
          edges did not move -- which is dominated by frames where there
          was NO cleared neighbour to give an edge up to, not by frames
          where the arm ran and did nothing. Decomposed: 91.4% (man) and
          98.2% (woman) of the inert count is "no cleared neighbour at
          all". Conditional on having an opportunity, the arm moves the
          edge at essentially the SAME rate in both genders -- 81.9% man
          against 79.8% woman -- so the printed 28.1% / 6.6% is a
          statistic about the FOOTAGE, not about the arm, and the bench's
          own rule ("a high inert count with a low moved count means the
          arm is nearly a no-op") misreads the woman arm.
FALSIFIER Instrumented copy of `arch-arms.mjs` in scratch, adding
          `mnEdgeNoNeighbour` (branch reached, inner loop never entered)
          and `mnEdgeNeighbourButWider` (neighbour present, measured box
          no tighter); nothing else changed:

            -- MAN --
              branch reached (moved+inert) 1014   moved 285 (28.1%)  inert 729
              of the INERT: no cleared neighbour at all 666 (91.4% of inert)
              of the INERT: neighbour present, measured box no tighter 63 (8.6% of inert)
              branch reached WITH a cleared neighbour: 348   moved/withNb = 81.9%
            -- WOMAN --
              branch reached (moved+inert) 1014   moved 67 (6.6%)  inert 947
              of the INERT: no cleared neighbour at all 930 (98.2% of inert)
              of the INERT: neighbour present, measured box no tighter 17 (1.8% of inert)
              branch reached WITH a cleared neighbour: 84   moved/withNb = 79.8%

COST       The gate §21a built to decide the arm answers with a rate whose
           denominator is 91-98% opportunities that never existed. Here it
           happened not to change the verdict -- the refusal rests on the
           per-window distribution, which is sound -- but §21a writes the
           counter's reading into a standing rule for future work ("the arm
           is structurally four times more active in his mode ... a
           woman-mode measurement of it is nearly a control"). Measured per
           opportunity, that rule is false: the arm is equally active in
           both modes and the OPPORTUNITIES are 4x rarer (348 against 84).
           The mechanism §21a states in the next sentence is the correct
           one; the counter it cites cannot show it.
```

---

## G8

```
SEVERITY  NIT
WHERE     app/gaze/src/assign.mjs:99-102 (`assignFellBackGreedy`)
CLAIM     The counter is bumped only on the fallback and is seeded
          nowhere, so an absent key on a device report cannot be told from
          a bump that was never hooked -- the exact ambiguity E3 added
          three SEEDED counters to remove, in the same range that quotes
          "a counter that does not exist reads exactly like a counter at
          zero" (F6). It is also very unlikely ever to be non-absent in
          the app: the ceiling is 32 per side and the player carries <=6
          MoveNet slots plus a handful of faces.
FALSIFIER cd app/gaze && grep -rn "assignFellBackGreedy" src/ test/

            src/assign.mjs:101:    bumpAssign('assignFellBackGreedy');
            test/assign.test.mjs:130:  assert.equal(...life.assignFellBackGreedy, 1, ...)
            test/assign.test.mjs:138:  assert.equal(...life.assignFellBackGreedy, undefined, ...)

          -- no seed site, unlike wholeFrameSamples/NoFaces/Cleared which
          are seeded at init-entry.js:1939-1942.
COST       When the artifact is next read off his phone, an absent
           `assignFellBackGreedy` proves nothing. The counter is alive in
           the bundle -- `if(e>hj||r>hj)return Gde("assignFellBackGreedy"),
           RE(t,e,r)` with `hj=32` -- but the report cannot say so.
```

---

## G9

```
SEVERITY  NIT
WHERE     app/gaze/test/whole-frame-counter.test.mjs, "that sweep can
          actually fail -- a two-file name is caught" (its comment);
          the same file's widened-sweep comment; docs/engine-findings.md
          §19 F7 bullet
CLAIM     `clampFired` is written by ONE module. `person-track.mjs:2303`
          bumps it; the other two files the sweep counts as "owners" are
          three COMMENT mentions in `init-entry.js`. Neither
          `region-blur.mjs` nor `body-clamp.mjs` contains the string at
          all, so the diff's "region-blur's patch clamp against
          body-clamp's" and the test's "still written by two modules"
          are both false, and the red-proof fixture demonstrates only that
          a name MENTIONED twice trips the sweep.
FALSIFIER cd app/gaze && grep -n "clampFired" src/*.mjs src/*.js

            src/person-track.mjs:2303:        bumpLife(drawn === padded ? 'clampNoLegalEdge' : 'clampFired');
            src/init-entry.js:3090:              // `clampFired` is the life counter that proves it alive.
            src/init-entry.js:4107:                // NOT `clampFired` -- that name is TAKEN, by the patch
            src/init-entry.js:4108:                // geometry clamp in region-blur (clampFired /

COST       Small, and in the safe direction (the sweep matches text, so a
           genuine two-writer collision would still be caught -- I checked
           and there is none today: 41 distinct literal-bumped counter
           names across src/, 0 multi-owner). What it costs is a reader
           who trusts the fixture: the sweep has never been shown to catch
           a two-WRITER collision, only a two-MENTION one, and the next
           counter documented in a comment in a second module will turn it
           red for nothing.
```

---

## G10

```
SEVERITY  NIT
WHERE     docs/engine-findings.md §21a (two prose counts) and §20 (a
          source citation)
CLAIM     Three statements in the new sections do not match the artifacts
          they cite.
          (a) §21a: "the false cover column has TWO windows going the
              WRONG way (+0.5, +1.5) offset by two going the right way".
              Three go the right way (-1.5, -0.5, -1.0). The net -1.0 is
              correct; the count is not.
          (b) §21a: "one window's phantom going UP (+1.0)" in the woman
              arm. Two do: H14bBuluwB8_w222 +1.0 and 8R1hy3uHds0_w1642
              +0.5.
          (c) §20: "`arch-arms.mjs:731` opens every observation with
              `let box = null`". After this range's own comment insertion
              it is line 804.
FALSIFIER grep -E "KAWvDsghyc8_w552|4u3jS_cTHH0_w252|4u3jS_cTHH0_w1602|NWoT1ZVd1Lo_w292|NWoT1ZVd1Lo_w702|8R1hy3uHds0_w1642|H14bBuluwB8_w222" spikes/gauntlet/mnedge-where.txt

            (MAN)  KAWvDsghyc8_w552   +0.0  -1.5  -8.0
                   4u3jS_cTHH0_w252   +0.0  +0.5  -3.0
                   4u3jS_cTHH0_w1602  +0.0  +1.5  -0.5
                   NWoT1ZVd1Lo_w292   +0.0  -0.5  +0.0
                   NWoT1ZVd1Lo_w702   +0.0  -1.0  +0.0
            (WOMAN) 8R1hy3uHds0_w1642 +0.5  +0.0  +0.5
                    H14bBuluwB8_w222  +0.0  -0.5  +1.0

          grep -n "let box = null" app/gaze/bench/arch-arms.mjs
            804:          let box = null;
COST       None to him. Recorded because §21a's whole argument is "read
           the distribution, not the total", and it miscounts its own
           distribution twice in the paragraph that says so.
```

---

## G11

```
SEVERITY  NIT
WHERE     app/gaze/bench/movenet-gated.mjs:194-197 (the SANITY comment)
          against docs/critic/ledger.md F4 and docs/engine-findings.md §19
CLAIM     The source says the red-proof "deliberately breaking sx to sx/3
          reads 0.699 here" and calls a wrong map "tenths"; the ledger and
          §19 say 1.938. Measured, at both N=4 and N=10, it is 1.938 for
          both the all-slots and the scored-slots statistic. The docs are
          right and the in-code justification for `MAP_TOL = 0.05` quotes
          a number 2.8x too small, in the file a reader actually opens.
FALSIFIER Scratch copy, sx -> sx/3, nothing else changed:

            N=4 :  worst overshoot outside 0..1   all slots 1.938   scored slots 1.938
            N=10:  worst overshoot outside 0..1   all slots 1.938   scored slots 1.938

          (and a y-axis break for scale: sy/3 reads 2.207 / 2.073.)
COST       None today. It weakens the only stated justification for the
           tolerance the check is decided by.
```

---

## G12

```
SEVERITY  NIT (pre-mortem; inert while PERSON_LETTERBOX ships false)
WHERE     app/gaze/src/person-gate.mjs:355-372 (the F2 justification
          comment); test/unpad-persons.test.mjs, "a KEYPOINT is not
          clamped"; docs/engine-findings.md §19 F2 bullet; ledger F2
CLAIM     "`parsePersons` consumes keypoints as DIFFERENCES, not as
          positions" is half of the story. It also consumes them as
          ABSOLUTE POSITIONS -- the box union at person-gate.mjs:828-838
          takes each confident keypoint's x and y, and `headX`/`headY`
          are the MEAN of the head keypoints and are emitted UNCLAMPED
          (person-gate.mjs:1004-1005) where the box is clamped. So
          removing the keypoint clamp is not monotone-covering on every
          consumer, only on the ones the comment names.
FALSIFIER The repo's own fixture, plus a print of headX:
          cd app/gaze && node --input-type=module -e "<pillarbox fixture,
          one ear regressed into the bar; appendix>"

            mapped L_EAR x = -0.3533 (outside 0..1 => true )
            emitted person: box x1 0.0000 y1 0.0000 x2 0.6708 y2 0.9914
            emitted headX = -0.0006666623055934906   headY = 0.4920000076293945   headW = 0.5133
            headX outside 0..1 ? true

COST       Nothing today: verified in the EMITTED bundle that the flag
           ships off (`wn=256,pde=!1`, and the branch is gated
           `async function Eh(t,e,r,n,o){var s=null;if(pde){...}`), and
           the box union only ever grows, and the emitted box IS clamped
           (`y1: Math.max(0, y1 - mh)` ...). When the letterbox is turned
           on, `headX` is the field that tells THIS person's face from a
           neighbour's leaking into the same crop (init-entry.js:2635) and
           sets `sameHuman`'s tolerance (person-track.mjs:2482); an
           out-of-frame `headX` on an edge subject is a wrong face-to-
           person assignment, i.e. a gender read applied to the wrong
           person. F2's argument does not cover it and the new tests do
           not test it.
```

---

## C13 — PRE-MORTEM

Nothing user-visible shipped in this range: `app/src-tauri/gaze-page.js`
differs from `55a9f51` only in its marker string, and the only shipped
source change in the wider range is inert (`pde=!1`) or a counter. So the
pre-mortem is about the next push, ranked:

1. **He is given `mnBody s >= 0.40` over OTA-adjacent work and reports no
   change at all.** G3: on the footage his complaints were measured on
   MoveNet admits nobody, and every mnBody row collapses to CONTROL. The
   counter that would show it is the existing per-pass `slots n:0` /
   `faceNoShape` pair in the report — read those before quoting any
   §21 row at him.
2. **`PERSON_LETTERBOX` is flipped on and a crown or a whole subject goes
   sharp at a frame edge.** G5 says the check designated to catch a wrong
   map cannot read the shipped map, G6 says it exits 0 when it does fire,
   and G12 says `headX` now escapes the frame. `bodyFromSlot`,
   `birthFresh` and `gateKept`/`gateRefused` are where it would show; the
   file is `src/person-gate.mjs`.
3. **A future adjacency arm is shipped on the strength of §21a's
   "structurally four times more active in his mode".** G7: per
   opportunity the arm is equally active in both modes. A woman-mode
   measurement is NOT nearly a control, and treating it as one would
   under-price a woman-mode regression.

---

## What I tried to break and could not

Recorded because a round that only lists failures is misleading.

- **All four raw files reproduce exactly.** `extent-reach.mjs` (0.26s),
  `mnbody-ab.mjs` (0.58s) and `mnedge-where.mjs` (0.53s) each print
  byte-for-byte what is committed under `spikes/gauntlet/`.
- **The per-window instrument has no separately-loaded-window confound.**
  `mnedge-where` reloads each window for each arm while `mnbody-ab` shares
  one object across six arms. Run both ways over the same 18 windows the
  EDGE delta is identical: `SAME-OBJECT dExp -0.5 dFalse -1.0 dPhantom
  -11.5` / `FRESH-LOAD dExp -0.5 dFalse -1.0 dPhantom -11.5`. And
  `mnbody-ab`'s six arms are order-independent — running them in reverse
  reproduces all six triples exactly.
- **Both new CONTROL guards fire.** Mutating `CONTROL.man.exposureS` to 99
  makes `mnbody-ab` exit **2** without printing a table; mutating
  `CONTROL.woman.phantomS` makes `mnedge-where` exit **2** before printing
  the woman distribution.
- **`births.mjs`'s mode guard fires both ways.** `GENDER=bogus` and
  `node bench/births.mjs banana` both print "is neither man nor woman --
  refusing rather than defaulting" and exit 2. `births-1091.txt`
  reproduces 141 man / 136 woman.
- **`assign.test.mjs`'s counter assertions are not vacuous.** The
  sub-ceiling arm carries 101 pairs and optimal genuinely beats greedy
  there (32 matches against 27), so `assignFellBackGreedy === undefined`
  is asserted on a frame that did real work.
- **The emitted bundle carries what the range claims.** Keypoints
  unclamped and box floats clamped —
  `i[c+p*3]=(t[c+p*3]-o)/a,i[c+p*3+1]=(t[c+p*3+1]-n)/s;i[c+51]=l((t[c+51]-o)/a)`;
  the letterbox flag off — `wn=256,pde=!1`; the greedy fallback reachable
  and read — `if(e>hj||r>hj)return Gde("assignFellBackGreedy"),RE(t,e,r)`
  with `hj=32`. The marker `__TS_GAZE_BUNDLE__="55a9f51"` is clean, and
  the new pathspec really does exclude the bundle (appending a byte to
  `gaze-page.js` leaves `git status --porcelain -- . ":(exclude)../src-tauri/gaze-page.js"` empty).
- **§20's exculpation of the decision layer survives.** I tried to break
  "It does NOT invalidate the DECISION-layer work ... the DIFFERENCES
  stand" by re-running the two dials that matter under the mnBody body
  source. Both keep their sign and nearly their magnitude:

  | dial | body = synthetic guess | body = mnBody s>=0.40 |
  |---|---|---|
  | IOU 0.20 -> 0.15, man | +1.0 / -3.0 / -19.0 | +1.0 / -4.5 / -19.5 |
  | IOU 0.20 -> 0.15, woman | +2.5 / +2.5 / -31.0 | +1.5 / -1.5 / -15.5 |
  | coast 2 -> 1.33, man | +5.0 / -10.5 / -141.0 | +5.0 / -14.5 / -134.0 |
  | coast 2 -> 1.33, woman | +4.0 / -8.0 / -156.5 | +3.5 / -6.5 / -150.5 |

  The coast dial — the one open question for the owner — keeps its price
  (+5.0s for ~-140s) under the other body source. That is real
  corroboration and it is the strongest thing in this range.
- **No live counter-name collision in `src/`.** A general sweep of every
  literal-string bump across the module tree finds 41 distinct names and
  0 with more than one owner, so G9's scope limitation is not currently
  hiding anything.
- **C8 SCOPE clean.** Nothing in the diff matches `.env*`, `**/auth/**`,
  `**/payment*/**`, `**/migrations/**`, `*.sql`, `.github/workflows/**`,
  `src-tauri/capabilities/**`, or any filename containing
  key/secret/token/credential.
- **C9 owner rules clean.** No patch is subtracted, split, windowed or
  silhouetted; the `mnBody` arms narrow one rectangle and it stays one
  solid rectangle. No code travels over OTA in this range.
- **C11 stale harness: not applicable.** No device number is quoted
  anywhere in the range; every number is corpus or bench.

---

## Appendix — the scripts behind the falsifiers

All are single `node --input-type=module -e` invocations run from
`app/gaze`, or a `sed`-copy of a repo file into scratch with its relative
specifiers rewritten to `file:///` URLs and `node_modules` junctioned.
None writes to the repo.

**G1 (shipped-predicate re-derivation)** — walk `winFiles()` through
`thinFrames(loadWin(f), K_HIS)`, run each frame's banked `[1,6,56]` slice
through `parsePersons`, and count each banked face three ways: the bench's
`inside()`; `faceInsideIndex`'s 10%-margin first-match; and the same with
init-entry's one-face-per-person `claimed` map.

**G2 / G3 (arm ladders)** — `makeArms(S)({ ...hisRegimeOpts(g), ...opts })`
over `winFiles().map(loadWin)` with `score()` and the corpus crop labels,
summing `exposureS`/`falseCoverS`/`phantomS`, with `opts` taken from
`{mnBody, ssdMin, ssdMinFaceW, ssdUnionH, ssdEdge}`.

**G7 (inert decomposition)** — `sed` copy of `bench/arch-arms.mjs` into
scratch with `./_build.mjs`, `./.cache/shipped.mjs` and `./corpus-lib.mjs`
rewritten to absolute `file:///` URLs, plus two added counters:
`__probeHadNeighbour` set inside the neighbour loop, and
`mnEdgeNoNeighbour` / `mnEdgeNeighbourButWider` bumped beside the existing
pair. Nothing else changed.

**G5 / G6 / G11 (map red-proofs)** — `sed` copy of
`bench/movenet-gated.mjs` into scratch with the three repo imports made
absolute and `node_modules` junctioned; then either the bench's own
sanity `sx` broken, or `unpadPersons` wrapped as
`(d, fit, size) => _up(d, { ...fit, dw: fit.dw / 3 }, size)` with the
sanity inverse left correct.

**G12 (headX)** — the pillarboxed fixture from
`test/unpad-persons.test.mjs`'s "the head anchor survives the map" test,
run through `unpadPersons` then `parsePersons`, printing `headX`.
