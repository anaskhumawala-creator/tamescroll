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
3. Score EVERY frame by eye against the five classes, comparing
   `fNNN.png` (as the user sees it) against `fNNN_truth.png` (same
   instant, overlays hidden). The pair is what makes scoring objective —
   from the blurred image alone, a correctly-covered person and a
   wrongly-covered one look identical. Record counts and the exact frame
   files that failed.
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
- **R3** (2026-08-25) — the "boxes spawn randomly and float around"
  complaint, diagnosed and fixed. NOT ghosts: the truth frames show real
  people under every patch. The defect was DUPLICATE patches — two
  tracks per person, drawn stacked with a visible seam.
  Two causes, both fixed:
  * merge used IoU only, which punishes a size difference. A full-body
    patch and a head-and-shoulders patch on one person score IoU ~0.14
    and never merged. Added MERGE_CONTAIN_MIN 0.6 on intersection-over-
    smaller-area, which asks the question that matters (is this patch
    essentially inside that one) and stays near zero for people standing
    side by side.
  * the duplicate tracks themselves: MoveNet reports a person, the
    full-frame face pass finds their face, `faceInsideAny` misses
    because the face box pokes outside the person box, and
    personFromFace mints a second person on top. New
    dedupeObservations() collapses them BEFORE association — merging at
    render time hid the seam but left two tracks competing for one
    person's gender reads, so a verdict landing on one left the other
    blurred forever.
  Before: 3 stacked patches over 2 people. After: exactly one patch per
  person, no seams (runs/r3-woman, runs/r3b-woman).
  COST, first measurement on the dev app: verdict pass p50 152ms,
  p95 554ms, max 3856ms; position pass p50 27ms, p95 37ms, max 57ms.
  The position pass is cheap and fine. The verdict tail is the problem —
  a 3.8s outlier on a desktop means a phone stalls, and the adaptive
  throttle reacts to it rather than preventing it. NEXT ROUND'S TARGET.
  Harness: frames are now captured in PAIRS, blur-on and blur-off at the
  same instant (owner idea), so scoring stops being guesswork about who
  is underneath a patch. gaze 93/93, cargo 31/31.
