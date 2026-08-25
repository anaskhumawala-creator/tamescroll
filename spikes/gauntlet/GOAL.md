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

  CRITIC (Opus, track-lifecycle lens) landed after the round was committed.
  Its ranked findings are R8's input. Two were verified against source
  before being written down here; the rest are recorded as claims to check,
  not as facts:

  * **F3 — VERIFIED by reading the code: one faceres inference per
    multi-face crop is dead work.** init-entry.js:940 runs
    `classifyFaceGenders` over ALL faces in a person crop, then :941
    overwrites the only element anybody reads with the native re-crop
    result. Downstream, `own === -1` returns at :1013 without touching
    `meta` at all, and `own !== -1` reads `meta[own]` where `bigIdx` was
    already forced to `own` at :936 — so `nat[0]` is the answer in both
    branches and the multi-face pass is 100% discarded. It fires exactly
    when a crop holds >1 face, i.e. the crowd and two-shot frames where
    cost hurts most (up to 3 of a pass's ~8-11 inferences).
    NOT applied this round, deliberately: deleting it changes the array
    LENGTH, and `meta[own]` with `own > 0` on a short array yields
    undefined, which falls back to flagged:true — a silent FALSE COVER
    regression. The correct shape is to keep the array length and fill
    non-primary slots with `{gender:'unknown', score:0}` (which is what an
    unread neighbour honestly is, and what faceMeta already turns into
    flagged/uncertain). That needs frames, so it is R8's first item.
  * **F1 — demoteTracks on every scene cut is what zeroes the earned
    clear.** Field signature at f001->f002 (blurred/0/0/0/'uncertain' with
    the id kept) matches demoteTracks and nothing else; the critic
    eliminated flagStreak revocation, CLEARED_TTL, coastStep and identity
    break by their predicted field values. Its argument that this is
    terminal on a phone: shots here average ~2s, and re-earning a clear
    costs >=2 verdict passes at effZoom = max(400, lastVerdict*1.5), which
    on a G88 is 1.8-2.9s. Proposed fix is to demote on EVIDENCE (mark
    pendingCut, then keep state for a track re-matched at iou>=0.5 and
    size-compatible) rather than on the cut event.
  * **F2 — nothing kills a track that sizeCompatible refused**, so the
    refused track coasts up to 2s at the previous shot's geometry, and
    mergeTracks unions overlapping stale boxes transitively with no area
    test — which is how f007 got a (0,0,1,1) full-frame patch from five
    stale tracks while persons was 0. Two proposed guards: drop a track
    refused ONLY on size (positive evidence it is stale), and refuse a
    merge whose union is mostly empty (MERGE_MAX_FILL ~1.35).
  * **F4 — R6's CLEAR_DECAY is arithmetically a no-op on the blurred
    track.** A blurred track's clearStreak only ever holds 0 or 1 (it
    clears the instant it reaches CLEAR_STREAK_N 2), so decaying 1->0 is
    identical to zeroing. R6's log claims 8.75 -> ~4 expected reads; the
    correct figure is 8.75 -> 8.75. Decay does still help the OTHER clear
    path (clearMs >= CLEAR_HOLD_MS). Suggested replacement is a windowed
    vote (2 certain clears within the last 4 reads) instead of a
    consecutive run.
  * **F5 — sizeCompatible is NOT what broke R7's close-up.** The critic
    computed the actual ratio from f000_truth geometry: 1.28, nowhere near
    3, and faceInsideAny + dedupeObservations each independently stop the
    body/synthetic pair reaching association in a close-up. So the 3->6
    change shipped above fixed a real churn source but the critic's read of
    WHERE it fires differs from the round's; both agree the gate stays and
    the consequence of refusal is the bug. Worth resolving in R8 with the
    per-refusal reason already being logged.
  * **F8/F9 — clearMs is zeroed on coast for blurred tracks while
    clearStreak is preserved (inconsistent), and nothing de-duplicates
    TRACKS anywhere** (dedupeObservations works on observations,
    mergeTracks on the render list). Two tracks on one human alternate
    claims and the blurred one always wins the render. f001 shows exactly
    that: id 14 (cs 0, cm 0) beside id 15 (cs 3, cm 839, cleared).
  * **F7 — identity memory may be revoking clears and the harness cannot
    see it.** memoryLookup returns 'blurred' at MEM_SIM_FLAG 0.85, and the
    module's own calibration note records 17% of DIFFERENT-person pairs
    scoring >=0.9. A crowd fills identityMemory (MEM_MAX 8) with female
    exemplars seconds before the edit cuts back to the man. Unverified —
    `__TS_GAZE_IDS.sims` and `.mem` are already logged in the bundle and
    simply not captured. **Add `sims` and `mem` to the PROBE in
    gauntlet.py before R8**; that is the cheapest high-value harness change
    available.
  * Critic's own flag, and it gates the id-churn conclusions: `__TS_GAZE_IDS`
    is a WINDOW global while videoTracks is per-element, so two live
    samplers would interleave the snapshots and part of the measured churn
    could be a MEASUREMENT artifact — the same class of bug as R2's gender
    mismatch and R5's seek clamp. `video.__tsGazeAttached` should prevent
    it, but it was not verified. Capture a sampler count in the probe and
    hard-fail if it is not 1, BEFORE acting on F1/F2/F9.
  * Critic agrees with R5's critic that multi-scale crowd recall must NOT
    ship yet: duty cycle is already ~31% on this desktop and 67% at a
    5-8x G88 multiplier, and finding 10 people with ZOOM_MAX_PERSONS 3
    gives each a read every ~5 passes while all of them start blurred —
    converting EXPOSURE into mass FALSE COVER. Measure F3's saving on real
    hardware first.

