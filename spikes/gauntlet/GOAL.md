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
