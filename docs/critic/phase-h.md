# Phase H — critic report, PHASE A (independent)

Range `c134032..HEAD` (`497c12e`). Packet `packet-h`, assembled
2026-09-02 10:22.

Produced with no access to any summary, CLAUDE.md session-state entry or
commit body beyond the three subjects the packet carries. Every finding
below was reached by running something; every falsifier below was run by
me and its raw output is pasted.

**10 findings — WRONG-NUMBER 2, EXPOSURE 1 (latent, shipped code, not in
the diff), DEAD-CHECK 4, NIT 3.**

Working method: the repo was read and run, never edited except once
(`src/person-track.mjs`, for H4's red-proof), reverted inside the same
shell command and verified by `git status --porcelain` immediately
afterwards. All other mutation experiments ran in two scratch trees under
the session scratchpad — `h2` (a copy of `bench/` with junctions to
`src`, `models`, `node_modules`) and `h3` (a full copy of `bench/`,
`src/`, `test/`). `npm test` in the repo is **583/583** at the end of
this run, `bench/critic-gate.mjs` reads **70 rows / 70 CONFIRMED**, and
the packet's `cargo test` carries **EXIT CODE 0**.

---

## H1

```
SEVERITY  WRONG-NUMBER
WHERE     app/gaze/bench/arch-arms.mjs:329-353 (`bodyFromSsd`, the return
          literal); consequences in docs/engine-findings.md §23 (whole
          section), §21 (every row except EDGE ONLY), §7 ("coco-ssd
          person boxes ... phantom -41%"), phase-g G2's percentages;
          raws spikes/gauntlet/mnbody-births.txt and mnbody-ab.txt
CLAIM     `bodyFromSsd` returns a box carrying no
          `headX`/`headY`/`headW`/`headH`, where `personFromFace`
          (person-gate.mjs:1408) and `boundBodyToSlot` (which copies
          every own key of its input) both carry them. `sameHuman`
          (person-track.mjs:578) short-circuits -- `if (typeof ax !==
          'number' || typeof bx !== 'number') return true;` -- so for
          every mnBody/ssd observation the head-separation guard is OFF
          and `dedupeObservations` merges any two observations whose
          boxes are 60% contained, INCLUDING two different people handed
          the same MoveNet person box. Measured, man arm
          `mnBody s>=0.00`: `dedupeMerged` 11 -> 128, `dedupeHeadSplit`
          (the guard REFUSING a merge) 328 -> 42, and observations
          reaching `updatePersonTracks` 1,218 -> 1,101 (-9.6%). It is
          the deleted observations, not "better association", that move
          every counter in §23's table -- and the discarded verdicts,
          not "the AREA the guess has and the measurement does not",
          that produce the +30.5s.
FALSIFIER Add the four head fields to `bodyFromSsd`'s return, computed
          exactly as `personFromFace` computes them (face centre; head
          height de-inflated by FACE_ENLARGE 1.4; `headW = headH / ar`).
          NO geometry changes -- the four box floats are untouched.
          Script in the appendix. Re-run `bench/mnbody-ab.mjs` and
          `bench/mnbody-births.mjs`.

          bench/mnbody-ab.mjs, MAN, against CONTROL 22.5 / 136.5 / 547.5

            arm                     published              head fields restored
            mnBody s>=0.00          53.0 / 129.5 / 371.5    24.0 / 159.0 / 532.5
                                   (+30.5 / -7.0 / -176.0) (+1.5 / +22.5 / -15.0)
            mnBody s>=0.40          28.5 / 137.5 / 501.5    26.0 / 145.0 / 566.0
            mnBody s>=0.00 unionH   52.5 / 130.0 / 365.0    22.5 / 161.0 / 530.0
            mnBody s>=0.00 faceW6  142.0 / 104.5 / 257.5    20.0 / 156.0 / 552.0
            mnBody EDGE ONLY        22.0 / 135.5 / 536.0    22.0 / 135.5 / 536.0  (identical)

          WOMAN, against 25.5 / 201.5 / 628.0

            mnBody s>=0.00          44.0 / 186.5 / 466.5    27.5 / 213.0 / 608.0
                                   (+18.5 / -15.0 / -161.5)(+2.0 / +11.5 / -20.0)
            mnBody s>=0.40          30.5 / 192.0 / 603.0    26.5 / 214.5 / 626.5
            mnBody s>=0.00 faceW6   84.5 / 176.0 / 240.0    12.0 / 232.0 / 735.0
            mnBody EDGE ONLY        27.0 / 201.0 / 627.0    27.0 / 201.0 / 627.0  (identical)

          bench/mnbody-births.mjs, head fields restored:

            MAN     arm                exp  births fresh nearMiss contend coastExp
            CONTROL synthetic guess   22.5    141    38     43      60      96
            mnBody  s>=0.00           24.0    139   43+5  30-13   66+6    96+0
            WOMAN
            CONTROL synthetic guess   25.5    136    38     34      62      92
            mnBody  s>=0.00           27.5    133   40+2   27-7   66+4    88-4

          And the instrumented counters that name the mechanism
          (bench copy, appendix):

            MAN  CONTROL              merged  11  headSplit 328  obs 1218  meanObsArea 0.3873
                 mnBody (published)          128            42       1101
                 mnBody (restored)            10           ~324       1219  meanObsArea 0.3934
COST      Nothing on his screen -- nothing here ships, and the shipped
          app is NOT affected (`parsePersons` emits headX/headY/headW/
          headH and `boundBodyToSlot` copies them, so the only producer
          in the tree that strips them is this bench-local helper). What
          it costs is the direction of the roadmap. Six published
          conclusions rest on it:

          1. §23's headline "the measured body associates BETTER on
             every count" -- FALSE. Restored, births move 141 -> 139
             (man) and 136 -> 133 (woman), `birthContended` REVERSES
             (-22 -> +6 man, -26 -> +4 woman) and `coastExpired` is flat
             (+0 man) or -4 (woman). The only counter still falling is
             `birthNearMiss`, which is the one the prediction was about.
          2. §23's "2.4x worse on exposure" -- 53.0/22.5 = 2.36x becomes
             24.0/22.5 = 1.07x. The measured body costs **+1.5s (man) /
             +2.0s (woman)**, not +30.5s / +18.5s.
          3. §23's "specifically it is the AREA the guess has and the
             measurement does not" -- the mean observation area is
             **0.3873 for the guess and 0.3934 for the measurement**.
             The measured bodies are 1.6% LARGER on average.
          4. §23's "the false cover column is the signature ... strip
             the fat and some of what it was covering was people who
             should not be" -- the sign REVERSES: -7.0 becomes **+22.5**
             (man), -15.0 becomes **+11.5** (woman). "The fat guess
             covers people by accident, measured from the inside" is
             measured backwards.
          5. §23's "37% (man) / 42% (woman) of `birthContended` is
             manufactured by the guess overlapping itself", and the
             whole "1091's assignment headroom is partly an artifact"
             bullet -- withdrawn. Restored, contended RISES 10% (man) /
             6% (woman) on a measured body. The artifact was the bench's.
          6. §21's title "THE MEASURED BODY IS WORTH A THIRD OF THE
             PHANTOM" -- it is worth **2.7% (15.0/547.5) man and 3.2%
             (20.0/628.0) woman**. And "`s >= 0.40` is the first
             defensible row" is dead: restored it reads 26.0 / 145.0 /
             566.0, **worse than control on all three columns** in his
             mode.

          Two more, outside the diff but reached by the same helper:
          phase-g G2's arithmetic ("height explains 1.6%, width ~15%,
          83% of the cost has no geometric explanation") divides by a
          30.5s denominator of which ~29s is the merge; and its
          "`faceW 6.0` costs 142.0s of exposure (+119.5), six times the
          control -- a box wide enough to swallow the neighbour's
          observation takes the neighbour's TRACK with it" names the
          right mechanism and the wrong cause. Restored, `faceW 6.0`
          reads **20.0 (-2.5) man and 12.0 (-13.5) woman** -- it REDUCES
          exposure. The swallow was the missing head field, not the
          width.

          And §7's "do not re-propose" list: "coco-ssd person boxes
          replacing the synthetic body: phantom -41%". The coco-ssd arms
          go through the same `bodyFromSsd`. Man, `ssdMin 0.5`:
          published 28.5 / 126.0 / 436.0 with `dedupeMerged` 105;
          restored **27.0 / 147.5 / 551.0 with merged 12** -- the
          phantom win is +3.5, i.e. gone. The refusal survives (it now
          costs exposure AND false cover for nothing); the reason
          recorded for it does not.
```

**This is phase-G's own lesson recursing one more time.** G1 was "a
bench re-implemented a shipped rule and lost half of it". H1 is "a bench
re-implemented a shipped BOX and lost a field the shipped one carries",
in the same file, found by asking the question the brief asked me to ask
— whether fewer births could mean fewer OBSERVATIONS rather than better
association. It could, and it does: 117 of them on the man arm.

---

## H2

```
SEVERITY  EXPOSURE (latent -- shipped code, NOT in this diff, inert on
          his phone today)
WHERE     app/gaze/src/person-track.mjs:578-582 (`sameHuman`'s
          short-circuit) against app/gaze/src/person-gate.mjs:1017
          (`headX: hx`, null when no head keypoint is confident)
CLAIM     `sameHuman` returns TRUE on containment alone whenever either
          box's `headX` is not a number -- and `parsePersons` emits
          `headX: null` for a person facing away or otherwise without a
          confident head keypoint. On this corpus that is **190 of 3,940
          admitted persons (4.8%)**, and **128 of 1,129 frames with more
          than one admitted person (11.3%) contain one**. On such a frame
          `dedupeObservations` can merge two distinct people whose boxes
          are 60% contained; `preferred()` keeps ONE of the two, so one
          person's verdict is discarded. If the survivor is a cleared
          same-gender read, the other person is uncovered. The
          head-separation guard exists because it "was deleting one of
          three people on every pass" (person-track.mjs:513-521) -- and
          it is switched off precisely for the person nobody could
          locate.
FALSIFIER The count: appendix script `_h_headnull.mjs` --

            admitted persons 3940; headX not a number on 190 (4.8%)
            frames with >1 admitted person 1129; of those, 128 carry a
            head-null person (11.3%)

          The behaviour: `sameHuman({box:{x1:0,y1:0,x2:1,y2:1}},
          {box:{x1:.4,y1:0,x2:.6,y2:1,headX:.5,headY:.5,headW:.05,
          headH:.05}})` returns true whatever the head separation,
          because the first box has no headX.
COST      Zero on his phone today -- findings 36 measures all twelve
          slots `n:0`, so `parsePersons` admits nobody and no such
          observation exists. It becomes live the moment his device
          admits persons (better hardware, the 16b letterbox, whatever
          fixes `n:0`), and it is the shape he cares about most: a woman
          standing inside a man's box, merged, his cleared verdict kept,
          her patch gone. H1 is the same mechanism seen through a bench;
          this is the half of it that is in `src/`.
```

---

## H3

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/bench/critic-packet.mjs:54-61;
          .claude/skills/gauntlet-round/SKILL.md:194;
          app/gaze/package.json `pretest`
CLAIM     G4 replaced `--test-concurrency=1` with an npm `pretest`, and
          `pretest` only runs when the suite is invoked through npm. The
          **evidence packet's own oracle does not**: critic-packet runs
          `node --test 'test/**/*.test.mjs'` directly, with a comment
          explaining why npm was avoided. So the one artifact a critic is
          required to trust is produced by the exact path G4 does not
          protect, and a `src/` edit made after the last build lands in
          the packet as unattributed failures.
FALSIFIER cd app/gaze && touch src/tuning.mjs \
            && node --test "test/**/*.test.mjs" 2>&1 | grep -E "^ℹ"

            ℹ tests 568
            ℹ pass 565
            ℹ fail 3

          against `npm test` on the identical tree:

            ℹ tests 583
            ℹ pass 583
            ℹ fail 0

          The three failures print `'test failed'` with no assertion
          named and **15 tests never run**, which is the unreadable
          shape G4's own commentary says cost a previous packet's oracle
          a false alarm. Restore with `node bench/_build.mjs`.
COST      Nothing on his screen. It costs a critic round: a packet
          assembled at the wrong moment reads as a regression in the diff
          under review, and phase-G records that exact false alarm
          happening once already. One line -- running `_build.mjs` in
          critic-packet ahead of `t1` -- closes it.
```

---

## H4

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/src/person-track.mjs:748-757 (the G8 seed);
          app/gaze/test/assign.test.mjs:141-144 (the comment added
          beside it)
CLAIM     G8's seed (`assignFellBackGreedy = 0`, optimal mode only) has
          no test anywhere in the tree, and the comment the diff adds
          names one that does not exist: *"`test/assign-seed` below pins
          the seed itself"*. There is no `assign-seed` test in
          `assign.test.mjs`, in `assign-wired.test.mjs`, or in the
          directory. Deleting the whole seed block leaves the suite fully
          green.
FALSIFIER Delete the seven-line `if (PTRACK_ASSIGN === 'optimal') {...}`
          block from person-track.mjs and run `npm test`:

            ℹ pass 583
            ℹ fail 0

          (Run in the repo and reverted in the same command; `git status
          --porcelain` shows no modification afterwards. Reproduced
          independently in the h3 scratch tree: 579 pass / 4 fail with
          AND without the block, the four being scratch-path artifacts
          unrelated to the seed.)
COST      Nothing today. The counter it seeds is what distinguishes "the
          optimal assignment ran and never hit its ceiling" from "no pass
          has happened yet" -- G8's entire point -- and a future refactor
          that moves the assignment call, or flips the default to greedy,
          silently returns the counter to the ambiguous state with 583
          green tests behind it. Grepping for a named test that was never
          written is also how a reader concludes a thing is covered when
          it is not.
```

---

## H5

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/test/whole-frame-counter.test.mjs:80-105 (`ownersOf`)
          and its red-proof at :138-172
CLAIM     G9's rewrite is wrong in BOTH directions, and one of the false
          positives is the exact failure G9 says it fixed. Six of seven
          crafted inputs are misclassified. The fourth alternative --
          `['"`]?NAME['"`]?\s*:\s*0` -- has OPTIONAL quotes and no string
          handling, so a bare mention inside a string literal reads as an
          OWNER; and the third alternative is `(?:bump\w*|\w*Life)\s*\(`,
          which IS a helper-name enumeration, three lines under a comment
          asserting "the rule is structural rather than a helper-name
          enumeration".
FALSIFIER Appendix script `ownersprobe.mjs` (imports the exported
          function; no repo edit):

            OWNER  A. real init-entry shape (control)
            MISSED B. FALSE NEGATIVE: helper not named bump*/*Life
            MISSED C. FALSE NEGATIVE: life bag aliased to a local
            MISSED D. FALSE NEGATIVE: computed key from a constant
            OWNER  E. FALSE POSITIVE: a // comment whose slashes follow a colon
            OWNER  F. FALSE POSITIVE: the name inside a STRING, not code
            OWNER  G. FALSE POSITIVE: an unrelated default-shape object

          B is `function inc(k){ids.life[k]=(ids.life[k]||0)+1}
          inc('wholeFrameSamples')` -- a genuine second writer, missed.
          E is the comment stripper's `(^|[^:])//` guard refusing to
          strip a comment whose slashes follow a colon. F is
          `log('reset wholeFrameSamples: 0 on a new video')`.

          The companion red-proof at :138 only exercises the two shapes
          the implementation already handles (`bumpLife("x")` and
          `bumpArm('x')`) plus two comment forms, so it is a fixture
          selected by the implementation -- the same criticism G9 makes
          of the fixture it replaced.
COST      Nothing on his screen. It costs the counter-collision guard its
          scope: the check that exists because `clampFired` was taken
          twice still cannot see a second writer that reaches the bag
          through a local alias or a helper nobody named `bump*`, and it
          will go red for a module that merely quotes the name near a
          `: 0`.
```

---

## H6

```
SEVERITY  DEAD-CHECK
WHERE     app/gaze/test/face-in-person.test.mjs:92-105 ("the app and the
          bench read ONE copy of this rule")
CLAIM     The guard against G1's defect class is four regexes over
          `init-entry.js` source. A re-introduced private copy passes it
          as long as the copy is written in a different syntax and the
          now-unused imports are left in place -- which is what a
          re-introduction looks like, because nobody deletes an import
          they did not notice was unused.
FALSIFIER Appendix script `onecopy.mjs` -- reads the real file, applies
          the mutation in memory, runs the test's four assertions
          verbatim, writes nothing:

            HEAD as committed                                      GREEN
            a private UNPADDED copy + a re-derived sort re-added    GREEN
            a literal revert to the old declaration form            red

          The mutation adds an arrow-function `faceInsideIndex2` with NO
          10% pad and a re-derived `order.sort((a,b) => ...)`. All four
          assertions hold: the imports are still there, there is no
          `function faceInsideIndex (`, and there is no
          `order.sort(function`.
COST      Nothing today -- the extraction itself is correct (see the
          clean bill). It costs the guard: only a byte-for-byte revert of
          this diff is caught, and the padding half of the rule -- the
          half worth 141 of the 317 synthetic faces -- can be re-derived
          unpadded beside the import with the test green.
```

---

## H7

```
SEVERITY  WRONG-NUMBER
WHERE     docs/engine-findings.md §23, the "AND IT MAKES 1091'S
          ASSIGNMENT LOOK CHEAPER THAN IT IS" bullet: "`birthContended`
          is the class the Hungarian shipped for -- 44-51% of births,
          the largest"
CLAIM     44.2% / 51.0% are §17's **greedy (1090)** row. §23's own
          control is the 1091 OPTIMAL arm, where §17's own table two
          sections earlier gives **42.6% (man) and 45.6% (woman)** --
          the same figures §23's table implies (60/141 and 62/136). The
          section quotes the shares of the build it is not measuring.
FALSIFIER cd app/gaze && node bench/births.mjs | head -8

            BIRTHS 141
              birthFresh            38  27.0%
              birthNearMiss         43  30.5%
              birthContended        60  42.6%
              birthSizeRejected      0  0.0%

          (`births.mjs` at HEAD reproduces `mnbody-births`'s CONTROL row
          exactly -- 141 / 38 / 43 / 60 / coastExpired 96 -- so the two
          instruments agree and 44-51% belongs to neither.)
COST      Nothing on his screen. The qualitative claim ("the largest
          class") survives. It is a stale cross-reference in the one
          bullet that asks a future round to re-price 1091, so the
          re-pricing would start from the wrong baseline -- and H1
          reverses that bullet's conclusion anyway.
```

---

## H8

```
SEVERITY  NIT
WHERE     docs/engine-findings.md §20, "Per window it runs 45.0% to
          100.0%, five windows at 100%, only one under 70%"
CLAIM     That sentence sits immediately under the two rows about faces
          claiming a person's box (72.5% / 27.5%) and immediately above
          "So on this corpus the shipped app would take a MEASURED body
          for roughly three faces in four", so it reads as a per-window
          bound on the CLAIM rate. It is the per-window ADMIT-FRAME rate
          (the `admit%` column of extent-reach.txt) -- a different
          quantity with a different denominator. `extent-reach.mjs` never
          computes a per-window claim rate at all.
FALSIFIER cd app/gaze && node bench/extent-reach.mjs | tail -20 -- the
          only per-window column printed is `admitFrames/frames`; the
          `facesInsideAPerson` accumulator is global. The 45.0% row is
          `RcGyVTAoXEU_w522` (54 of 120 frames admit anybody), which is a
          statement about frames, not about that window's share of the
          1,153 faces.
COST      Nothing measurable. It is the sentence a future round will
          quote when it decides whether one window can be dropped from
          the extent argument, and it would be quoting the wrong column.
          One clause ("of frames") fixes it, or the bench prints the
          per-window claim rate it is being read for.
```

---

## H9

```
SEVERITY  NIT
WHERE     app/gaze/bench/_build.mjs:110 (the entry-point test)
CLAIM     `path.resolve(process.argv[1]) === path.resolve(d,
          "_build.mjs")` is a case-sensitive string compare between a
          path as typed and a path derived from `import.meta.url` (a
          realpath). Windows paths are case-insensitive and a symlinked
          invocation differs from its realpath, so the same file invoked
          by a different-but-valid path takes the IMPORT branch and
          throws instead of exiting 0.
FALSIFIER cd app/gaze && touch src/tuning.mjs && node bench/_BUILD.mjs
          -- rebuilds, then throws ".cache/shipped.mjs was stale". The
          identical command `node bench/_build.mjs` prints
          "bench/.cache/shipped.mjs rebuilt (src/ had changed)." and
          exits 0.
COST      Nothing today: `npm test`'s `pretest` uses the exact literal.
          It is one `fs.realpathSync` (or a case-folded compare on
          win32) away from being robust, and a `pretest` that throws is a
          `pretest` that blocks the suite it was added to unblock.
```

---

## H10

```
SEVERITY  NIT (a qualification on a check that otherwise SURVIVES)
WHERE     app/gaze/bench/movenet-gated.mjs:127-168, the comment "THE
          INDEPENDENT INVERSE"
CLAIM     It is not independent. The four expressions
          `(data[o+51]-oy)/sy` … and the clamp are line-for-line what
          `unpadPersons` (person-gate.mjs) contains, computed from the
          same `FIT` and the same `S`. It is a second typing of the same
          arithmetic, which catches an EDIT inside `unpadPersons` (and
          does, both directions -- see the clean bill) but cannot catch a
          wrong `fit`, a wrong `size`, or a shared conceptual error in
          the inverse itself.
FALSIFIER Diff the two: `awk '/export function unpadPersons/,/^}/'
          app/gaze/src/person-gate.mjs | sed -n '56,63p'` against
          movenet-gated.mjs:133-137. The reported worst deviation
          `2.65e-8` is Float32Array storage rounding, not a difference in
          method -- if the two derivations were genuinely independent the
          residual would not be exactly one ULP of the storage type.
COST      Nothing. The check does the job F4 left undone and it is
          red-proved. The word "independent" oversells what a future
          round may rely on it for; "a second implementation of the same
          expression, in the same file, from the same fit" is what it is.
```

---

## C13 — PRE-MORTEM

He installs a build tomorrow that adopts the measured MoveNet body, and
reports it is worse. Three mechanisms, ranked:

1. **A woman merged into a cleared man's box, and only his verdict
   survived.** `sameHuman` is off for any person whose head keypoint was
   not confident (H2: 4.8% of admitted persons, 11.3% of multi-person
   frames), and `preferred()` keeps one observation. The counters that
   would show it are `dedupeMerged` against `dedupeHeadSplit` in
   `player.life`, read together: a build where merged rises and headSplit
   falls is this. Nothing in the report separates them by CAUSE today, so
   the null-head count belongs beside them.
2. **False cover, not exposure, is what he would actually notice.** With
   H1's artifact removed the measured body costs +22.5s (man) / +11.5s
   (woman) of FALSE COVER on the corpus and buys only 15-20s of phantom
   — i.e. more men covered who should be sharp, which is his oldest
   complaint ("it blurs males"), not fewer patches.
   `readClearCertain` against patch count per pass is the reading.
3. **Nothing changes at all and the round is unfalsifiable.** Every
   `mnBody` arm is byte-identical to CONTROL where `parsePersons` admits
   nobody, and that is 100% of his phone today (twelve slots `n:0`). A
   build shipped into the `n:0` regime produces no difference to report,
   which reads exactly like a change that did not work. `slotsNonZero` in
   the artifact is the gate — do not ship a body-source change without it
   reading non-zero on his device first.

---

## What I tried to break and could not

- **G1's extraction is behaviourally identical, and it is verified in the
  EMITTED bundle, not in source.** `app/src-tauri/gaze-page.js` (clean
  against HEAD; `git diff --stat HEAD -- app/src-tauri/gaze-page.js` is
  empty) carries exactly **one** copy of the padded containment —
  `var s=e[o],a=(s.x2-s.x1)*.1,i=(s.y2-s.y1)*.1;if(r>=s.x1-a&&r<=s.x2+a&&n>=s.y1-i&&n<=s.y2+i)`
  — **zero** copies of the inline size comparator, and the claim site
  reads `Bo=hE(xe[Lt],ye);if(Bo!==-1&&!Wn[Bo]){Wn[Bo]=1;continue}`. So
  the rule is READ, not merely emitted.
- **`synthFaceIndices` faithfully models the app's loop.** I read
  init-entry.js:3685-3785 line by line looking for something the
  reconstruction drops. The `noShape` branch only bumps `faceNoShape` and
  writes the two gate rings; `boundBodyToSlot` only shrinks a box already
  being pushed; neither can change WHICH faces fall through. The set
  `synthFaceIndices` returns is the set the app pushes to `extra`.
- **The 27.5% / 72.5% correction reproduces exactly.**
  `node bench/extent-reach.mjs` → 1,153 banked faces, 836 claiming
  (72.5%), 317 falling through (27.5%), 1,900 of 2,160 frames admitting
  (88.0%). `parsePersons(slice, undefined, …)` defaults to
  `PERSON_MIN_SCORE`, so the bench and the arm gate identically.
- **G5/G6 are real and red-proved in BOTH directions.** In the h3 scratch
  tree with a copied `src/`: breaking `unpadPersons`'s `sx` to `sx/3`
  gives worst deviation **6.48e-1** and `*** THE SHIPPED MAP DISAGREES
  ***` with **exit 2**; breaking it the other way (`sx*3`) gives
  **6.53e-1**, also exit 2 — so the two-sidedness claim holds. Clean, it
  reads **2.65e-8** against a 1e-6 tolerance and exits 0. G6's half (the
  block used to print the failure and exit 0) is fixed.
- **G7's counters are at the right granularity and its arithmetic is
  right.** An OPPORTUNITY is a frame-face with ≥1 eligible neighbour,
  bumped once per face; the edge can only move inside the `elig++`
  branch, so moved ⊆ opportunity by construction, and
  `moved+inert == opportunity+noNeighbour == 1014` in both arms, which
  means the `x2-x1>0` guard never silently dropped a case. 285/348 =
  81.897% and 67/84 = 79.762%, reproduced exactly. (One residual: the
  header line still prints the conflated "28.1% of the branch" above the
  corrected figure. The text under it explains; I would delete the
  number.)
- **§21a survives H1 entirely.** The EDGE ONLY arm builds its box as
  `{...guess, x1, x2, faceBox}`, so it inherits `personFromFace`'s head
  fields and `sameHuman` works normally. Its rows are byte-identical with
  and without H1's patch (22.0 / 135.5 / 536.0 man, 27.0 / 201.0 / 627.0
  woman, both arms, both runs). The 285-moves-six-windows refusal stands.
- **`boundBodyToSlot` is not affected either** — it copies every own key
  of the body it is handed, so the `slotBound` arm keeps the head fields.
  `bodyFromSsd` is the only producer in the tree that strips them, which
  is what makes H1 a bench defect and not a shipped one.
- **G4's headline reproduces.** `npm test` is **583/583 in 12.8s**, and
  green on the first run even from a deliberately stale bundle
  (`touch src/tuning.mjs && npm test` → 583/583). The `pretest` fires,
  rebuilds, and exits 0. H3 is a path it does not cover, not a defect in
  the fix.
- **No scope or owner-rule violation in the diff.** Nothing matching
  `.env*`, `**/auth/**`, `**/payment*/**`, `**/migrations/**`, `*.sql`,
  `.github/workflows/**`, `src-tauri/capabilities/**`, or any
  key/secret/token/credential filename. `rules/tuning.json` untouched, so
  nothing travels over OTA. No patch geometry changed anywhere — no
  holes, splits or silhouettes — and `PTRACK_IOU_MIN`'s clamp is unmoved.
  The 1091 control triple reproduces in four benches (`man 22.5 / 136.5 /
  547.5`, `woman 25.5 / 201.5 / 628.0`) and `control-triple.test.mjs` is
  green.
- **`bench/critic-gate.mjs` reads 70 rows / 70 CONFIRMED, exit 0**, and
  the packet's `cargo test` carries EXIT CODE 0 with three
  `test result: ok` lines.
- **Things I looked for and did not find:** a saturating-ring
  b-minus-a in any number under review (every corpus counter is a
  per-window accumulator over a fresh `__TS_GAZE_IDS`); a device number
  anywhere in the diff (there is none — H's evidence is entirely offline
  corpus, so C11 has nothing to bite on); and a counter-name collision
  introduced by `mnEdgeOpportunity`/`mnEdgeNoNeighbour` (both are
  `bumpArm`, bench scope, and `ownersOf` finds no `src/` writer for
  either).

---

## Appendix — the scripts behind the falsifiers

### H1 — restore the head fields on the measured body

Applied to a COPY of `bench/arch-arms.mjs`. It touches no box
coordinate; the four added fields are metadata `sameHuman` reads and
nothing else does.

```python
# in the copied bench/arch-arms.mjs, inside bodyFromSsd's return literal
old = """    fromFace: true, faceBox: face, fromSsd: true,
  };
}"""
new = """    fromFace: true, faceBox: face, fromSsd: true,
    // The head metadata personFromFace carries and this box did not.
    // Without it sameHuman() returns TRUE on containment alone.
    ...(process.env.HEADMETA ? {
      headX: (face.x1 + face.x2) / 2,
      headY: (face.y1 + face.y2) / 2,
      headW: ((face.y2 - face.y1) / 1.4) / (640 / 360),  // de-inflate FACE_ENLARGE, then /ar
      headH: ((face.y2 - face.y1) / 1.4),
    } : {}),
  };
}"""
```

Then:

```
             node bench/mnbody-ab.mjs        # published
HEADMETA=1   node bench/mnbody-ab.mjs        # restored
             node bench/mnbody-births.mjs
HEADMETA=1   node bench/mnbody-births.mjs
```

The instrumented counters (`dedupeMerged`, `dedupeHeadSplit`,
`obsPreDedupe`, `obsPostDedupe`, `obsAreaX1e6`) are a
`bumpArm2(key, n)` helper beside `bumpArm`, called around the
`obs = dedupeObservations(obs)` line, with the keys added to
`mnbody-births.mjs`'s `KEYS` array.

### H2 — how often the head anchor is null

```js
import './_build.mjs';
import { winFiles, W, H } from './corpus-lib.mjs';
import { loadWin, thinFrames, K_HIS } from './arch-arms.mjs';
import { parsePersons } from './.cache/shipped.mjs';
let persons = 0, headNull = 0, framesMulti = 0, multiWithNull = 0;
for (const file of winFiles()) {
  const w = thinFrames(loadWin(file), K_HIS);
  if (!w.persons) continue;
  const fr = w.frames || [];
  for (let fi = 0; fi < fr.length; fi++) {
    const off = fi * 336;
    if (off + 336 > w.persons.length) continue;
    let ps = [];
    try { ps = parsePersons(w.persons.subarray(off, off + 336), undefined, W / H, null) || []; } catch (e) { ps = []; }
    persons += ps.length;
    let n = 0;
    for (const p of ps) if (typeof p.headX !== 'number') { headNull++; n++; }
    if (ps.length > 1) { framesMulti++; if (n) multiWithNull++; }
  }
}
console.log(`admitted persons ${persons}; headX not a number on ${headNull}`);
console.log(`frames with >1 admitted person ${framesMulti}; of those ${multiWithNull} carry a head-null person`);
```

### H5 — `ownersOf` in both directions

```js
import { ownersOf } from 'file:///Z:/Apps/Disconnect/app/gaze/test/whole-frame-counter.test.mjs';
const cases = [
  ['A. real init-entry shape (control)',
   "var d=window.__TS_GAZE_IDS; d.life.wholeFrameSamples = (d.life.wholeFrameSamples||0)+1;"],
  ['B. FALSE NEGATIVE: helper not named bump*/*Life',
   "function inc(k){ ids.life[k]=(ids.life[k]||0)+1; }\ninc('wholeFrameSamples');"],
  ['C. FALSE NEGATIVE: life bag aliased to a local',
   "var L = window.__TS_GAZE_IDS.life; L.wholeFrameSamples = (L.wholeFrameSamples||0)+1;"],
  ['D. FALSE NEGATIVE: computed key from a constant',
   "var K='wholeFrameSamples';\nvar d=ids; d.life[K]=(d.life[K]||0)+1;"],
  ['E. FALSE POSITIVE: a // comment whose slashes follow a colon',
   "var o={a:// wholeFrameSamples: 0 is what init-entry seeds\n1};"],
  ['F. FALSE POSITIVE: the name inside a STRING, not code',
   "log('reset wholeFrameSamples: 0 on a new video');"],
  ['G. FALSE POSITIVE: an unrelated default-shape object',
   "export const EMPTY_REPORT = { wholeFrameSamples: 0 };"],
];
for (const [label, src] of cases)
  console.log((ownersOf('wholeFrameSamples', [['probe.mjs', src]]).length ? 'OWNER  ' : 'MISSED ') + label);