- **R8** — rotation entry 6 (`conference keynote audience`, **woman** — the
  direction the last three rounds never exercised). TWO videos, because the
  first was too easy and the skill says move on rather than declare victory.

  **Run A, y08TrAsHZzI** (single man, talking head, static camera, later a
  slide with a stock-photo man inset). 10 frames, **ZERO failures in all
  five classes**, both layouts. Logged as a clean baseline, not as a win.

  **Run B, pxBQLFLei70 t=601-615** (a naval officer in a white peaked cap at
  a lit podium, seated audience behind him in low light). This is where the
  round happened.

  | class | before (r8b) | after (r8c) |
  |---|---|---|
  | EXPOSURE | **10/10** | **3/10** (cap tip only) |
  | of which TOTAL exposure (no patch at all) | 1 (f009) | **0** |
  | head/face covered | 0/10 | **10/10** |
  | PARTIAL | 9 | 5 |
  | FALSE COVER / GHOST / DRIFT | 0 / 0 / 0 | 0 / 0 / 0 |
  | verdict p50 / p95 / max | 91 / 355 / **4360** | 74 / 320 / **2109** |
  | newTrack per 10 frames | 29 | 27 |

  Run A cost also improved with no accuracy change: p50 66 -> 55, p95 590 ->
  106, **max 5973 -> 2619**.

  HARNESS FIRST (R7's critic asked for all three and they paid off
  immediately): the PROBE now captures `sims`, `mem`, `life` and
  `samplers`. **samplers = 1 in every frame of every run**, which settles
  R7's critic's own gating worry that `__TS_GAZE_IDS` being a window global
  while `videoTracks` is per-element could make the measured id churn an
  artifact of the measurement. It is not; the churn is real.

  **The dominant finding: MoveNet reported `persons: 0` on EVERY frame of
  run B** — for a large, well-lit, centred human filling a third of the
  frame. The primary detector was blind for the entire run and every patch
  came from the `personFromFace` fallback. That fallback's geometry had
  never been measured against a real subject, and it was wrong in two ways
  at once:
  * `y1 = cy - h*1.0` on the DE-INFLATED face box, whose top is at
    `cy - h/2` — half a face-height of headroom. Hair, hats and any upward
    tilt fall outside. The patch top sat at y 0.21-0.26 on nine consecutive
    frames while his head began at y~0.05. Now `cy - h*1.4`.
  * half-width 1.8 (3.6 face-widths) cut his shoulder board and sleeve off,
    sharp out to x~0.79 against a patch ending at 0.686. Measured
    requirement was 2.5 half-widths; took **2.2** as the crowd-safety
    compromise, since every extra half-width is a neighbour swallowed and
    mergeTracks unions genuine overlaps anyway.

  **The second finding, and it took two attempts:** r8b f009 was a fully
  covered man going COMPLETELY SHARP because he tilted his head down for
  one pass. `wipeIfEmpty`'s `big` shortcut (R5b's fix) erases every track on
  a SINGLE empty pass whenever the last subject filled the frame — and it
  never asked whether the shot had actually changed.
  * Attempt 1: require a recent scene cut for the `big` shortcut, else fall
    back to WIPE_EMPTY_STREAK 2. **This only MOVED the failure** — r8b2
    f009 got its patch back and f005 lost its own, because the same man
    looked down for two consecutive passes instead of one.
  * Attempt 2, shipped: **with no cut the eraser stands down entirely**, and
    coastStep's TIME window (blurredCoastMs 900-2000ms, already scaled to
    the verdict cadence) ends stale tracks instead. No pass count can be
    right here, because what is being counted is the detector's blindness,
    not the subject's absence. Cost accepted deliberately: a genuine ghost
    over an empty desk now survives up to its coast window instead of
    ~800ms. The owner ranks EXPOSURE above GHOST, and BOTH measured
    misfires of this eraser (R5's stage of ~40 people, r8b's officer) were
    it erasing people who were still there.

  **R7 critic's F3 applied** (verified dead work before shipping): the
  multi-face `classifyFaceGenders` at init-entry.js:940 was computed and
  discarded — `nat[0]` is the answer in both consumer branches. It is NOT a
  plain deletion: the caller indexes the result by `own`, and a SHORT array
  yields undefined there, which falls back to flagged:true and would have
  been a silent FALSE COVER of the person just read. The array keeps its
  length; unread faces are filled with `{gender:'unknown', score:0}`, which
  is what they honestly are.

  STILL OPEN, in priority order:
  * **MoveNet's total blindness on run B is the real bug and it is
    unexplained.** Everything above is the fallback path compensating for
    it. The subject is truncated at the podium — head, shoulders, upper
    chest, no hips, no legs — so either `parsePersons`' evidence gate is
    rejecting him or the model genuinely cannot see him. `lastSlotDiag`
    already holds the raw pre-gate slots at zero cost and is still not
    captured; capture it in R9 and the two hypotheses separate in one run.
  * residual PARTIAL 5/10 and cap-tip EXPOSURE 3/10 in run B — a fixed
    multiple of a face box assumes a fixed head-to-body ratio on a frontal
    upright untruncated subject, and all three assumptions are false here.
  * the cost tail is better but still 30-45x the median (max 2109-2619 vs
    p50 55-74). On a single-person static talking head. Unexplained.
  * identity memory: `sims` ran 0.70-0.94, mostly at or above MEM_SIM_FLAG
    0.85, with `mem` pinned at the MEM_MAX cap of 8, for a whole run whose
    subject is ONE man. Captured but NOT interpreted — the run direction is
    `woman`, so the man is the flagged party and memory was working in its
    intended direction, which means this run cannot answer whether memory
    wrongly REVOKES clears. Needs a `man` run on the same footage.
  * crowd EXPOSURE (R7's top item) untouched this round.

  CRITIC (Opus, geometry + cost-tail lens) landed after the round closed.
  R9's input. Two findings verified against source before writing them here;
  the rest are ranked claims to check.

  * **VERIFIED — personFromFace's `h` is not a face height, and my R8
    headroom fix is therefore in the wrong unit.** detector.js:318-323
    computes ONE scalar `half` and divides it by INPUT_SIZE for BOTH axes,
    so a face box is square in NORMALIZED units — x2-x1 and y2-y1 are
    numerically equal, always. In real pixels that makes w*W = Wf (an
    honest face width) but h*H = Wf/ar. On 16:9 `h` is 0.56 face-widths, so
    my cy - h*1.4 buys only ~0.6 face-heights above centre — which is
    exactly why the cap tip is STILL exposed on 3/10 frames after the fix.
    I hand-tuned a constant that is 1.78x short by construction.
    person-gate.mjs's own header (:12-14) documents this precise trap, and
    the MoveNet path already corrects for it at :199-200 (headH =
    headW * ar); personFromFace is simply never passed `ar`
    (init-entry.js:1185).
    **And it inverts on portrait video**: at ar 0.5625 the same code yields
    3.2x MORE headroom than on 16:9, so every patch reaches far above and
    below its subject — GHOST. Pre-existing (1.0 had the same bug) but my
    change amplified it 40%. NOT hot-fixed: no portrait capture exists to
    verify against, and shipping a geometry change without frames is the
    thing this loop exists to prevent.
    Fix for R9: personFromFace(face, ar) with every multiplier in
    face-widths — fw = (x2-x1)/1.4, vy = fw*ar, y1 = cy - vy*1.3,
    y2 = cy + vy*7.0, x = cx +- fw*1.9. Aspect-invariant, one
    anthropometric unit, ~4 lines.
  * The critic also argues my width 1.8 -> 2.2 was paying width for a
    vertical problem: at 4.4 face-widths total, two neighbours 3
    face-widths apart overlap enough to cover each other's heads but NOT
    enough for mergeTracks (containment 0.32 / IoU 0.19 vs MERGE_CONTAIN_MIN
    0.6 / MERGE_IOU_MIN 0.5) — FALSE COVER in the crowd case this function
    exists to serve. Recommends 1.9 once the vertical unit is fixed. Not
    observed in R8 (run B had one subject); check on crowd footage in R9
    before reverting.
  * **VERIFIED — the cost tail converts directly into EXPOSURE on slow
    hardware, and it is a two-constant interaction, not a model problem.**
    effZoom = max(ZOOM_INTERVAL_MS, lastVerdictMs*1.5) (init-entry.js:1112)
    is UNCAPPED above, while blurredCoastMs = min(2000, max(900,
    2.5*effZoom)) (person-track.mjs:570-576) is CAPPED at
    PTRACK_MAX_COAST_MS 2000. One 5973ms verdict therefore puts the next
    verdict 8960ms away while every blurred track's coast window is pinned
    at 2000ms — and `sampling` (init-entry.js:1100) blocks position passes
    for the whole verdict, so nothing refreshes them either. A covered
    opposite-gender person goes sharp ~7s after a single slow pass. On a
    G88, where p95 is plausibly 2-3s, effZoom p95 3-4.5s exceeds the 2000ms
    coast ROUTINELY and never once on this desktop. Sharpest answer yet to
    why the tail matters more than the median. Free fix: cap effZoom, or
    raise PTRACK_MAX_COAST_MS in step with it.
  * **Check cost.verdict[0] FIRST, before any tail work.** The array is
    push-ordered and capped at 120; both runs had n<120, so nothing was
    shifted and index 0 IS the first verdict pass. If max === verdict[0] the
    tail is model warm-up (faceres + BlazeFace + MoveNet shader compile),
    amortised, and should be reported as p99-excluding-index-0. Costs
    nothing and reorders everything below it.
  * **Critic's top item: MoveNet's input is squashed.** detector.js:191-195
    resizes a 16:9 frame into a hard 256x256 square — a 1.78x anisotropic
    compression of every person. MoveNet MultiPose's documented contract is
    aspect-PRESERVING resize padded to multiples of 32. A person-centre
    heatmap is a whole-body-geometry prior, so this is off-distribution, and
    it bites hardest on subjects already geometrically atypical — such as a
    podium-truncated head/shoulders/chest. Internal inconsistency worth
    noting: parsePersons is handed the true `aspect` (init-entry.js:1124)
    and corrects head geometry with it, so the code knows the frame is 16:9
    while the MODEL was shown a square.
    Fix needs no coordinate un-letterboxing (normalized coords map 1:1 under
    a plain non-uniform resize, parsePersons untouched):
    resizeBilinear(..., [160, 256]) on 16:9. Distortion 78% -> 11% AND the
    tensor drops 65536 -> 40960 px, -37% on the person pass.
    Its bet is model-blindness rather than gate-rejection, because BlazeFace
    found his face on all 10 frames from the SAME squashed source (a face
    survives anisotropy far better than a body pose), and because R5
    established MoveNet emits 0.14-0.35 slots for real distant people rather
    than nothing.
  * lastSlotDiag is ALREADY pushed to __TS_GAZE_IDS.slots[].raw
    (init-entry.js:1132-1142) — the bundle needs no change at all, only
    gauntlet.py extracting `slots` the way it now extracts sims/mem.
    Decision table for run B's zero-person frames: all six slots ~0/0-4 =>
    model blind (fix the squash); a slot at 0.12-0.35 with >=7 confident
    keypoints => the gate threw him out; a slot >=0.35 is impossible.
  * If it IS the gate, the critic found a defect in my own R5 coherence
    guard: person-gate.mjs:227 tests the box AFTER the 17-keypoint union
    with KEYPOINT_MARGIN (:162-169) and after the head anchor (:201-204), so
    it asks "do the keypoints plus OUR OWN inflation disagree with the model
    box" rather than "is this box sprawling". On a tightly-boxed truncated
    subject the head anchor alone approaches 2x the model box, so a real
    person can trip a 3x cap on our own inflation. Fix: test the raw
    keypoint union, then inflate. Zero cost.
  * **This run structurally CANNOT answer R7's F7** — direction was `woman`,
    so the man is the flagged party, memoryStore only stores flag-certain
    (init-entry.js:592) and memoryLookup only ever returns 'blurred' (:576).
    Memory was working in its intended direction. Needs a `man`-direction
    run with >=2 people. Recorded as unanswered, not as evidence either way.
  * What the sims DO prove is worse: mem pinned at MEM_MAX 8 on a shot
    containing ONE man means at least 8 stores fell BELOW MEM_SIM_UPDATE
    0.85 and pushed fresh entries — identity memory held eight copies of the
    same person. Intra-person sims measured this round 0.70-0.94; the
    cross-person band already recorded at person-track.mjs:55-58 is 32% of
    DIFFERENT-person pairs >=0.6 and 17% >=0.9. Those bands overlap across
    essentially their whole range, so MEM_SIM_FLAG 0.85 is not defensible as
    an identity threshold in EITHER direction: it false-splits (observed)
    and false-merges (calibrated). Same conclusion the module already
    reached for the clear direction, now extended to the flag direction.
  * The bug that follows: person-track.mjs:486-490 applies
    obs.remembered === 'blurred' UNCONDITIONALLY and AFTER the clear logic
    at :452-459, so a track that just earned two certain same-gender reads
    is forced back to blurred with its streak zeroed on every later pass. In
    `man` mode one memorised woman permanently covers any man matching her
    at >=0.85 — a 17%-likely event by our own calibration, and unrecoverable
    rather than transient. newTrack at :662 already respects this
    interaction; matchedStep does not. Two-line fix, zero ms: gate the
    override on the current read. Per-shot scoping is the WRONG fix (memory
    exists to survive cuts); the wrong bound is the eviction rule, since
    MEM_MAX shifts the OLDEST entry and one person's 8 near-duplicates flush
    every other identity out.
  * Free cost wins the critic rates above accuracy work: ONE
    tf.browser.fromPixels per verdict pass instead of two full-resolution
    uploads (init-entry.js:1124 and :1181 each upload the raw video, ~8.3MB
    each at 1080p, half pure waste and dominant on a G88's shared LPDDR4);
    and quantizing the crop dw/dh (init-entry.js:776-778) to multiples of
    32, because the crop is derived from a moving person box so almost every
    pass asks tfjs for a texture shape it has never seen, and the pool keys
    on shape. One-line probe to confirm the latter: dbgC.gpu =
    (dbgC.gpu||[]).concat([tf.memory().numBytesInGPU]).slice(-40) in the
    .finally at :1409 — monotonic growth confirms it.
  * MERGE_MAX_FILL (R7 critic F2) is still unbuilt, and standing the eraser
    down this round left its mirror armed: on a CROSSFADE the 16x16 luma
    gate does not fire, so neither demoteTracks nor the eraser runs and
    stale tracks ride the coast window into the new shot, where mergeTracks
    (person-track.mjs:740-770) unions overlaps TRANSITIVELY with no area or
    fill test — the r7 f007 (0,0,1,1) full-frame mechanism exactly.
  * Judged my third change (classifyBest length-preserving fill) CLEAN,
    having checked the one place it could break: when own === -1, pick =
    genders[bestIndex(faces)], and bigIdx's loop (:926-934) is behaviourally
    identical to bestIndex (:912-923), so pick is always a real read and
    faceDesc never goes null.
  * BlazeFace already decodes 6 face landmarks and throws them away
    (detector.js:284, "12 landmark values we ignore"). Free, already
    downloaded: inter-ocular distance is a far more stable scale than the
    box, tragion span gives head width directly, and mouth->eye-midpoint
    gives an UP-VECTOR — precisely what r8b f009's head-tilted-down total
    failure needed and what a fixed vertical multiple cannot provide. Prior
    art named as MediaPipe's detection_to_roi (Apache-2.0, licence clean);
    the critic did NOT verify its constants, so read the .pbtxt before
    copying numbers.
  * Critic's own flags: could not verify which Q2 hypothesis is true (only
    the slots probe decides), never ran a portrait video, has no stage
    timings so the tail composition is ranked candidates rather than
    measurement, did not measure the texture-pool consequence, and warns
    that back-solving captured patch rects into personFromFace constants is
    INVALID — those rects are post-EMA, post-PTRACK_PAD and
    post-mergeTracks. Two of its own early attempts to do that produced
    contradictions.

- **R9** — rotation entry 7 (`sports post match interview`, **man**),
  video 1L_R0MB2W5A t=61-75: a Premier League post-match interview, TWO MEN
  in a handheld two-shot. In `man` direction both must be completely sharp,
  so every patch in this run is a failure by definition.

  | class | before (r9) | after (r9b / r9c) |
  |---|---|---|
  | FALSE COVER frames | **3/10** (f000, f006, f009) | **2/10 / 1/10** |
  | EXPOSURE / PARTIAL / GHOST / DRIFT | 0 | 0 |
  | verdict first / p50 / p95 / max | 2220 / 120 / 325 / **2220** | 2911 / 120 / 196 / **2911** |
  | newTrack per 10 frames | 7 | 6 / 8 |

  **THE FINDING OF THE ROUND, and it retires four rounds of chasing the
  wrong thing: `cost.verdict.first === cost.verdict.max`, in every run.**
  R9 2220 = 2220. r9b 2740 = 2740. r9c 2911 = 2911. R8 run A 5973 = 5973,
  run B 4360 = 4360. The FIRST verdict pass of a video is the WORST pass of
  that video, every time. The cost arrays are push-ordered and capped at
  120 and every run had n < 120, so index 0 really is pass one. The
  standing "verdict-pass cost tail" target — p95 974, max 3818 — is
  therefore in large part **one-off model warm-up** (faceres + BlazeFace +
  MoveNet shader compile), not a recurring stall. p50 is 120 and p95 is
  196-411 once the models are hot. The honest number to optimise is the
  warm-up, and the honest fix is to pay it where nothing is on screen. The
  harness now captures `cost.*.first` so no future round can confuse the
  two again.

  **FALSE COVER root cause: we were re-asking a question already answered.**
  Every single gender read in the run was `male` at 0.71-0.99, ages 23-37 —
  not one misread, not one weak direction. And three of ten frames still
  carried a patch, because a fresh track starts blurred and CLEAR_STREAK_N
  demands a SECOND consecutive read. f000 id3 and f009 id7 both sat covered
  at `clearStreak 1, lastVerdict 'clear-certain'`: a man read as male at
  0.97 was blurred because we had only asked once. A handheld two-shot
  mints fresh tracks constantly (7 newTrack per 10 frames with two humans
  present), so this recurs all run rather than being a first-frame
  curiosity. This is the owner's oldest complaint, measured.
  FIXED: GENDER_INSTANT_CLEAR — one read at >=0.9 clears without waiting.
  The streak exists because a read at the 0.6 bar is weak evidence; a read
  at 0.9 is not, and R6 measured male reads at 0.87-0.97 with the model
  never once reversing direction. Verified firing: r9b f001 id4 cleared at
  `cs 1`, which was impossible before.
  SYMMETRY, stated plainly rather than papered over: the female bar
  (GENDER_INSTANT_CLEAR_FEMALE 0.7) is set ABOVE every female read ever
  observed (R6: 0.22-0.67, n=5), so it effectively never fires in woman
  mode. Deliberate — five samples is not a distribution, and guessing it
  low enough to be useful would risk instantly clearing a MISREAD MAN,
  which is EXPOSURE in the direction we have least data for. Woman mode
  keeps the two-read streak. **R10 must run woman-direction on
  female-heavy footage and measure the real female certainty band.**

  **Second fix, from R8's critic, verified by arithmetic before shipping:**
  the coast cap was a flat PTRACK_MAX_COAST_MS 2000, which goes SHORTER
  THAN ONE VERDICT INTERVAL once effZoom passes 2000. A 5973ms verdict puts
  the next verdict 8960ms away with coast pinned at 2000ms, and `sampling`
  blocks position passes for the whole verdict — so a covered
  opposite-gender person is sharp for ~7 seconds. EXPOSURE produced purely
  by two constants disagreeing, routine on a G88 (p95 2-3s), impossible to
  observe on this desktop. The cap now floors at PTRACK_MIN_COAST_PASSES
  (2) verdict intervals. Desktop behaviour is untouched (effZoom 400 =>
  floor 800, well under 2000), so the desktop-measured ghost tuning does
  not regress.

  **R8's top open item is SETTLED, and the answer is "both, at the
  boundary".** The new slots probe (raw MoveNet slots BEFORE our gate, as
  score/confidentKeypoints/height) on the same podium video, runs/r9d-woman:
  the best slot scores **0.06-0.30 with 0-7 confident keypoints**, against
  **0.31-0.46 with 4-10 keypoints** on the interview footage. So MoveNet is
  not blind in general — it is weak on THAT footage, and our gate sits
  exactly where that weakness lands. f001 slot0 is `0.26/6/0.82`: score
  0.26 is below PERSON_MIN_SCORE 0.35, and 6 confident keypoints is one
  short of PERSON_STRONG_KEYPOINTS 7, so it misses BOTH tiers by a hair.
  NOT acted on this round: moving either threshold on the evidence of one
  video is exactly the change that produced R5's GHOST regression, and the
  numbers are now in the log for R10 to decide with a crowd frame in hand.
  It also supports R8's critic on the squash — a truncated podium subject
  is the geometrically atypical case an anisotropic 1.78x compression
  should hurt most.

  **Measured incidentally, and it is a better lever than any threshold:**
  gender certainty depends on how many faces share the crop. In r9c f000
  the reads with `n:1` scored 0.97-0.98 while the reads with `n:2-3` scored
  0.78-0.86 — the SAME men. So crowded crops systematically read ~0.15
  lower, which is what puts them under the instant bar. The fix is to make
  crowded crops read like clean ones (tighter per-person cropping), not to
  lower the bar.

  STILL OPEN:
  * **R7 critic's F1 is no longer a hypothesis — r9b f006 is the frame.**
    A hard cut to a wider shot of the SAME two men demoted both earned
    clears to `blurred / cs 0 / 'uncertain'` and painted nearly the whole
    frame. The identical timestamp in r9c is completely clean, so the
    failure is cut-timing dependent, which is why it has survived nine
    rounds of sampling. demote-on-EVIDENCE (keep state for a track
    re-matched at iou>=0.5 and size-compatible) is R10's first item.
  * warm-up: pay the 2200-5900ms first pass during idle on a dummy tensor,
    before the user's first real frame. Nothing else in the log is worth
    this many milliseconds.
  * the cold-start window itself is UNMEASURED and the harness is
    structurally blind to it — it seeks and waits before capturing, so a
    video that autoplays with people in frame while the first verdict is
    still 2-6s away has never once been scored.
  * personFromFace units (R8 critic, verified), MERGE_MAX_FILL, the
    identity-memory override at person-track.mjs:486, crowd EXPOSURE.

  CRITIC (Opus, boot / warm-up / cold-start lens) landed after the round
  closed. It corrects TWO things in the R9 entry above, both verified
  against source before writing here. **Read the corrections before
  trusting the numbers above.**

  * **CORRECTION 1 — R9's instant clear does NOT fix the frames it was
    built from.** `newTrack` (person-track.mjs:669-699) sets
    `state: 'blurred'` UNCONDITIONALLY and never reads `obs.instant`; the
    only consumer is matchedStep:466, i.e. a track on its second-or-later
    pass. The three scored FALSE COVER frames were all newTrack BIRTHS, and
    the field signature proves it rather than suggesting it: newTrack is
    the only producer of `clearMs 0`, because matchedStep's clear branch
    does `clearMs += vdt` before anything else — even the identityBroken
    path zeroes it and then immediately adds vdt. f000 id3 and f009 id7 are
    `cm 0 / cs 1 / 'clear-certain'`; f006 id6 is `cm 0 / cs 0 /
    'uncertain'`. All births.
    Where I DISAGREE with the critic, having checked it: it calls the
    change "a no-op in both directions". It is not. r9b f001 id4 read
    `cleared, cs 1, cm 437` — a MATCHED track (cm > 0), with clearMs 437
    below CLEAR_HOLD_MS 1500 and clearStreak 1 below CLEAR_STREAK_N 2, so
    neither pre-existing path can explain `cleared`. Only `obs.instant`
    does. The fix is real and it halves time-to-clear for a track that
    survives one pass; it simply does not touch the birth frame, which is
    where this round's failures were. The measured 3/10 -> 1-2/10 is
    therefore cut-timing variance plus faster recovery, NOT the birth fix
    I implied. Honouring `instant` in newTrack is R10's decision, and it is
    the risky one — see the screen-face path below.
  * **CORRECTION 2 — every `newTrack` / `sizeReject` rate in R7, R8 and R9
    is wrong, mine included.** `bump` (person-track.mjs:88-93) only ever
    increments; nothing assigns `g.life = {}`, and `seeked`/`loadstart`
    reset videoTracks but not the counter. So `life` is CUMULATIVE FROM
    PAGE LOAD and gauntlet.py reads it raw. "7 newTrack per 10 frames" is
    7 since the page loaded — across the ~20s pre-seek autoplay, the seek
    wipe, and the capture window.
    The critic's reconciliation is exact and it makes the round's story
    tighter, not looser: ids 1-2 pre-seek, 3-4 alive at f000, and 5, 6, 7
    minted during capture — **3 births, 2 people, and exactly 3 FALSE COVER
    frames. One per birth.** Churn is far lower than assumed and maps 1:1
    onto the failures. R7's 30->0 size-rejection before/after still stands
    (both sides measured the same way); the RATES do not. **Reset `life`
    on seek in the harness, or subtract a baseline, before quoting it
    again.**

  Findings ranked as R10 input:

  * **The cold-start EXPOSURE window, and the harness is structurally blind
    to it.** Sequence, verified: bundle evals, `.ts-gaze-pending` blur
    installs, `attachVideo` calls `markPending` — blur-first holds. Then
    autoplay fires `play` -> `start()` -> `ensureFaceModels()`
    (init-entry.js:1503), which BYPASSES the post-load-idle deferral
    entirely, so on a watch page the deferral never does its job. Models
    load in order: backend, face, gender, `genderSettled = true` (:1850),
    THEN person/MoveNet (6.8MB embed), then NSFW.
    **The hole is between `genderSettled = true` and `personModel != null`.**
    The region path requires `useRegionVideo && personModel` (:1114); with
    personModel still null the player falls through to whole-blur
    (:1442-1479), which is full-frame BlazeFace at 256px — the detector
    R5/R7/R8 all measured as blind on wide shots, small subjects and
    back-turned people. Find no face and `cleanStreak` hits `unblurStreak`
    2 (:501) at the 120ms floor, so **the player goes SHARP in ~250-500ms**
    and stays sharp for the whole MoveNet b64-decode + graph-parse +
    weight-upload, then for the 2220-5973ms first verdict pass on top.
    Harness blindness confirmed: gauntlet.py sleeps 20s after navigation,
    polls duration up to ~30s, seeks, then settles 2.0s — by f000 the page
    is >=22s old and the hole has long closed. `cost.verdict.first`
    survives only because `dbgC.cost` is never reset on loadstart or
    seeked. The NUMBER is captured; the FRAMES it describes never are.
    Free structural fix, no measurement needed: gate the fallback unblur at
    :1468 on `personModel || !useRegionVideo`. The user keeps watching a
    blurred player for the extra MoveNet seconds — which they were already
    doing one second earlier, so it costs nothing they were not paying.
  * **The CLEARED coast is a flat 1000ms and was never made cadence-aware
    — the exact mirror of the bug I fixed this round.** coastStep:608 uses
    `blurredCoastMs` for blurred tracks (which `setVerdictCadence` now
    scales) but flat `PTRACK_MAX_MISS_MS` 1000 (:28) for cleared ones, and
    nothing ever touches it. `dt` includes the previous pass's full cost
    (init-entry.js:1084) and `sampling` blocks position passes for the
    whole verdict, so after a 2109ms verdict the next dt is ~2.5s against a
    1000ms limit: **the cleared track is deleted on ONE miss**, re-detected
    next pass, and reborn `blurred`. A cleared same-gender man is re-covered
    after every slow verdict pass, on the phone, forever — and never once on
    this desktop. Two lines, zero ms, desktop-neutral (at effZoom 400 the
    formula returns max(1000, 2.5*400) = 1000, unchanged). Bound the new
    risk by advancing `clearAge` during coast so CLEARED_TTL_MS still
    expires it.
  * **Do NOT make MoveNet admission hysteretic.** The critic checked the
    slots against the gate and the gate is honest: f003 slot1 `0.26/2/1`
    fails PERSON_MIN_SCORE 0.35, fails PERSON_STRONG_KEYPOINTS 7, and fails
    PERSON_MIN_KEYPOINTS 5 as well. Two confident keypoints is not a
    person. `parsePersons` is stateless on purpose and loosening it
    reopens the phantom class R5 closed at real cost. The hysteresis
    already exists in the tracker; it is the cleared coast that is flat.
    Slot ORDERING is not implicated at all — association is IoU-based
    (:311), never index-based, and `byConf` only picks who gets a gender
    read.
  * **Warm-up is absent everywhere.** `grep warm` returns nothing; every
    model goes straight from `loadGraphModel` to its first real inference,
    and in tfjs-webgl the texture upload and every shader compile happen on
    that first `execute`. That is the whole of `first === max`. Shape of
    the fix: run each model once on a blank source of the EXACT shape the
    real path uses — MoveNet [1,256,256,3] int32, faceres batch N=1 (the
    player always passes one box), BlazeFace [1,256,256,3] — and feed a
    blank CANVAS through `tf.browser.fromPixels` rather than `tf.zeros` so
    the fromPixels program compiles too. `WEBGL_USE_SHAPES_UNIFORMS` makes
    the programs shape-portable so it transfers. Put each warm-up in the
    same `.then` as its load; a warm-up throw must be swallowed, never a
    gate. Estimated 2-15s moved off the user's first frame on a G88 —
    an estimate, not a measurement.
  * Warm-up is NOT paid per SPA navigation, per new video element, or on
    fullscreen/resolution change (model handles are IIFE-closure scoped and
    `loadstart` touches none of them). It IS paid in full on every hard
    navigation, which is what the launcher's `open_platform` does — so
    every platform open re-evals ~22MB and reloads and re-warms four
    models. No cross-document caching exists: tfjs shader programs are
    per-GL-context, and `b64ToBuffer` (detector.js:45-51) re-decodes ~17MB
    of base64 through a per-character loop on every document.
  * **No `webglcontextlost` listener anywhere in the bundle.** On Android a
    backgrounded WebView that loses its GL context leaves every model
    handle pointing at dead textures; the pass-level catch just counts
    `passFails` forever, tracks coast, then expire, then everything goes
    sharp. Silent AND fails open. Unverified on device, and it is the only
    failure mode in this area with both properties.
  * **The path that would break an instant clear in `newTrack`, named
    precisely:** a woman turned away (her own face undetected — this is
    common, it is why the `own === -1` branch exists at :1035), a screen or
    poster behind her showing a man, that face falling inside her crop and
    nearer her head anchor than anything else. `own` resolves to the screen
    face, the read comes back male at 0.95, and with instant in newTrack
    **her track clears in ONE pass.** Today it takes two, which is little
    protection against a static screen but total protection against a
    transient one. R6 measured NEWSPRINT faces at 0.02-0.27, which is not
    evidence about a monitor or a backdrop portrait — those present a
    full-quality frontal face and read like any other.
  * Related defect the above rides on: `ownFaceIndex` (init-entry.js:886-910)
    computes a Euclidean distance over x normalised by `rw` and y by `rh`,
    which are different physical scales — and on 16:9 they differ again by
    the frame aspect. `d <= max(0.18, fw)` is therefore not one distance in
    one unit, and a HORIZONTALLY offset neighbour in a wide crop produces a
    small `d`. Same bug class the R8 critic verified in `personFromFace`,
    different function.
  * **The test that decides whether the 0.9 bar means anything, and it
    needs no run:** `score = min(0.99, 2*|v-0.5|)` (detector.js:398) is a
    sigmoid DISTANCE, not a calibrated probability. This codebase was
    burned by exactly this once already — gender-ssrnet saturated ~1.0 on
    every real face. "High score implies reliable" is a property of a
    well-behaved model and we have n=24 frontal samples asserting it.
    bench.html already exposes `genders`: feed a known female face at 8x
    downsample and under Gaussian blur and record the score. If a smeared
    face reaches 0.9, the instant bar is dead and the streak is all that
    stands.
  * Calibration gap to close before tuning the bar again: `reads` is logged
    per-READ, not per-track, so this round CANNOT say whether f000 id3's
    own read was 0.71 or 0.99. One line each: `score: pick.score` on the obs
    (init-entry.js:1041-1050) and `sc` in the track probe (:1357-1368).
  * The R8 critic's memory-ordering bug is still live and still unfixed:
    matchedStep applies `obs.remembered === 'blurred'` at :496-500 AFTER
    the clear logic at :464-469, unconditionally — so an instant clear at
    :468 is silently overridable by a 17%-likely descriptor false-match.
    Safe direction today, but it means instant is not final.
  * Judged change #2 (cadence-aware coast cap) correct and minimal, and
    change #3 (cost.*.first) as the thing that reframed the round.
    Endorsed keeping GENDER_INSTANT_CLEAR_FEMALE unreachable rather than
    guessed — "an unreachable bar is honest, a guessed one is exposure" —
    and said to label it as unreachable rather than as symmetry.
  * Critic's own flags: no run, no build, no device. It could not measure
    the `genderSettled -> personModel` window on any hardware (so the
    cold-start exposure is a mechanism, not a measurement), could not say
    whether f000 id3's read was >=0.9, did not test faceres under motion
    blur, could not confirm WebGL context loss on the phone, did not read
    video-region.mjs or region-blur.mjs beyond call sites, and labels every
    millisecond figure in its ranking as an estimate.