- **R5** (2026-08-25) — rotation entry 3, TED talk arj7oStGLkU, `man`,
  12 frames, bundle v7. **The failure INVERTS with subject scale.** That
  is the finding of this round and the target of the next.
  BEFORE (every frame read against its blur-off twin):
  EXPOSURE 4 (f003, f004, f005, f006) · FALSE COVER 3 (f000, f004, f005)
  · GHOST 0 · PARTIAL 0 · DRIFT 0.
  * CLOSE-UP frames (f001, f002, f007-f011) are PERFECT: persons=1, zero
    patches, the male speaker correctly sharp, track 10 'cleared' with
    clearStreak 15 and lastVerdict 'clear-certain'. The pipeline is right
    when the subject is big.
  * WIDE frames (f003-f006 — speaker ~12% of frame height, ~40-person
    audience) invert it: `persons` reads 0, yet f004/f005 still carry ONE
    patch and it sits over the MALE SPEAKER, while ~40 audience members —
    several clearly female in the lit right-hand block around x 0.78-0.90,
    y 0.74-0.90 — are completely sharp. Both terminal classes at once, and
    in the worst possible arrangement: the only person we track is the one
    who should be sharp, and everyone who should be covered is invisible
    to us. Same video, same code, seconds apart — scale is the only
    variable.
  * f000 is a separate, milder FALSE COVER: a new track starts BLURRED and
    needs 2 certain clear reads, so the speaker is covered for the first
    ~1.8s of the shot before clearing. Blur-first working as designed —
    but the owner's bar counts it, so it is logged, not excused.
  COST: verdict n=56 p50 97ms p95 340ms max 2416ms; position n=109 p50
  23ms p95 37ms max 51ms. The verdict tail improved markedly against R3
  (p95 554 -> 340, max 3856 -> 2416); the multi-second outlier survives.
  Harness: gauntlet.py now refuses a run whose start offset is past the
  end of the video. A seek past duration silently CLAMPS to the final
  frame, and R5's first attempt scored 12 identical frozen frames at
  t=76.08 while believing it was looking at a static shot.
  AFTER (runs/r5h-man, same video, same offsets):
  EXPOSURE 4 (unchanged) · FALSE COVER **3 -> 0** · GHOST 1 · PARTIAL 0 ·
  DRIFT 0. COST verdict p50 86 p95 330 max 1494 (from p95 340 max 2416);
  position p50 23 p95 36. gaze 100/100.
  WHAT CHANGED, and the measurement behind each:
  * **Two-tier person floor.** A new probe (person-gate lastSlotDiag)
    logged all six raw MoveNet slots BEFORE any gate. On every
    zero-person wide pass, slot 0 came back at 0.14-0.35 with 10-11 of 13
    confident keypoints — the speaker in full view, thrown away by our
    own PERSON_MIN_SCORE 0.35. Noise slots scored ~0 with 0-4 keypoints,
    so keypoint count separates person from noise where score cannot. A
    slot now gets in by scoring well OUTRIGHT or by carrying a strong
    skeleton (>=7 keypoints, score >=0.12). Every wide frame now reports
    persons=1 where it reported 0.
    This is the answer to the round's open question: the wide-shot miss
    was OUR THRESHOLD, not the model. It was free to fix. The audience is
    a genuinely different problem — their slots carry 0-4 keypoints, i.e.
    below the model's real floor, and most are back-of-head so no face
    path reaches them either. That needs multi-scale and it is NOT done.
  * **Track survival + wipe corroboration.** Coast is now cadence-aware
    (max(900ms, 2.5x the verdict interval)) because 900ms of wall time is
    less than one verdict pass on a Helio G88, which would flicker every
    covered person once per pass — a phone-only bug no desktop round can
    reproduce. wipeIfEmpty now needs TWO consecutive empty passes, but
    only when the last thing seen was SMALL: at small scale both
    detectors fail for the same reason, so their agreement is one blind
    spot counted twice, whereas a BIG subject vanishing really is a cut.
  * **Size-compatible association.** An oversized stale track overlaps
    everything, so on IoU alone it claimed every new detection, reset its
    own miss counter and became immortal. Boxes differing by more than 3x
    in area no longer associate.
  * **Identity break snaps the box.** When a descriptor stops matching we
    already reset the verdict; the box kept EMA-gliding from the old
    shot's geometry. If it is not the same person, the geometry is not
    theirs either.
  THREE REGRESSIONS CAUGHT AND FIXED INSIDE THE ROUND, each by re-running
  and looking rather than by reasoning:
  * unconditional wipe corroboration kept a stale close-up alive through
    a cut = near-full-frame blur (r5b f003) -> fixed by the size
    condition;
  * a plain area cap on low-tier slots rejected legitimate close-ups and
    drove FALSE COVER to 5 frames (r5e) -> replaced with a COHERENCE
    check (keypoint union vs the model's own box), because the tell is
    keypoints disagreeing with the box, not the box being large.
  STILL OPEN, and the next round's target:
  * **the cut frame.** f003 — the first wide frame after the close-up —
    still carries one near-full-frame patch, and it survived all four
    fixes above. It is a single transient frame at a shot change; the
    scene gate's luma-delta cut detector does not fire on this
    crossfade. Next round: instrument the cut path directly rather than
    guessing which layer mints that box.
  * **audience EXPOSURE (4 frames, unchanged).** Needs multi-scale
    recall, and per the critic that must NOT ship before the verdict
    budget can absorb what it finds: ZOOM_MAX_PERSONS is 3, so finding
    40 people would give each a gender read every ~5s while all of them
    start blurred — converting EXPOSURE into mass FALSE COVER, which is
    a lateral move, not a fix.
  Harness: gauntlet.py now waits out the ad/load window before trusting
  `duration` (during a pre-roll the element reports the AD's duration, so
  an 843s talk briefly looks like a 6s clip and the guard rejected a good
  run).
- **R6** (2026-08-25) — rotation entry 4, news panel u_Kdf06irw8, `woman`.
  First woman-direction run since the tracker rewrite, and it found a
  **real direction asymmetry in the model, not in our code**.
  BEFORE (runs/r6-woman, 12 frames): FALSE COVER 3 (f000-f002) · EXPOSURE 0
  · GHOST 0 · PARTIAL 6 (f006-f011, the newspaper) · DRIFT 0.
  AFTER (runs/r6d-woman + r6g-woman, same segment): **FALSE COVER 3 -> 1**,
  and the 1 is the unavoidable first-appearance frame where a new track
  starts covered before its first two reads land. Man direction re-checked
  for symmetry (runs/r6f-man): 2 of 10 frames carry a patch, matching the
  R5 baseline — no regression.
  THE FINDING. A 3-person panel: man left, woman centre, man right, all
  seated, faces 8-11% of frame height, one static shot. For ~6 seconds
  ALL THREE were covered — including the woman, who is the person the
  setting exists to leave alone. The raw reads say why:
      male reads   (19 samples): 0.87-0.97, median 0.94, P(>=0.6) = 19/19
      female reads ( 5 samples): 0.22-0.67, median 0.54, P(>=0.6) =  2/5
  Same frames, same lighting, same scale — the frame is its own control,
  so this is NOT the R5 scale effect. faceres gets the DIRECTION right
  every time; it is simply far less certain about women. GENDER_CLEAR_SCORE
  0.6 was calibrated on the male distribution, so one number is not one
  bar: a man clears on his first read, a woman's clear streak keeps
  resetting. With CLEAR_STREAK_N 2, expected reads to clear go from 2
  (~0.8s) at p=1.0 to ~8.75 (~3.5s) at p=0.4 — which is the observed
  latency, and it would hit every woman-mode user on every video.
  FIXED:
  * per-gender clear bar, selected by the MODEL'S LABEL rather than by the
    user's gender so the code stays symmetric: GENDER_CLEAR_SCORE_FEMALE
    0.45, male bar untouched at 0.6. Note this cannot affect the owner's
    own experience at all — in man mode the clear side is male, so the
    female bar is never consulted.
  * clearStreak now DECAYS by one on an uncertain read instead of being
    zeroed. An uncertain read is treated as non-evidence everywhere else
    in the tracker (CLEAR_DECAY); zeroing treated it as evidence against.
    A certain OPPOSITE read still erases the streak outright.
  * coast window CAPPED (PTRACK_MAX_COAST_MS 2000). R5 made coast track
    the verdict cadence but left it unbounded above — this desktop's worst
    verdict of 1618ms already implied a 6-SECOND coast, and a phone would
    carry a stale patch for 10-15s. Every ghost complaint scales with it.
  CRITIC CORRECTED MY SCORING, and the correction matters: I logged the
  newspaper frames as GHOST. They are not. Every patch there has real
  photographed people under it — a group photo, a portrait — so they score
  PARTIAL/FALSE COVER instead. f004/f005 are also correct, not ghosts: a
  full-frame close-up of a man, covered, in woman mode.
  STILL OPEN, next round's target:
  * **printed-photo churn.** Twelve distinct track ids across six frames of
    a nearly static newspaper: BlazeFace finds a different subset of ~15
    printed faces each pass, personFromFace mints a new body for each, and
    PTRACK_IOU_MIN 0.2 sits inside the 0.16-0.30 band those boxes score
    against each other, so association is a coin flip. Fix is face-anchored
    association (associate on the FACE box, not a body box that is 7 face-
    heights tall of which 1/7 is evidence). Free.
  * merge is structurally blind here: for EQUAL-area boxes containment>=0.6
    implies IoU>=0.4286, barely looser than MERGE_IOU_MIN 0.5, so the
    containment rule only does real work at >=2x area difference. A cluster
    of similar-sized offset boxes never merges at any scale.
  * positionOnly observations mint blurred tracks that never receive a
    verdict (person-track newTrack has no positionOnly check).
  * static suppression was considered and REJECTED on argument: it cannot
    separate a printed person from a motionless real one (a still subject
    decodes to bit-identical frames), and the old confidence leg is refuted
    by R5, where a real speaker in full view scored 0.14. Low confidence
    means SMALL, not PRINTED.
  * OWNER DECISION NEEDED: should printed photographs of people be covered?
    Recommendation is yes, for consistency with thumbnail blurring — but it
    means printed SAME-gender people get covered too, and the model cannot
    resolve those faces (reads 0.02-0.27, coin flips).
  COST: verdict p50 103-203 p95 496-537 max 2332-4943 across the round's
  runs; position p50 21-29 p95 28-38. The tail is still the standing target
  and it did not improve this round.
  Harness: three new hard-fail guards, each from a run that silently lied.
  A run is now rejected if playback jumps BACKWARDS (the video ended and
  autoplay moved on — r6b scored six frames of one video and six of
  another), if the video id changes mid-run, or if ANY frame was captured
  during an ad (r6e scored ten frames of a pre-roll and the numbers read
  like a regression in the TED talk).
- **R7** (2026-08-25) — rotation entry 5, Hell's Kitchen S19E1 KAWvDsghyc8,
  `man`. Target was the GHOST trap (hands and objects); what it actually
  found was **TRACK CHURN, and the cause was a fix I shipped in R5**.
  BEFORE (runs/r7-man, 12 frames): FALSE COVER 5 (f000-f003, f008 — a male
  close-up, covered) · EXPOSURE 1 severe (f004: a dense crowd of ~8 women,
  ZERO patches, everything sharp) · f007 the opposite extreme (one patch
  covering the WHOLE frame, so every man in the crowd covered too) ·
  correct on f009/f010.
  THE FINDING. One continuous close-up of ONE man, no cuts, gender reads
  'male' at 0.52-0.96 throughout — and **eighteen track ids** across twelve
  frames. He kept earning a clear and then losing it: id 15 CLEARED with
  clearStreak 3 at f001, BLURRED with clearMs 0 at f002; id 17 CLEARED at
  f004, blurred again at f005. CLEAR_STREAK_N needs 2 CONSECUTIVE certain
  reads on ONE identity, so an identity that rarely survives two passes
  makes the clear mechanism close to structurally unreachable.
  MEASURED CAUSE (new lifecycle probe, __TS_GAZE_IDS.life): over 8 frames,
  30 SIZE-REJECTED associations against 26 new tracks. R5's
  `sizeCompatible` gate (PTRACK_SIZE_RATIO_MAX 3) was firing constantly,
  and every refusal mints a fresh track. The reason is that one human has
  two legitimate representations in this pipeline — a MoveNet body box and
  a personFromFace synthetic body (3.6 face-widths by 7 face-heights) — and
  they differ severalfold in area, so whenever the observation SOURCE
  flipped between passes the gate declared them two different people.
  FIXED: PTRACK_SIZE_RATIO_MAX 3 -> 6. That still blocks what the gate was
  built for (the r5f immortal ghost was a 0.795x1.0 box absorbing a
  0.12x0.45 detection, ratio ~15) without punishing a person for being
  seen a different way.
  AFTER (runs/r7b-man, r7c-man): size rejections **30 -> 0**, distinct
  track ids **23 -> 16**, identityBroke only 1 in a full run, and tracks
  now persist 2-5 passes instead of 1. Frame effect: the male close-up
  that was fully covered at r7-man f002 is SHARP at r7b-man f002.
  COST unchanged: verdict p50 100-105 p95 403-436 max 2294-2581; position
  p50 21 p95 27.
  STILL OPEN — and this is now the biggest single failure in the log:
  * **crowd EXPOSURE.** r7c f008 is a wide restaurant shot with ~20 people
    and carries 2 patches. r7-man f004 was ~8 women with ZERO. MoveNet caps
    at 6 slots, ZOOM_MAX_PERSONS is 3, and the crowd is below the model's
    resolution floor anyway. This is the multi-scale item R5 deferred, and
    R5's critic was right that recall must not ship before the verdict
    budget can absorb it — but "a crowd of women left entirely sharp" is
    the owner's worst class and it is now the top item.
  * the man is still covered on some close-up frames (r7c f003). Churn is
    reduced, not eliminated; 16 ids for one shot is still too many.
  HARNESS — a correctness bug that silently corrupted scoring on fast-cut
  footage, and it invalidates any earlier round scored on such content:
  the blur-on and blur-off shots are two SEQUENTIAL screenshots, and on
  rapid editing the video CUTS between them. r7b f001 was captured as a
  man pointing while its "truth" twin showed a completely different shot of
  a crowd — a patch scored against a frame it was never drawn on. Capture
  now PAUSES across the pair and resumes after, so the two shots are
  genuinely the same instant. Also: the duration guard now re-reads before
  rejecting, because a pre-roll ad reports ITS duration (72s) for a
  2545s episode and the guard was throwing away good videos.