```

### H6 — the "one copy" assertion, bypassed without writing to the repo

```js
import { readFileSync } from 'node:fs';
const orig = readFileSync('Z:/Apps/Disconnect/app/gaze/src/init-entry.js', 'utf8');
const verdict = (src) => (/faceOrderBySize,/.test(src) && /faceInsideIndex,/.test(src)
  && !/function faceInsideIndex\s*\(/.test(src) && !/order\.sort\(function/.test(src)) ? 'GREEN' : 'red';
const reCopied = orig.replace('var order = faceOrderBySize(faces);', `
  var faceInsideIndex2 = (face, persons) => {
    var cx = (face.x1 + face.x2) / 2, cy = (face.y1 + face.y2) / 2;
    for (var i = 0; i < persons.length; i++) {
      var p = persons[i];
      if (cx >= p.x1 && cx <= p.x2 && cy >= p.y1 && cy <= p.y2) return i;   // NO PAD
    }
    return -1;
  };
  var order = [];
  for (var oi = 0; oi < faces.length; oi++) order.push(oi);
  order.sort((a, b) => (faces[b].x2 - faces[b].x1) * (faces[b].y2 - faces[b].y1)
    - (faces[a].x2 - faces[a].x1) * (faces[a].y2 - faces[a].y1));`);
console.log('HEAD                       ', verdict(orig));
console.log('private unpadded copy back ', verdict(reCopied));
```

### H1's coco-ssd extension

An arm run in the copied bench, `{ ssdMin: 0.5 }` and `{ ssdMin: 0 }`
against CONTROL, scored with `corpus-score.mjs`, with and without
`HEADMETA=1`:

```
HEADMETA off
man    CONTROL              exp 22.5  fc 136.5  ph 547.5   merged  11  obs 1218
man    coco-ssd ssdMin 0.5  exp 28.5  fc 126.0  ph 436.0   merged 105  obs 1127
man    coco-ssd ssdMin 0.0  exp 29.0  fc 131.0  ph 480.0   merged 103  obs 1131
woman  CONTROL              exp 25.5  fc 201.5  ph 628.0   merged  14  obs 1215
woman  coco-ssd ssdMin 0.5  exp 39.5  fc 195.5  ph 506.5   merged 110  obs 1122
woman  coco-ssd ssdMin 0.0  exp 34.5  fc 201.5  ph 516.0   merged 108  obs 1129

HEADMETA on
man    coco-ssd ssdMin 0.5  exp 27.0  fc 147.5  ph 551.0   merged  12  obs 1217
man    coco-ssd ssdMin 0.0  exp 28.0  fc 154.0  ph 595.0   merged  12  obs 1217
woman  coco-ssd ssdMin 0.5  exp 32.0  fc 221.0  ph 622.5   merged  14  obs 1215
woman  coco-ssd ssdMin 0.0  exp 28.5  fc 224.0  ph 662.0   merged  13  obs 1216
```