- **R10** — rotation entry 8 (`classroom lecture`, **woman**), video
  DD54J5kecpg t=900-915: a Harvard lecture hall — a woman lecturer at the
  blackboard, a foreground row of students seen from BEHIND, and (at t=900)
  a medium close-up of a woman speaking. In `woman` direction women must be
  completely sharp.

  | class | r10-woman | regression check (r10b-man, R9's footage) |
  |---|---|---|
  | FALSE COVER frames | **10/10** | 2/10 (unchanged from R9) |
  | EXPOSURE / PARTIAL / GHOST / DRIFT | 0 | 0 |
  | verdict first / p50 / p95 / max | 4508 / 157 / 312 / **4508** | 2794 / 120 / 225 / **2794** |
  | newTrack in-window (now baselined) | 15 | 3 |

  **The worst score any round has recorded, and it is the woman direction.**
  Every track blurred, every frame. This is the calibration item R9 flagged
  and deferred, now measured on an unambiguous face.

  **The decisive frame is f000.** A medium close-up of a woman — frontal,
  well lit, face ~20% of frame height, nothing hard about it — is FULLY
  COVERED. Her read was `female 0.31`. `GENDER_CLEAR_SCORE_FEMALE` is 0.45,
  set in R6 from **five samples**. She fails the bar, so she is uncertain,
  so she is covered. Every woman-mode user would see this on every video,
  and it is precisely the person the setting exists to leave alone.

  **All 40 reads, and the pattern is not subtle: 38 of 40 read `male`**,
  scores 0.07-0.74 median 0.29, ages 27-42, nearly all from single-face
  (`n:1`) crops. 28 of the 38 clear GENDER_MIN_SCORE 0.25, so they are
  CERTAIN flags. Compare the same code on bigger faces: R9's interview read
  male 0.71-0.99, R6's news panel read male 0.87-0.97 median 0.94. **The
  same model on the same path gives 0.97 on a big face and 0.25 on a small
  one, and the direction collapses to `male`.**
  That asymmetry cuts opposite ways by direction, which is why nine
  man-direction rounds never saw it: a no-signal `male` default CLEARS
  people in man mode (invisible, and an exposure risk) and COVERS them in
  woman mode (total false cover). NOT acted on this round — whether `male`
  is a reading or a default is exactly what R10's critic was sent to
  determine, and moving a safety-critical threshold on one video is what
  produced R5's ghost regression.

  **The cold-start EXPOSURE window R9's critic predicted DID NOT REPRODUCE.**
  New `coldstart` harness mode polls from the moment of navigation, and the
  hole is defined exactly: player carrying neither gaze class, no patches,
  `__TS_GAZE_PERSONS` still undefined (the region path has never run), video
  playing, not an ad. Two videos, 28s each: **hole_ticks 0 on both.**
  `pending` held from navigation until MoveNet produced its first pass —
  14.4s on one, 18.9s on the other — and only then did the player unblur.
  The predicted chain needed full-frame BlazeFace to find no face for two
  consecutive passes; in practice the ~22MB bundle eval also blocks video
  DECODE, so `currentTime` sat at 0 for 13-15s and there were no frames to
  expose. Honest mechanism, and it means blur-first held. Recorded as
  REFUTED ON DESKTOP, not as refuted — a G88 changes the ratio between
  "models loading" and "video decoding" and only a device settles it.

  SHIPPED:
  * **The CLEARED coast was still flat** while R9 made the blurred one
    cadence-aware — the exact mirror bug, and R9's critic found it. `dt`
    carries the previous pass's full cost and `sampling` blocks position
    passes for the whole verdict, so against a flat 1000ms limit a 2109ms
    verdict deletes a cleared track on ONE miss; it is then re-detected and
    reborn `blurred`. A cleared same-gender man re-covered after every slow
    pass, on the phone, never on this desktop. `clearedCoastMs` now takes
    the same `min(cap, max(1000, 2.5*effZoom))`, and `coastStep` advances
    `clearAge` during coast so `CLEARED_TTL_MS` still expires a clear
    nobody re-confirmed. Desktop unchanged by construction (effZoom 400 =>
    max(1000, 1000) = 1000). Regression-checked on R9's footage: 8/10 clean,
    tracks persisting to cs 17, no change to the residual 2 birth frames.
  * **HARNESS — a partial stall was scoring as evidence.** The existing
    guard only asked whether the player moved AT ALL (max-min spread
    >= 0.5s). The first r10-woman attempt sat frozen at t=900 for eight
    frames then advanced to 905 on the last two: spread 5.26s, guard
    satisfied, run "valid" — and those eight frozen frames were a BLACK
    SCREEN WITH A PLAY BUTTON. Eight tenths of the round would have been
    fiction. A run with >30% repeated timestamps is now INVALID.
  * **HARNESS — `life` is baselined at the seek.** It is cumulative from
    page load and nothing resets it, so R7/R8/R9 all quoted page totals as
    per-window rates. `life_window` now reports the delta: 3 births in
    R9's footage (matching the R9 critic's reconciliation exactly) and 15
    in the lecture hall.

  STILL OPEN:
  * **the female clear bar (0.45, n=5) is the top item** — a frontal woman
    reads 0.31. Needs the critic's verdict on whether low-score `male` is a
    direction or a default before the bar moves either way.
  * `cost.verdict.first === max` for the FOURTH consecutive round (4508,
    2794, and R9's three). Warm-up still unbuilt and still the single
    biggest millisecond item in the log.
  * demote-on-cut (proven by r9b f006), personFromFace units, MERGE_MAX_FILL,
    the memory override at person-track.mjs:496, crowd recall.

  CRITIC (Opus, crop/resampling-chain lens) landed after the round closed.
  It found a REGRESSION R10 SHIPPED, which is fixed and re-verified below;
  the rest is R11 input. Two things verified against source first.

  * **VERIFIED, and fixed same session — R10's cleared-coast change opened
    an EXPOSURE window.** The entry above claims `clearAge` bounded the
    longer window via `CLEARED_TTL_MS`. It did not: `coastStep` ADVANCED
    clearAge and the TTL was tested only in `matchedStep`, which a coasting
    track by definition never reaches. At effZoom 3000 the window is 6000ms
    against a 5000ms TTL — the coast outlived the bound meant to contain
    it. The cost is not a ghost (a cleared track paints nothing) but
    INHERITANCE: a newcomer entering that screen region associates at
    PTRACK_IOU_MIN 0.2 against the coasted box and starts `cleared` —
    sharp, from frame one, on zero reads. And the identity check cannot
    stop it, because `sameSim` needs `obs.desc` and a back-turned newcomer
    has `desc: null`, so `identityBroken` never runs on exactly the
    observations most likely to be a different person.
    FIXED: `coastStep` now demotes cleared -> blurred once the advanced
    clearAge reaches CLEARED_TTL_MS (demote, not delete — still probably a
    person, just no longer one we have evidence about). And per the
    critic's amendment, a track unobserved for more than PTRACK_MAX_MISS_MS
    loses the earned-clear protection: the `flagStreak >= 2` guard exists
    to absorb one noisy read on THE SAME PERSON, and a coasting track has
    no claim to be the same person. Without it an inherited clear also
    inherited two-reads-to-revoke, roughly doubling the window. `missMs` is
    0 on every matched pass, so both are inert on desktop. Two regression
    tests added.
  * **VERIFIED — the low-score `male` reads are the model's NULL OUTPUT,
    not a direction.** Invert the score formula (detector.js:397,
    `score = min(0.99, 2*|v-0.5|)`) on R10's last 24 reads: raw sigmoid
    **v in [0.595, 0.670], mean 0.635, sd 0.022**. Twenty-four reads, four
    or more different subjects, six frames, inside a +-0.04 band. That is
    not a distribution, it is a constant. The AGE head corroborates
    independently and more strongly: mean 36.2 overall, and over the last
    20 reads **mean 36.9 sd 1.4** — on a hall of undergraduates. `age` is
    the expectation over a [N,100] softmax, so with no signal it returns
    the training-set mean age, ~35-38 for the IMDB-WIKI/VGGFace2 family.
    Two independent heads simultaneously returning their training priors
    is a zero-information signature. Compare R9 on real faces: ages 23-37,
    spread; scores 0.71-0.99.
    v ~ 0.635 gives score ~0.27, and **GENDER_MIN_SCORE is 0.25 — the flag
    bar sits BELOW the centre of the null distribution.**
  * **The asymmetry is not the one the R10 entry above guessed.** Traced
    through faceMeta: in `man` mode the null label `male` is SAME gender,
    so `certain` needs GENDER_CLEAR_SCORE 0.6 and the null is inert — it
    clears nobody, and there is **no exposure path from the default in man
    mode**. In `woman` mode `male` is OPPOSITE, `certain` needs only
    GENDER_MIN_SCORE 0.25, so the null is a CERTAIN flag: hard blur,
    clearMs 0, and two consecutive nulls revoke an earned clear. Since the
    null is a CONSTANT, "two consecutive" is guaranteed the moment a
    subject drops below resolution.
    So the real defect is that a read in [0.25, 0.45) is **certain enough
    to condemn, not certain enough to acquit**, and in woman mode that
    makes it terminal: the evidence that would clear her is the same
    evidence flagging her.
    It also unifies the whole log — because the null label is `male` and
    the male clear bar is 0.6, the no-signal path has never once produced
    EXPOSURE in either direction. Every measured EXPOSURE in ten rounds
    came from detector MISSES, never from a wrong read.
  * **Do NOT lower GENDER_CLEAR_SCORE_FEMALE on R10's data.** R9 asked R10
    to measure the female band; what R10 actually measured is n=2 at 0.02
    and 0.31, and both are null-band artifacts rather than female reads.
    Lowering the bar to reach them would let the null's occasional
    `female` side instantly clear a MAN. Honest reading: no female band
    was measured, the footage was below resolution.
  * **The chain, computed — five resamples, three anisotropic.** (1)
    `cropPersonPixels` aspect-preserving to 224 (init-entry.js:771-791),
    `createImageBitmap` with no `resizeQuality` so the spec default "low"
    aliases on a downsample; (2) `detectFaceBoxes` `resizeBilinear` to a
    hard 256x256 square (detector.js:273) — the R8 MoveNet squash bug in a
    SECOND function; (3) the face box squarified in MODEL space
    (detector.js:318-323); (4) `genderFromNativeFace` re-crops, still
    non-square (init-entry.js:860-864); (5) `cropAndResize` to 224x224
    stretching it square again (detector.js:355).
    NATIVE RESOLUTION NOW MEASURED (new probe): **1280x720** — the number
    the critic had to assume. On that, R10's lecturer: person box 170x399
    native -> crop 95x224, her 33-native-px face becomes 18.5px, then gets
    stretched **2.36:1** and lands as ~135px wide x 68px tall in a 224
    frame, reconstructed by bilinear from ~33 real pixels. R9's interview
    on the same arithmetic: anisotropy 1.24, face ~180 native px — **5.5x
    more real pixels and half the distortion.** That is the whole of 0.97
    vs 0.25, and half of it is chain, not model. Literature floor for this
    model class is ~64-100px face width.
  * R11's ranked work, all zero or negative ms: skip the faceres inference
    entirely when `own === -1` (init-entry.js:935 pays a full call that
    :1035 then discards — 29 of 38 track-frames in R10 hit that path);
    kill the gender-crop anisotropy by taking `min(w_px,h_px)` as the
    square side in `faceRegionInVideo` (:846-859) — provably the honest
    1.4x-enlarged face size, ~4 lines, third instance of the
    normalized-vs-pixel unit bug; abstain below a FACE_MIN_NATIVE_PX of 64
    by returning `gender:'unknown'` (faceMeta already turns that into the
    honest `{flagged:true, certain:false}`, so it is exposure-safe by
    construction); split ZOOM_CROP_SIZE so the DETECTION crop is 256 to
    match the detector input instead of 224-then-upsampled; and
    `resizeQuality:'high'`.
  * Note on the R10 fix above: `clearedCoastMs` and `blurredCoastMs` are
    now IDENTICAL for every reachable input (effZoom >= 400 forces
    2.5*ms >= 1000, so the 900 and 1000 floors are both inert). One
    window, not two — worth knowing before anyone tunes them apart.
  * Critic could not verify: which of R10's 40 reads was the lecturer's
    (reads carry no track id); whether anisotropy or resolution dominates
    (needs a 2x2 bench factorial: isotropic-downsample vs stretch vs both
    vs control, ~20 lines on the existing bench.html); whether the four
    per-frame faces are hallucinations or real profiles (`confidence` is
    decoded at detector.js:324 and read by NO player-path consumer); and
    every millisecond figure is an estimate.

  AFTER the exposure fix, re-verified on R9's footage (runs/r10c-man):
  **FALSE COVER 1/10** — the best man-direction result in the log, down
  from 2/10 before the fix and 3/10 at R9's start; the single remaining
  frame is a track birth. `life_window` 2 newTrack. Verdict p50 234, p95
  468, first === max === 6941 (**fifth consecutive round** where the worst
  pass is the first pass). gaze 107/107, cargo 35/35.
