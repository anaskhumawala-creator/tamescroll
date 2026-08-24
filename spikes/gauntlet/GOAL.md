# Gauntlet loop — in-player blur accuracy

**Owner's bar, verbatim (2026-08-25):** "there isn't a single frame that
the other gender is visible and there isn't a single frame where the
wrong gender is blurred up". Plus: "there shouldn't be any frame that is
being blurred which has no human at all", and "for women, blur them
fully — not leave anything, the legs or the hands or the head".

The owner asked for the goal to be sharpened beyond his own wording, so:

## The invariant

For every frame, for every person in it, exactly one of two things is
true, and nothing else appears on screen:

- they are the **opposite** gender (or a child, or unresolved) ⇒ their
  WHOLE body is covered — head, hands, feet, hair, nothing protruding;
- they are the **same** gender ⇒ they are completely sharp.

And: **pixels not belonging to a person are never covered.**

## Failure classes (scored per frame, all terminal)

| class | definition |
|---|---|
| **EXPOSURE** | any part of an opposite-gender person visible unblurred |
| **PARTIAL** | covered person with a limb, hand, foot or hair outside the patch |
| **FALSE COVER** | a same-gender person carrying a patch |
| **GHOST** | a patch over no person at all — empty frame, furniture, hands, a logo, or a patch coasting after its subject left |
| **DRIFT** | a patch that visibly lags, floats, or jitters away from its subject between frames |

EXPOSURE is the worst, but the owner counts all five. "Blur-first" is the
tiebreaker for a genuinely unknown frame, never an excuse for GHOST.

## Symmetry

Every fix is tested in BOTH directions. With `man`, women and children
are covered and men sharp; with `woman`, the inverse. A fix that helps
one direction and quietly breaks the other is a regression, and this is
easy to do because only one of the two paths is exercised by the
baseline video.

## Cost

Mobile is a first-class constraint, not a footnote. Target hardware is a
Helio G88. A fix that buys accuracy at the price of pass cost is judged
on both numbers, and pass cost is measured, not assumed. Record
`lastVerdictMs` / `lastPassMs` alongside the accuracy score every round.

## Edge cases that must never regress

Seek, pause, resume, resolution change, 2x/3x playback, loop back to
start, SPA navigation to another video, fullscreen enter/exit, ad break,
tab hidden then shown. Each of these has produced a stuck or stale patch
at least once.

## How a round runs

1. Pick the next `(query, gender)` pair from the rotation.
   `python gauntlet.py search "<query>" 5` resolves live video ids —
   never hardcode an id.
2. `python gauntlet.py runs/<round>-<gender> <gender> <videoId> <start>
   <count> <step>` captures player-only frames + overlay geometry +
   track state + pass cost.
3. Score EVERY frame by eye against the five classes. Record counts and
   the exact frame files that failed.
4. Spawn a critic agent. **Each round's brief must differ from the
   last** — different lens, different question, fresh evidence, and it
   is told what the previous critic already said so it does not repeat
   it. Web search is allowed and encouraged for prior art.
5. Apply what survives scrutiny. Rebuild, re-run the SAME round, confirm
   the failed frames now pass and the passing set did not regress.
6. Commit + push. Append a ROUNDS entry.

## Rotation

| # | query | gender | why this one |
|---|---|---|---|
| 1 | (fixed) NWoT1ZVd1Lo | man | baseline: adult male + child female, known-hard |
| 2 | (fixed) NWoT1ZVd1Lo | woman | same footage, inverted expectation |
| 3 | ted talk full speech | man | single speaker, stage lighting, slow cuts |
| 4 | news panel discussion | woman | 3-5 people, seated, small faces |
| 5 | cooking show episode | man | hands and objects — the GHOST trap |
| 6 | conference keynote audience | woman | crowd shots, 10+ people (MoveNet caps at 6) |
| 7 | sports post match interview | man | motion, back-turned subjects |
| 8 | classroom lecture | woman | mixed ages — the child gate |

Owner constraint: nothing indecent. Queries stay ordinary.

## Standing rules

- Verify by FRAME, never by test suite alone. A green suite shipped
  three broken releases this week.
- A probe must never be able to throw inside the pipeline. One did, and
  it silently killed every gender verdict for two releases.
- Licences: MIT/Apache/BSD only. Ultralytics YOLO (code AND weights) and
  abewley/SORT are AGPL/GPL — permanently banned. Never copy HaramBlur.

## ROUNDS

- **R0** (2026-08-25) — harness built. Baseline NWoT1ZVd1Lo/man: Linus
  clears, daughter covered, empty desk shots hold 0 patches. Open: one
  frame carried a half-frame GHOST (x 0.000-0.551, y 0.000-1.000).
- **R1** (2026-08-25) — patch geometry reversed to FULL BODY per the
  owner: all 17 keypoints extend the patch (legs included), keypoint
  margin 0.03 -> 0.05, new outward PATCH_MARGIN 0.08, personFromFace
  widened to a whole body. Evidence gate deliberately still counts only
  the upper body (0-12) — legs are the noisiest keypoints, so they get a
  vote on GEOMETRY but never on whether a slot is a person at all.
  Frame f004: Linus fully sharp, daughter covered head to frame-bottom,
  single patch. gaze 88/88.
- **R2** (2026-08-25) — first run of the `woman` direction, and it
  immediately caught a HARNESS bug rather than a product bug: the run
  reported `g:"man"` while claiming to test `woman`. Calling
  `set_user_gender` directly looks like it works and does nothing —
  `open_platform` passes the launcher's stored gender through with the
  tile click and overwrites the Rust state a moment later. The harness
  now drives the launcher's own toggle and HARD-FAILS if the booted
  direction disagrees with the request, because a run that booted the
  wrong way is worse than no run: its frames look like evidence.
  Re-run (runs/r2b-woman): 0 EXPOSURE, 0 FALSE COVER on adults — Linus
  covered as expected. His daughter stays covered too, which is the age
  gate working as designed (under 18 ⇒ gender untrusted ⇒ never clears,
  in either direction) rather than a false cover.
  OPEN, and the next round's target: f000/f006/f008 carry 2-3 patches
  while the last pass reported 0 persons. That is the GHOST class and it
  matches the owner's "boxes spawn randomly and float around". Note the
  persons count is the value from the most recent pass, so some of these
  may be position-pass lag rather than true ghosts — settle that first
  by timestamping the persons count alongside the patch rects.
