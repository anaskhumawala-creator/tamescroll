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
| 1 | (fixed) NWoT1ZVd1Lo | man | baseline: adult male + child female, known-hard. R19 note: a rotation entry is a VIDEO, not a window - every round before R19 used t=560; moving to t=901 produced the worst man-direction score on record. Move the offset. |
| 2 | (fixed) NWoT1ZVd1Lo | woman | same footage, inverted expectation |
| 3 | ted talk full speech | man | single speaker, stage lighting, slow cuts |
| 4 | news panel discussion | woman | 3-5 people, seated, small faces. R19 note: news footage is half GRAPHICS - z5WBceo0bIg is a title slate at t=240 (and painted a whole-frame GHOST over it), fFbNU0TvMH8 is two men in split-screen boxes at t=600. Probe forward for actual faces, and note this is the only GHOST-regime footage in the table. |
| 5 | cooking show episode | man | hands and objects — the GHOST trap |
| 6 | graduation ceremony full ceremony | woman | crowd shots, 100+ people. R16 note: "conference keynote audience" resolves to single-speaker talking heads, not crowds, and livestreams open on a title-card slate - probe forward before capturing |
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

- **R11** — NOT the strict rotation entry. R10 was entry 8, so entry 1
  (baseline NWoT1ZVd1Lo/man) was due, but the standing target was
  woman-mode TRACK CHURN and the baseline shows almost none. Picked
  footage that exhibits the failure instead, per the skill's licence to
  choose for a failure class: **H14bBuluwB8** (TED, Angela Lee
  Duckworth), `woman`, t=60s. Single large adult woman on stage + a
  second seated adult woman stage-right + a full audience. In woman mode
  BOTH women should be sharp, so every patch on them is a clean
  FALSE COVER signal. Entry 1 (`man`, NWoT1ZVd1Lo t=540) run as the
  symmetry check.

  **BEFORE — woman: FALSE COVER 9/10** (only f003 clean), EXPOSURE
  present every frame (audience). **man: PARTIAL/EXPOSURE 3/10** —
  f000-f002, the daughter's HANDS are covered while her HEAD sits
  uncovered at the frame edge (overhead bench shot, MoveNet pers=0).
  I first scored f001 as a GHOST from the blurred frame alone and was
  WRONG — the truth frame shows the patch sitting exactly on her hands.
  Score from the blurred image alone and you invent failures.

  **CHURN, MEASURED FOR THE FIRST TIME** (diagnostics built at the end of
  R10 and never run): window `birthFresh 1, birthNearMiss 3,
  coastExpired 3`. So 3 of 4 track births were the association threshold
  refusing a person it already had. The critic then traced the cause one
  layer further and it is NOT the IoU gate: the seated woman is admitted
  only via the second person tier (`PERSON_LOW_SCORE 0.12 &&
  PERSON_STRONG_KEYPOINTS 7`, person-gate.mjs:136) and her confident
  keypoints oscillate 3-9, so she is dropped and re-admitted repeatedly.
  The IoU gate only decides whether the re-mint keeps her identity.

  **A HYPOTHESIS I BUILT, MEASURED, AND THEN REVERTED.** The probe showed
  the stream was 854x480 — every previous round's arithmetic had assumed
  1280x720. Her face is ~50 native px there. So I wired a raise-only,
  desktop-only ABR floor (YouTube's own setPlaybackQualityRange) with a
  dropped-frame backoff, and it worked: 480p -> 720p live, 0 dropped
  frames. It bought NOTHING. Same 9/10 FALSE COVER at 480p, 720p AND
  1080p; the seated woman reads `uncertain` with a ~112px face exactly as
  she did with a ~50px one. Cost: verdict p50 97ms (480p) -> 101 (720p)
  -> 127-131 (1080p). REVERTED, with the reasoning written into
  init-entry.js where the code was, so R12 does not rebuild it. Two
  further nails: YouTube's setPlaybackQuality has been a documented no-op
  since 2019, and raising the rung spends the owner's mobile data on the
  G88 for zero visible gain.
  It did leave one real result: **input resolution is an uncontrolled
  variable in this harness.** Two runs of the same video minutes apart
  gave 854x480 and 1280x720 with no code change. `vw/vh` is recorded per
  frame now — a resolution mismatch INVALIDATES a cross-round comparison,
  and every run before r10c has it null.

  **SHIPPED: the clearStreak leak (EXPOSURE class).**
  person-track.mjs return block read `t.clearStreak` — the PREVIOUS
  track — on the decrement branch, so both places that zero the local
  streak when someone else is in the box (the `identityBroken` block
  :453, the memory override :542) were undone one line later. And the
  counter was never clamped: cs 21 measured live. Exposure: a long-cleared
  track suffers an identity break, reads uncertain, hands back 20, and
  ONE confident read from the NEW person clears them — they owe
  CLEAR_STREAK_N, they pay one. `identityBroke: 2` was logged in a
  10-frame window, so this fires on real footage. Now reads the local
  streak and clamps to CLEAR_STREAK_N. Regression test fails on the old
  code with "streak must be clamped, got 8".
  **AFTER:** cs never exceeds 2 in any frame of either direction (was 21);
  speaker still holds her earned clear (r11e f008 verified by eye, fully
  sharp). man direction: birthNearMiss 0, Linus clears, daughter covered.
  FALSE COVER unchanged at 9/10 — this fix closes an exposure path, it
  was never going to move the false-cover count.

  Verdict cost: p50 119-131, p95 199-605, and **first === max in all six
  runs — the sixth consecutive round.** Warm-up, not a tail; that target
  stays retired. gaze 109/109, cargo 36/36.

  **R12'S INPUT — the critic's findings, which I have NOT yet applied.**
  Its central result overturns my framing of this round: the false covers
  are the R10 NULL, read-by-read, not churn and not resolution.
  * In a frame containing two women and zero men, 22 reads were labelled
    `male`; 21 sat in the null box and **20 were CERTAIN FLAGS**
    (GENDER_MIN_SCORE 0.25). Control r11c-man: 78 real male reads,
    minimum score 0.48, not one in the null box. 122 samples, total
    separation.
  * The f001 frame I attributed to a streak reset was actually a null
    `male 0.31` flag-certain read. My mechanism was wrong.
  * Corrected constant: the null sigmoid band is v in [0.545, 0.705] over
    44 reads (R10 said [0.595, 0.670] from 24). Real male reads start at
    v = 0.74 — a 1-D gap of only 0.035, so **do not build a 1-D
    threshold**; use the joint (v, age) box or a null reference
    descriptor.
  * `FACE_MIN_NATIVE_PX = 64` NEVER FIRED — no read in any run returned
    `gender:'unknown'`. The box already carries FACE_ENLARGE 1.4, so the
    effective floor is ~46px. A size gate also cannot catch a dark face
    or a BlazeFace false positive; a null-signature gate catches all
    three, and is resolution-invariant.
  * **Identity memory is already a working null detector, wired
    backwards.** Null-labelled reads score median 0.91 against memory
    (35/40 above MEM_SIM_FLAG 0.85); real female reads score 0.23-0.62
    (0/56 above it). memoryStore only stores on `flag-certain`, so the
    null is what gets memorised — `mem` climbed to 6 of MEM_MAX 8, six
    copies of a constant, then used to blur people.
  * `uncertain` conflates four things; 27% of female reads are
    direction-correct-but-weak and are penalised identically to a null.
    Proposed `weakSame` HOLD semantics (never advances a streak, so
    exposure-safe by construction).
  * Ranked for R12: (R1) null-signature abstention, ~0ms, kills 8 of the
    9 false covers, and is strictly safe — abstention only ever REMOVES
    flag evidence, and in man mode the null at 0.27 is already below
    GENDER_CLEAR_SCORE 0.6 so it is inert; (R3) keep the null out of
    identity memory and re-derive MEM_SIM_FLAG afterwards; (R4)
    `weakSame`; (R5) second-chance association that may NOT inherit
    `cleared`.
  * **`__TS_GAZE_BUNDLE__` is stale ('v7' across at least three distinct
    code states), so no run can be attributed to a build.** Stamp it from
    git HEAD. Also: runs/r12-woman is a corrupt run (0-byte PNGs,
    vw/vh 0) that still wrote a scorable meta.json — the harness must
    refuse to write meta.json when videoWidth is 0 or a capture is empty.

  STILL OPEN and not caused by any of the above: the audience is sharp in
  every frame. MoveNet is NOT hitting its 6-person cap — slots 2-5 score
  0.00-0.15 on a hall of dozens. That is R8's conclusion holding.

- **R12** — rotation entry 2 (`(fixed) NWoT1ZVd1Lo`, **woman**) as the
  scored run, plus a re-verify on R11's TED footage (H14bBuluwB8, woman)
  because that is where the failure this round targets actually lives,
  and entry 1 (`man`) as the symmetry check. First round whose runs can
  be attributed to a build: `boot.b` now reads `f51c0f8-dirty` instead of
  the hand-edited `v7` that had covered at least three code states.

  **SHIPPED: null-signature abstention.** R11's critic proved faceres
  returns its PRIOR — a constant — when it has no signal, and that in
  woman mode that constant is a CERTAIN opposite-gender flag. I did not
  take the constants on trust; I instrumented and re-derived them.
  * detector.js discarded the raw sigmoid and kept only
    `confidence = 2*|v-0.5|`. Folding destroys the sign the test needs: a
    null (v~0.63) and a genuine weak female read (v~0.37) are the SAME
    folded number and 0.26 apart unfolded. Verdicts now carry `raw`, and
    the reads probe logs `v` and `px`.
  * Independent re-derivation on entry 2 (18 unique male reads):
    IN BAND 4 — raw 0.623/0.627/0.641/0.652, ages 36/36/36/37, scores
    0.25/0.25/0.28/0.30. OUT 14, nearest real male read raw **0.759**.
    Every single in-band read scored >= GENDER_MIN_SCORE 0.25, i.e. all
    four were certain flags built on nothing.
  * Confirmed again on the TED footage, unseen by the derivation:
    **16 of 55 reads** in band, raw 0.616-0.681, ages 35-39, scores
    0.23-0.36 — against real female reads at raw 0.045-0.373, ages 20-34.
    No overlap.
  * `isNullRead` + a guard at the top of `faceMeta`'s loop
    (gender-verdict.mjs). Abstain = `{flagged:true, certain:false}` — the
    same honest state a person with no visible face gets. **Safe by
    construction: abstention only ever REMOVES flag evidence, never adds
    clear evidence**, so no configuration of it can expose anyone, and in
    man mode it is inert (a null folds to ~0.27, far below
    GENDER_CLEAR_SCORE 0.6). Tests pin the four measured nulls as refused
    and the six nearest real male reads as NOT refused, so if the band
    ever grows into real data the suite says so.
  * CAUGHT BEFORE BUILDING: my first patch inserted the guard into
    `faceVerdict`, which has no `out` array — it would have thrown inside
    the verdict chain, the exact failure class that silently killed every
    gender read for two releases. Read the diff, not the intent.

  **MEASURED: `FACE_MIN_NATIVE_PX = 64` is very nearly unreachable.**
  Across both runs the native face size behind a read ran 49-577px and
  exactly ONE read fell below 64. The box already carries FACE_ENLARGE
  1.4, so the effective floor is ~46px. It is not the instrument for
  this: the nulls came from faces of 68, 69, 90, 112, 224, 234 and 239
  native px. A size gate also cannot see a face in shadow or a BlazeFace
  false positive; the null-signature test catches all three and is
  resolution-invariant (which matters, since R11 proved resolution
  varies run to run under us).

  **SCORES.**
  * entry 2 (r12-woman2), 8 scorable frames: **EXPOSURE 1/8**, FALSE
    COVER 0, GHOST 0. The exposure is f007 — an overhead workbench shot,
    `persons: 0`, zero patches, a man's hand and a child's head both
    fully visible. Same class as R11's audience: a person-primary
    pipeline is blind to a body it cannot see. I first scored a
    neighbouring frame as GHOST from the blurred image and was WRONG —
    the truth frame showed the patch sitting exactly on the child's
    hands. Second round running that mistake has appeared; score the PAIR.
  * TED re-verify (r12-ted): FALSE COVER **9/10 before and 9/10 after**.
    The abstention did NOT move the frame score, and that is the honest
    result: blur-first covers `uncertain` too, so refusing the null
    changes WHY the seated woman is covered, not WHETHER. What it does
    remove is her ability to condemn — she went from `flag-certain` every
    pass to `uncertain` every pass, so she can no longer revoke an earned
    clear or be written into identity memory. The speaker clears one
    frame earlier (f003, was f005) and holds at cs 2 to the end.
    f003 is a fully CORRECT frame — both women sharp, audience sharp,
    zero patches — verified by eye, so the target state is reachable on
    this footage.
  * symmetry (r12-man): unchanged. Linus clears and holds, daughter
    covered throughout, one frame with `persons: 0` and no patches (the
    same overhead-bench exposure class).

  **HARNESS: two guards, both from failures this round produced.**
  r12-woman2 wrote two frames captured before the player existed — one
  with videoWidth 0, one reporting a full 1920x1080 while the PNG was
  still the YouTube search bar over black — and both scored as a clean
  "0 patches, no people". Now a run hard-fails on any frame with no
  decoded video, any 0-byte PNG, and on a LEADING run of identical
  timestamps (the reliable tell: currentTime had not moved yet). Verified
  the guard rejects r12-woman2 and accepts r12-ted and r12-man, so it has
  no false positives on good runs.

  Verdict cost p50 97-131, first === max again — **seventh consecutive
  round**. gaze 112/112, cargo 36/36.

  **STILL OPEN, and R13's target.** The seated woman reads null with a
  face of 224-239 native px. It is therefore NOT size, and R11 already
  proved it is not resolution. Remaining candidates, in order: she is in
  deep stage shadow (luminance, not geometry), or BlazeFace is returning
  a false positive on her and faceres is being handed something that is
  not a face. Her crop finds `n=1` face every pass while the speaker's
  finds 2-3. Settle it by dumping the 224x224 crop actually handed to
  faceres for one of her reads — one toDataURL behind a debug flag —
  before changing any threshold.
  Also open and unaddressed: EXPOSURE on partial/edge-of-frame humans
  (hands, scalps, an arm entering frame) where MoveNet reports 0 persons;
  and re-deriving MEM_SIM_FLAG 0.85, which was calibrated against a read
  population that was ~40% null and now is not.

  **R12, CONTINUED — the critic's round, folded in the same round for
  once, because one of its findings was a regression R12 itself shipped.**

  **THE HOLE I OPENED.** The abstention moved no-information reads out of
  `flag-certain` and into plain `uncertain`. A cleared track ABSORBS an
  uncertain read for the whole CLEARED_TTL_MS, while the certain flag it
  replaced needed 2 consecutive reads to revoke. So on a cleared track the
  refusal bought the subject 4800ms of sharp against 400ms — measured by
  the critic against the real modules, not argued. The case that bites is
  a person SWAP: someone walks into a cleared track's box, reads null, and
  inherits somebody else's earned clear. I had checked the abstention for
  safety in one direction (it can only remove flag evidence) and missed
  that removing flag evidence IS the exposure when that evidence was the
  only thing revoking a stale clear.
  FIXED: `faceMeta` marks the refusal `abstained: true` and person-track
  advances the same revocation streak a certain flag does — 2 consecutive
  abstentions demote. A streak, not a millisecond budget, because a streak
  is cadence-relative and reproduces the pre-R12 bound on ANY device
  (desktop ~400ms, Helio ~1800-3000ms). Deliberately NOT extended to plain
  uncertain reads: an uncertain read is weak evidence pointing somewhere,
  a null is the model returning its prior, and only the second is a face
  we demonstrably could not read. Three regression tests, including one
  asserting an abstention on a BLURRED track is byte-identical to plain
  uncertain, so the change cannot leak outside the cleared branch.
  It did NOT fire once on either re-verify run — proven by unit test, not
  by frame. Say that rather than claiming footage evidence it does not have.

  **TWO CRITIC FINDINGS I REJECTED, WITH THE COUNTS.**
  * "The v-axis is dead weight; age carries the guard." COUNTED on
    runs/r12-woman2, 21 unique reads: v-band 9, age-band 11, BOTH only 4.
    Drop age and 5 real reads become nulls; drop v and 7 do — including
    the two most confident male reads in the run (v 0.938/0.947 scoring
    0.88/0.89). Both axes are load-bearing. Written into the code.
  * "Fix the class — apply the abstention to the image path too." The
    image path has no track, no state machine and no memory. A null there
    is already `flagged`, and abstaining would produce the identical
    output; the only way to make it produce a different one is to stop
    flagging, which is an exposure. A no-op, not an oversight. Also
    written into the code so R13 does not re-litigate it.

  **THE CRITIC'S BIGGEST FINDING, VERIFIED BY ME, AND R13'S TARGET.**
  Identity memory saturates and converges on flagging everyone. From
  runs/r12-woman2/meta.json, abstention live, two people on screen:
  `mem` 0 -> 1 -> 2 -> 4 -> 6 -> **8 = MEM_MAX in ten frames (~15s)**, and
  the best-match similarity FLOOR climbs with it — reads taken while
  mem<=2 scored 0.00-0.89 (median 0.39), reads at mem>=6 scored 0.68-0.82
  (median 0.77). MEM_SIM_FLAG is 0.85 and it already fired three times.
  The mechanism is structural, not a bad threshold: `memBest` takes a MAX
  over a bank that only ever grows, and docs/detection-engine.md already
  registers 17% of DIFFERENT-person pairs scoring >=0.9 — so the false-
  match probability goes as 1-(1-0.17)^k in the bank size: ~0.43 at one
  entry, ~0.99 at eight. That is a plausible mechanism for the owner's
  oldest complaint, "why does it keep blurring me": in man mode the bank
  fills with women and then re-covers him on any read that is not
  confidently same-gender. It cannot be re-tuned — R11 measured the full
  ROC and the distributions overlap across their whole useful range — so
  R13's question is whether memory is worth keeping at all. What it
  actually buys is one thing: shortening CLEARED_TTL_MS for a face we
  have seen before. That is obtainable directly, without a descriptor
  test, and the abstention fix above is already half of it.

  **RE-VERIFY, build `914b7d9-dirty`, both directions, every frame read
  against its truth pair.**
  * runs/r12b-ted (H14bBuluwB8, woman), 10 frames: FALSE COVER 9/10,
    GHOST 0. Unchanged, and unchanged is the honest answer — blur-first
    covers `uncertain`, so the abstention still changes WHY the seated
    woman is covered, not WHETHER. The speaker now clears at **f002**
    (r12 f003, r11e f005) and holds to f009 with flagStreak 0 throughout,
    so the fix did not cost her a single frame. f003 is again a fully
    correct frame: speaker sharp, seated woman sharp, zero patches. Every
    patch was checked against its truth frame and sat on a real person.
  * runs/r12b-man (NWoT1ZVd1Lo, man): EXPOSURE 1/10, PARTIAL 2/10, FALSE
    COVER 1/10, GHOST 0. Linus clears at f003, again at f007 after a cut,
    and holds — no abstention ever demoted him, which was the false-cover
    risk this change carried. f008 shows the daughter at `flag-certain`
    fs1 while his track sits at fs0, so the real flag path still works.
    f005 is the standing exposure: overhead bench, MoveNet `persons: 0`,
    zero patches, her scalp and hands visible. f000/f001 are the partial
    class — her hands covered, her sleeve and the top of her head outside
    the patch. The one false cover is f002, a scene transition where both
    tracks are re-minted and blur-first covers him for a single frame.

  gaze 117/117, cargo 36/36.

  **R13's queue, in the critic's order and mine.** (1) Identity memory:
  delete it, or gate `memoryStore` on a verdict pass and dedupe — it is
  currently re-storing the same descriptor at PASS cadence, so exemplar
  slots hold duplicates of one look while every genuinely new look mints
  a new entry. (2) `lastSlotDiag` records only a COUNT of keypoints above
  0.3, so nobody can say whether MoveNet had a 0.28 wrist on the workbench
  frame or nothing at all — three comparisons in an existing loop decide
  whether the exposure class needs a second model (BlazePalm, Apache-2.0
  code AND weights) or a free keypoint-rescue tier. Measure before buying.
  (3) Log `abstained` and `own` on every read: the abstention is currently
  invisible in the artifact, and the band was fitted on a log that can
  contain reads the pipeline discarded. (4) Harness: `p95` is computed
  over a ring that still holds the model-load pass, so every frame reports
  p95 = the warm-up number; and the blank-frame guard only catches a
  LEADING stall — f001 had 123 unique colours against f002's 47409, which
  would catch a blank anywhere in a run.

- **R13** — rotation entry 3 (`ted talk full speech`, **man**), resolved
  live to `arj7oStGLkU` (Tim Urban, TED): one male speaker on a lit stage
  with an audience of dozens in the foreground rows. Plus entry 2
  (`NWoT1ZVd1Lo`, **woman**) as the second direction, because that is the
  footage where R12 measured the failure this round exists to remove.
  Baseline build `914b7d9-dirty`, after build `e165c8b-dirty`; the dev app
  PID changed 21632 -> 33832 between them, which is the only thing that
  actually proves a reload.

  **SHIPPED: identity memory is DELETED.** The owner made the call after
  R12; this round measured it once more before pulling it, and the
  measurement is worse than R12's.
  * On the woman run the bank was at **MEM_MAX 8 on frame ZERO** — not
    "saturates in 15 seconds", already saturated before the measurement
    window opened. It stayed pinned at 8 for all ten frames while `sims`
    ran 0.75-1.00 and included exact 1.00 self-matches.
  * The mechanism is structural, not a bad threshold. `memBest` took a
    MAX over a bank that only ever grew, and max-of-k is non-decreasing
    in k, so the score rose with BANK SIZE independently of who was on
    screen. docs/detection-engine.md already registers 17% of
    DIFFERENT-person pairs at >=0.9 against a same-person 5th percentile
    of 0.28 — overlapping across the whole useful range, so there is no
    operating point to retune to. With 8 entries x 3 exemplars the
    false-match probability is ~1-(1-0.17)^24, i.e. essentially certain.
  * What it cost in practice, and it is the owner's oldest complaint:
    R11 watched a woman reading a CERTAIN CLEAR stay covered for ten
    straight frames while the bank sat at the cap. In man mode the bank
    fills with women and then re-covers HIM.
  * Removed: `identityMemory`, `MEM_MAX`, `memBest`, `memoryLookup`,
    `memoryStore`, both `MEM_SIM_*` constants, the `obs.remembered`
    override in matchedStep, and the newTrack clause that let a
    remembered flag suppress a new track's first clear credit.
  * The honest cost of removal, written into the code so R14 does not
    rediscover it as a bug: a person once read as certainly opposite-
    gender who now reads UNCERTAIN is no longer re-covered on someone
    else's cleared track. That case is a person SWAP — an identity
    question — and the measurement above says this descriptor cannot
    answer it. It is instead bounded by the two mechanisms that need to
    recognise nobody: a new track always starts blurred, and a cleared
    track is revoked by CLEARED_TTL_MS or by two abstained reads (R12).
  * The two tests that pinned memory's BEHAVIOUR were rewritten to pin
    its ABSENCE — `obs.remembered` is an easy field for a future change
    to start honouring again, and it must not.

  **AND IT IS THE BIGGEST PERF WIN OF THE LOOP SO FAR.** Verdict p50,
  same footage, same machine, memory the only difference:
  man **105-110ms -> 89-98ms**; woman **141-150ms -> 103-108ms**, a 28%
  cut on the two-person run. That is the removed work: up to 24 cosine
  similarities over 1024-d descriptors per face per lookup, plus a second
  full `memBest` per track inside `memoryStore`, ~100k multiply-adds per
  pass in JS. Every previous round bought accuracy and paid milliseconds;
  this one took both. On a Helio G88 that margin is the whole cadence
  budget.

  **SCORES, every frame read against its truth pair, both directions.**
  * entry 3 (man, TED): FALSE COVER **1/10 -> 0/10** — f002's patch sat
    on the male speaker on a re-minted track and is gone; the speaker is
    now sharp with ZERO patches on all ten frames. GHOST 0 -> 0,
    PARTIAL 0 -> 0. EXPOSURE 5/10 -> 6/10, and that difference is frame
    content, NOT a regression: the audience rows are sharp in every wide
    shot in both runs and the sampling simply landed on one more wide
    shot the second time. MoveNet reports `persons: 1` on every single
    frame of a hall containing dozens.
  * entry 2 (woman): EXPOSURE 4/10 -> 4/10, PARTIAL 3/10 -> 2/10 (frame
    content again), FALSE COVER 0 -> 0, GHOST 0 -> 0. Coverage of both
    subjects is unchanged frame for frame. `flagStreak` also stopped
    running away — 12 before, clamped at 2 now.
  * So: one failure removed, nothing regressed, and a third of the pass
    cost returned. Both directions.

  **ALSO: `flagStreak` was unclamped**, observed at 12 on one track in
  ten frames. Structurally the same shape as the `clearStreak` leak R11
  fixed. The only thing ever asked of it is `>= 2`, so clamping there is
  behaviour-identical — but an unbounded counter is a number nobody can
  read in a diagnostic, and that is how R11's leak hid.

  gaze 116/116 (117 minus the three memory tests, plus two pinning the
  removal), cargo 36/36.

  **STILL OPEN, and it is now unambiguously the top failure in BOTH
  directions: EXPOSURE from people the detector never reports.** Two
  distinct shapes, and neither is a state-machine problem:
  (a) the audience — MoveNet returns `persons: 1` on a TED hall with
  dozens of visible faces, so it is not even hitting its 6-person cap;
  (b) partial bodies — the overhead workbench shot returns `persons: 0`
  with a scalp, two hands and a forearm plainly visible.
  R12's critic already surveyed the licence-clean options (BlazePalm,
  Apache-2.0 code AND weights, is the leading candidate) and the correct
  next step is the MEASUREMENT that decides between a free fix and a
  bought one: `lastSlotDiag` (person-gate.mjs) records only a COUNT of
  keypoints above 0.3, so nobody can say whether MoveNet had a 0.28 wrist
  on that frame or nothing at all. Three comparisons inside an existing
  loop, 0ms, and it decides the architecture. Do that before adding a
  second model.

  **R13, CONTINUED — the critic found that MY LAST ROUND SHIPPED DEAD
  CODE, and it is the exact bug this whole loop exists to catch.**

  **F1, CRITICAL, one line.** R12's abstention revocation never ran.
  `faceMeta` produced `{flagged, certain, abstained}`, and the observation
  builder in init-entry.js copied three fields and silently dropped the
  fourth — so `obs.abstained` was never set, both consumers in
  person-track.mjs were unreachable, and `abstainDemote` had never
  appeared in any run ever recorded. The R12 log said the branch "did not
  fire once on either re-verify run" and blamed the footage. It could
  never have fired. **The unit tests passed the whole time because they
  hand `abstained` straight to `updatePersonTracks` and never cross that
  boundary** — a green suite over a dead product path, which is the exact
  failure mode named at the top of this file.
  Now wired, and PROVEN LIVE rather than by test: the reads probe carries
  `ab`, and the runs show **12 of 80 reads abstained** on the baseline
  footage and **20 of 80** on the TED footage. `abstainDemote` now appears
  in `life` at all — it fired during pre-window playback, which is why
  baselining `life` and reporting deltas matters; the in-window delta is
  0 because no cleared track in these runs got two consecutive nulls.
  **NEW LIVE RISK, named because it is now reachable for the first time:**
  in MAN mode a null is labelled `male`, i.e. same-gender, so on a CLEARED
  track it now advances the revocation streak and two consecutive nulls
  re-cover the owner for ~800ms. That is the trade R12 chose deliberately
  (blur-first on a face we demonstrably cannot read) but it was inert
  until today. Evidence so far: **0 of 80 reads abstained across the
  man run** — real male close-ups never enter the null band — so it costs
  nothing on this footage. Watch it on the next man-direction round.

  **F4, geometry, 0ms, and the round's second real bug.**
  `KEYPOINT_MARGIN` is a DISTANCE applied unscaled in both axes, but
  normalized coordinates are not isotropic: on 16:9 the same constant is
  96px sideways and only 54px vertically at 1080p, a 1.78x shortfall in
  the vertical. The keypoints that set the extreme y edges are exactly a
  raised HAND and the crown of a HEAD — the two things the owner keeps
  reporting outside the patch — while sideways-extended arms were always
  fine, and that asymmetry in his reports is what this explains.
  `person-gate.mjs` already knew the rule and states it thirty lines
  below for the head anchor (`headH = headW * ar`); the union never got
  it. Fixed. Test asserts it as a SYMMETRY — square frame must give a
  square cushion — plus a direction, so it survives a change to either
  constant. Measured cost: nothing where the MoveNet box already
  dominates; +3.9% of frame height per edge only on head/hand-extreme
  boxes, which is where the owner asked for it.

  **REJECTED, with the counter-evidence, so R14 does not re-litigate.**
  * The critic's own strongest finding kills my framing of the round's
    PARTIAL failures: on the baseline footage f000-f002 have
    `persons: 0`, every MoveNet slot at score 0.00-0.13 with zero
    confident keypoints. There is no detected person to under-cover.
    The patch comes from `personFromFace` on a **BlazeFace false positive
    on the disassembled phone**, reverse-solved to a "face" at
    (0.439, 0.318) — the PCB. So the child's hair and sleeve are not a
    box-constant problem, and F4 cannot fix that frame.
  * That phantom also proves **`isNullRead` is useless against this
    class**: the reads behind it are `male s0.99 v0.997` and
    `male s0.98 v0.990` — a false positive on hardware produces a
    MAXIMALLY confident gender read, nowhere near the null band. Refusing
    the model's prior does nothing when the model is certain and wrong.
  * Do NOT lower `PERSON_LOW_SCORE` / `PERSON_STRONG_KEYPOINTS` to catch
    the TED audience. The single-speaker close-ups (f007-f009, exactly
    one person in frame) report slots with **6-9 confident keypoints at
    score ~0.00** — pure noise slots. Lowering the tier admits those.
    R11's "the low tier oscillates" is now confirmed from a second video.
  * `mem: 8` on frame zero was NOT cross-video contamination. Full
    document navigation re-evaluates the bundle, and `cost.verdict.n`
    = 34 says 34 verdict passes completed before capture opened. Moot
    now that the bank is gone, but recorded so nobody re-opens it.
  * `flagStreak` unclamped was genuinely inert — a track can only reach
    `cleared` through the branch that zeroes it, so the `>= 2` bound was
    always exact. My clamp is hygiene, not a fix, and it changes no
    behaviour.

  **DEFERRED to R14, with the numbers so it starts from evidence.**
  (1) `flagStreak` HARD-ZEROES while `clearStreak` DECAYS, so a cleared
  track reading `flag / uncertain / flag / uncertain` never reaches 2 and
  rides the full CLEARED_TTL_MS. Structural, and NOT observed in R13 —
  both runs' cleared tracks read `clear-certain` steadily — so it needs
  measuring before it is fixed. Symmetric fix is `Math.max(0, fs-1)`,
  0ms. (2) The 60Hz render lerp is symmetric, so a moving limb's LEADING
  edge lags ~40ms after every pass; `interpolateBox` is careful to
  extrapolate size outward-only and `lerpRect` then throws that away.
  Union the lerped rect with the target — grow instantly, shrink
  smoothly. (3) `personFromFace` never applies `PATCH_MARGIN`, so a
  face-derived person carries 8% less relative margin than a pose-derived
  one, for no stated reason. (4) `PTRACK_PAD_TOP` is a fraction of BOX
  height but hair is proportional to HEAD size, so a head-and-shoulders
  box gets 39px of crown headroom where a full-body box gets 117px —
  backwards. (5) `mergeTracks` flips a two-shot between two rects
  (IoU 0.257, containment 0.427) and one frame-wide rect covering 72% of
  the frame, one frame apart; hysteresis needs per-pair state so it is
  not free.

  **RE-VERIFY after all of the above, three runs, every frame read
  against its truth pair.** man (arj7oStGLkU): FALSE COVER 0/10, GHOST 0,
  PARTIAL 0, speaker cleared and zero patches on all ten frames,
  verdict p50 87-99ms. woman baseline (NWoT1ZVd1Lo): EXPOSURE 4/10,
  PARTIAL 2/10, FALSE COVER 0, GHOST 0 — unchanged, and unchanged is
  correct since F4 does not touch the face-fallback path those frames use.
  woman TED (H14bBuluwB8): FALSE COVER 9/10, GHOST 0, speaker clears at
  f003 and holds to f009, f003 again a fully correct frame. No regression
  in any direction from F1 or F4.
  gaze 117/117, cargo 36/36.

- **R14** — rotation entry 4 (`news panel discussion`, **woman**),
  resolved live to `fFbNU0TvMH8` (India Today debate). This is a footage
  CLASS the pipeline has never seen and has no concept of: a **composite
  broadcast mosaic** — a banner strip, five talking-head panel windows
  each about 0.28 of frame height, two or three vertical video insets,
  and flat dark-red studio background filling the bottom 40% and every
  gap. Entry 4's rotation note says "3-5 people, seated, small faces";
  what it actually exercises is layout, and that turned out to matter far
  more. Same footage run in `man` as the symmetry check.
  Build `ae66ff1-dirty`; app PID changed on every rebuild
  (43872 -> 41768 -> 30384 -> 28592), which is the only proof of a reload.

  **SHIPPED: the measurement R13 asked for, and it answered.**
  `lastSlotDiag` recorded only a COUNT of keypoints above
  PERSON_KEYPOINT_MIN 0.3, so a slot reading `confident 0` was ambiguous
  between two opposite worlds — MoveNet saw NOTHING, or MoveNet saw a
  wrist at 0.28 and the threshold ate it. Those want opposite fixes (buy
  a second model vs a free rescue tier), and three comparisons inside a
  loop that already runs decide which. Now records `maxKp` and `nKp15`,
  and the slots probe carries them into the artifact.
  **Both worlds exist, and which one you are in depends on the footage.**
  R13's overhead workbench frames were a genuine void: every slot score
  0.00-0.13 with ZERO confident keypoints while a scalp and two hands were
  plainly visible. This panel is the opposite: slots at score 0.13-0.21
  with 5-6 confident keypoints, **nKp15 5-8**, box heights 0.11-0.21 —
  panel-window sized, and every one a real panelist — sitting just under
  the admission bar while MoveNet reported `persons: 0` on three of ten
  frames of a frame containing five visible people. So "MoveNet is blind"
  was too coarse a diagnosis, and the free rescue tier is at least
  sometimes on the table. That is the round's durable result.

  **TRIED, MEASURED, REVERTED: PERSON_STRONG_KEYPOINTS 7 -> 5.**
  The case looked strong — it admits exactly the population above, and
  R13's noise-slot warning did not apply because those slots scored
  ~0.00-0.01 and are excluded by PERSON_LOW_SCORE, which was not moving.
  The theory was that a real skeletal box (bounded by evidence) would
  DISPLACE the unbounded synthetic body `personFromFace` paints for a face
  with no person under it, and so cut the round's dominant failure.
  Measured side by side on the same footage: persons per frame barely
  moved, patch heights got **WORSE, 0.39-0.76 of frame height before ->
  0.35-0.87 after**, `coastExpired` rose 6 -> 9, and the exposed man in
  the reference frame was still exposed. Reverted, with the refutation
  written into person-gate.mjs so the diff alone cannot lose it.
  The lesson worth keeping: **recall at the person gate is not the lever
  on synthetic-body sprawl — the two mechanisms stack rather than
  substitute.**

  **SCORES, every frame read against its truth pair, both directions.**
  * woman (r14-woman): **GHOST 10/10 — the worst any round has recorded,
    and it is the class the owner named in his own words.** Every frame
    carries patch area over flat red studio background. Mechanism is
    arithmetic, not a bug: `personFromFace` extends a body cy + 6.0 face
    heights, so a face of h~0.06-0.10 inside a 0.28-tall window becomes a
    patch 0.39-0.76 of the FRAME tall and runs straight out of its window.
    Example rects: f003 `(0.00,0.37)-(0.29,1.00)`, f008
    `(0.05,0.37)-(0.54,1.00)`, f009 `(0.80,0.10)-(1.00,0.86)`.
    EXPOSURE at least 5/10 (f000, f002, f003, f006, f008) — all of it
    inside the video insets, where people are small. f008 is the frame to
    remember: a man and a woman stand side by side in an airport inset,
    BOTH fully sharp, while two huge patches cover empty background to
    either side of them. FALSE COVER 0, verdict p50 99-122ms.
  * man (r14c-man): the gender read is working and the symmetry is clean.
    All five male panelists CLEAR and go sharp; patches per frame fall
    from 3-5 to 0-1; **f003 is a perfect frame** — five men sharp, zero
    patches, zero ghosts. EXPOSURE remains, and it is the same class:
    women inside the video insets, small, undetected. verdict p50 122-158.
  * **The asymmetry is itself the finding.** Ghost severity scales with
    how many people are COVERED, because a ghost is the tail of somebody's
    synthetic body. So it is worst in exactly the direction that matters
    most, and a round that only ever measured the man direction on this
    footage would have called it nearly clean.

  gaze 117/117.

  **OPEN, and R15's question.** Is there any signal already in the
  pipeline that separates "face inside a small window on a composite
  layout" from "small face of a distant full-body person"? They are
  arithmetically identical to `personFromFace` today, and the difference
  is worth 10/10 ghost frames. Candidates, none yet measured: window
  geometry is temporally STATIC while its contents move (the scene gate
  already computes 16x16 luma deltas at up to 10Hz and throws the spatial
  structure away); a real body below the face implies MoveNet torso
  keypoints, which on this footage exist at 0.15 but not at 0.3; and
  edge/gradient structure at a window border is strong and axis-aligned.
  Also still open from R13 and untouched: `flagStreak` hard-zeroes while
  `clearStreak` decays; the 60Hz render lerp is symmetric so a moving
  limb's leading edge lags; `personFromFace` never applies PATCH_MARGIN.

  **R14, CONTINUED — the critic found a coordinate-space bug with an
  arithmetic fingerprint, and I verified the fingerprint myself before
  touching anything.**

  **`personFromFace`'s "width" was never a width.** `detectFaceBoxes`
  squarifies the face with a SINGLE `half` scalar in MODEL space and then
  divides both axes by INPUT_SIZE (detector.js ~:318-325), so every face
  box satisfies `x2-x1 === y2-y1` in NORMALIZED units. Model space is a
  256x256 resize of the frame, so equal normalized extents are not equal
  pixel distances. `var w = (face.x2 - face.x1) / 1.4` was therefore the
  face HEIGHT wearing a width's name, and "2.2 half-widths" silently
  carried a hidden factor of the frame's aspect ratio.
  **Verified independently, not taken on trust:** an unclamped synthetic
  body has a FIXED width/height by construction, so the bug pins its own
  value. Across runs/r14-woman's 49 patches, **28 sit between 0.553 and
  0.561** — a band 0.008 wide. That is arithmetic, not footage.
  **And it is an EXPOSURE bug off 16:9.** Per side, as a multiple of face
  pixel-height, the old x-extension came to 3.91H on 16:9, 2.93H on 4:3
  and **1.24H on a 9:16 vertical video** — three times too narrow on the
  shape YouTube now serves most. Shoulders sharp.
  Fixed by deriving x from the faithful axis and dividing by the aspect,
  which is what `parsePersons` already does for its own margins and which
  R13 threaded into that function and not this one.

  **I REJECTED the critic's magnitude, and the reason is in the code.**
  It proposed `k ≈ 2.4` from anthropometry (shoulders are ~2.5-3 face
  widths). But 2.2 was not an anthropometric guess — R8 measured it on a
  naval officer at a podium whose sleeve stayed sharp to x~0.79, and that
  run put the REQUIREMENT at 2.5 half-units, which converts to **4.44H,
  above even today's 3.91H**. Cutting to 2.4H is a 39% width reduction
  against a constant already below its own measured requirement, and the
  class it reopens is EXPOSURE. So I took `k = 3.911` — exactly
  `2.2 x 16/9` — which leaves 16:9 bit-for-bit unchanged, fixes every
  other aspect, and leaves the narrowing to a round that can re-capture
  the R8 podium footage and measure it. **Verified neutral as designed:**
  re-running the same footage kept the 0.557 signature (21 of 47 patches)
  and the same frames. A fix that is inert on the footage in front of me
  is the correct outcome when its purpose is correctness elsewhere.

  **The critic also explained MY OWN REVERT, which I had recorded as an
  unexplained refutation.** `dedupeObservations` (person-track.mjs ~:227)
  collapses any observation pair with containment >= MERGE_CONTAIN_MIN
  0.6, and `preferred()` breaks the tie by LARGER AREA. A newly-admitted
  panel box (h 0.11-0.21) sitting inside a NEIGHBOUR'S synthetic body
  (h ~0.51) has containment 1.0 — so two different people collapse into
  one observation and **the bounded skeletal box is deleted while the
  unbounded phantom survives**. Displacement was never possible; that is
  why lowering PERSON_STRONG_KEYPOINTS bought nothing and added churn.
  `personFromFace` already stamps `fromFace: true` and it survives onto
  `obs.box` — and it is read NOWHERE. Making `preferred()` favour
  evidence over extrapolation before falling through to area is the
  prerequisite for ever retrying the recall change. Not done this round:
  it is a behaviour change to the association layer and it deserves its
  own before/after rather than riding along with two other edits.

  **Also from the critic, recorded not applied.** Capping synthetic height
  by the frame's largest MoveNet box is INERT here and I confirmed the
  numbers: a composite frame has no single person scale — the admitted
  boxes are the full-body inset people at h 0.30-0.52 while the panel
  heads are 0.11-0.21, so 1.5 x 0.45 never clamps the 0.51 it would need
  to. The scene gate is the one existing signal that could work: it
  already rasterises a 16x16 luma grid at up to 10Hz and `meanAbsDelta`
  collapses 256 numbers to one and discards the rest. Keeping a per-cell
  EMA is ~256 mul-adds at 10Hz, under 0.05ms per verdict pass, and a
  composite layout is DEFINED by having live cells and dead cells. The
  critic simulated an ideal mask at 66.8% -> 52.7% coverage with the
  bottom-band ghost going to zero. It needs three guards or it becomes
  exposure: inert while `sceneState === 'static'`, trim only BELOW the
  lowest confident keypoint, and never trust a dead cell unless the frame
  has live cells elsewhere (a motionless person must never be trimmed).
  Also killed one of my own standing leads: do NOT add PATCH_MARGIN to
  `personFromFace` — given the width bug that geometry was already over,
  and the margin moves the wrong way.

  **R15's queue.** (1) `preferred()` must prefer evidence over
  extrapolation — it gates everything else on this footage. (2) The
  per-cell motion mask, with the three guards, measured against the
  simulated 66.8% -> 52.7%. (3) `PTRACK_PAD_TOP` is 0.12 of BOX height,
  which on a 0.51-tall synthetic is 66px of headroom above a head needing
  ~10px — about a tenth of every synthetic patch is pure ghost; the
  correct form is a multiple of head size, which `parsePersons` already
  computes. (4) The render lerp is still symmetric (exposure direction,
  ~100ms of lagging leading edge). (5) Re-capture the R8 podium footage
  and narrow `k` from 3.911 with evidence.

- **R15** — rotation entry 5 (`cooking show episode`, **man**), resolved
  live to `KAWvDsghyc8` (Hell's Kitchen S19 E1), t=620, 10 frames @1.5s.
  The rotation note promised "hands and objects — the GHOST trap" and it
  delivered, but not by the mechanism the note (or I, or the critic)
  expected. Same footage in `woman` for symmetry, plus the baseline video
  as a regression check. Build `6572a32-dirty`; app PID changed on every
  rebuild (22352 -> 43212 -> 45524 -> 42864 -> 38164 -> 45256), which is
  the only proof of a reload. The dev WATCHER was dead this round —
  `touch lib.rs` did nothing for ten minutes — so every rebuild was an
  explicit stop / `cargo build` / detached relaunch.

  **SHIPPED 1: `FACE_MIN_NATIVE_PX` had never executed. Not once, in any
  round, in any shipped bundle.** The artifact said so first: 19 of 55
  unique reads sat below a supposed 64px floor, several scoring high
  enough to CLEAR (px 40 -> score 0.62, px 32 -> 0.69). Reading the
  emitted bundle showed `var IY;` with no initializer and `IY=64`
  appearing zero times in 23MB, so every comparison was `px < undefined`
  — false for all input. The unminified build of the same source is
  correct, which is what makes it invisible.
  **Cause (the critic's, and it is the whole answer): the `var` sits
  AFTER a `return` inside the boot closure — unreachable code,
  dead-code-eliminated.** I had independently narrowed it to "the
  minifier drops the initializer" and was wrong about why; the fix I had
  already applied (move it to a module) is right for the reason the
  critic gives, and it dodges the trap it warned about — my first attempt
  changed `var` to `const`, which after a `return` is TDZ, and would have
  thrown inside `genderFromNativeFace`, been swallowed by
  `classifyBest`'s catch, and silently degraded EVERY gender read in the
  pipeline. Third time an instrumentation-shaped change has come close to
  killing the verdict chain.
  **This retroactively corrects R12**, which concluded the 64px floor was
  "very nearly unreachable" on the footage. It was unreachable in the
  control flow.
  **Measured effect: ZERO patches changed.** Frame-for-frame identical
  before and after (r15-man vs r15b-man). An unreadable face is still a
  covered face, so a size gate cannot remove a patch — what it removes is
  16 of 53 reads per window and their ability to condemn or clear.

  **SHIPPED 2: the round's real bug — tracks survive a scene cut and
  paint the old shot over the new one.** `demoteTracks` keeps the boxes
  on a cut (deliberately, review C2: coverage must hold through the gap
  before the forced pass lands) and its comment justifies that by saying
  "identity memory, not stale association, decides who re-clears".
  **Identity memory was deleted in R13.** The justification went; the
  behaviour stayed. So a kept box coasts the ordinary blurred budget —
  2.5 verdict passes, ~1000ms — on geometry belonging to a shot that no
  longer exists. New `PTRACK_CUT_COAST_MS = 400`: a demoted box lives one
  pass, and the flag self-clears because `matchedStep` builds a fresh
  object, so a box that IS re-observed returns to the normal budget.
  `cutCoastExpired` counts it.

  **TRIED, BUILT, AND REVERTED IN THE SAME ROUND: a relative-size floor
  on the fallback.** The critic ranked "face height / tallest face in the
  pass" first and proposed 0.15 from this round's two frames. I checked
  0.15 against four earlier runs and REFUSED it — it would have dropped
  real people at ratios 0.116 (r12-ted audience), 0.128 (r12-man), 0.137
  and 0.152 (R14 insets), and dropping a real person is an EXPOSURE. I
  derived 0.10 instead, shipped it, and it fired ZERO times. The reason
  is the important part: **I calibrated it on `reads.px`, which is the
  face found INSIDE a crop and mapped back to video — not the full-frame
  face that builds a synthetic body.** Adding the `ff` probe (the actual
  input: every full-frame face height, whether each is inside a person,
  and the max) showed the two populations do not exist on this footage —
  a pass returns either ONE big face (close-up, h 0.36-0.52) or a set of
  SIMILAR small faces (wide shot, h 0.030-0.059), so every ratio is 1.0
  or ~0.5. The "six phantoms at 29-52px" I had measured were the tracker
  re-cropping coasted ghost boxes and reading whatever texture was inside
  them. Reverted rather than left in place: unfired code carrying a
  five-run derivation computed from the wrong quantity is worse than no
  code, and the next round would have trusted it. The lesson is written
  into person-gate.mjs so the diff alone cannot lose it.

  **SHIPPED 3: instrumentation, five pieces, each from a specific
  blindness this round hit.** `cfg` publishes the EFFECTIVE value of the
  gating constants as the bundle sees them (a dead constant now shows up
  as `null` in the artifact instead of hiding for six rounds); `fc`
  carries BlazeFace's own confidence per read; `b` carries the region a
  read came from, so a read can finally be JOINED to a patch; `ff`
  records the full-frame face pass; and `lastSlotDiag` now carries the
  model BOX, not just its height, which is the capture the critic asked
  for before anyone builds face-corroborated slot admission.
  **`fc` immediately killed the critic's rank-3 candidate.** Raising
  FACE_MIN_CONFIDENCE cannot separate anything here: the 16 gated small
  faces run fc 0.40-0.75 and the real faces run 0.46-0.91 — a real face
  at 0.46 sits below phantoms at 0.71 and 0.75. Measured, not assumed.

  **HARNESS: the paired capture can straddle a scene change, and did.**
  r15-man f004's two shots showed different scenes; 44.8% of the pixels
  OUTSIDE every patch differed, against 0.00% on all nine other frames.
  `pause()` is a request, not a state, and the `play()` issued at the end
  of the previous frame can resolve after it. The pair is now polled to
  `paused===true` and bracketed by `currentTime`; a pair whose clock
  moved is stamped `pairSkew` instead of being scored. Zero skew in the
  four runs since.

  **SCORES, every frame read against its truth pair, both directions.**
  * man, the nine frames scoreable BEFORE and after (f004's baseline pair
    was skewed): **FALSE COVER 2 -> 1, GHOST 3 -> 2, EXPOSURE 0 -> 0,
    PARTIAL 0, DRIFT 0.** f005 carried the whole improvement and went
    from the worst frame in the run to a **perfect** one: it was a
    close-up of one bearded man wearing FIVE patches — four over kitchen
    furniture and one over his own eyes and glasses — and is now zero
    patches, fully sharp. f007 is unchanged in character: Gordon Ramsay
    carries a FALSE COVER and the empty studio floor carries GHOST, both
    from `personFromFace` sprawl (y2 = cy + 6.0h on a 0.04-tall face),
    which is R14's geometry finding and not this round's.
  * **f004 is a regression in the worst class, and it is the honest cost
    of the fix.** With the harness guard it became scoreable for the
    first time, and it shows **EXPOSURE**: a blonde woman and a second
    woman standing sharp in a studio wide shot. Before the cut fix that
    same frame carried a single patch covering 83% of the frame — a
    frame-wide GHOST that happened to cover them. So the exposure is
    pre-existing (wide-shot women at ~40px faces, which the detector
    catches on f007 and misses on f004), it was being masked by a ghost,
    and removing the ghost revealed it. Trading a ghost for an exposure
    is a bad trade by the owner's own ordering, and the underlying miss
    is R16's first target.
  * woman (r15f), same footage: cleanly inverted. The woman close-up
    (f000) goes to ZERO patches and stays sharp; the bearded man is
    covered on all seven of his frames, head to frame edge, no PARTIAL.
    Symmetry holds.
  * regression check on the baseline video (r15g, NWoT1ZVd1Lo, woman):
    the cut change is nearly inert there — `birthNearMiss 0`,
    `coastExpired 3`, `cutCoastExpired 2` across the window, 1-2 patches
    per frame, the girl covered. Pre-existing and untouched: people
    entering at the FRAME EDGE (f007 has a man's beard at x<0.06 and
    another at x>0.94, both sharp in woman mode).
  * churn, deltas over the 15s window: `coastExpired` 14 -> 13 with
    `cutCoastExpired` 12 alongside, i.e. most expiries are now the cut
    path retiring stale geometry on purpose rather than the miss path
    timing it out. `birthNearMiss` 9 -> 7. verdict p50 75ms, p95 155,
    pass p50 33ms.

  gaze 122/122, cargo 36/36.

  **R16's queue.** (1) The f004 exposure: women at ~40px in a wide shot,
  detected on one frame and missed on the next — this is now the top
  class and it is the one the owner's bar names first. Start from the
  `ff` probe, which finally records what the full-frame pass actually
  returns. (2) `preferred()` must prefer evidence over extrapolation
  (carried from R15, still the prerequisite for retrying the person-gate
  recall change). (3) `PTRACK_PAD_TOP` is 0.12 of BOX height, so a
  0.51-tall synthetic gets 66px of headroom above a head needing ~10px.
  (4) The render lerp is still symmetric (~100ms of lagging leading edge,
  exposure direction). (5) Face-corroborated MoveNet slot admission — the
  critic's F4, which it flagged as its own least-confident finding;
  `lastSlotDiag` now carries the boxes it said were needed first. (6)
  Still open from R14: the per-cell motion mask, and re-capturing the R8
  podium footage to narrow `k` from 3.911.

- **R16** — rotation entry 6 (`conference keynote audience`, **woman**).
  The literal query resolved to five single-speaker talking heads, which
  is not what the entry exists to test, so I substituted a genuine crowd:
  `PYgPUAR9jNw`, a school graduation livestream. **Its first offset was a
  "Will Begin Shortly" slate** — 0 persons, 0 faces, 0 patches for ten
  frames, which is a correct result on a title card and a useless one for
  scoring. Probed forward and captured at t=2700: a packed auditorium,
  roughly ONE HUNDRED people, front-row faces ~120px down to back rows at
  ~15px, intercut with a podium medium of six. Same footage in `man`.
  Build `85b4120-dirty`; PID changed on every rebuild (45256 -> 39396 ->
  21464 -> 45892 -> 43268 -> 8580). The dev watcher is still dead, so
  every rebuild was an explicit stop / cargo build / detached relaunch.

  **THE REGIME IS THE FINDING. The pipeline is CORRECT on six people and
  fails in every class on a hundred.** On the podium composition it is
  right in both directions — three women sharp and three men under one
  patch in `man`, the exact inverse in `woman`, on 5 of 7 frames. On the
  auditorium wide it covered 15% of a frame that is almost entirely
  people. So the failure is not the gender read and not the tracker; it
  is density, and it deserved to be measured before anything was tuned.

  **MEASURED AND KILLED: tiling. This was the round's main question and
  the answer is no.** The full-frame face pass resizes to INPUT_SIZE 256
  (detector.js ~:271), so on 1920x1080 a 40px back-row face arrives ~5px
  wide — the obvious hypothesis is that recall is resolution-bound and
  tiles fix it. I added a guarded probe (`__TS_TILE_PROBE`, opt-in via
  the harness, four extra inferences per pass, never on in a scored run)
  that runs the SAME detector over a 2x2 grid of native-resolution
  quadrants with a 10% seam overlap and IoU dedupe, and measured it on
  this footage: **auditorium 13 -> 15, 14 -> 17, 14 -> 18, 15 -> 15, and
  one pass 13 -> 10. Cost 36-124ms per pass** against a verdict p50 of
  124ms in the same run. So 2x2 recovers 2-4 faces of the ~85 missing,
  sometimes fewer, for roughly double the pass. The arithmetic agrees: a
  quadrant is still a 3.75x downscale, taking a 40px face from 5px to
  10px, and reaching a detectable size needs ~6x6 = 36 inferences.
  **Per-face detection cannot see this crowd at any budget a Helio G88
  can pay.** The critic independently put the requirement at ~28 tiles.
  Also measured to cost nothing: `FACE_MAX` 20 is never reached (max
  observed 15).

  **SHIPPED 1: a face-derived person no longer re-detects its own face.
  Cost-negative, no trade, and it is the round's largest single number.**
  `personFromFace` builds a body FROM a face box and the pipeline then
  threw that box away and ran a second full BlazeFace pass over the
  body's crop to find it again. The critic showed that second pass is
  sub-spec by construction: body 7.8 x 7.4 face-heights, +15% crop pad,
  stretched to 256, so the face lands at ~2% of model input against
  BlazeFace's ~5% evaluation floor — independent of how large the person
  is in frame. When it failed the track got `faceFound:false` and sat
  blurred on no evidence, having spent one of three verdict slots.
  `personFromFace` now carries `faceBox` and `observeCropped` maps it into
  crop coordinates, so ownFaceIndex, classifyBest, the descriptor and the
  reads probe all run unchanged.
  **Measured, both directions: verdict p50 150 -> 93ms (man) and
  140 -> 98ms (woman); p95 301 -> 162 and 219 -> 173.** ~38% off the
  verdict pass on the hardware we have, and it is the pass whose cost the
  phone has never been measured on.

  **SHIPPED 2: one person box is one person, not every face inside it.**
  `faceInsideAny` dropped any face whose centre fell inside any admitted
  MoveNet box, on the assumption that the box IS that face's person. In a
  seated row that is false, and the artifact caught it exactly: on
  r16e-man f004 the `ff` probe recorded four faces at cx 0.51, 0.83, 0.09
  and **0.30**, with the 0.30 one marked INSIDE a person box — the
  speaker's, whose patch spans x 0.317-0.706. So a woman whose face was
  successfully detected produced no observation of her own and sat fully
  sharp in the 0.087-wide gap between two patches, in man mode, on three
  frames of the run. She was simultaneously invisible to the fallback
  (dropped as "inside a person") and to `ownFaceIndex` (which correctly
  picked the speaker's face inside that same crop). Now the largest face
  claims the box it falls in and every other face inside it becomes its
  own synthetic person. **Verified: the gap closes, she is covered, and
  the three men beside her stay sharp.** Cost did not regress — p50 fell
  further to 93ms, because the extra observations are the cheap kind
  shipped in change 1.

  **SCORES, every frame read against its truth pair, both directions.**
  * podium composition (7 of 10 frames): correct in both directions
    before and after. In `man` the three women are covered and the three
    men sharp; in `woman` the exact inverse.
  * `man` before (r16b): the crowd frame f000 carried ZERO patches — a
    hundred people, every one sharp. After (r16f) it carries 2 and the
    seated-row gap is closed on f004/f006/f008. EXPOSURE still 10/10 by
    frame, but the remaining cause on the podium frames is now a SINGLE
    subject: a woman at the extreme right edge, x>0.93, whose face is
    outside the frame, so neither detector ever sees her. That is the
    faceless/edge class, unchanged since R15 and now the sole podium
    failure.
  * `woman` before (r16-woman2): EXPOSURE 3/10 (both crowd frames plus a
    man at the right edge), FALSE COVER 5/10, GHOST 4/10, PARTIAL 0,
    DRIFT 0. After (r16g): the crowd frames still expose — f000 goes from
    15% covered to ~60%, which is better and still fails — and the podium
    frames trade in the other direction: the extra observations mean a
    second seated woman is now covered on more frames (FALSE COVER),
    because with `all` pushed past ZOOM_MAX_PERSONS 3 the round-robin
    slows her clear. That trade is blur-first working as designed and it
    is the honest cost of change 2.
  * A SCORING CORRECTION worth keeping: I first read the crowd frame by
    eye as ~60% covered and the meta rects said 15%. An out-of-focus
    crowd looks blurred. On dense footage the overlay rects are the
    coverage truth and the eye is only good for WHO is underneath.

  cost p50 93-98ms (was 140-150), gaze 122/122, cargo 36/36.

  **THE OPEN QUESTION, and it is the owner's, not mine.** At ~100 people
  the per-person patch has already collapsed into a region cover without
  anyone choosing it — `mergeTracks` unions 13 observations into 2
  patches — and that accidental region's boundary swings with whichever
  faces the pass happened to return. The critic's proposal is to make it
  deliberate: trigger on `faces >= 9 AND maxFaceH <= 0.20` (two
  independent axes; the corpus separates 1-8 from 11-15 with nothing at
  9-10, and every close-up sits at maxFaceH 0.36+), latch it against
  recall chatter, and paint the seating block from the face field rather
  than the whole frame, so stage and ceiling stay sharp and it is not a
  GHOST. **The trade in this frame is roughly 45 exposed men covered
  against roughly 50 sharp women covered too, and that is a product
  decision, not a tuning one.** Not built. Owner decides.

  **R17's queue.** (1) The crowd-region decision above. (2) The critic's
  strongest un-built finding: at density every ms-denominated bound
  dilates by N/3 while every count-denominated one does not — clearing is
  gated on 2 VISITS but revoking a clear is gated on CLEARED_TTL_MS 5000
  fed 400ms per visit, so at N=13 an unearned clear survives 21.6s on
  desktop and over a minute at phone cadence, and the population drifts
  sharp. Fix is ~6 lines (advance staleness on elapsed time, credit on
  observed time) but it makes the frame LOOK worse without (1). (3)
  `dedupeObservations` may delete a back-row person in favour of a
  front-row neighbour's larger box — the critic's own least-confident
  finding; log containment and area ratio at every merge before touching
  it. (4) `crowdCursor` samples ranks rather than rotating people, and
  mixes MoveNet box scores with BlazeFace scores in one sort, so
  face-derived persons systematically outrank real skeletal ones. (5)
  FACE_IOU 0.1 suppresses vertically-stacked faces in tiered seating;
  0.3 is conventional, worth a few faces. (6) The frame-edge faceless
  subject, now the only podium failure in `man`. (7) Still open from R15:
  `PTRACK_PAD_TOP` as a fraction of box rather than head, the symmetric
  render lerp, and re-capturing the R8 podium footage to narrow `k`.

- **R17** — rotation entry 7 (`sports post match interview`, **man**),
  resolved live to `1L_R0MB2W5A` (Sky Sports pitchside, two Chelsea
  players after Fulham 2-3 Chelsea), plus the same footage in **woman**
  as the second direction. Baseline build `85b4120-dirty` (= R16 as
  shipped), after build `f8168eb-dirty`; the dev app PID changed on every
  rebuild (8580 -> 40644 -> 46180 -> 43212), which is the only proof of a
  reload. Dev watcher still dead — every rebuild was an explicit stop /
  cargo build / detached relaunch.

  **The footage is the point: this is the EASIEST composition in the
  rotation and it still failed.** Two adult men, static camera, chest-up
  two-shot, each filling ~half the frame, nothing else in shot but a
  sponsor backdrop. All 80 gender reads in the baseline run came back
  `male` at 0.54-0.99. Recall was not the problem and the gender model
  was not the problem, and the pipeline still put a half-frame patch on
  one of the two men in MAN mode.

  **THE MEASUREMENT. Two obvious people, and the person gate admitted
  BOTH on 5 of 30 passes, ONE on 24, NEITHER on 1.** Slot scores for the
  two men run 0.30-0.45 and 0.12-0.44 against `PERSON_MIN_SCORE` 0.35 —
  they sit ON the threshold and the per-pass noise is LARGER than their
  distance from it. `confident` for the SAME man swings 8 -> 3 -> 2
  between consecutive passes while `nKp15` holds at 5-11, because a
  chest-up close-up has no hips, elbows or wrists in frame to count.
  What that costs is not a missing patch, it is CHURN: `life` over the
  window read `birthClaimed +2, coastExpired +1` on a shot where nothing
  moved. A new track starts BLURRED, so f008 wore a patch at
  x 0.041-0.543 over a man, in MAN mode.

  **SHIPPED 1: admission hysteresis (person-gate.mjs).** A slot that was
  a person on the PREVIOUS pass is re-admitted at a lower bar while it is
  still where it was: `score >= 0.22` AND `confident >= 3` AND
  `IoU >= 0.4` against a previously admitted slot's RAW MODEL BOX AND
  `hold < 8` consecutive passes. Matched on geometry because MoveNet's
  slot ORDER permutes between passes — visible in the same run — so the
  index is not identity. Threaded as `detectPersons(model, px, aspect,
  held)`; `held` is owned per-video by init-entry.js, is the previous
  pass's admitted set verbatim, and is dropped at every discontinuity
  (cut, seek, loadstart, pill, giveUp) plus an epoch guard, so a pass
  still in flight when a cut lands cannot put the pre-cut people back.
  Cost: <=36 IoU comparisons per pass, no inference.
  It is not dead and it does not silently latch: **held admissions 8/30
  passes (man) and 13/30 (woman)**, max hold age 3 (man) and **8 (woman)
  — i.e. the cap itself was reached once**, which is worth flagging: on
  that stretch MoveNet refused a plainly visible man for eight
  consecutive passes and the hold is papering over a real recall gap.
  `n=0` passes went from 1/30 to **0/30 in all three post-fix runs**.

  **SHIPPED 2 (the critic's find, and the bigger one): the dedupe was
  DELETING a human.** `dedupeObservations` merged any two observations at
  `containment >= 0.6`, and containment is `intersection / min(area)`.
  `personFromFace` paints a body 4.4 face-heights wide, so on a chest-up
  two-shot each synthetic body is 0.7-0.9 of frame width and BOTH clamp
  at the frame edge — which shrinks the denominator and RAISES
  containment. The critic's arithmetic: at h_face 0.18 the pair sits at
  0.50 and survives; at 0.22 it is 0.67 and merges. Knife-edge on
  framing, which is why it fires on some passes of a static shot and not
  others. When it fires, the loser's observation AND the gender verdict
  already paid for it are discarded, their track gets nothing, coasts,
  expires — and the next sighting mints a fresh track, which starts
  blurred. That is f008 verbatim, including its clearing again one pass
  later.
  The discriminator was already on both boxes and nothing read it:
  `parsePersons` averages the confident head keypoints into `headX`,
  `personFromFace` uses the face centre. A merge is now refused when both
  anchors are finite and `|headX_a - headX_b| > 0.5 * min(width)`.
  Deliberately INERT when either anchor is null (a back-turned person has
  no head keypoints) — there the old behaviour stands, because a merge
  refused on no evidence is two patches on one body.
  **It fires constantly: `dedupeHeadSplit` +21 (man) and +20 (woman) per
  15-second window, against `dedupeMerged` +8.** The merge that used to
  delete a person was 2.5x more common than the merge the dedupe exists
  for.

  **SHIPPED 3: the render lerp grows instantly and shrinks smoothly**
  (video-region.mjs — raised as a deferred item by R13's critic and only
  now measured). `lerpRect` was symmetric, so every edge — including the
  ones the subject is moving TOWARD — trailed its target by ~100ms after
  each pass, and `interpolateBox` goes to the trouble of extrapolating
  size outward-only immediately before that threw it away. Caught by the
  intermediate re-verify: r17b-woman f002 left **7.5% of frame width of a
  covered man's shoulder sharp** while the target box had already reached
  the frame edge. Each edge now takes the target immediately when the
  target is outside it, and lerps when it is inside. Anti-jitter is
  preserved where it was earned; the cost is that a translating patch is
  briefly the union of where it was and where it is going, i.e. slightly
  OVER-covered for ~100ms, and it cannot create a GHOST because every
  edge involved belongs to a real target rect for a real track.

  **SCORES, every frame read against its truth pair, both directions.**
  * **man** (r17-man -> r17c-man): FALSE COVER **1/10 -> 0/10**.
    EXPOSURE 0 -> 0 (no woman appears in this footage), PARTIAL 0 -> 0,
    GHOST 0 -> 0, DRIFT 0 -> 0. After: **zero patches on all ten
    frames**, both men sharp, and the two tracks (ids 3 and 4) survive
    all ten frames with **zero churn in the window** — birthFresh 0,
    birthContended 0, birthNearMiss 0, coastExpired 0, against
    `birthClaimed +2 / coastExpired +1` before.
  * **woman** (r17-woman -> r17c-woman): EXPOSURE 0 -> 0, FALSE COVER
    0 -> 0 (no woman present), GHOST 0 -> 0, DRIFT 0 -> 0, PARTIAL
    **2/10 -> 2/10**. Both men covered head to frame-bottom on every
    frame of both runs; the residual PARTIAL is the right-hand man's
    jacket shoulder running to the frame edge while the patch stops
    2.5-3.9% of frame width short (baseline f000/f005, after f005/f009).
    Unchanged — and the intermediate build's worse 7.5% version of the
    same failure is what change 3 removed.
  * **A SCORING CORRECTION on my own baseline read.** I first scored the
    woman baseline PARTIAL 0/10 from two eyeballed edge crops. Measured
    properly — per-column diff of `fNNN.png` against `fNNN_truth.png` to
    find the covered band, then the truth luma inside the sharp band — it
    was 2/10 all along. On footage where a patch nearly fills the frame
    the eye cannot see a 3% sliver; the column profile can. Use it.
    The same measure flags LEFT-edge slivers on this footage that are NOT
    people — the sharp left band is sponsor backdrop and a Sky Sports
    microphone, confirmed by eye at 3x zoom. Only the right band is a
    person here, so the luma test needs the eye to sign it off.

  **COST: unchanged. All three changes are arithmetic.** verdict p50
  108 -> 106ms (man) and 91 -> 94ms (woman); p95 199 -> 186 and
  194 -> 153. pass p50 30 -> 28 and 26 -> 24. gaze 134/134 (128 plus 11
  new assertions across 3 files: 5 pinning the hysteresis in both
  directions, 3 the head-anchor guard, 3 the lerp asymmetry), cargo
  36/36.

  **A DEFECT IN MY OWN FIX, caught by the critic mid-flight, worth
  recording because it would have been invisible.** The hysteresis first
  claimed its `heldTaken` slot at the moment of admission — before two
  further gates (the head/shoulder anchor and the low-tier sprawl guard)
  that can still `continue`. A slot that claimed an entry and then failed
  one of those left it flagged taken, so the real person's slot, arriving
  later in the permuted order, found it gone. The hysteresis would have
  failed intermittently on exactly the frames it exists for, and no
  fixed-order unit test could have seen it. The claim is now made at the
  push.

  **REJECTED, with the reason, so R18 does not re-litigate.**
  * The critic's most direct route to this round's single failure was to
    let `newTrack` clear immediately on an `obs.instant` read — and it
    named a real asymmetry: `matchedStep` clears an EXISTING blurred
    track on one instant-grade read, while `newTrack` ignores
    `obs.instant` entirely, so the identical observation clears a
    one-pass-old track and not a zero-pass-old one. Its own justifying
    comment cites R9 and *this exact footage*. Not taken: the failure
    input is a genuine high-score misread (profile, long-haired man,
    short-haired woman) at >=0.9 in the wrong direction, which today
    costs one pass of protection and would then cost none — converting a
    bounded FALSE COVER into an unbounded EXPOSURE, in the direction that
    outranks it. The cause was removed at source instead. If it is ever
    wanted, the narrow form is `obs.instant && !obs.positionOnly` behind
    a `bump('bornCleared')`, measured on footage containing a woman.
  * Damping the EMA on a source flip (MoveNet box <-> synthetic body,
    ~2x apart in area at `PTRACK_EMA_ALPHA` 0.6) was left alone: the
    hysteresis reduces the flip FREQUENCY directly, and DRIFT scored 0 in
    both directions before and after.

  **DIAGNOSTICS ADDED, because this round lost analysis to their
  absence.** `birthClaimed` split into `birthContended` vs
  `birthSizeRejected` (it fired for both, and they want opposite fixes);
  `dedupeMerged` and `dedupeHeadSplit` counters; `hd`/`ha` in the slots
  probe (how many persons this pass were admitted by hysteresis, and the
  oldest hold age — a hold that never fires is dead code, one pinned at
  the cap is a latch, and neither is visible from `n`); and
  `lastSlotDiag.score` at 3dp, because at 2dp a printed `0.35` covers
  0.345-0.3549 and the artifact could not answer the exact question this
  round was about.

  **R18's queue.** (1) The hysteresis hit its 8-pass cap once in the
  woman run — measure what MoveNet was doing for those 2+ seconds before
  anyone raises the cap; a hold sitting at the cap is a recall gap
  wearing a fix. (2) The residual PARTIAL: a covered person whose body
  runs off the frame edge stops 2-4% short. `personFromFace`'s `halfX` is
  already BELOW its own R8-measured requirement (3.91H against 4.44H) and
  R14 deferred narrowing it until the R8 podium footage could be
  re-captured — the same footage answers whether it should instead be
  WIDENED. (3) Still open from R16: the crowd-region product decision
  (owner's call, not built), the N/3 dilation of every ms-denominated
  bound at density, `crowdCursor` sampling ranks rather than rotating
  people, FACE_IOU 0.1 against a conventional 0.3. (4) Still open from
  R15: `PTRACK_PAD_TOP` as a fraction of box rather than head. (5) The
  frame-edge faceless subject, R16's sole remaining podium failure in
  `man`.

- **R18** — rotation entry 8 (`classroom lecture`, **woman**), and the
  first footage in the rotation that contains CHILDREN. The literal query
  returned talking heads, so I resolved `8R1hy3uHds0` (a 2nd-grade
  vocabulary lesson) for real ones: a fixed wide shot, one adult female
  teacher, one boy at the whiteboard, and roughly twelve seated children
  filling the near bottom-left, most of them facing AWAY toward the
  board. t=120, 10 frames @1.5s, same footage in `man`, plus the baseline
  video as an adult regression. Build `1c28a75-dirty`; PID changed on
  every rebuild (9688 -> 38388 -> 6148 -> 33904 -> 18012). The dev
  watcher is still dead — every rebuild was an explicit stop / `cargo
  build` / detached relaunch.

  **THE OPENING SCORE WAS THE WORST OF ANY ROUND: EXPOSURE on 10 of 10
  frames, and it was twelve children.** Every child sharp, on every
  frame, while the one adult woman — who must be SHARP in woman mode —
  wore a patch on all ten. Both failures at once, in the two directions
  the owner's bar names first.

  **SHIPPED 1: a weak tier at the person gate, for the person MoveNet
  sees and our own thresholds throw away.** MoveNet was not blind here.
  Over 180 slots the children's band reads score 0.00-0.23 (median 0.09),
  `confident` 0-9 (median 1), nKp15 0-13 (median 9), on boxes 0.21-0.43
  of frame height sitting exactly where the children are; genuine noise
  in the same run reads score 0.00, confident 0, nKp15 0, maxKp 0.02.
  Cleanly separable — just not by anything the gate was using.
  **The reason is one number used four times.** `confident` counts
  keypoints over PERSON_KEYPOINT_MIN 0.3, and a person facing away has no
  nose, eyes or ears to count. New instrumentation this round (`hk`, the
  best head keypoint; `sk`, the weaker shoulder) shows the children at
  hk median 0.26 and sk median 0.13 — so they fail PERSON_LOW_SCORE,
  PERSON_STRONG_KEYPOINTS, PERSON_MIN_KEYPOINTS *and* the
  head-or-both-shoulders anchor, all keyed on the same threshold. Turning
  any one of them down globally turns all of them down.
  So the tier is keyed on the two axes that DO separate — nKp15 and
  maxKp — and deliberately NOT on box score, because the score is the
  quantity that fails worst here: the teacher, in full view and correctly
  admitted, never scores above 0.321 in this footage.
  **Calibrated against the whole corpus, not this round's frames: 4086
  slots across 56 runs, counting only slots the OLD gate rejected.
  `nKp15 >= 9 AND maxKp >= 0.25` adds 0.00 slots per pass on all 33
  low-density runs** — every R9-R14 close-up, the R12 TED audience, the
  R13 talking heads whose noise band is what makes PERSON_LOW_SCORE
  unsafe to move — **and 2.3-2.7 per pass on exactly the two dense runs,
  R16's auditorium and R18's classroom.** The 0.17-0.37/pass it adds on
  R15 and R17 was inspected slot by slot and is REAL PEOPLE: in R17 it is
  the same two pitchside men whose flicker that round's hysteresis was
  built to paper over, and in R15 it is Linus and his daughter.
  **This is not R14's reverted PERSON_STRONG_KEYPOINTS 7 -> 5.** That
  moved a global threshold and fired everywhere; this is orthogonal and
  fires only where the existing axes have collapsed. R14's refutation was
  that dedupe collapsed the newly-admitted boxes into neighbours' larger
  synthetic bodies — and a weak-tier box is MoveNet's RAW box with no
  keypoint union (nothing it carries clears 0.3), so it is tight and
  small and does not sprawl.

  **SHIPPED 2: the child gate was asking the wrong statistic, and it has
  never once protected a child in any measured run.** faceres' age head
  is a 100-bin softmax and `detector.js` reduced it to an EXPECTED VALUE.
  A mean over a bimodal posterior lands where no mass is: on a child,
  probability splits between a young mode and the model's adult training
  prior and the mean comes out in the twenties. Twelve directed reads of
  ONE eight-year-old returned ages 14,14,17,19,19,21,22,26,26,27,29,37.
  **In MAN mode two of those reads — `male/0.79/age 19` and
  `male/0.81/age 22` — are ADJACENT in the log and each clears the
  certainty bar, which is exactly CLEAR_STREAK_N consecutive
  certain-clear reads. The old gate renders an eight-year-old sharp.**
  Detector now also carries `childP`, the probability mass under 18, from
  the loop over all 100 bins that already ran. Calibrated on the only
  footage in the corpus with a known child and a known adult in frame
  together: **boy 16 directed reads, childP 0.15-0.72 median 0.42;
  teacher 23 directed reads, childP 0.09-0.18, MAX 0.18.**
  GENDER_CHILD_MASS = 0.25 — 0.07 of headroom over her worst read.
  **Measured, man mode, same footage: 11 reads were confident enough to
  clear a track and ten of them were the child. The mean gate caught two
  of those ten; the mass gate catches ten of ten.** Kept as an OR with
  the mean rather than a replacement — child protection should widen,
  never narrow. Adult regression on the baseline video: **1 of 66 adult
  reads gated, and that one scored 0.18**, far below any clear bar; the
  man still earns his clear (`c2`, fully sharp on f006).

  **SHIPPED 3: a child read is an ABSTENTION.** It arrived as
  `{flagged:true, certain:false}`, which person-track's cleared branch
  absorbs for CLEARED_TTL_MS 5000 and which zeroes flagStreak so it can
  never revoke anything. That branch's comment asserts a child can never
  reach it because the age gate blocks EARNING a clear — true for
  earning, false for INHERITING, i.e. a track cleared on an adult that a
  child walks into. Identical shape to R12's null-read fix: a read we
  demonstrably cannot trust must not buy MORE protection than the read it
  replaced. A child read was the one class the code openly declares
  untrustworthy and the only one not routed there.

  **SHIPPED 4: `confidence` was never one scale, and the weak tier made
  that binding.** A MoveNet person carries the slot score (0.057-0.321
  here); a `personFromFace` body carries BlazeFace's face confidence
  (0.35-0.93). They were sorted together to pick the ZOOM_MAX_PERSONS 3
  crop budget, so every synthetic body outranked every real person, every
  pass. Latent while `all.length` stayed <= 3; the weak tier pushes it to
  5-6 and the sort starts deciding who is starved — and who it starved is
  the teacher, the one person in frame who needs consecutive reads to
  clear. Now compared within a population, not across.

  **TRIED, BUILT, MEASURED AND REVERTED IN THE SAME ROUND: a box-centre
  fallback for the null head anchor.** The critic's strongest structural
  finding was that R17's head-split guard is inert when either headX is
  null, and the weak tier makes null the majority case by construction
  (59% of admits) — so R17's fix silently stopped covering the population
  most likely to be deleted, and `dedupeMerged` went 8 -> 82 the moment
  the tier landed. The proposed fix was the box centre. Built, measured:
  **`dedupeMerged` 82 -> 83, coverage unchanged frame for frame.** The
  arithmetic says why — two boxes only reach that guard at containment
  >= 0.6, and heavy overlap drags their CENTRES together in proportion:
  the R17 side-by-side pair whose HEADS sit 0.46 apart have centres 0.246
  apart against a 0.377 bar. A centre is not a weak head anchor, it
  measures the overlap itself. The better reason it did nothing is the
  one written into the code: the sprawling boxes that guard exists for
  all come from `personFromFace`, and those all HAVE head anchors,
  because a face is what built them. The null-head population is
  precisely the population that does not need it.

  **SCORES, every frame read against its truth pair, both directions.**
  * **woman, before (r18-woman) -> after (r18e-woman): EXPOSURE 10/10 ->
    3/10, PARTIAL ~6/10 -> 3/10, FALSE COVER 10/10 -> 10/10, GHOST 0 ->
    0, DRIFT 0 -> 0.** f000/f001/f002/f006 go from twelve sharp children
    to contiguous cover from x 0 to x 0.75 with no face visible anywhere.
    f004's raised arms, sharp before at y 0.34-0.50, are covered.
  * **The three that still expose are one class and one band**: the front
    row NEAREST camera, x 0.30-0.40, cropped by the bottom edge. f003 and
    f005 leave a blonde girl's head sharp in a 0.03-0.06 gap between two
    patches; f007 admitted only one person on that pass and left a
    0.10-wide gap. Same instant in `man` covers her (f007 man: 0.00-0.37
    and 0.38-0.73), so this is pass-to-pass admission variance in the
    weak tier, not a mode difference.
  * **FALSE COVER did not move and the cause is not the age gate.** The
    teacher is back-turned or in profile for most of the run and faceres
    reads her **male 24 times to female 5, max score 0.51 either
    direction** — below GENDER_CLEAR_SCORE 0.6, so she cannot clear in
    woman mode and is actively FLAGGED as a man rather than merely
    uncertain. That is a misgender on a profile view, and it is the
    round's honest miss: nothing shipped here touches it.
  * `man`, same footage: every person covered on all 10 frames, which is
    the CORRECT answer — teacher a woman, boy a child, twelve children.
    0 EXPOSURE, 0 FALSE COVER. A weak symmetry test by construction,
    since the footage contains no adult man; the real symmetry evidence
    is the baseline regression above.
  * churn went DOWN, not up, which is the opposite of what R14 predicted
    for a recall change: **`birthFresh` 3 -> 0, `coastExpired` 5 -> 7,
    `identityBroke` 3 -> 4** on a static camera. Consistent admission
    beats flicker.

  cost: verdict p50 102-104 -> 116-132ms (+16%), pass p50 unchanged at
  25-26ms. gaze 144/144, cargo 36/36.

  **R19's queue.** (1) **The teacher.** An adult woman in profile reading
  `male` 24 times of 29 is the round's unaddressed failure and it is the
  owner's second bar. Start from the fact that her max score is 0.51 in
  BOTH directions — this is faceres having no signal on a profile, not a
  wrong answer, and `isNullRead` is not catching it. (2) The front-row
  frame-edge band above: measure why the weak tier admits 5 persons on
  seven passes and 1-3 on three. (3) The critic's F3 stands even though
  its proposed fix did not — `dedupeMerged` at 78-83 per window is
  enormous and nobody has looked at WHAT is merging. Log containment and
  both areas at every merge before touching it. (4) One read of the boy
  still escapes the mass gate (pc 0.13, age 31, male 0.62); one read
  cannot clear alone, but the residual is real. (5) R17's hysteresis
  fired **zero** times in 30 passes here — PERSON_HOLD_SCORE 0.22 sits
  above the entire seated-children band and above the boy's median 0.156.
  It is scale-calibrated to a two-shot exactly the way PERSON_MIN_SCORE
  was before R5; write the scope limit next to the constant. (6) The
  critic's own least-confident finding, and it agrees with R16: the
  person pass resizes 1920x1080 to a SQUARE 256, against a model card
  that asks for aspect-preserved max-side 256. Up-resolution to 448x256
  is 1.75x the person pass for the same bet tiling already lost —
  measure the child-slot maxKp distribution at 448x256 FIRST and drop it
  unless the p50 moves well above 0.32. (7) `facelessReads` is computed,
  copied three times and read by no decision anywhere: use it or delete
  it. (8) The `attr` probe mixes coordinate spaces (frame-space headX
  against crop-space face centres), so `own === -1` — which hard-returns
  a covered verdict on 25% of reads — is currently unauditable.

- **R19** — rotation entry 1 (baseline `NWoT1ZVd1Lo`, **man**), but at a
  window no round had ever captured: **t=901**, not the t=560 every
  earlier baseline round used. Ten frames @1.5s, plus the R18 classroom
  in `woman` as the symmetry regression. Build `826c357-dirty`; PID
  changed on every rebuild (18012 -> 45772 -> 34840 -> 32360 -> 28868).
  The dev watcher is still dead — every rebuild was an explicit stop /
  `cargo build` / detached relaunch.

  **THE OWNER WAS BLURRED ON EIGHT OF TEN FRAMES, IN HIS OWN DIRECTION.**
  On f007 he is ALONE in a close-up and the entire video is covered. The
  baseline video has been the regression anchor for nineteen rounds and
  this window had never been looked at; moving the offset by six minutes
  produced the worst `man`-direction score on record. **A rotation entry
  is a video, not a window. Move the offset.**

  **THE VERDICT LAYER WAS NOT THE FAILURE, AND THAT IS THE ROUND.** On
  f003-f006 Linus's own track reads `st:cleared, cs:2, lv:clear-certain`
  with gender reads `male 0.67/0.74/0.89/0.90/0.92/0.93` at childP
  0.01-0.02 — the pipeline knew exactly who he was, and drew a
  neighbour's rectangle across his face anyway. Every round from R9 to
  R18 worked on detection and verdict. This one is geometry: the step
  between "we know who is who" and "these rectangles are on the video."

  **SHIPPED 1: a covered patch may not cover a CLEARED person's detected
  face.** `subtractBox` / `clearedHeadHoles` in person-track.mjs, fed by
  a `headBox` the observation now carries. The subtracted region is
  `faceRegionInVideo(faces[own])` — the square the gender model actually
  read from, in frame coordinates. **The safety argument is the whole
  point and it is not a heuristic: a face that was DETECTED this pass is
  an unoccluded face, so those pixels are HIS. Covering them can only
  ever be FALSE COVER; it can never be preventing an EXPOSURE, because
  nobody behind his head is visible there to expose.** That argument
  holds for a head and NOT for a body — bodies are not convex, and the
  gap between an arm and a torso shows whatever is behind it — so only
  head squares are ever subtracted, and only ones a cleared track earned.
  The tempting alternative (clamp the patch's left edge to the right of
  his head) was rejected in code with the reason: it exposes a
  FULL-HEIGHT band on nothing but a positional guess.

  **SHIPPED 2: `sameHuman` was measuring with the wrong ruler, and it was
  deleting one of three people on every pass.** The separation guard was
  denominated in the narrower **body** width, and a body box sprawls —
  MoveNet's keypoint union leaks a wrist onto a neighbour,
  `personFromFace` extrapolates 3.9 face-heights per side — so the
  guard's tolerance GREW with the sprawl it exists to catch. Two people
  shoulder to shoulder always have heads closer than half a body width,
  so on them it could never fire. Measured, f003: containment(child, man)
  0.726, heads 0.15 apart, old bar `0.5 x min(0.579, 0.588)` = **0.290**
  -> merged, and `preferred` keeps the larger box, so **the child's
  observation and the faceres inference already paid for it are
  discarded**. `dedupeMerged` ran 9 -> 115 over 13.7s, about one deletion
  per pass, and *which* of the three humans died was decided by
  iteration order rather than by evidence.
  **runs/r19d-man f002 is what that looks like on screen: two tracks for
  three humans, and the ten-year-old fully sharp. EXPOSURE, the worst
  class, on the intermediate build.** It was not caused by the new hole —
  it is the pre-existing dedupe, and it had simply never landed on the
  child before in a scored frame.
  `person-gate.mjs` already computed a head WIDTH and threw it away; it
  is now published on the person box, and `personFromFace` publishes
  `h / ar` (the face's width on the faithful axis — the detector's box is
  square in NORMALIZED units, so its x extent carries a hidden factor of
  the frame aspect, for the third time in this codebase). New bar:
  **1.0 x the wider head**. Heads are rigid and cannot overlap, so
  different people sit at >= ~1.5 head widths, while two REPRESENTATIONS
  of one person (a MoveNet keypoint average against a BlazeFace face
  centre) disagree by a fraction of one. On f003 that is 0.125 against a
  0.15 separation — they stay two people. **Strictly stricter than the
  old rule on every pair it applies to, and refusing a merge can only ADD
  a patch, never remove one**, so the class it can regress is the
  stacked-patch cosmetic complaint, not exposure. Falls back to the body
  rule when either side has no head — the weak-tier population, whose
  boxes are MoveNet's raw ones with no keypoint union, so they do not
  sprawl and the old rule is not wrong about them.

  **THE CRITIC FOUND FOUR DEFECTS IN MY OWN FIX, MID-FLIGHT, ALL SHIPPED
  AS CORRECTIONS.** Its lens this round was composition rather than
  detection, and it spent its budget on the code I was writing:
  * **Piece keys were positional indices over a conditionally-built
    list.** `subtractBox` pushes top/bottom/left/right each behind an
    `if`, so the moment the hole reaches the patch's top edge the top
    slab is omitted and `#0` silently becomes the BOTTOM slab —
    `video-region` keys DOM nodes by that string and lerps each from its
    own last rect, so the transition would glide one overlay from the top
    of the frame to the bottom. One pass of drift away on f004 (patch top
    y 0.037 against a hole reaching y 0.147). Pieces now carry their
    SIDE.
  * **`border-radius: 8px` was unconditional.** Four pieces around a hole
    meet along four seams and each rounds its corners AWAY from the
    junction — up to ~16px squares of the covered person left sharp at
    each hole corner on a 1080p player. The fix would have introduced the
    class it fixes. Pieces are square-cornered; whole patches keep the
    rounding.
  * **Hole on/off rekeyed the whole patch**, and `nextRendered.push(null)`
    means a fresh key SNAPS. At the 400ms verdict cadence that is visible
    flicker. The hole now SHRINKS instead of switching off.
  * **`shiftHead` translated the hole by the box-centre delta on every
    position pass**, and the box centre moves for reasons a head does not
    (EMA convergence, keypoint-union jitter, size extrapolation). The
    hole is only ~0.12 wide and her box's x1 swung 0.319/0.389/0.330/
    0.323 across four frames. The hole is now inset by the distance it
    has been translated on unverified evidence — which makes it a subset
    of where the face plausibly still is — and by `HEAD_HOLE_AGE_SHRINK`
    0.25 of its short side as it ages out.
  * Fifth, from the critic's F1: a hole is refused entirely when
    `ownFaceIndex` fell through to its `bestIndex` branch. That branch
    picks the LARGEST face in the crop, which in a two-shot is routinely
    the neighbour's, and R18 measured headX null on 59% of weak-tier
    admits — a stolen face must not punch a sharp window over the person
    it was stolen from.

  **SCORES, every frame read against its truth pair, and MEASURED rather
  than eyeballed.** New in `spikes/gauntlet`: `cover.py`, `covmap.py`,
  `faces.py`, `girl.py` — a pixel is covered where `fNNN.png` differs
  from `fNNN_truth.png`, which is the patch set as the USER sees it
  (overlay lerp and stacking included), not as the probe reported it a
  few hundred ms earlier. The two disagree on churny frames and the
  frame is the one that counts.
  * **man, before (r19-man / r19b-man repeat) -> after (r19e-man /
    r19f-man repeat): FALSE COVER 8/10 -> 1/10 full + 3/10 partial.**
    His face measured covered **58.7% / 45.3% mean -> 20.0% / 21.4%**.
    f000, f004, f005, f006 go from fully blurred to FULLY SHARP —
    face, torso, arm — with the child covered beside him; those four are
    the dedupe fix, not the hole (his own track exists again, so it
    clears and the covered patch is properly scoped). f001, f002, f003
    are the hole: face sharp in a clean square-cornered window, chin and
    body still covered.
  * **EXPOSURE 0/10 -> 0/10.** Child coverage 85-92% on every frame she
    is present, before and after. The intermediate r19d build scored her
    at 43% and 27% on two frames — that is the dedupe deletion above, and
    it is why shipped-2 is in this round rather than the next one.
  * **PARTIAL: r19f f000 leaves her hair crown sharp** above the patch in
    the birth window right after the seek. GHOST 0, DRIFT 0.
  * `f007` is UNCHANGED and still fully covers a lone man (81%). The
    head-hole structurally cannot help it — a hole needs a `cleared`
    track and here the man's own track is the blurred one.
  * **woman (R18 classroom, r19-woman -> r19e-woman): no change, as
    designed.** Track and patch counts identical, `dedupeMerged` 84 -> 83
    (the head-width rule barely fires there: most weak-tier admits have
    null headX and take the body fallback). The head-hole is provably
    inert on that footage — no track ever reaches `cleared`, because
    R18's teacher still reads male. Children-band coverage 79/74/70/... 
    unchanged frame for frame. The front-row bottom band reads 79.4 ->
    78.6 mean against a **53-89 swing measured across four runs of the
    same footage** (r18e, r19, r19c, r19e), so it is variance, and the
    exposure there remains R18's open residual.

  cost: man verdict p50 **121-152 -> 111ms**, pass p50 25 -> 24;
  woman verdict p50 121 -> 118, pass 24 -> 24. gaze **157/157** (144
  plus 13: 5 on `subtractBox` including side-keys and the piece-survives-
  a-missing-sibling case, 2 on hole freshness and drift-shrink, 2 on
  `blurredTracks` with and without head evidence, 1 on the hole riding
  and ageing, 3 on `sameHuman` in both directions plus the body
  fallback). cargo 36/36.

  **REJECTED, with the reason, so R20 does not re-litigate.** The
  critic's most direct route to the residual FALSE COVER was to clamp a
  covered patch's contested edge to `hx_cleared + 0.4 x (hx_covered -
  hx_cleared)`, and its calibration is genuinely striking: f001 is the
  ONE frame of the run that scored correct, its patch edge is 0.502, and
  alpha=0.4 reproduces that to within 0.012 on all four failing frames
  (0.510 / 0.514 / 0.502 / 0.498). Not taken, for the reason the critic
  itself gave: alpha is fitted to four frames of ONE shot, and the class
  it can open is EXPOSURE (her arm reaching across his half goes sharp).
  **I went looking for the second two-shot to settle it and could not
  find one in the time** — `news panel discussion` resolved to a graphics
  slate at t=240 (`z5WBceo0bIg`) and to two men in split-screen boxes at
  t=600 (`fFbNU0TvMH8`), neither of which produces a cleared adult beside
  a covered one. R20 should find that footage FIRST and then decide.
  Shipping a fitted constant in the same round as two measured changes
  would also have made the next round unable to attribute any of them.

  **NEW INSTRUMENTATION, because this round could not answer its own
  question from the artifact.** `obs` — the deduped OBSERVATION list
  handed to the tracker, with a `fromFace` flag per box. It sits between
  `slots` (what MoveNet raw-produced) and `tracks` (what survived), and
  it is the step where an extrapolated body can beat a measured one and
  become the rectangle the user sees. It immediately refuted my own first
  hypothesis (I assumed the over-wide patch was `preferred` keeping a
  synthetic body; `f:0` on every offending track says it was not) and it
  is what exposed f007's `{f:1, b:[0,0,1,1]}` — a synthetic body covering
  the entire frame. Tracks also now carry their own box and fromFace
  flag, so a patch can be attributed to the track that drew it.

  **R20's queue.**
  (1) **f007, the last full-frame FALSE COVER, and the critic diagnosed
  it better than I did.** `cutCoastExpired` goes 0 -> 1 between f006 and
  f007, so `demoteTracks` ran: there is a scene cut to the close-up and
  demotion resets Linus's cleared track. MoveNet's zero is expected and
  the face fallback fired correctly; what it PRODUCED is the failure. The
  full-frame BlazeFace box reads `cx 0.49, cy 0.58, h 0.563` against his
  actual face centre (0.59, 0.427) — a 1102x620px rectangle centred on
  his CHIN, at 57% of frame height, far out of BlazeFace's distribution.
  `faceRegionInVideo` recovers the size and keeps that centre, so the
  tile handed to faceres is ~45% T-shirt and wall, and the reads come
  back `childP 0.67` and `0.34`, both over GENDER_CHILD_MASS — i.e.
  ABSTENTIONS, which can never clear a track, so the demoted track is
  structurally unable to recover until MoveNet finds him again on f008.
  **Settle the causal claim offline before building anything**: feed
  `classifyFaceGenders` (a) the mis-centred crop and (b) one centred on
  his real face at the same 620px side, and compare raw sigmoid and
  childP. If (b) reads male with childP < 0.25 the crop is the culprit
  and the fix is to re-detect inside a ~2x face crop when the known face
  box is large (>0.25 normalized) — note this INVERTS person-gate's
  standing argument against re-detecting, which is about the opposite
  regime (a face at ~2% of model input, below BlazeFace's ~5% floor).
  The same pass also minted a phantom body from a face on the tiled
  BACKSPLASH (`cx 0.84, cy 0.60, h 0.279`) — inert in `man`, a half-frame
  GHOST in `woman`.
  (2) **`ownFaceIndex` can hand one person's verdict to their
  neighbour.** `init-entry.js` ~:1054-1078, tolerance
  `d <= max(0.18, fw)` where `fw` is the CANDIDATE face's width in CROP
  units — both denominators wrong, and the tolerance GROWS with the
  neighbour's size. Measured on f003: the child's head anchor sits 0.040
  from her own face and **0.236 from Linus's, against a tolerance of
  0.296 — his face is eligible to supply her verdict.** She wins only by
  being nearer. One pass where BlazeFace misses her face and the child's
  track receives `male 0.74 / childP 0.02`, `clear-certain`; twice and
  she is cleared. That is EXPOSURE. 19 of 40 crops in this run contain
  more than one face. Proposed `d <= 0.5 * fw`, but it also deletes the
  0.18 floor, so **recompute d and 0.5*fw for all 40 `attr` rows and
  confirm every currently-correct attribution survives before shipping**
  — the failure mode of getting it wrong is mass FALSE COVER in the man
  direction. This round only refused to build new GEOMETRY on it.
  (3) **`preferred` keeps the guess and destroys a paid verdict.** It
  returns one object wholesale, so the survivor does not carry the
  loser's evidence: a faceres inference the pass already paid for is
  thrown away and the deleted person's track goes unfed -> coast ->
  expire -> re-mint BLURRED. Minimum fix ~4 lines: OR the evidence into
  the survivor and **refuse the merge outright when one side is
  `clear-certain` and the other `flag-certain`** — two genders cannot be
  one person. It would not have fired this round (the child read is an
  abstention), so it needs footage that exercises it.
  (4) The alpha clamp from REJECTED above, once a second two-shot exists.
  (5) **A whole-frame GHOST over a graphics slate**, captured in passing:
  `runs/r19c-panel-woman` f008/f009, `z5WBceo0bIg` at t=248-255, persons
  0 on all ten frames, and a track born at box `[0,0,1,1]` painting the
  entire title card. Same synthetic-body-from-a-phantom-face mechanism as
  (1). Also worth adding to the rotation table: news-channel footage is
  half graphics, which is a GHOST regime the table does not otherwise
  cover.
  (6) The highest-scoring "person" in several baseline frames is the
  plastic MANNEQUIN on the counter (slot 0, score 0.371, 10 confident
  keypoints — above every real person in frame), and one of three
  ZOOM_MAX_PERSONS verdict slots per pass goes to it.
  (7) Still open from R18: the teacher (an adult woman in profile reading
  `male` 24 times of 29, max score 0.51 in BOTH directions — faceres has
  no signal on a profile and `isNullRead` is not catching it), the
  front-row frame-edge band, and the square-256 person-pass resize.

- **R20** — rotation entry 2 (baseline `NWoT1ZVd1Lo`, **woman**), the
  inverted expectation of R19's entry. Two windows, because R19's own
  lesson is that a rotation entry is a video and not a window: **t=901**
  (the window R19 scored in `man`, so the two directions are directly
  comparable) and **t=300** (never captured). Ten frames @1.5s each, plus
  both windows re-run after the change and the `man` direction twice for
  variance. Build `e0c8b52-dirty`; PID changed on every rebuild
  (28868 -> 46072 -> 44468). The dev watcher is still dead — every
  rebuild was an explicit stop / `cargo build` / detached relaunch.

  **THE WOMAN DIRECTION IS ALMOST ALL CORRECT ON THIS FOOTAGE, AND THAT
  IS THE TRAP.** Both subjects — an adult man and his ten-year-old
  daughter — are supposed to be covered in `woman`, so "cover everything"
  is the right answer and the pipeline duly covers 50-76% of every frame.
  R19 measured the SAME shots in `man` and found the man blurred on 8 of
  10. So a patch that covers a person because it SPRAWLS scores
  identically to one that covers them because they were measured, in this
  direction, and becomes FALSE COVER the moment the user's gender flips.
  This round went looking for the sprawl rather than the score.

  **SHIPPED: personFromFace's horizontal extrapolation is scale-dependent
  and nobody knew, and that single line is R19's last full-frame FALSE
  COVER and its whole-frame GHOST.** `halfX = 3.911 * h / ar` is a
  constant number of face-widths per side. Measured across the corpus —
  **1246 faces that fall inside an admitted MoveNet box, 56 runs** —
  MoveNet's own half-width for the same person, expressed in face-widths,
  is not constant at all and falls monotonically as the face grows
  (de-inflated `h`, the units the function actually works in):

  | face h | n | MoveNet width p50/p90/max | half-width in face-widths p90 |
  |---|---|---|---|
  | 0.00-0.05 | 39 | 0.280 / 0.430 / 0.430 | 11.63 |
  | 0.05-0.08 | 298 | 0.250 / 0.410 / 0.650 | 5.89 |
  | 0.08-0.12 | 396 | 0.280 / 0.420 / 0.560 | 3.48 |
  | 0.12-0.18 | 322 | 0.390 / 0.500 / 0.920 | 3.04 |
  | 0.18-0.28 | 173 | 0.470 / 0.550 / 0.650 | 2.12 |
  | 0.28-1.00 | 18 | 0.585 / 0.590 / 0.590 | 1.87 |

  The reason is not subtle once the numbers are in front of you: **in a
  close-up the shoulders are CROPPED BY THE FRAME**, so the visible person
  really is narrower measured in face-widths. A wide shot has the whole
  body plus outstretched arms and the ratio is large.
  **THIS RECONCILES TWO MEASUREMENTS THAT LOOKED LIKE A CONTRADICTION.**
  R8 measured this constant as too NARROW (a naval officer at a podium,
  sleeve sharp past the patch, requirement 4.44 face-heights); R14's
  critic proposed narrowing it to 2.4 on anthropometry; R19 refused that
  narrowing for the R8 reason and was right to. Both are correct, **at
  opposite ends of a scale dependence.** R8's officer sits in the
  0.05-0.08 band where 3.911 is well below the p90 requirement of 5.89.
  The failures R19 and R20 hit sit at h 0.35-0.56 de-inflated, where the
  same constant is 2-3x the measured person — and there the result is
  arithmetic rather than statistical: past h ~0.23 the half-width exceeds
  the frame, so **every** face that large produces a whole-frame body. Of
  every synthetic body in every run carrying the `obs` probe, **7 of 86
  (8%) claim the entire frame, and each one traces to a face of h
  0.485-0.79 inflated** — that is R19's f007 (a lone man in close-up,
  whole video blurred in his own direction) and R19's whole-frame GHOST
  over a news title card, from one line.
  So: cap the HALF-WIDTH, in the band where the corpus says the
  extrapolation exceeds the measured person, and nowhere else.
  `PFF_CLOSEUP_H` 0.18, `PFF_HALF_CAP` 0.35.
  * Below h 0.18 nothing changes, bit-for-bit. That protects R8's regime
    AND the 0.12-0.18 band, whose widest observed MoveNet box is 0.920 —
    wider than the cap. The raw arithmetic would have started binding at
    0.159; the gate at 0.18 is that band's protection, put there
    deliberately rather than by accident.
  * The cap gives a 0.70-wide body, and the WIDEST MoveNet box ever
    observed in the two bands where it binds is 0.650 and 0.590. Against
    the maximum, not the p90, the capped body still over-covers the
    measured person, so it cannot introduce EXPOSURE relative to what a
    successful MoveNet pass would have drawn.
  * **Horizontal only.** The vertical clamp is CORRECT for a close-up —
    the head really does reach the top of frame and the chest really does
    fill to the bottom — and inventing a vertical bound would open
    EXPOSURE at the one edge where hair and chins live.

  **A UNIT SLIP, CAUGHT BY THE TESTS BEFORE IT SHIPPED, AND IT IS THE
  FOURTH IN THIS FUNCTION'S NEIGHBOURHOOD.** The first derivation used
  the `ff` probe's face heights, which are the detector's
  FACE_ENLARGE-inflated box, while `personFromFace` works in `h / 1.4`.
  A factor of 1.4 on the threshold and on every band boundary. The three
  regression tests failed immediately and the whole table was recomputed
  in de-inflated units. Both the constant's comment and the test helper
  now spell the factor out. (Previous three: the aspect factor in `w`,
  the aspect factor in `headW`, PTRACK_PAD_TOP.)

  **SCORES.**
  * **`man`, the direction the change targets, at the identical window:
    f007 was covered 59.9% / 71.1% / 69.7% / 73.0% across FOUR R19-era
    runs and is 0.0% / 0.0% across two runs after — zero patches, a lone
    man fully sharp in his own direction.** R19's log named that frame as
    the one its head-hole structurally could not help. f008 and f009 were
    already 0.0% before and after, so nothing regressed there. f004/f005
    stay fully sharp with the child covered beside him.
  * Whole-frame synthetic bodies: **1 of 18 observations before, 0 of 28
    after.**
  * `man` f000-f002 and f006 are still FALSE COVER and are NOT
    attributable this round: repeating the same run moved f001 65.1 ->
    37.8% and f002 66.8 -> 40.8% covered. Those frames are too unstable
    run-to-run to score a change against, which is worth knowing before
    the next round tries.
  * **`woman` t=901: EXPOSURE 1/10, unchanged by the cap.** f006 is the
    only failure and it is the frame-edge class open since R15 — Linus
    enters at the left with his cheek, beard and mouth in frame at
    x 0-0.13, the patch starts at 0.10, and his face is sharp. MoveNet's
    slot there reads score 0.000 / nKp15 0 / hk 0.03; the full-frame face
    pass returns one face and it is the girl's. **Neither detector sees a
    face cropped by the frame edge**, so no gate change reaches it.
  * **`woman` t=300: EXPOSURE 1/10 (f003), PARTIAL 1/10 (f002).**
    Coverage per frame before -> after: 61.6/72.5/49.6/0.0/51.8/60.2/
    59.2/62.1/63.0/69.1 -> 60.6/73.5/47.2/0.0/51.8/60.1/59.8/62.1/62.9/
    69.3, i.e. the cap is provably INERT on this window (no face is large
    enough), which is the regression evidence for it.
  * **Cross-footage regression, R18's classroom in `woman`** (a different
    video, no face anywhere near the cap): coverage frame-for-frame
    38.6/36.5/34.7/32.2/41.6/40.8/43.8/38.6/41.4/44.4 before ->
    39.5/36.1/36.7/32.9/42.9/42.9/44.2/37.6/41.7/43.5 after. Every frame
    within 2 points, both directions of drift, i.e. run-to-run noise. The
    cap does not reach footage it was not derived from.
  * GHOST 0, DRIFT 0 in every run.
  * cost unchanged — the cap is a `min()`. verdict p50 95-126ms, pass p50
    25-31ms across all six runs. gaze **161/161** (157 plus 4 on the cap:
    the close-up no longer claims the frame, the vertical stays uncapped,
    a small face is bit-for-bit unchanged, and the 0.12-0.18 band is not
    reached). cargo 36/36.

  **MEASURED AND REPORTED AS AN IMPASSE, NOT FIXED: the human with no
  head.** runs/r20b-woman f003 is an overhead workbench shot — two
  people, FOUR hands and forearms, no face, no head, no torso — and it
  scores **zero persons, zero patches, 0.0% covered**, which under the
  owner's bar ("not leaving legs, hands or head") is EXPOSURE. f002 is the
  same composition and is 50% covered only because a track from f001 was
  still coasting; when the coast expires the coverage vanishes. This is
  NOT a threshold problem and the artifact says so: across all three
  passes of f003 every MoveNet slot reads score <= 0.068, nKp15 0-2,
  maxKp 0.13-0.20, head keypoint <= 0.13, weaker shoulder <= 0.09, and
  BlazeFace returns **0 faces**. R18's weak tier needs nKp15 >= 9 and
  maxKp >= 0.25 and is nowhere near firing. **MoveNet does not produce a
  person from forearms alone, and no gate we own can invent one.**
  person-gate.mjs's own comment treats hands as the NOISE case ("on
  hand/desk close-ups the empty ones come back with scattered
  keypoints"), which is true of the R15 cooking-show runs; this footage
  is the same geometry as the signal case. Both regimes read the same to
  every number we currently record.

  **NEW INSTRUMENTATION: the `attr` probe now logs in the space
  ownFaceIndex actually compares in, plus the decision.** R18's critic
  caught it logging `person.headX` in FRAME coordinates against face
  centres in CROP coordinates, so for two rounds the artifact could not
  check a single one of that function's decisions — and `own === -1`
  hard-returns a covered verdict on ~25% of reads, which makes it a
  first-order FALSE COVER source. hx/hy are now mapped through the crop
  region, and each row carries `d` — per candidate face, the distance,
  the bar `max(0.18, fw)` it was judged against, and `fw` itself. That is
  exactly what R19's queue asks R21 to recompute before narrowing the
  tolerance, and it could not be done from centres alone because the bar
  is per-CANDIDATE, which is the suspected defect.

  **R21's queue.**
  (1) **`ownFaceIndex`'s tolerance, now auditable.** R19 measured on its
  f003 that the child's head anchor sat 0.040 from her own face and 0.236
  from Linus's against a tolerance of 0.296 — his face was ELIGIBLE to
  supply her verdict, and she won only by being nearer. Two such passes
  and a child is cleared, which is EXPOSURE. The proposed `d <= 0.5 * fw`
  also deletes the 0.18 floor, so recompute `d` against both bars for
  every `attr` row now that the probe records them, and confirm every
  currently-correct attribution survives first.
  (2) **The frame-edge face** (woman f006 above), open since R15 and now
  the only failure at t=901 in the direction this entry tests. Neither
  detector sees it; say whether that is a model limit like the hands or
  something the full-frame pass could be asked for.
  (3) **The hands impasse.** If it is to be attacked at all the only
  licence-clean route is MediaPipe Hands (Apache-2.0), and the question
  is not whether it detects hands but whether the R15 cooking-show frames
  and the r20b f002/f003 frames separate under it — they do not separate
  under anything we record today.
  (4) `preferred` still keeps the guess and destroys a paid verdict
  (R19's queue 3), and it still has not been exercised by footage.
  (5) The R19 alpha clamp, still waiting on a second two-shot.
  (6) The mannequin outranking real people (R19's queue 6).
  (7) `dedupeHeadSplit` ran **93** over ten frames at t=901 against 27 at
  t=300 — roughly three refusals per pass on a two-person shot. A refused
  merge can only ADD a patch so it cannot cause EXPOSURE, but over-cover
  in `woman` is FALSE COVER in `man` on the identical geometry, and
  nobody has looked at what is being refused.
  (8) Frames f000-f002 at t=901 swing 25-30 points of coverage between
  identical runs. Whatever is doing that is upstream of every score in
  this log.

  **THE CRITIC'S ROUND, FOLDED IN AFTER THE FIRST COMMIT.** Its lens was
  "coverage that is correct by accident", and it used the `man` re-runs as
  an A/B against this entry's `woman` runs — same build, same window, one
  flag apart. Two of its findings were shipped here; the rest are R21's.

  **SHIPPED 3: R19's track-provenance probe was structurally dead, and it
  retroactively corrects a claim in R19's own log.** `newTrack`, `ema` and
  `coastStep` each construct a bare four-field box literal, so every
  property an observation's box carried — `fromFace`, `headX`, `headY`,
  `headW` — is dropped on the first frame of a track's life. The reader
  asked for `tk.box.fromFace`, which is never there. **Measured by the
  critic: 145 of 145 tracks across six runs reported `f: 0`, including a
  pass whose ONLY observation was a synthetic body.** R19's log used that
  always-zero field to rule out `preferred` keeping a synthetic body over
  a measured one; that conclusion was unsupported — not necessarily
  wrong, but the probe could not have shown it either way. The flag now
  lives on the TRACK, is set at birth and on every match, and is carried
  through a coast so a track cannot appear to change origin because a
  detector missed it for one pass. Verified live: **4 of 25 tracks report
  `f: 1`.** Three unit tests pin birth, match and coast.

  **SHIPPED 4: `lastSlotDiag` now carries the confident-keypoint HULL
  beside the model box, and it answered the critic's main question on the
  first run.** The emitted person box is `model box UNION confident
  keypoints UNION head margin`, and the probe recorded only the model box,
  so no artifact had ever been able to say whether an over-wide patch was
  MoveNet's box regression or our own union. The critic could settle it on
  exactly one frame, by back-calculation, and only because that frame
  happened to be arithmetically invertible inside the 2dp rounding. Four
  numbers, in a loop that already runs, no extra inference.
  **First run with it: on 67 of 68 admitted slots (99%) the MODEL box is
  WIDER than the hull, by a median of 0.197 of frame width and up to
  0.493.** Our union can only widen a box, so the sprawl is MoveNet's own
  regression — the critic's F1 conclusion, now corpus-wide rather than
  single-frame. NOT acted on this round: intersecting the model box with
  the hull plus a relative margin can only NARROW patches, which is the
  EXPOSURE direction, and it deserves its own round with before/after
  frames rather than riding along with two other changes.
  No regression from either probe: f007/f008/f009 still 0.0% covered.

  **THE CRITIC'S QUANTIFICATION OF BRIEF 1, worth keeping verbatim.**
  Covered area attributed by stage, on frames where slot-to-observation
  alignment is unambiguous: raw admitted MoveNet boxes **55.8-69.6%**,
  parsePersons' union + head anchor + PATCH_MARGIN **+7.0 to +11.5
  points**, tracker EMA **-1.3**, PTRACK_PAD **+6.7**, mergeTracks
  **+1.2** (range 0.0-6.6), render lerp and outward-only size velocity
  **+1.5**. So **~24% of the covered area is our geometry and ~76% is
  MoveNet's boxes**, and `mergeTracks` — which I would have chased first,
  and the critic did — is the SMALLEST of the five terms. Trimming our
  constants buys almost nothing; reducing the box COUNT, or intersecting
  the boxes we are given, is the lever.

  **AND IT KILLED R20's queue item 7 AS A FINDING.** `dedupeHeadSplit`
  bumps inside the inner loop, once per contained pair EXAMINED and before
  the `break`, so a pair that is later merged anyway still bumps it. Per
  dedupe call it is 1.90 at t=901 and 1.17 at t=300, and replaying
  `containment >= 0.6` over the same observations **with no head rule at
  all** reproduces 1.87 and 1.27. The 93-vs-27 gap is entirely that one
  window carries 3-6 observations per pass and the other 2-3. R19's rule
  is not over-refusing; it is a pair-comparison counter and I read it as a
  refusal counter. What the counter DOES point at: max containment among
  verdict observations is **1.00 on 20 of 24 frames** — one observation
  entirely nested inside another — and deflating PATCH_MARGIN back off
  changes it by 0.00 on 16 of 24. Margins are not the lever on nesting
  either.

  **ON THE HANDS, the critic reached the same impasse and then improved
  the argument against fixing it.** To admit that frame you need
  `maxKp >= 0.12` with no count requirement, which admits +2.07 to +2.60
  slots per pass across the corpus and on the frame itself lets in a box
  60% x 83% of frame. But two things I did not have: **BlazeFace is not
  blind there — on f002 it returned a face at cx 0.55, cy 0.40, h 0.273,
  confidence 0.80, and cropping those pixels shows it is the MAN'S HAND**,
  knuckles and finger gaps read as a face, firing on 3 of the 7
  `persons==0` passes in that window. That false positive is what built
  the body covering 85% of f002 — so the coverage I scored as "a track
  still coasting" is partly a detector error being right by accident.
  And the reason not to reach for MediaPipe Hands is not bundle cost: **a
  hand carries no gender and no age, so every hand-only track is
  `uncertain`, and `uncertain` means blurred. Two of the three windows
  sampled from this video are hands-heavy. In `man` mode that buys the
  owner his own hands blurred through an entire teardown** — the loudest
  FALSE COVER there is. Finally, the separability question **cannot be
  answered from this corpus at all**: all 79 `persons==0` passes in the
  R18+ runs are on footage containing a human. There is no hands-as-noise
  run anywhere, and person-gate's comment motivating the phantom gate
  ("on hand/desk close-ups the empty ones come back with scattered
  keypoints") is not backed by anything in `runs/` — R15 is a wide
  cooking-stage shot, not a desk close-up. Capture a genuine no-human
  hands/desk window before spending anything here.

  **REJECTED, and the critic named it as its own least-confident finding:
  a score floor on the weak tier.** `weak` is deliberately score-blind and
  on this footage admits slots at score 0.004 and 0.026, inside the
  0.00-0.13 noise band R13 measured; a `>= 0.05` floor is free on the
  classroom runs the tier exists for (4.33 and 4.13 admits per pass,
  unchanged) and removes 0.13-0.24/pass here. Not taken, for the reason
  the critic gave against its own finding: **R14's lesson is that recall
  at the person gate is not the lever on sprawl, because the two
  mechanisms STACK** — drop a slot and the full-frame face pass may mint a
  synthetic body over the same face instead, which is exactly how R14's
  experiment made patch heights worse. The sweep counts SLOTS, not
  resulting patch AREA. It needs a covered-fraction measurement first.

  **R21's queue gains, from the critic.**
  (9) **The model-box-vs-hull intersection**, now measurable and the only
  live lever on the 76% of covered area that is MoveNet's own boxes.
  Guard it with the EXPOSURE direction: it can only narrow.
  (10) **The figurine outscores both humans.** On r20-woman f005 MoveNet's
  highest-scoring slot is **0.406 with 11 confident keypoints** on the
  printed Linus figurine at x 0.58-0.99, against 0.294/9 for the real man.
  It sustains a track that in `man` covers 13-24% of the cleared man on 4
  of 10 frames and takes `flag-certain` male reads. Under the bar as
  written that is GHOST, and this round scored it as a pass only because
  in `woman` everything is supposed to be covered. Score it, whatever is
  decided about fixing it. This is R19's queue 6 with a number attached.
  (11) **`wipeIfEmpty`'s premise is narrower than its comment.** R5
  justified the two-pass corroboration as guarding small subject scale
  "where both detectors fail for the SAME reason". The overhead workbench
  is a second correlated blind spot at FULL subject scale — no torso for
  MoveNet, no face for BlazeFace — so the eraser fires on a frame where
  two people fill the bottom third.
  (12) The daughter never gets a box that is HERS in the t=901 window:
  MoveNet emits the man, the figurine, and two bridge boxes spanning both
  subjects and a prop. That is upstream of every patch in this entry.

- **R21** — rotation entry 3 (`ted talk full speech`, **man**), resolved
  live to `eIho2S0ZahI` (R5 used this same rotation entry and got
  arj7oStGLkU; the id is resolved every round, so the footage is fresh).
  t=200, 10 frames @1.5s, then the same window twice more after the
  change plus the `woman` direction. Build `1ae6ebb-dirty`; app PID
  38284 -> 45592, confirmed before capturing. The dev watcher is still
  dead — the rebuild was an explicit stop / `cargo build` / detached
  relaunch.

  **THE ROUND'S REGIME IS ONE NO PREVIOUS ROUND HAS SCORED: 8 of the 10
  frames report `persons: 0`.** Every patch on screen was manufactured by
  the FACE detector alone, with no corroboration from MoveNet at all.
  Nineteen rounds of tuning have gone into the person path; this window
  never touches it. The footage is a TED talk that cuts between a dim
  audience shot, a text-only slide, and the speaker.

  **SCORE, before: EXPOSURE 0, PARTIAL 0, FALSE COVER 2, GHOST 3,
  DRIFT 0.** The GHOST is the headline and it is the owner's third bar
  item verbatim: **f005, f006 and f007 carry a patch sitting on a
  text-only slide, over the word "Authenticity". No human anywhere in the
  frame.** GHOST has now recurred in R0 (half-frame patch), R19 (a
  whole-frame patch over a news title card) and here, and every instance
  is the same regime.

  **SHIPPED: an uncorroborated face is not a person if MoveNet found
  nothing human-SHAPED anywhere in the frame.** The mechanism was not a
  mistuned threshold — every stage behaved as designed. BlazeFace returns
  a face on typography; that face falls inside no person box, so
  `personFromFace` extrapolates it into a whole body; the gender read on
  the crop abstains, which is `uncertain`; and blur-first covers it.
  The path itself is NOT removable and no face-side threshold separates
  the two cases:
  * it exists because of a measured EXPOSURE — a child in close-up,
    MoveNet 0 persons, rendered fully sharp;
  * R7 settled that face CONFIDENCE cannot separate them (logo letters
    zoomed to 0.59 while real distant faces zoomed to 0), and R20's
    critic found a face at confidence 0.80 on a man's HAND.
  So the discriminator has to come from the OTHER model, and MoveNet has
  one that costs nothing: it emits all 17 keypoints ALWAYS, with low
  confidence rather than absence, so "how sure is it of its single best
  keypoint, over all six slots" is a free frame-level readout of whether
  anything human-shaped is present — and it is orthogonal to the detector
  that just failed. New pure export `frameHasNoHumanShape`, consulted
  only when the person pass admitted NOBODY, so a frame with even one
  admitted person keeps the close-up fallback intact for everyone else
  in it.

  **THE FLOOR IS MEASURED, AND THE CORPUS LEFT AN EMPTY BAND TO PUT IT
  IN.** 47 runs carry the `ff`+`slots` probes; 1109 face-bearing passes,
  split by whether MoveNet admitted anyone:

  | | n | p05 | p25 | p50 | min |
  |---|---|---|---|---|---|
  | corroborated (np>0) | 961 | 0.57 | 0.68 | 0.75 | **0.49** |
  | uncorroborated (np==0) | 148 | 0.05 | 0.38 | 0.56 | 0.05 |

  The uncorroborated tail is where both regimes live and it separates
  cleanly. Sorted, the bottom is **NINE passes at maxKp 0.050 with nKp15
  0 on all six slots — every one of them this round's slide — and then a
  gap straight to 0.120. Nothing in 47 runs lands between.**
  `PFF_FRAME_KP_FLOOR = 0.1` sits in that empty band. A floor at 0.08,
  0.10 or 0.12 blocks the same 6.1% of uncorroborated passes and **0.0%
  of corroborated ones**.
  **What fixes it at 0.1 rather than higher is the three cases just above
  the gap, all of which must keep their coverage:**
  * **the close-up the fallback exists for.** r18f-base-man t=561-574 is
    the baseline video's close-up regime, uncorroborated on every pass,
    maxKp 0.14-0.76 median ~0.36 — but its worst single pass is
    **0.14 at t=566.3 on a face 0.387 of frame height**. A floor at 0.15
    kills exactly the frame this whole path was built for.
  * r20b-woman t=304.7, maxKp **0.120**: the overhead workbench, two
    people present as forearms only. R20 scored the uncovered version of
    that frame as EXPOSURE under "not leaving the hands".
  * r21-man t=201.7-203.2, maxKp **0.130-0.330**: the dim audience shot
    where the synthetic body is the ONLY thing covering a woman.

  **SCORE, after — two full re-runs of the identical window, frame for
  frame IDENTICAL to each other, so this is not run-to-run variance:**
  **GHOST 3 -> 0.** f005/f006/f007 now carry zero patches and measure
  0.0% covered against their truth pairs. `faceNoShape` fired 6 times per
  window. EXPOSURE stayed 0, PARTIAL stayed 0, DRIFT stayed 0.

  **AND IT COST ONE FRAME, WHICH IS THE HONEST PART OF THIS ENTRY.
  FALSE COVER went 2 -> 3.** f008, the cut back to the speaker, now
  renders him covered for a single frame; he is sharp again by f009. The
  artifact says exactly why, and it is not the gate: **in the BEFORE run
  the slide's GHOST track (id 8, born on the typography at f005) was
  re-associated onto the speaker at f008 and rendered him `cleared` on
  its first human read.** With the ghost gone he is a NEW track, and a
  new track starts covered and needs its second read. So the before-run's
  "clean" f008 was a ghost laundering a clear onto a human — R20's critic
  called this class "correct by accident" and this is the sharpest
  example yet. Reproduced in both post-fix runs.

  **SYMMETRY, and the gate is direction-blind as intended.** Same video,
  `woman`: `faceNoShape` 6, slide frames 0 patches, audience frames still
  covered at 11.4%/14.5% (the same geometry as `man`), and the speaker
  correctly BLURRED at f008/f009 with `flag-certain`. Nothing the gate
  touches differs between directions.

  **NOT FIXED, and NOT attributable to anything shipped here.**
  * `man` f000/f001 FALSE COVER: the patch that covers the woman at
    centre-frame is a synthetic body built from the **top-right MAN's**
    face (`ff` cx 0.79, h 0.226-0.278). It covers the man it was built
    from, and a second man in a tan jacket. The read on it abstains at
    gender score 0.25-0.42 in near-darkness — the same "faceres has no
    signal" class as R18's teacher in profile, not a threshold.
  * `woman` f000/f001 EXPOSURE 2/10: the two men at frame-left are sharp,
    because that one patch starts at x 0.41. Pre-existing, unchanged.
  * cost: verdict p50 76 -> 79/88ms, pass p50 29 -> 28/30ms, i.e. inside
    noise. The gate is a loop over six numbers and it SKIPS a crop and a
    gender inference when it fires. `first == max` on verdict again
    (1004-1101ms) — model warm-up, consistent with that target's
    retirement. gaze **170/170** (163 plus 7 on the gate), cargo 36/36.

  **THE SECOND GRAPHICS WINDOW, RUN BEFORE THE ROUND CLOSED, AND IT
  BOUNDS THE FIX RATHER THAN CONFIRMING IT.** R22's queue item 3 asked
  for a second instance of the class before trusting a constant fitted to
  one slide, so I re-captured R19's news-panel window (z5WBceo0bIg,
  t=240, `woman`) on the new build. **`faceNoShape` fired ZERO times, and
  f002 is still a GHOST** — a patch over a Zee News title card, 10.0% of
  the frame covered, no human in it.
  The gate cannot reach it, and the artifact says why: on news graphics
  MoveNet does NOT go silent. It emits weak keypoint noise on the logo
  shapes at maxKp 0.24-0.26 with nKp15 4-5, four to five times the
  0.05 the slide produced.
  **So I measured whether MoveNet's slot SCORE separates the two, and it
  does not** — the two regimes overlap on every axis the person pass has:

  | | maxScore | maxKp | nKp15 |
  |---|---|---|---|
  | news-graphics ghost (8 passes) | 0.000-0.174 | 0.10-0.52 | 0-7 |
  | baseline close-up, REAL human (18) | 0.030-0.303 | 0.14-0.76 | 0-9 |
  | text slide (9 passes) | **0.000** | **0.05** | **0** |

  The typography case is uniquely identifiable because MoveNet returned
  literally nothing; the news-graphics case is not identifiable from the
  person pass at all, at any threshold, because a real close-up produces
  the same numbers. That is a different problem needing a different
  signal, and it is now R22's first item rather than a hope.
  Also worth recording from that window, because it is the third time:
  f008 measured 79.1% covered on R19's build and 62.5% on this one **with
  the gate firing zero times**, so that is run-to-run variance again, on
  footage where both subjects are real men correctly covered in `woman`
  mode. Frames on this footage cannot carry a 16-point attribution.

  **CORRECTION TO THIS ENTRY, MEASURED AFTER THE CRITIC'S TWO DEFECT
  FIXES LANDED, AND IT DOWNGRADES THE HEADLINE. GHOST IS 3 -> 1, NOT
  3 -> 0.** The "empty band" above is not empty. It was derived from the
  `ff`-bearing passes only — passes where a face was actually found — and
  the two verification runs on the final build show the SAME slide
  reading maxKp **0.11** on passes where no face was found (r21f f003,
  f004) and a mint slipping through at f005 in both runs. So the
  typography distribution is 0.05-0.11 and it OVERLAPS the 0.1 floor;
  what the earlier sweep measured was a sample, not the range.
  **0.12 would close it and is refused anyway**, for a reason that is
  worth more than the frame: the nearest real case is the forearms
  workbench at maxKp **0.120**, and `lastSlotDiag` rounds maxKp to TWO
  decimals, so a raw 0.1198 and a raw 0.1204 are the same number in every
  artifact we have. Calibrating a floor against rounded data at the exact
  boundary is how R7's zoom-score rule was got wrong. The floor stays at
  0.1, which is the EXPOSURE-safe side, and R22 gets a one-line probe
  change instead of a guess.
  The two defect fixes themselves verified clean: `faceNoShape` still 6
  per window, f006/f007 still 0 patches, f002-f004 still 0 patches, cost
  unchanged (verdict p50 75ms, pass p50 25ms), gaze 170/170.

  **R22's queue.**
  (1) **Record maxKp at THREE decimals and re-derive this floor.** The
  whole question is 0.11 typography against 0.120 real limbs and the
  probe cannot resolve it — the constant that decides GHOST-versus-
  EXPOSURE is currently calibrated against rounded numbers. One line in
  lastSlotDiag, then re-run the corpus sweep counting ALL passes, not
  only the ones that found a face.
  (2) **The scene-entry frame, now unmasked and reproducible.** A person
  appearing on a cut is covered for exactly one frame before their second
  read. Blur-first says that is the safe direction, but the owner's bar
  says "not a single frame where the wrong gender is blurred up", and it
  is now measurable on demand (f008 of this window, both runs). The lever
  is CLEAR_STREAK_N, which R7 set to 2 deliberately because one read
  misgendered — do not move it without measuring the misgender rate of a
  FIRST read at score >= GENDER_CLEAR_SCORE across the corpus.
  (3) **A face in near-darkness abstains, and abstention costs a man his
  sharpness.** f000/f001 here, R18's teacher in profile. Same root:
  faceres has no signal, and `isNullRead` does not catch it. Two rounds
  have now logged this class without touching it.
  (4) **The graphics GHOST that the person pass cannot see** — answered
  in the negative above, and now the round's biggest open item. A news
  title card produces MoveNet noise indistinguishable from a real
  close-up on score, maxKp and nKp15 alike, so no threshold on the person
  pass reaches it. It needs a signal neither detector currently provides.
  Cheap candidates worth measuring before anything is built: the crop we
  ALREADY compute per person goes through faceres, which already returns
  an age posterior and a 1024-d descriptor, and nsfwjs is already loaded
  and already classifies "Drawing" — that class is free and nobody has
  ever looked at what it reads on a title card versus a face.
  (5) Everything R20 left open, unchanged: the model-box-vs-hull
  intersection (the only live lever on the 76% of covered area that is
  MoveNet's own boxes), the figurine that outscores both humans, and
  `wipeIfEmpty`'s premise being narrower than its comment.

- **R22** — rotation entry 4 (`news panel discussion`, **woman**), resolved
  live to four ids of which `z86LGEFyQpo` was new and `z5WBceo0bIg` is
  R19's known graphics window. Build `ada32d1-dirty`; app PID
  34276 -> 11284 -> 46516, confirmed by PID change before every capture.
  The dev watcher is still dead — each rebuild was an explicit stop /
  `cargo build` / detached relaunch.

  **THE ROTATION ENTRY SCORED CLEAN IN BOTH DIRECTIONS, WHICH MEANS THE
  WINDOW WAS TOO EASY, NOT THAT THE PROBLEM IS SOLVED.** `z86LGEFyQpo`
  t=300, 10 frames @1.5s: a single adult man in close-up filling centre
  frame against a Bloomberg logo wall. **`woman`: EXPOSURE 0, PARTIAL 0,
  FALSE COVER 0, GHOST 0, DRIFT 0** — covered on all ten, hands included.
  **`man`: the same, inverted** — zero patches on all ten, `st:cleared,
  lv:clear-certain`, gender reads male 0.65-0.98 at childP 0.01-0.03.
  Per GOAL's own rule that is a signal to move to harder footage, so the
  round did, to the one regime this table has that the person pass
  cannot see.

  **SCORE on the hard window** (`z5WBceo0bIg` t=240, `woman`, r22b):
  **EXPOSURE 1, PARTIAL 1, FALSE COVER 0, GHOST 2, DRIFT 0.**
  * GHOST f002/f003 — a patch on the show logo of a title card. No human
    in frame. R19's finding, reproduced.
  * EXPOSURE f008 — a split-screen of two men; only the right one is
    covered, the left man is fully sharp, because the full-frame face
    pass found both of its faces on the right half (`ff` cx 0.52/0.64)
    and missed his entirely. He is looking down, in shadow.
  * PARTIAL f009 — both men covered, and the left man's bald crown sits
    ABOVE his patch. Mechanism, from the artifact: his synthetic body
    was built from a face box of de-inflated height 0.097 while his
    actual head spans ~0.43 of frame height. Head bowed, so BlazeFace
    boxed the eye/glasses region only, 4x undersized. `personFromFace`'s
    headroom is 0.9 face-heights and his crown is 2.5 above the box —
    NO sane headroom constant reaches that. It is a detector undersizing,
    not a geometry constant, and widening the constant would be
    over-fitting.

  **QUEUE ITEM 1 IS ANSWERED, AND THE ANSWER IS THAT THE CONSTANT CANNOT
  BE IMPROVED.** `lastSlotDiag.maxKp` now records 3dp (it was 2), and both
  boundary windows were re-captured on the same build:

  | | n | maxKp range |
  |---|---|---|
  | r22c-slide-man — TED text slide, no human, np==0 | 18 | 0.045 – **0.108** |
  | r22d-bench-woman — workbench, two people as forearms only, np==0 | 8 | **0.109** – 0.225 |

  R21 refused 0.12 because the forearms read `0.120` at 2dp and suspected
  rounding. It was rounding: the forearms MINIMUM is 0.109 and the
  typography MAXIMUM is 0.108. **The empty band is real and it is 0.001
  wide.** The only floor that blocks all typography and keeps all
  forearms lies in (0.108, 0.109], which is a coincidence rather than a
  threshold — calibrating on it is how R7's zoom-score rule was got
  wrong. **PFF_FRAME_KP_FLOOR stays at 0.1, on the EXPOSURE-safe side,
  and the two typography passes at 0.108 are NOT blocked. The leak is
  structural, not a mis-set constant.** Pinned in three tests so a future
  round has to face the frame rather than rediscover it.

  **TWO RULES MEASURED AND REFUSED, both written into person-gate.mjs
  with their evidence so they are not proposed a fourth time.**
  * *"Refuse to mint a synthetic body from a face too small to
    gender-read."* It looks decisive here — every ghost face on this
    window reads `px 32-48` (below FACE_MIN_NATIVE_PX 64, so gender
    abstains `unknown` FOREVER and the track can only ever sit
    `uncertain`), while the real men in the same window read px 91-389.
    **Refused on a corpus sweep.** Across every run's `ff` probe there
    are 17 uncorroborated sub-64px faces in the whole corpus; twelve are
    this title card, and the other FIVE are `PYgPUAR9jNw` t=2701 at
    58-62px — the graduation crowd, 13-15 real faces on one frame with
    MoveNet admitting nobody. That rule uncovers a crowd of real people.
    A cut at ~55px separates them and would be a constant fitted to a
    10px gap in 17 samples from two videos.
  * *"Admit a MoveNet slot only if its weaker shoulder `sk` clears a
    floor."* The separation is real where it applies — on r22-woman,
    typography slots sit at `sk 0.00-0.04` against the real man's
    `0.62-0.89`, a 0.58 gap with no overlap, and the mechanism is
    physical (eyes and ears are blob-and-counter features, which is what
    letterforms are made of; shoulders are a low-frequency silhouette
    with no typographic analogue). **Refused**: 12.1% of real-person
    slots at score >= 0.20 read `sk < 0.30`, and the r21d title-card
    ghosts it is aimed at read `sk 0.09-0.16` anyway. Corroborator, never
    a gate.

  **SHIPPED, and it is deliberately all measurement plus one real
  defect — no behaviour change survived scrutiny this round.**
  1. `maxKp` at 3dp (above), plus a confident-keypoint **bitmask** `kb`
     on every slot: `confident` is a COUNT and a count cannot tell a
     contiguous anatomical set from scattered letterform hits. One OR in
     a loop that already runs.
  2. **THE `reads` AND `attr` PROBES WERE UNGUARDED INSIDE THE VERDICT
     PROMISE CHAIN** (critic's find, verified). That is the exact shape
     of the bug that silently discarded every gender read for two
     releases; the `slots` probe beside them has always been wrapped,
     these two never were, and `attr`'s `hx`/`hy` divide by
     `region.x2 - region.x1` with no positive guard while the `d` IIFE
     directly beneath them has one. Both wrapped BEFORE anything was
     added to them.
  3. Two free null tests that were being computed and thrown away, now
     recorded on every read, because R23 cannot decide the graphics
     question without them:
     * `nm` — the faceres descriptor's **L2 magnitude**, discarded by the
       very line that computes it (`detector.js`). The descriptor is
       global-average-pooled trunk output; a crop with no face excites the
       trunk weakly, and normalising is precisely the step that erases
       that. It is a 1024-dim null test ORTHOGONAL to the 1-dim one
       `isNullRead` already runs on the gender sigmoid, whose band R11
       measured at a gap of only 0.035. First live values: 13.08 / 13.18
       on the real man, 8.35 / 5.86 on the news panel.
     * `ap` — the age posterior's **shape** (peak bin / peak mass /
       entropy) beside its mean. The mean provably does not separate
       (title cards read age 33-56, the real man 33-45, fully
       overlapping). Free: the loop over all 100 bins already runs.
  4. The floor measurement and both refusals written into the source as
     comments, per the standing rule that a decision reverted by someone
     holding only the diff is a decision that was never recorded.

  **RE-VERIFY, both halves.** Man direction on the clean window
  (r22f-man): 0 patches on all 10, `clear-certain` throughout — no FALSE
  COVER regression on the owner's own direction. Woman direction
  (r22g-woman): all 10 still fully covered. Graphics window (r22e-woman)
  scored **EXPOSURE 0, PARTIAL 2, GHOST 1** — and that is **NOT
  attributable to anything shipped**, because nothing shipped changes
  behaviour. It is run-to-run variance on footage R21 already logged as
  variable (79.1% vs 62.5% coverage on the same frame across builds with
  the gate firing zero times). f002's GHOST reproduced exactly; f003's
  did not recur; f008 flipped from EXPOSURE to PARTIAL because the patch
  happened to be built wide enough that pass to reach the left man and
  then clipped the right man's ear. **Frames on this footage cannot carry
  a single-frame attribution and this round does not give them one.**

  **COST unchanged.** verdict p50 93 -> 92 (woman) / 105 (man) / 68
  (panel) ms; pass p50 29 -> 29 / 34 / 32 ms; pass p95 <= 45. `first ==
  max` on verdict again (967-1631ms) — model warm-up. Everything shipped
  is arithmetic inside loops that already run, except the two try/catch
  wrappers. gaze **177/177** (174 plus 3 on the new diagnostics), cargo
  36/36.

  **R23's queue.**
  (1) **Measure `nm` and `ap` against the labelled ghosts.** They are now
  in every artifact. Join r22e/r21d/r19c title-card reads against
  r22-woman and r22d real-face reads and see whether either separates. If
  neither does, findings 1 and 3 die and the next candidate is
  BlazeFace's **6 landmarks**, computed on the GPU and sliced off before
  the download (`detector.js`, `[896,17]` -> `[896,5]`). Decode is
  Apache-2.0 and already vendored in node_modules; cost is a WIDER
  READBACK on the same fence (+43KB/call), no extra inference. The
  predicate to test first is ordering — `eye_y < nose_y < mouth_y` —
  which is scale-free and needs no calibration. Guard the slice on
  `shape[2] === 16` or a throw kills face detection outright.
  (2) **The f008 EXPOSURE class: a face the full-frame pass simply does
  not find.** Two frames apart, the same man is found (f009 `ff` cx 0.21)
  and not found (f008). Downcast, in shadow, split-screen. This is not a
  threshold — FACE_MIN_CONFIDENCE never saw a candidate. Measure how
  often the full-frame pass loses a face it found one pass earlier before
  proposing anything.
  (3) **`personFromFace` headroom is not the f009 bug** — recorded so the
  next round does not spend itself there. A bowed head gives a face box
  4x smaller than the head; the fix, if any, is on the detector side.
  (4) Unchanged from R21/R20: the scene-entry frame (CLEAR_STREAK_N, do
  not move it without measuring first-read misgender rate), the face in
  near-darkness that abstains and costs a man his sharpness (now three
  rounds logged without a fix), the model-box-vs-hull intersection, and
  `wipeIfEmpty`'s premise being narrower than its comment.
  (5) **nsfwjs "Drawing" is dead per-pass and the critic said so itself**:
  the video path never calls `isNsfw`, so adding it is a whole extra
  224x224 inference — ~17ms on an RTX 3060 Ti, plausibly 100-170ms on a
  Helio G88 against a verdict p50 of 93ms. Once per scene CUT is the only
  framing that survives, and a cut is already the most contended tick in
  the pipeline. Reach for it only if (1) fails entirely.

## STABILITY

The objective changed on 2026-08-26. Owner, verbatim: *"the blurs look
much annoying right now with multiple boxes here and there... previous
versions were significantly better at feeling stable. Make it much stable
and optimised and performance oriented"*, and separately *"optimization
is a real concern btw cuz yt app already feels slow and annoying"*.

Twenty-two rounds optimised per-frame ACCURACY and **not one of the five
classes counts how many separate boxes appear and vanish per second**, so
every round could improve its score while the thing he actually sees got
worse — and several rounds deliberately added recall (the weak tier, the
close-up face fallback, synthetic bodies), every one of which raises
patch count. Accuracy is now a regression GATE, not the objective.

The metric is `spikes/gauntlet/stability.py`. It never pauses — the
accuracy harness pauses for its blur-on/blur-off pair, which zeroes track
velocities and re-pins every overlay, so its own sampling FABRICATES
churn — and polls the live overlay rects at 10Hz during continuous
playback. Jitter and breathe are computed only across intervals where the
patch COUNT is unchanged; pairing rects across a count change matches
unrelated boxes and inflates both, an artifact that already cost one
analysis.

- **S1** (2026-08-26) — baseline + the shrink deadband.
  Baseline, build 8c5a2f3, NWoT1ZVd1Lo man t=890 45s: patches mean 2.08 /
  MAX 7 on a TWO-person scene, dCount 2.23/s, births 0.24/s, jitter 0.264,
  breathe 0.466 p90 1.084, cover life p50 1.14s, and only 67% of intervals
  carry a stable patch count.
  **SHIPPED: a shrink deadband in `lerpRect`.** Growth is instant by
  design (R17 measured a lerped leading edge leaving 7.5% of a covered
  man's shoulder sharp) while shrink glides at ~100ms, so every noisy
  detection inflates the box and it deflates a tenth of a second later —
  at the 4-8Hz the detector runs, a visible throb. Slowing the shrink is
  the obvious fix and is WRONG: `lerpRect` also handles TRANSLATION, and a
  long tail smears a moving patch into the union of where it was and where
  it is going. The discriminator is the SIZE of the inward step, not its
  speed — under 5% of the edge's own dimension is noise and the edge does
  not move at all. Breathe 0.466 -> 0.397, jitter 0.264 -> 0.206. It can
  only ever make a patch LARGER, so it cannot open EXPOSURE or PARTIAL.
  **BUILT AND REFUSED: merging boxes that merely sit a hairline apart**,
  gated on the union being cheap in area. Two full-height people side by
  side with a 0.05 gap have a union of 0.72 against a summed area of 0.68
  — relatively CHEAPER than two partial boxes on one person. Area cannot
  separate "two boxes on one person" from "two people", and the three
  existing tests pinning side-by-side people apart failed at once. Patch
  count is not fixable at the merge step; the reason is in the code.

- **S2** (2026-08-26) — **the "multiple boxes" had one cause, and it is
  gone.** Re-baselined on HEAD d44311d: patches mean 1.91 / MAX 7,
  dCount 2.49/s, births 0.31/s, cover life p50 1.13s, 67% stable
  intervals, and the diagnostic that named the culprit — **drawn patches
  EXCEEDED live tracks on 33-44% of covered samples, most commonly 3
  patches from 2 tracks, on a scene containing exactly two people.**
  That is `subtractBox`: to keep a CLEARED person's head sharp, a blurred
  patch was SPLIT into up to four sibling rectangles around each head
  hole. Working exactly as designed, and it is precisely what the owner
  reported. It is also a performance cost, because every piece is its own
  DOM node with its own `backdrop-filter`, i.e. its own backdrop snapshot.

  **SHIPPED: one patch carrying HOLES, subtracted by the renderer instead
  of by the geometry.** `blurredTracks` now returns a single patch per
  merged track with a `holes` array clipped to it, and `video-region`
  turns those into a two-layer CSS mask composited with `exclude`. The
  same pixels are covered and the same cleared head stays sharp — the
  subtraction just moved from the geometry to the compositor.

  **THE CONSTRUCTION WAS MEASURED BEFORE IT WAS BUILT, AND THE OBVIOUS
  ONE IS DEAD.** `CSS.supports` reports **true** for
  `clip-path: path(evenodd, ...)` in this WebView — and an element
  carrying one paints **NOTHING AT ALL**, verified side by side against an
  identical unclipped control that blurred correctly
  (`runs/clip-spike.png`). `CSS.supports` tests the parser, not the
  compositor. Two mask layers with `mask-composite: exclude` DO work and
  were verified by pixel first (`runs/clip-spike2.png`: one element,
  blurred, with a genuinely sharp rectangle inside it). Both the
  unprefixed and `-webkit-` forms are written, and a WebView that
  understands neither ignores the mask and draws the solid patch — which
  over-covers, the safe direction, and never exposes anyone.

  **RESULTS, man t=890 45s, before -> after:**

  | | before | after |
  |---|---|---|
  | patches mean | 1.91 | **0.87** |
  | patches MAX | 7 | **2** |
  | dCount/s | 2.49 | **0.45** |
  | births/s | 0.31 | 0.24 |
  | patches > tracks | 33% of samples | **0%** |
  | stable-count intervals | 84.9% | **95.4%** |

  **woman, same window:** patches mean 1.46 / max 3, dCount 0.87/s,
  **patches > tracks 0%**, stable intervals **91.3%**, jitter 0.114,
  breathe 0.185, cover life p50 44.98s (i.e. continuous coverage, no
  blinking) — the direction where everyone in frame must be covered is now
  essentially one steady patch.

  **Honest note on jitter/breathe in the man direction: they read HIGHER
  after (jitter 0.189 -> 0.220, breathe 0.329 -> 0.425) and that is a
  composition change, not a regression.** Those averages only include
  stable-count intervals, and the sample set changed underneath them:
  84.9% -> 95.4% of intervals now qualify, and the static slabs that used to
  dilute the average are gone, leaving the one real moving patch. The
  woman direction, where coverage is continuous, shows the true direction:
  jitter 0.114, breathe 0.185.

  **ACCURACY GATE HELD**, checked frame by frame against truth pairs on
  the R20 window (man t=901): coverage 64.9 / 38.8 / 42.1 / 53.2 / 43.4 /
  47.2 / 64.6 / 0.0 / 0.0 / 0.0 against R20's 56.8 / 39.3 / 44.9 / 48.3 /
  42.2 / 46.4 / 65.8 / 0.0 / 0.0 / 0.0 — the same coverage from **one**
  patch per frame instead of three or four. f003 read directly: a single
  blurred patch with a sharp rectangular hole, the cleared man's face
  crisp inside it. EXPOSURE 0, GHOST 0, and the frames that were clear
  before are still clear. gaze **179/179**.

  Two tests changed contract rather than being deleted: the one asserting
  a cleared face is outside every patch BOX now asserts the pixel property
  it always meant (inside no box, or inside a hole), and
  `piece keys survive a sibling disappearing` — which existed only because
  four sibling rectangles needed stable distinct keys — became
  `one patch and a stable key however the hole is shaped`.

  **Still open.** Patch count is now ~1 per person, so the next lever is
  the hole itself: it is still a RECTANGLE over a face, which is visible
  as a hard-edged notch. That is what segmentation removes — a silhouette
  has no seams and needs no holes. The cost spike on a Helio G88 has NOT
  been run, and no number on this project has ever come from the owner's
  phone.

  **PERFORMANCE: MEASURED, AND THIS DESKTOP CANNOT ANSWER THE QUESTION.**
  The seams were argued to be a perf cost as well as a visual one, so it
  was benchmarked rather than assumed: a live rAF loop in the real player,
  translating the overlays every frame the way the render loop does, four
  small `backdrop-filter` slabs against ONE masked element, 4s per arm,
  interleaved and repeated.
  Result: **pieces 159.8 and 162.0 fps, masked 157.8 and 162.5 fps, empty
  control 164.1** — the arms are inside each other's run-to-run spread.
  On an RTX 3060 Ti four small backdrop snapshots cost nothing measurable,
  so **the perf half of this change is UNPROVEN, not proven**. The
  stability half stands on its own numbers. The question is only decidable
  on the Helio G88, where fill rate and backdrop snapshots are the scarce
  resource — and no number on this project has ever come from that device.
  Recorded so a later round does not quote the stability win as a perf
  win.

- **S3** (2026-08-26) — **the critic caught the measurement lying, and one
  of the two S1/S2 wins does not survive it.**

  The S1 docstring said jitter and breathe were computed only across
  intervals of unchanged patch count. **`stability.py` never did that** —
  the filtering happened in throwaway scripts beside the tool, while the
  tool's own numbers went into the log unfiltered. A metric whose stated
  definition lives outside the metric is how a wrong number gets written
  down as fact, so the filter now lives in `analyse()`, along with two
  more corrections the critic was right about:

  - **dt comes from VIDEO time, not wall clock.** The sampler is a Python
    loop over CDP round-trips; wall spacing wanders by tens of
    milliseconds, so a slow eval alone can inflate a per-second rate.
  - **`births` counts TRACKS, not patches** — `__TS_GAZE_IDS.tracks`
    includes cleared tracks that draw nothing. So "patches exceed tracks"
    compares against a SUPERSET and under-reports splitting. The direction
    is safe; the magnitude was a floor, not a measurement.

  Recomputed through the corrected analyser, the S1/S2 stable-interval
  figures were wrong (84.9% -> 95.4%, not 67% -> 79%) and have been fixed
  in place above rather than left standing.

  **A single 45s run cannot decide a small change.** Run-to-run spread on
  this footage is most of the mean, so two whole-run averages only settle
  a difference that is enormous. Both runs watch the SAME video, so
  `stability.py compare` now pairs the traces by `currentTime` and reports
  how many seconds of video moved which way. Applied to both shipped
  changes, on the same 46 buckets:

  | change | mean Δ patches | buckets fewer | more | same |
  |---|---|---|---|---|
  | one-patch-with-hole (S2) | **-1.03** | **30** | 2 | 14 |
  | shrink deadband (S1) | +0.13 | 15 | 19 | 12 |

  **S2 is real and S1's effect on patch COUNT is a coin flip.** That is
  not a retraction of S1 — the deadband's job was breathing, and it did
  that (breathe 0.467 -> 0.398, jitter 0.264 -> 0.206) — but S1 must never
  be quoted as a count win, and the paired test is now the bar for every
  future stability claim.

  **THE SEAM, WHICH IS PROBABLY WHAT HE ACTUALLY SAW.** The critic
  measured that on 96% of covered samples the patches form ONE connected
  blob, with internal seam length averaging 1.23 frame-widths on 66% of
  samples. So "multiple boxes here and there" was largely not floating
  boxes at all — it was **visible LINES inside one covered region**. Two
  abutting `backdrop-filter` elements each snapshot the backdrop
  separately and the joint reads as a hard edge; the contrast step at the
  seam column measured **23x**. This is the mechanism behind the owner's
  report and it is exactly what S2 removes wherever a hole caused the
  split. Overlapping SIBLING patches still compound their blur and still
  seam — unmeasured, and the next thing to look at.

  **THE CLIP-PATH CONFLICT, RECORDED UNRESOLVED RATHER THAN SETTLED.**
  S2 recorded that an element with `clip-path: path(evenodd, ...)` paints
  NOTHING in this WebView2 despite `CSS.supports` returning true, verified
  by pixel against an unclipped control. The critic tested the same idea
  in headless Edge 151 and found all five constructions work. The likely
  reconciliation is that the spike used `path()` and the critic used
  `polygon()` — different code paths in the same engine — but that is a
  hypothesis, not a measurement, and nobody has run both forms side by
  side in the shipping WebView. **Whoever picks this up runs the pixel
  test first.** And a hard constraint if they do: with `polygon()` the
  fill rule must be **nonzero, never evenodd** — 62.6% of patch pairs
  overlap, and evenodd XORs an overlap into a TRANSPARENT HOLE over
  someone who is meant to be covered. That is EXPOSURE manufactured by a
  rendering choice. The shipped mask uses `exclude` over hole layers,
  where overlapping holes compound toward MORE cover, not less.

  **SEGMENTATION: use it to tighten the box, not to draw the shape.**
  The critic's judgement, and it is right for a reason worth keeping:
  a silhouette cannot be dead-reckoned between passes the way a rectangle
  can, and producing one per frame means reading pixels back out of the
  GPU — undoing the zero-readback work that took the long tasks from
  1338ms to 247ms. The 76% of wasted blur area is MoveNet's box
  regression, and segmentation can fix that by shrinking the RECTANGLE
  once per pass. Same accuracy gain, none of the render cost.

  **SHIPPED this round, all three in the functions S2 already touched:**
  - `makeOverlay` now seeds `__tsW/__tsH` from `BASE_PX`. They were
    undefined, so `place()` compared the first real rect against 0 and
    skipped the write for any patch under 2px — leaving a **100px blurred
    slab** at BASE_PX. Latent, never observed, but slivers are exactly
    what this renderer produces and a smaller player reaches it.
  - `lerpRect` settles. A 0.25 lerp is asymptotic, so the drawn rect
    differed from its target for ever and the transform string was
    rewritten 60 times a second through a completely static shot. It
    settles slightly LARGER than the target (the shrink deadband parks
    each inward edge up to 5% of its span short) — over-cover, the safe
    direction, now asserted by test rather than left implicit.
  - `place()` compares the transform string before assigning it. Identical
    assignments still cross CSSOM; comparing them does not.

  gaze **180/180** (one new test pins convergence AND containment
  together, because a settle that shrank the patch would be an exposure
  dressed as a perf win). Nothing here changes geometry the pipeline
  asks for, so the S2 accuracy gate carries.

  **Still open.** The sibling-overlap seam (unmeasured). The `polygon()`
  pixel test in the real WebView. Segmentation as a box-tightener. And
  the whole stability story is still desktop-only — no number on this
  project has ever come from the owner's Helio G88.

  **RE-VERIFIED on a freshly built dev app** (the previous binary was an
  ORPHAN — `app.exe` was alive with no `cargo`/`tauri dev` watcher behind
  it, so `touch lib.rs` had rebuilt nothing for who knows how long. A
  relaunch then failed silently on `Port 1420 is already in use` from a
  vite left over from the previous day. Check for the WATCHER, not just
  the app.) man t=890 45s: patches mean 0.85 / max 2, dCount **0.31/s**,
  stable_frac **96.8%**, cover life p50 7.83s. Paired against S2 over the
  same 46 buckets: 7 fewer, 5 more, 34 identical, mean delta -0.013 —
  i.e. **geometry-neutral, which is exactly the claim**: these were render
  fixes and they must not move what is covered.

  Frames read directly (man t=901): f003 = ONE blurred patch with a sharp
  rectangular window over the cleared man's face, no internal seam, the
  second man at frame left fully sharp. f006 = a close-up filling the
  frame, 88.4% covered and correct, the cleared man still sharp at the
  edge. f008 = man alone, zero patches, entirely sharp. EXPOSURE 0,
  GHOST 0. cargo 36/36.

  **A limitation in the harness worth knowing before quoting a coverage
  number:** `gauntlet.py`'s probe reads overlay RECTS from the DOM and has
  no idea holes exist, so every coverage percentage in this section --
  S2's included -- counts a hole as covered. The figures compare to each
  other; they overstate the truth by the hole area.


- **S4** (2026-08-26) — **the owner said "before any gauntlet run you were
  better". He is right about one metric, and it is the one that matters
  to him.**

  Built the pre-gauntlet bundle (92e8fba, marker `v7`, 55 commits back)
  in a worktree, swapped it into the running app, and measured it on the
  identical 45s. Man t=890:

  | | pre-gauntlet v7 | today |
  |---|---|---|
  | patches mean | 1.20 | **0.87** |
  | patches MAX | 6 | **2** |
  | dCount/s | 1.22 | **0.49** |
  | births/s | 0.60 | **0.31** |
  | stable-count intervals | 91.1% | **95.0%** |
  | jitter/s | 0.206 | 0.219 |
  | **breathe/s** | **0.229** | **0.383** |

  Paired by video time, 46 buckets: 21 fewer patches, 12 more, 13 same.
  So COUNT genuinely improved over the gauntlet — and **patch SIZE
  stability regressed by 67%**. Breathing is what reads as "not smooth",
  and it is the one number 22 accuracy rounds made worse while every
  scored class improved. Nothing in the five classes measures it. That is
  the whole lesson of this entry.

  **WHERE THE CHURN IS NOT.** The birth-cause counters
  (`birthFresh`/`birthNearMiss`/`birthSizeRejected`/`birthContended`) were
  built rounds ago and had never been read; `stability.py` now captures
  `life` and reports the delta across a run. Read at last: births total
  9-10 per 45s in BOTH directions, against `dedupeMerged` 152-169 and
  `dedupeHeadSplit` 131-144. Track minting is not the problem at the
  current state, which retires the standing assumption that it was.

  **SHIPPED 1: the axis-wise shrink tail.** Growth stays instant (R17:
  a lerped leading edge left 7.5% of a covered man's shoulder sharp), but
  a shrinking edge now glides on SHRINK_LERP 0.06 (~600ms) instead of
  RENDER_LERP 0.25 (~100ms) — and only when the axis is BREATHING. The
  discriminator needs no velocity and no tracker: on a translating axis
  both edges move the same way, on a breathing axis they move opposite
  ways. A translating axis keeps the old speed, so the patch cannot smear
  into the union of where the subject was and where they are going —
  which is exactly why S1 shipped only a deadband. Man: breathe 0.487 ->
  0.372, jitter 0.264 -> 0.201, both -24%. Count unchanged (8 fewer / 4
  more / 34 same).

  **SHIPPED 2: soft edges, because the owner named the mechanism.**
  Verbatim: *"the technique you're using to show the face ... through
  cropping is not the correct one. rather we could use translucent edges
  blur ... with the edges being more towards transparency ... the cropping
  through the square is just not working correctly."* He is right beyond
  taste: a hard edge advertises exactly where the subject is and what
  shape the detector thinks they are. The patch is now a horizontal fade
  INTERSECTed with a vertical fade (four soft edges) and each hole is a
  radial falloff instead of a cut-out rectangle.
  Pixel-tested in the real WebView before building
  (`runs/feather-spike2.png`), three constructions side by side over one
  paused frame — S2 paid for the lesson that `CSS.supports` is not
  evidence here. The first attempt passed TWO composite operators for
  THREE layers; the list repeated and the hole silently got `intersect`.
  It is one operator per layer, and the computed style must read back
  `source-over, source-in, xor`.

  **THE FEATHER IS A REAL TRADE AND THE FIRST WIDTH WAS TOO BIG.** A soft
  outer edge is only possible by painting some blur OUTSIDE the requested
  box — ramping inward instead would under-cover the covered subject.
  At 26px, frame `runs/s4-feather-man/f001` shows partial blur across the
  cheek of a CLEARED man standing at the patch edge: the owner's "not a
  single frame where the wrong gender is blurred", in its mildest form.
  Reduced to 16px (~3% of a 500px patch), which halves the encroachment
  and still reads as soft. Recorded in the code so it is not raised
  blindly. Coverage percentages in this section jump accordingly — the
  patch element is now 2x16px larger per axis than the box the pipeline
  asked for.

  **SHIPPED 3: no size velocity across a change of observation SOURCE.**
  One human has two legitimate representations differing severalfold in
  area — a MoveNet box and a `personFromFace` synthetic body — and R7
  raised PTRACK_SIZE_RATIO_MAX to 6 precisely so they would associate.
  `sizeVel` was turning that representation change into a velocity, which
  `interpolateBox` then predicted more of. A new `srcFlip` counter says it
  fires **53-59 times per 45s** (~1.3/s), so the mechanism is real and
  frequent. Guarded: breathe 0.372 -> 0.359, jitter 0.201 -> 0.189.
  Small — it is ~4% of the 67% gap, not the cause.

  **BUILT, MEASURED, REFUSED: capping size extrapolation.** The obvious
  suspect for breathing is `interpolateBox` predicting growth outward for
  up to 1200ms. Capped at 8% of the box's own dimension it does
  **nothing** for breathe (0.3589 -> 0.3614) and COSTS count stability
  (dCount 0.40 -> 0.58/s, births 0.20 -> 0.36/s, stable 96.3% -> 94.0%),
  because a patch that stops predicting growth expires and re-mints more
  often. Reverted, with the numbers written into `interpolateBox` so the
  next round does not re-derive it. **The breathe regression is still
  unattributed. It is not in what CONSUMES sizeVel; look at what FEEDS
  it.**

  **Symmetry, woman t=890:** dCount 1.11 -> 0.67/s, stable intervals
  88.5% -> 93.2%, cover life p50 44.9s (continuous). jitter 0.124 ->
  0.138 and breathe 0.213 -> 0.233 rose slightly — the drawn rect is
  larger by the feather, and breathe is an absolute size delta.

  **ACCURACY GATE HELD.** Man t=901, frames read directly: one patch per
  frame on every covered frame, soft-edged throughout with no rectangle
  anywhere; f007 = the man alone, zero patches, entirely sharp. EXPOSURE
  0, GHOST 0. gaze **182/182**, cargo **36/36**.

  **SEGMENTATION, COST RESEARCHED, NOT BUILT** (owner asked whether it is
  allowed — it is):
  - **MediaPipe Selfie Segmentation, tfjs graph model: 332,432 bytes**
    (general, 256x256) / 336,175 (landscape), Apache-2.0, via the Kaggle
    `.../download` endpoint — tfhub is retired and 404s, the same gotcha
    MoveNet already hit. Inlinable exactly like our other models. The
    `@mediapipe/selfie_segmentation` WASM runtime is a different thing
    entirely: 5.59MB of `.wasm` fetched at runtime, which our CSP blocks.
    Foreground only, NOT instances.
  - **BodyPix is deprecated** in favour of `body-segmentation`, which
    still does true multi-person via `segmentPeople({multiSegmentation})`.
    Smallest usable weights 2.36-2.66MB; the only sub-1MB config
    (MobileNetV1 0.50 / quantBytes 1, 664,058 bytes) is the degraded
    corner. Apache-2.0.
  - **PP-HumanSeg int8bq, 1,734,724 bytes, Apache-2.0**, mIoU 0.9162 vs
    0.9164 fp32 — best size/accuracy under the bar, but foreground-class,
    not instances. (Its plain-int8 sibling collapses to mIoU 0.364 —
    do not take the smaller file.)
  - RobustVideoMatting is **GPL-3.0, banned**.
  - **NO published latency exists for any of these on Helio G88 /
    Mali-G52 class silicon, from anyone.** Nearest: MediaPipe
    SelfieSegmenter 33.5ms CPU / 35.2ms GPU on a Pixel 6 (flagship);
    PP-HumanSegV1-Lite 12.3ms on a Snapdragon 855. Both are much faster
    chips — treat every number as a FLOOR, not a prediction. Note that
    the PP-HumanSeg paper's own 11.5ms is a **Tesla V100**, not mobile,
    and is easy to misread given the paper's mobile framing.
  - Prior critic judgement stands and is reinforced: do NOT render the
    mask. A silhouette cannot be dead-reckoned between passes and would
    undo the zero-readback work. Use segmentation to TIGHTEN THE
    RECTANGLE, which attacks the ~76% of blurred area that is MoveNet box
    slop.

  **Critic findings NOT acted on, ranked, for the next round:** (1) merge
  is the only hard threshold left on a jittering input — crossing it
  changes the merged key, so `setTracks` destroys and rebuilds the DOM
  overlay and `lerpRect(null, target)` snaps with NO glide; wants
  hysteresis, and a counter first. (2) `detectPersons` and
  `detectFaceBoxes` each upload the FULL video element — ~16.6MB per
  verdict pass at 1080p across a shared memory bus, half of it pure
  duplication; the single biggest untaken perf win and a one-line fix.
  (3) MoveNet's input is still squashed to a hard 256x256 square;
  [160,256] drops the tensor 37% AND fixes the 1.78x anisotropy.
  (4) the rAF loop never stops even when every patch has settled.
  (5) `clearedHeadHoles` punches every cleared track's hole into EVERY
  blurred patch with no ownership test, so a duplicate track on one
  person puts a window over their own face. (6) `blurredCoastMs` /
  `clearedCoastMs` are module globals written per video element — the
  third instance of that class of bug here.

  **Harness notes.** The dev app must be relaunched with a WATCHER behind
  it — an orphaned `app.exe` makes `touch lib.rs` a no-op, and a stale
  vite on port 1420 makes the relaunch fail silently. A worktree needs
  `node_modules` junctioned in and `src/model-embed.js` copied before its
  bundle will build; `NODE_PATH` does not help, esbuild resolves from the
  file's own directory.

- **S5** (2026-08-26) — **S4's headline was largely a measurement error,
  and the bisect that found it also found the real number.**

  **THE METRIC WAS WRONG, AND IT WAS WRONG IN THE FLATTERING DIRECTION.**
  `breathe` is an ABSOLUTE size change in frame-width units, so it cannot
  tell "the box jitters more" from "the box is bigger" — and across the
  gauntlet the box roughly doubled on both axes. `analyse()` now also
  reports `breathe_w`/`breathe_h`, `rel_breathe_w`/`rel_breathe_h`
  (normalised by the patch's own size) and `patch_w_p50`/`patch_h_p50`
  with `clamped_h_frac`. Recomputed over every stored trace:

  | | pre-gauntlet v7 | today |
  |---|---|---|
  | median patch WIDTH | 0.24 | **0.51** |
  | median patch HEIGHT | 0.41 | **0.98** |
  | patches pinned at frame edge | 1% | **64%** |
  | rel breathe, width | 0.29 (3 runs) | 0.39 (2 runs) |
  | rel breathe, height | 0.49 | 0.20 |

  So the honest statement is **not** "breathing regressed 67%". It is:
  **the patch doubled in each axis, relative width stability degraded by
  roughly a third, and relative HEIGHT stability improved only because
  64% of patches now hit the frame edge — a clamp is a perfect
  stabiliser.** S4's 0.229 -> 0.383 is corrected in place by these rows,
  not deleted, because the absolute figure is still what the owner's eye
  integrates. But the size is the story: **the median patch is now the
  full height of the frame**, which is what "much better before" means.

  **RUN-TO-RUN NOISE IS LARGER THAN ANY ONE ROUND'S EFFECT, PROVEN BY
  ACCIDENT.** The bisect measured commits 3 and 4 (`a9c22df`, `c3bcbee`)
  at breathe 0.255 and 0.331 — **a 30% spread on byte-identical bundle
  code**, since neither commit touches `app/gaze`. Every single-run
  before/after in this section, S4's included, is inside that band.
  Bisect points are therefore NOT separable at n=1, and the bisect below
  is reported as a direction, not a verdict.

  **THE BISECT.** `bisect-breathe.sh` builds any historical commit's
  bundle in a worktree, swaps it into the running dev app, waits for a
  PID change and measures. Absolute breathe across the 56 commits:
  #2 0.255 · #4 0.331 · #5 0.362 · #14 0.313 · #28 0.402 · HEAD 0.372.
  Median patch height over the same points: 0.67 · 0.65 · 0.71 · 0.74 ·
  0.86 · 0.97. **The size grows monotonically and the "breathing" tracks
  it** — which is the same finding as the metric correction, arrived at
  independently.

  **SHIPPED 1: hysteresis on the keypoint union gate.** A hard threshold
  on a noisy score is a SQUARE WAVE. A hallucinated ankle crossing
  PERSON_KEYPOINT_MIN 0.3 on a chest-up shot moves y2 from ~0.60 to ~0.99
  in one pass — after the margins, a drawn height step near 0.46 with no
  motion behind it; a wrist crossing with the arm 0.12 outside the box is
  ~0.22 of drawn width. A keypoint now ENTERS at 0.30 and only LEAVES
  below PERSON_KEYPOINT_EXIT 0.22. **This cannot regress any accuracy
  class**: holding a keypoint in only ever keeps the box LARGER.
  Deliberately NOT module state — `detectPersons` already documents that
  one detector instance serves every video element, and this file has
  shipped that bug twice; the flags ride the same per-video `held`
  channel the admission hysteresis already uses, and a test pins that a
  null `held` behaves as a cold start.

  **SHIPPED 2: asymmetric size smoothing across an observation-source
  flip.** S4 guarded the size VELOCITY on a flip and bought almost
  nothing (0.372 -> 0.359) because the velocity is the derivative and the
  STEP is the event. Measured over the S4 trace: flip intervals are 11.5%
  of intervals and carry **30.3% of ALL absolute size change**, mean
  |dw| 3.17x the non-flip intervals — because a MoveNet box and a
  `personFromFace` body now disagree about WIDTH by 49-69% in this
  footage's face-height band, where pre-gauntlet they agreed to 12%. At
  alpha 0.6 that whole disagreement enters in one pass. Now: GROW keeps
  the full alpha, SHRINK drops to PTRACK_FLIP_SHRINK_ALPHA 0.2, centre
  untouched. Asymmetry is what makes it safe — a patch that shrinks
  slower over-covers for longer and cannot open EXPOSURE or PARTIAL,
  while a person who genuinely got wider is covered exactly as fast.

  **RESULTS, paired by video time (the only form that beats the noise),
  two independent before/after pairs:**

  | pair | rel-breathe-w mean delta | buckets calmer | busier |
  |---|---|---|---|
  | S4 r1 -> S5 r1 | -0.047 | 22 | 16 |
  | S4 replicate -> S5 r2 | -0.052 | 27 | 11 |

  Combined **49 buckets calmer against 27 busier**, both pairs agreeing
  in sign and magnitude. Whole-run means, n=2 each: rel breathe width
  0.391 -> 0.330, height 0.195 -> 0.156. **The means alone are NOT
  separable from the noise measured above; the pairing is what carries
  this claim.** Patch count unchanged (13/5/28 and 11/7/28).

  **Woman, same window:** jitter 0.138 -> 0.094, breathe 0.233 -> 0.162,
  rel breathe width 0.203, cover life p50 45.0s — continuous coverage for
  the entire run. dCount 0.87/s, stable intervals 91.2%.

  **ACCURACY GATE HELD.** Man t=901, frames read: one patch per covered
  frame, soft-edged, no rectangle; the cleared man sharp beside a covered
  subject including his face and shirt; f007 man-alone at zero patches.
  EXPOSURE 0, GHOST 0. gaze **184/184**, cargo **36/36**.

  **THE REAL TARGET IS NOW NAMED, AND IT IS NOT JITTER.** A median patch
  of 0.51 x 0.98 is a near-full-height slab, and five additive changes
  built it, every one with a measured EXPOSURE or PARTIAL case behind it:
  PATCH_MARGIN 0.08 (new, proportional, multiplies box AND every size
  step by 1.16x); UNION_KEYPOINT_MAX 13 -> 17 with the hip clamp deleted
  in the same commit (the bottom edge used to be anchored to hip-y, one
  of MoveNet's smoothest outputs; it is now the box regression unioned
  with a threshold-gated ankle); KEYPOINT_MARGIN 0.03 -> 0.05, which is
  0.089 in y on 16:9, a 2.96x cushion; and `personFromFace` growing to
  7.4h tall by 4.4h wide, which makes a full-height slab for any face
  height >= 0.135. **Do not shrink these to buy the metric** — that
  trades the gate for a number. The correct lever is the one two critics
  have now named independently: **use segmentation to TIGHTEN the
  rectangle** (S4 costed it: MediaPipe Selfie Segmentation tfjs graph
  model, 332,432 bytes, Apache-2.0), so the margins sit on a smaller and
  correct box rather than on MoveNet's slop.

  **Still open, ranked:** (1) tighten the box via segmentation — the only
  safe route to the size problem. (2) `mergeTracks`' hard 0.5/0.6
  threshold has no hysteresis, and crossing it changes the merged key, so
  `setTracks` destroys and rebuilds the DOM overlay and
  `lerpRect(null, target)` snaps with no glide; it changes patch COUNT so
  it is invisible to breathe by construction. (3) `detectPersons` and
  `detectFaceBoxes` each upload the FULL video element — ~16.6MB per
  verdict pass at 1080p, half of it pure duplication; still the biggest
  untaken perf win. (4) MoveNet's input is still squashed to 256x256.
  (5) the rAF loop never stops. (6) `PFF_HALF_CAP` is a hard step worth
  13% of the capped body width at h = 0.18 — ramp it.

  **HARNESS DAMAGE, AND THE RULE THAT PREVENTS IT.** Removing a git
  worktree that has `node_modules` JUNCTIONED into it deletes THROUGH the
  junction and empties the real directory — this emptied
  `app/gaze/node_modules` in the main checkout and only surfaced as an
  unrelated-looking `Cannot find package 'obscenity'` test failure.
  Restored with `npm ci`. **Delete the junctions before removing the
  worktree, every time.**
- **S6** (2026-08-26) — **a fix for the round's own headline finding was
  built, measured, and REFUSED on a frame: it exposed a child.** Rotation
  entry 5 (`cooking show episode`), resolved live to a NEW id
  `4u3jS_cTHH0` (Laughter Chefs, five people in a studio kitchen; R15's
  `KAWvDsghyc8` deliberately not reused). Baseline `NWoT1ZVd1Lo` t=560
  added mid-round as the regression check, and it is what caught the
  exposure. Build `93916bf-dirty`; app PID confirmed changed before every
  capture (46212 -> 44768 -> 4692 -> 38244). The dev WATCHER was alive
  this round (`npx tauri dev` detached with the CDP env var), so
  `touch lib.rs` really did rebuild — verified by PID each time.

  **SCORE, entry 5, `man`, t=400, 10 frames @1.5s (runs/s6-cook-man ->
  runs/s6c-cook-man).**

  | class | before | after |
  |---|---|---|
  | EXPOSURE | 1 | **0** |
  | PARTIAL | 0 | 0 |
  | FALSE COVER | **16** | **16** |
  | GHOST | 0 | 0 |
  | DRIFT | 0 | 0 |

  FALSE COVER is counted per PERSON per frame, and 16 across 10 frames is
  the worst figure in this log. All three men in the shot are covered on
  f001/f004/f005/f007; f000/f006/f009 cover one man each. The single
  EXPOSURE (f002, a woman at the extreme left edge, back to camera) is
  covered in the after run — **not attributed to anything shipped**; a
  patch simply reached further left on the second pass over the same
  frame. The after run is otherwise the same verdict frame for frame.

  **THE MECHANISM IS NOT MISGENDERING. IT IS THAT NOTHING CLEARS.** Every
  track on every wide frame reads `st:blurred, cs:0, cm:0, lv:uncertain`.
  Aggregated over the window, 76 unique gender reads:

  | | n | score range |
  |---|---|---|
  | male, not abstained | 36 | 0.03 - 0.95 |
  | female, not abstained | 22 | 0.00 - 0.66 |
  | abstained (null read) | 18 | all labelled male |

  **Certainty tracks FACE SIZE, not correctness.** Every read at native
  px >= 241 scored 0.84-0.95; every read at px 85-174 scored 0.03-0.58,
  i.e. below GENDER_CLEAR_SCORE 0.6. On a five-person wide shot one track
  in four or five ever produces a certain read and blur-first covers
  everybody else. Direction stays right in aggregate (36 male / 22 female
  against three men and two women in frame) — R6's finding reproduced on
  new footage.

  **BUILT: a weak-evidence clear.** `faceMeta` gained a `weak` flag for a
  same-direction read that is directed, adult and non-null at
  score >= GENDER_MIN_SCORE but below the clear bar; the tracker
  accumulated GENDER_WEAK_STREAK_N = 4 consecutive such reads and cleared
  on them, with any non-same-direction read zeroing the streak, one
  certain opposite read revoking instantly (no two-read grace), and a
  short 2s TTL. Two iterations were needed: the first zeroed the streak
  on every pass that carried no face, which made it unreachable (`ws`
  never exceeded 1 on any track, measured runs/s6b-cook-man) — **the
  streak is over READS, not over PASSES**, because a track on a
  five-person shot is attributed a face on roughly one pass in three.

  **REFUSED, on runs/s6e-base-man, and this is the round's real result.**
  On the canonical baseline video in `man` mode, track 7 reached the
  streak and cleared at f001 (`ws:4`), and **f001 and f002 show the
  owner's daughter FULLY SHARP — f002 with no patch anywhere in the
  frame.** The child gate cannot stop this: it demands
  childP < GENDER_CHILD_MASS 0.25, and R18 measured a known 8-year-old at
  childP 0.15-0.72 (median 0.42), so a minority of her reads pass it. The
  CERTAIN path has survived that for six rounds only because it ALSO
  demands score >= 0.6, which those same reads do not reach. **The two
  gates are not independent, and the weak band is exactly where the child
  reads live.** Lowering the certainty bar removes the second lock while
  leaving the first one leaky. Reverted the same round; the whole
  derivation is written into `person-track.mjs` above
  GENDER_WEAK_STREAK_N so the next round cannot re-propose it from the
  diff alone.

  **What survives is measurement.** The streak is still counted and
  reported (`ws` on the tracks probe, `weakBump` / `weakZero` /
  `weakWouldClear` in `life`) and moves no state — pinned by a test that
  30 consecutive weak reads never clear a track. First numbers:
  `weakWouldClear 2` per 15s on the baseline video at `weakBump 27`; on
  the cook footage `weakBump 31` with the streak never reaching 4,
  because tracks do not live long enough (below).

  **RE-VERIFIED after the revert (runs/s6f-base-man, same window):
  EXPOSURE 0, PARTIAL 2, FALSE COVER 8, GHOST 0, DRIFT 0.** The daughter
  is fully covered on all ten frames, including the two that exposed her.
  The two PARTIALs are her shoulder and sleeve outside the patch on
  f007/f008 — torso-only framings where MoveNet returns 0 persons and the
  patch is a `personFromFace` synthetic. FALSE COVER 8 is the man covered
  on eight frames: his face is out of frame or downcast through most of
  this window, so he is a faceless person and blur-first covers him by
  design. **The before-state on this video was not separately captured** —
  it was added mid-round as the check that caught the exposure, and the
  run it replaces is the exposed build. Symmetry (runs/s6g-base-woman,
  same window): **EXPOSURE 0**, everything covered, `ws` 0 on every track
  because female weak reads are far rarer than male ones. On the cook
  footage `woman` (runs/s6d-cook-woman) covers every person in frame just
  as `man` does — the failure is symmetric, which is what the mechanism
  predicts.

  **ALSO SHIPPED — three findings from this round's critic, whose brief
  was the pipeline as a SCHEDULING system** (a lens no previous critic
  has had: cadence, coast budgets, the rAF loop, and every budget
  expressed in milliseconds while the thing it budgets is counted in
  passes).
  1. **`headAgeMs` was double-counted.** The position-only branch adds
     `dt` per position pass and the verdict branch added `vdt` — the gap
     between GENDER READS, which already spans those same position
     passes. So a cleared man's head hole aged at ~2x real time and
     expired after ~500ms against HEAD_HOLE_MAX_AGE_MS 1000, and he was
     covered again by his neighbour's patch. One token.
  2. **`demoteTracks` dropped `fromFace`.** `coastStep` carries
     provenance with an explicit comment about why; the demote path has
     the identical hazard and had no carry, so every face-derived
     observation after a cut registered as a source FLIP that never
     happened — and a flip selects S5's asymmetric damper, shrinking the
     box 5x slower on manufactured evidence. Measured srcFlip 15 against
     10 cut-demotions in one 15s window. One line.
  3. **`PTRACK_CUT_COAST_MS` is the only budget `setVerdictCadence` never
     rescaled.** Flat 400ms against `missMs`, which accrues in PASS
     intervals — and a track supported only by a face is invisible to
     position passes, so it can only be refreshed by a verdict. At the
     target's stated verdict range (600-1000ms) a demoted track dies
     ~500ms BEFORE the next verdict could see it: one chance, every cut.
     Now `min(cap, max(400, effZoom))` — **1.0x, not the 2.5x the other
     two use, and byte-identical at the desktop cadence by construction**
     (max(400,400) = 400), so R15's Hell's Kitchen calibration cannot
     regress here and the change is only ever visible on slower hardware.
     Pinned by a test in both directions.
  4. **`cutDetected` life counter** at the one place a cut is accepted.
     Everything downstream of that branch is sized by how often it fires
     and nothing had ever recorded it. First numbers: **8 cuts per 15s on
     the cook footage (a 1.9s mean shot), 5-6 on the baseline video.**
     The critic's proposed changes to CUT_DELTA and to the forced-pass
     gap are deliberately NOT taken until this number exists on real
     footage.

  **THE STRUCTURAL FINDING THIS ROUND ADDS, with numbers.** On the cook
  footage `birthFresh` is **0-1** against 14 births and 23-25 track
  deaths per 15s: the system is not detecting new people, it is losing
  and re-minting the same ones. `demoteTracks` zeroes `clearStreak` on
  every cut, and CLEAR_STREAK_N needs 2 CONSECUTIVE certain reads on ONE
  track. At 8 cuts per 15s the mean shot is 1.9s, and a given track is
  attributed a face on roughly one verdict pass in three — so it gets
  **~1.6 attributed reads per shot against a bar of 2.** Clearing is
  structurally unreachable on fast-cut multi-person footage, on THIS
  desktop, before any mobile penalty. That is the ceiling behind FALSE
  COVER 16, and no threshold change reaches it.

  **COST.** Cook `man` verdict p50 136 -> 126ms, pass p50 26 -> 25ms;
  baseline `man` verdict p50 96ms, pass p50 30ms; baseline `woman`
  verdict p50 113ms, pass p50 31ms. `first == max` on verdict again
  (1383-3156ms) = model warm-up. Everything shipped is arithmetic inside
  loops that already run. gaze **197/197**, cargo **36/36**.

  **Still open, ranked.**
  1. **Clear evidence does not survive a cut, and shots are 1.9s.** The
     measured ceiling above. Any fix is EXPOSURE-adjacent — the reason
     `demoteTracks` wipes the verdict is that the box may now be over
     somebody else — so it needs its own round with a per-track
     re-identification argument, not a constant.
  2. **A better read on a small face** is the only route to the FALSE
     COVER 16 that this round could not take. A lower bar on a bad read
     is now measured to be the wrong answer.
  3. Critic finding 3, unmeasured and NOT taken: `applyMask` is called
     per overlay per rAF frame with UNROUNDED geometry while `place()`
     uses a 2px deadband, so the mask string differs every frame for any
     moving patch and 10 CSSOM writes land on a `backdrop-filter` layer
     60x/s. It also means mask and element geometry are out of register
     by up to 2px. The fix is four `Math.round`s; the magnitude needs a
     pixel measurement in the real WebView first, per this repo's own
     history with CSS reasoning.
  4. Critic finding 4, NOT taken: `entry.at` is stamped at pass END while
     the box describes pass START, so the drawn patch is short by
     `v * passCost` — and that deficit ALTERNATES between the 26ms
     position cost and the 126ms verdict cost, i.e. a periodic backward
     step locked to the verdict clock. One argument to fix; measure
     `breathe` and median patch area either side, because it also
     increases outward extrapolation.
  5. Critic finding 2, instrumented only: the cut path bypasses BOTH
     adaptive throttles, and the gate compares a VIDEO-clock luma delta
     against a wall-clock tick interval that has a floor and no ceiling,
     so a busy main thread or `playbackRate > 1` inflates the delta and
     manufactures cuts — a closed loop with no damper.
  6. Unchanged from S5: tighten the box via segmentation; `mergeTracks`
     has no hysteresis; `detectPersons` and `detectFaceBoxes` each upload
     the full video element; MoveNet's input is squashed to 256x256; the
     rAF loop never stops.

  **HARNESS NOTE.** The probe reads overlay rects BEFORE the pause/shot
  pair, so on fast-cutting footage the reported `patches` list can
  disagree with what the two screenshots show. Score from the IMAGES; the
  rect list is for attribution, not for counting. Three frames this round
  disagreed.

- **S7** (2026-08-26) — **the first PHONE screenshot this project has ever
  had, and it invalidated a shipped feature on sight.**

  Owner, with a v0.1.17 screenshot from his device: *"I meant that the
  square edges should not have been shown and a nice blur ... and like a
  Linus still gets blurd sometimes but I like the progress though it
  still isn't as smooth."*

  **THE SOFT EDGE HAD SHIPPED AND WAS INVISIBLE ON HIS HARDWARE.** S4
  capped the feather at 16 ABSOLUTE PIXELS (cut from 26 to protect a
  cleared man at a patch edge). His patch measures ~460px across, so the
  ramp was **3.5% of it** — a gradient by construction, a hard rectangle
  to the eye. Every frame I verified it on was a desktop player where the
  same 16px read differently. **A pixel constant makes appearance depend
  on player size, which is precisely what differs between this machine
  and the only device that matters.** The width is now a FRACTION of the
  patch's short side (FEATHER_FRAC 0.10, floor 10px, ceiling 64px, and
  never more than a third of the patch), with a three-stop front-loaded
  falloff instead of a single linear ramp, because one linear ramp still
  reads as a band edge.

  **THE FIRST ATTEMPT FIXED THE EDGES AND MADE HIS SECOND COMPLAINT
  WORSE.** Outward-only feathering grows the drawn element by 2f per
  axis; once f scaled with the patch, measured coverage went to
  **72-99% of the picture** (f000 at 98.6%) — i.e. "a Linus still gets
  blurred", by construction. Caught by reading the frames, not by any
  metric: patch COUNT and breathe were both unmoved.

  **SHIPPED: half the ramp inside the box, half outside.** The element
  grows by f/2 and the ramp spans f from its edge, so the fully-opaque
  core sits f/2 INSIDE the requested box. That is affordable because S5
  measured the slack: PATCH_MARGIN 0.08 proportional + PTRACK_PAD 0.10 +
  keypoint margin 0.05 (0.089 in y on 16:9), with the median patch at
  0.51 x 0.98 of frame — roughly twice the subject. f/2 is about 5% of
  the short side, inside that margin, and the ramp is still at alpha 0.85
  at 78% of its width, so the only region losing meaningful coverage is
  the outer sliver of margin the box did not need.

  | | S4/S6 (16px cap) | outward-only, scaled | **shipped: split** |
  |---|---|---|---|
  | coverage across 6 frames | 66-94% | **72-99%** | **60-75%** |
  | visible square edge | YES (owner) | no | no |

  **Stability is unmoved, which is the correct result** — this is an
  appearance change, not a tracking change. Paired by video time against
  bc7ee2c over 46 buckets: patch count 10 fewer / 3 more / 33 same;
  rel-breathe-w 23 calmer / 15 busier, mean +0.018. Whole-run, before ->
  after: patches mean 0.85 -> 0.83, dCount 0.40 -> 0.36/s, jitter 0.166
  -> 0.163, stable intervals 95.8% -> 96.5%, rel breathe width 0.330 ->
  0.349. All inside the noise band this section measured in S5.

  **Frames read (man t=901):** the cleared man's face, cap, shirt graphic
  and forearm all sharp, with the blur fading in across the gap and no
  rectangle boundary anywhere in the picture. EXPOSURE 0, GHOST 0.
  gaze **199/199**, cargo **36/36**.

  **NOT FIXED, and it is his third point.** "Still isn't as smooth" and
  "Linus still gets blurred sometimes" are the verdict and box-size
  problems, untouched here: the median patch is still 0.51 x 0.98 of
  frame with 70% of patches pinned to the frame edge. Softening an edge
  does not shrink a slab. The lever remains segmentation as a
  box-tightener (S4 costed it: MediaPipe Selfie Segmentation tfjs graph
  model, 332,432 bytes, Apache-2.0).

  **THE LESSON WORTH MORE THAN THE FIX.** Twenty-odd rounds of frame
  verification on this desktop could not have caught a bug whose entire
  mechanism is "the player is a different size on his phone". Every
  appearance constant in the renderer should be relative to the patch or
  the player, and any that is not is a desktop-only assumption waiting
  to be found by a screenshot.

- **S8** (2026-08-26) — **two shipped, one built and refuted by its own
  measurement, and a harness artifact that has been faking a failure
  class for every round in this section.**

  **SHIPPED 1: the top pad is capped by the HEAD, not the body.**
  `PTRACK_PAD_TOP` 0.12 is a fraction of the BODY box, so on a
  full-height person it asks for ~0.11 of the frame above the box — about
  eight times the hair it exists to cover — and above the frame it simply
  clamps. The critic measured the whole margin chain at 1.66x the core box
  at p50, with margins ALONE taking full-height patches from 0% to 39%.
  `topPad()` now returns `min(h * PTRACK_PAD_TOP, headH * 0.6)` whenever
  the head was actually measured, and the old body fraction when it was
  not (R18 measured `headX` null on 59% of admitted persons in the weak
  tier — those are unchanged, by construction). The cap only ever REDUCES
  the pad, and only above a crown person-gate has already covered with
  `headH * 1.1`, so it cannot uncover a face.

  **THE PLUMBING WAS THE WHOLE JOB, AND IT IS THE SAME DEFECT CLASS FOR
  THE FOURTH TIME.** `ema()` returns a bare `{x1,y1,x2,y2}` literal, so
  every field hung on an observation's box is dropped on the first frame
  of every track's life. `topPad` reads `t.headH`, which did not exist:
  written the obvious way the change is **silently inert** and would have
  measured as "no effect" rather than "not wired". `headH` now rides the
  TRACK through all five lifecycle sites (matched, new, coast, demote,
  and the position-only early return), exactly as `fromFace` does, with a
  test pinning that it survives a position pass.

  **Units, because they were nearly wrong:** `headW` is normalized-X and
  the pad is a Y quantity; on 16:9 that is a 1.78x error in the quiet
  direction. `person-gate` already computes `headH = headW * ar`, so both
  producers (`parsePersons`, `personFromFace`) now emit it and the tracker
  never has to know the aspect.

  | man, 880s | S7 | S8 r1 | S8 r2 |
  |---|---|---|---|
  | patches pinned at frame edge | 0.707 | **0.610** | **0.577** |
  | median patch height | 1.012 | 0.990 | 0.974 |

  Both runs move the same way; the effect is modest because in this
  footage `y1` is usually already at 0, where a smaller pad changes
  nothing. It bites on the chest-up and mid-shot framings, not the slabs.

  **SHIPPED 2: one frame upload per verdict pass instead of two.** On the
  `directPersonOk` path the person pass and the full-frame face pass both
  read the SAME `<video>`, and each ran its own `fromPixels` — ~8.3MB at
  1080p, twice, per pass, across a shared memory bus. `uploadFrame` /
  `disposeFrame` hand one tensor to both; a `sharedImg` of null falls back
  to the old behaviour exactly, which is what the non-direct path (a 256px
  ImageData for persons, the video for faces — genuinely different pixels)
  keeps. **The gate on this was leak, not speed**, since a tensor leaked
  once per pass is far worse than the duplication it removes: `memcheck.py`
  samples `tf.memory()` across a minute of continuous playback, and over
  68s / ~270 passes the drift was **-4 tensors and -24.9MB**. Ownership is
  explicit — the tensor is created outside `tf.tidy` so the tidy cannot
  free it, and an idempotent `releaseFrame` runs on both the resolve and
  the reject path, before the terminal `.catch`.

  **BUILT, MEASURED, REFUTED: suppressing the phantom source flip.** A
  position pass is MoveNet by construction, so on a face-derived track it
  reports a source change on every fast pass and again on the next verdict
  — 105 such events against 51 genuine ones in a 90s run. Suppressing
  them, and carrying `fromFace` through the position return so the
  following verdict stopped seeing a phantom flip either, made the patch
  measurably BUSIER:

  | pairing | rel-breathe-w mean | calmer | busier |
  |---|---|---|---|
  | S7 -> S8 with suppression | **+0.133** | 10 | 28 |
  | with suppression -> without | **-0.113** | 49 | 26 |
  | S7 -> S8 shipped | +0.010 | 18 | 21 |

  Two independent pairings agree in sign and magnitude, several times the
  pairing noise S5 measured. **The flip is not the event; the
  DISAGREEMENT is.** A MoveNet box and a `personFromFace` body describe
  one human and differ 49-69% in width, and that disagreement is present
  on every pass that MIXES them, not only on the transition — the phantom
  flips were accidentally applying the shrink damper to most of that
  population, and removing them handed the whole thing back to alpha 0.6.
  Reverted, with the numbers written into `matchedStep` so the next round
  does not re-tidy it. **The correct fix is to gate the damper on the SIZE
  STEP instead of on provenance**, which is a measurement, not a cleanup.

  **THE HARNESS HAS BEEN MANUFACTURING A FAILURE CLASS.** `f003` showed
  the right two-thirds of the frame blurred with a hard vertical edge, and
  `meta.json` claimed one small patch in the bottom-right corner. The
  frame and its explanation disagreed, which the skill says means the
  explanation is wrong — and it was, but not in the interesting direction.
  A live probe found `getComputedStyle(video).filter = blur(42px)`: the
  WHOLE-VIDEO blur-first state. Sampled across 45s of continuous playback
  it is **0 of 90 samples** — it only exists in the window after a SEEK,
  which is precisely what the gauntlet does before every screenshot.
  **The capture can photograph a state that never occurs while watching.**
  It is correct behaviour (unknown ⇒ covered) photographed at the one
  instant that makes it look like a defect, and any past round that scored
  a "whole frame blurred" frame from a seek was scoring the harness.
  Fix for a later round: hold the shot until `videoFilter` is `none` or
  the first post-seek pass has landed, and record which it was.

  **ACCURACY GATE HELD.** Man, t=880, 8 frames read: `f002` and `f006`
  man alone at **zero patches**, fully sharp — face, cap, shirt graphic,
  watch, hands. `f007` the man sharp beside a covered subject with the
  feather visible as a gradient and no rectangle boundary. `f000` covers
  him for exactly one frame at track birth and clears on the next — that
  is blur-first, not FALSE COVER. **EXPOSURE 0, GHOST 0.**
  gaze **202/202**, cargo **36/36**.

  **Woman direction, same window:** patches mean 1.44, cover life p50
  29.7s, jitter 0.136, rel breathe width 0.286, stable intervals 92.5%.
  No asymmetry against the man direction.

  **Still open, ranked:** (1) size-step gating for the shrink damper, per
  the refutation above. (2) tighten the box via segmentation — still the
  only safe route to a median patch of 0.51 x 0.98, and the model is
  already downloaded (`spikes/segspike/`, MediaPipe Selfie Segmentation
  tfjs graph model, 332,432 bytes, Apache-2.0, input [-1,256,256,3]).
  (3) the seek artifact above. (4) `mergeTracks`' hard 0.5/0.6 threshold
  still has no hysteresis and crossing it destroys and rebuilds the DOM
  overlay. (5) MoveNet's input is still squashed to 256x256.

- **S9** (2026-08-26) — **three renderer/tracker fixes whose common
  mechanism is "the same people, described differently, look like new
  people", the segmentation cost number the owner asked for, and two
  frames that finally name "Linus still gets blurd sometimes".**

  **THE ROUND'S NUMBERS, man, t=890, 45s, paired by video time against
  the same build immediately before the diff (two independent after-runs):**

  | | before | after r1 | after r2 |
  |---|---|---|---|
  | dCount/s | 0.53 | 0.44 | **0.27** |
  | jitter/s | 0.206 | 0.173 | 0.176 |
  | breathe/s | 0.381 | 0.325 | 0.308 |
  | rel breathe w | 0.367 | 0.386 | 0.331 |
  | stable intervals | 0.953 | 0.956 | **0.975** |
  | cover life p50 | 1.03s | 7.67s | 7.45s |

  Pairing: r1 24 buckets calmer / 14 busier, r2 25 / 13, patch count 11
  fewer / 1 more. Both after-runs agree in sign. Against the section's
  original baseline (8c5a2f3): patches mean 2.08 -> 0.83, max 7 -> 3,
  dCount 2.23 -> 0.27-0.44, jitter 0.264 -> 0.175, breathe 0.466 -> 0.32,
  stable 67% -> 95.6-97.5%.

  **SHIPPED 1: the merged key was order-dependent, and that is a DOM
  rebuild with no metric watching.** `mergeTracks` built its key as
  `[a.key, b.key].sort().join('+')` — sorting the two COMPOSITE strings,
  which is not order-independent once a group has three members. Merging
  7 and 9 first gives `12+7+9`; merging 12 and 9 first gives `12+9+7`.
  Same three tracks, two keys. The key is the overlay's DOM identity, so
  a permutation destroys and rebuilds the node — and `lerpRect(null, to)`
  returns the target outright, **the only path in the renderer that skips
  both SHRINK_DEADBAND and SHRINK_LERP**. Fixed by flattening to member
  ids and sorting those. The merge order really does permute:
  `updatePersonTracks` rebuilds matched-then-coasted-then-new in
  IoU-descending order, and person-gate already documents MoveNet's slot
  order permuting independently.

  **SHIPPED 2: the overlay is ADOPTED across a key change instead of
  rebuilt.** The same argument generalises: a merge, an unmerge and a
  re-ordering all produce a different key for the same humans. `setTracks`
  now adopts the unused overlay sharing the most member ids, keeping the
  node — and with it `__tsW`/`__tsH`/`__tsTf`, the compositing layer and
  the backdrop snapshot — and keeping its rendered rect, so an unmerge
  GLIDES down through the damper instead of dropping from the union of
  two boxes to one box in a single frame. Guarded so adoption can never
  steal a node a later track will claim by exact key. **Safe by
  direction:** inheriting a union rect starts the patch too LARGE and
  shrinks it, which cannot expose anyone.

  **SHIPPED 3: the head geometry got the hysteresis S5 gave the box.**
  `headX`/`headW` were hard-thresholded at PERSON_KEYPOINT_MIN 0.3 while
  the box around them enters at 0.30 and leaves at 0.22. One ear decaying
  across 0.3 changes the head mean from `{nose, eye}` to
  `{nose, eye, ear}` — 0.3-0.5 headW of movement with nobody moving — and
  flips `headW`'s rung from shoulder-derived to ear-derived, tens of
  percent in one pass. That matters twice: `headW` sets **sameHuman's
  merge tolerance**, so the bar itself was a square wave, and since S8
  `headH` sets the patch's **top edge** through `topPad`. The head
  keypoints and the shoulders are all inside UNION_KEYPOINT_MAX, so the
  union loop has already decided their hysteresed membership — reused,
  rather than a second rule that could disagree with the box.
  **Deliberately NOT applied to admission**: holding a decayed ear there
  would admit a person the gate meant to refuse. dedupeHeadSplit 131 ->
  127 over the same window.

  **SEGMENTATION COST, MEASURED (target 4, owner asked whether it is even
  allowed — it is).** MediaPipe Selfie Segmentation, Apache-2.0, tfjs
  graph model, 332,432 bytes, handed to the page over the debug channel so
  the shipped bundle does not grow for a spike (`spikes/gauntlet/segcost.py`,
  `__TS_GAZE_SEG_SPIKE` in detector.js). Desktop WebView2, RTX 3060 Ti,
  live 1080p video, including the full `[256,256,2]` download:

  | | |
  |---|---|
  | first inference (shader compile) | **2820ms** |
  | p50 / p90 / max after warm-up | **18.9 / 47.4 / 55.7 ms** |
  | load from base64 | 5.9ms |
  | input | FIXED at 256x256 — 128 is rejected by the graph |

  **Against the pass budget measured the same session** (stage marks now
  in the pipeline, p50, cumulative): a VERDICT pass is 102ms — MoveNet 23,
  full-frame faces +12, **per-person crops + gender +64**, tracks and
  render ~0. A POSITION pass is 25ms, all MoveNet. So segmentation is
  **+18% on a verdict pass and +75% on a position pass** on a desktop GPU,
  and it CANNOT replace the 64ms crop stage because identity still has to
  come from faces and gender. It is a box-tightener, nothing more, and
  that is now a number rather than a hope. The 2.8s first inference also
  means it cannot be loaded lazily mid-video without a visible stall.

  **THE TWO FRAMES THAT NAME "LINUS STILL GETS BLURD SOMETIMES".** Gate
  run, man, t=890, 8 frames, every one read. EXPOSURE 0, GHOST 0,
  PARTIAL 0. But FALSE COVER on two frames, with two DIFFERENT mechanisms,
  and both are frame-backed for the first time:
  - **f002 — verdict flicker.** Track 6 is `cleared` at f001, `blurred` at
    f002, `cleared` again at f003, with the track-id set unchanged and the
    man reading male s=0.63 on that very pass. The round's critic measured
    this class independently at **0.17/s in the man direction against
    0.06/s for merge churn** — i.e. in the owner's own mode, verdict
    flicker is THREE TIMES the merge problem, and it is the thing nothing
    this round touched.
  - **f007 — merge over-reach from a duplicate identity.** Three tracks
    (6 cleared, 7 and 10 blurred) on two humans; `mergeTracks` unions 7
    and 10 into a patch spanning 0.30-1.03 which swallows the cleared man
    entirely. His OWN track is correct; the union is what covers him.

  **The critic's structural finding behind f007, measured over the stored
  traces:** the tracker carries **3-4 tracks on a two-person scene in 16%
  of samples** (tracks=3/patches=1 in 122 of 866), and `mergeTracks` is
  HIDING that, not preventing it. Patch count reads stable because a hard
  union collapses duplicates to one rectangle; every duplicate is one
  noisy pass from drawing itself, and when the union is what draws, it
  over-reaches onto a cleared neighbour. **89% of coexisting patch pairs
  overlap without merging, at a criterion p50 of 0.64 of its own bar (man)
  and 0.86 (woman).**

  **NOT verified against a before-build at the same window**, so I cannot
  call these two FALSE COVERs new or old from measurement. By construction
  neither is reachable from this diff: verdict flicker needs no geometry
  change, and `mergeTracks`' union rule is untouched. Stated as a limit,
  not a claim.

  **ALSO SHIPPED, off-round, owner named it with a phone screenshot** ("on
  selection it shows the blue thing at many places making it feel
  unpolished"): Android's WebView paints a translucent teal rectangle
  behind every tapped element. The launcher has killed this since the #10
  polish pass; platform pages never did, because the injected CSS only
  ever carried rules and blur. `chrome_css()` in lib.rs now ships
  `-webkit-tap-highlight-color: transparent` on every platform page in
  every mode, with a test across four host/mode combinations. Verified
  live on the dev app: the rule is in the injected sheet and a button
  computes `rgba(0, 0, 0, 0)`. **That is a computed-style proof, not a
  pixel proof, and the symptom is Android-only** — it needs an APK on the
  emulator to photograph, which is the exact gap S7 was written about.

  **INSTRUMENTATION LEFT FOR THE NEXT ROUND** (both settle a question
  rather than guess at it): `stability.py` now records each track's STATE
  and each overlay's `__tsKey` per sample, so the f002 class is attributed
  DIRECTLY instead of by elimination; and the verdict pass carries stage
  marks (`upload`/`persons`/`fullFaces`/`crops`/`tracks`/`end`) in
  `__TS_GAZE_IDS.stages`, which is where the 64ms crop figure came from.

  **Still open, re-ranked by the evidence above:** (1) **verdict flicker**
  — 0.17/s in the man direction, three times the merge churn, and now with
  a frame behind it. (2) **duplicate identities** — 3-4 tracks on 2
  humans, 16% of samples; f007 is what happens when the union draws. Fix
  at association, not at rendering. (3) the shrink damper: sign
  persistence over step magnitude, with ONE probe (per-track per-pass
  `{wObs, hObs, wTrack, dt, fromFace, cut}`) that settles both proposals
  before either is built — a magnitude gate is wrong on a genuine fast
  shrink (zoom-out, walk-away) where the identity check stays silent, and
  it self-feeds if measured against the damped track instead of between
  consecutive observations. (4) `cover_life_p50` measures coverage
  EPISODES, not patch lifetimes — ~15 heavy-tailed samples per run, which
  is why it reads 1.03 and 7.67 on the same behaviour; replace with a
  greedy-IoU patch life and report births/deaths per second. (5) `jitter`
  and `breathe` skip every interval where the count changed, so the two
  headline geometry metrics are blind BY CONSTRUCTION to exactly the
  births and deaths the owner described. (6) `clearedHeadHoles` still has
  no ownership test, and with duplicate identities a cleared duplicate can
  punch a sharp window into its twin's patch. (7) the compound-blur seam
  between overlapping sibling patches, named in S3 and still unmeasured,
  at 72-238 overlapping pairs per run.

- **S10** (2026-08-26) — **the re-blur is the SCENE CUT, measured three
  independent ways, and the flag streak that three rounds were spent on
  fires ZERO times.**

  **THE ROUND'S NUMBERS, man, t=890, 60s** (before = HEAD 7c3f361, after
  = this diff; paired by video time, plus a replicate):

  | | before | after r1 | after r2 |
  |---|---|---|---|
  | patches mean / max | 0.84 / 2 | 0.86 / 3 | 0.84 / 3 |
  | dCount/s | 0.37 | 0.50 | 0.47 |
  | births/s | 0.27 | 0.28 | 0.27 |
  | jitter/s | 0.197 | **0.147** | 0.159 |
  | breathe/s | 0.323 | **0.257** | 0.270 |
  | rel breathe w | 0.342 | **0.288** | 0.293 |
  | stable intervals | 0.963 | 0.955 | 0.955 |
  | cover life p50 | 1.33s | 3.39s | 1.26s |

  Paired: **33 buckets calmer / 18 busier, mean -0.060**; patch count 8
  fewer / 6 more. `cover_life_p50` swinging 1.26-3.39 on the same build is
  S9's F1 finding restated — it measures coverage EPISODES, ~15
  heavy-tailed samples per run, and should be replaced.

  **WHAT THE ROUND ACTUALLY ANSWERED.** S9 left "verdict flicker" as the
  #1 open item, attributed by ELIMINATION. S10 measured it directly, from
  the track STATE the S9 round put into the trace:

  **`cleared -> blurred` on a SURVIVING track: 0.117/s** (7 events in
  60s). Episodes last **0.42, 0.43, 0.83, 0.41s** — three of four are
  exactly ONE verdict interval. Track ids are never reused
  (`nextTrackId` is monotonic with no reset anywhere in the tree), so a
  surviving id is proof this is a state flip and not a death and rebirth.

  **Then the correlation: 6 of 7 revocations land within 0.21s of a
  `cutDetected`.** The one exception carries `abstainDemote`.

  **Then the counters, added this round to settle it directly rather than
  by correlation** — the flag branch was the only `cleared -> blurred`
  path in `person-track.mjs` with no `bump()` at all:

  | counter | run 1 | run 2 |
  |---|---|---|
  | `cutDetected` | 10 | 9 |
  | **`cutDemoteCleared`** | **8** | **6** |
  | `abstainDemote` | 1 | 1 |
  | **`flagDemote`** | **0** | **0** |
  | `flagDemoteStale` | 0 | 0 |
  | `flagDemoteMixed` | 0 | 0 |
  | `flagBlurFresh` (not a revoke) | 4 | 3 |

  **`demoteTracks` is the re-blur.** Every scene cut throws away every
  earned clear, and the owner watches fast-cut footage: cuts run at
  0.15-0.17/s here, so a correctly-cleared man is re-covered 6-8 times a
  minute for ~0.4s each. That IS "a Linus still gets blurd sometimes",
  and it is not a bug in the verdict — it is the documented cut policy.

  **AND THE POLICY'S JUSTIFICATION NO LONGER EXISTS.** The comment at the
  call site (`init-entry.js`, the cut branch) says: *"DEMOTE, don't wipe:
  boxes persist so coverage holds through the pass gap, but every verdict
  state resets to blurred — identity memory, not stale association,
  decides who re-clears."* **R13 deleted identity memory** (the descriptor
  bank saturated in seconds; 17% of different-person pairs matched above
  threshold — owner decision). The demotion survived the deletion of the
  mechanism that made it cheap. Nothing was put in its place, and nothing
  counted the cost until now.

  **THE CUTS ARE REAL — the threshold is NOT the fix.** S6's critic asked
  for `CUT_DELTA` to move and was refused pending a count. Measured this
  round over 532 scene-gate samples in 60s: p50 9.3, p90 16.9, p95 21.0.
  Only **9 samples reach the 28 bar, and 8 of those are 61-80** — far
  above it; exactly one (30.4) is near the line. The 20-28 band (21
  samples) is ordinary camera motion, correctly rejected. **CUT_DELTA 28
  is well calibrated on this footage**; raising it to 40 would change one
  event a minute and risk missing a real cut. S6's proposal is refuted by
  measurement, not by argument.

  **NOT FIXED THIS ROUND, DELIBERATELY.** Surviving a cut with an earned
  clear intact is an EXPOSURE trade: if a different person occupies the
  same screen region after the cut, keeping `cleared` is exactly the
  failure the demotion exists to prevent (owner 2026-08-24: subjects
  "switching one another"). That decision deserves its own round, and it
  now has the counter — `cutDemoteCleared` — to be measured against.
  The re-cover window is also already at its floor: the cut branch zeroes
  `lastSample`/`lastZoomAt`, `gateTick` runs inside `sampleOnce` on the
  rVFC loop ahead of both early returns, so detection is frame-driven and
  the forced VERDICT pass runs on the next tick. 0.42s at 10Hz sampling is
  ~one verdict interval plus quantisation; nothing schedulable is left.

  **SHIPPED: stop paying for a read that is thrown away.** `observeCropped`
  now calls `ownFaceIndex(faces)` BEFORE `classifyBest`. It is pure and
  reads only `faces` plus the person's head anchor, so the answer was
  already knowable — yet it was computed at the top of `classifyBest`, a
  full faceres inference on a fresh 224px native crop ran in between, and
  when it came back -1 the caller returned hard-covered without reading
  the result. It also stops a real defect: the discarded path still
  salvaged `desc` from `bestIndex`, i.e. the LARGEST face in a padded crop
  that R19 measured as containing more than one face 19 times in 40 — on a
  two-shot that stored the NEIGHBOUR's descriptor on this person's track,
  and that descriptor is the only input `identityBroken` trusts.
  **HONEST SIZE: the probe comment claiming `own === -1` on 25% of reads
  does not hold on this footage** — `ownMissSkipped` measured **3 and 2
  per 60s**, so the saving here is small. The correctness half stands
  regardless.

  **PERFORMANCE, measured, and the crop stage now has a scaling law.**
  Stage marks (added S9) over 39 verdict passes, crop+gender p50 by person
  count: **0 persons 13ms · 1 person 37ms · 2 persons 78ms · 3 persons
  95ms**. Verdict total p50 105ms, position pass 25ms (all MoveNet). So
  the stage is **~35-40ms PER PERSON** on an RTX desktop, and
  ZOOM_MAX_PERSONS is not the lever — the per-person cost is. That is the
  number any future crop-batching or resolution change has to beat, and it
  is proportionally worse on a Helio G88.

  **ACCURACY GATE: EXPOSURE 0, GHOST 0, PARTIAL 0.** 8 frames, all read.
  Steady state is right — f006 has the man fully sharp (face, cap, shirt
  graphic, forearm) beside a covered subject, soft-edged, no rectangle.
  FALSE COVER on two frames, unchanged from S9 and both already named:
  f002 (t=894.8) is the revoke — and the new per-pass fields show it was
  `abstainStreak 1` at f001 then demoted with `missMs 0`, i.e. the
  ABSTAIN path, not `stale` and not the flag streak; f007 is merge
  over-reach, patch 0.31-1.03 swallowing the cleared man.
  **The gate's own distribution differs from continuous playback** because
  it seeks before every frame (S8's harness finding): abstainDemote is 1
  per minute in continuous play against cut demotion's 6-8.
  gaze **209/209**, cargo **37/37**.

  **INSTRUMENTATION LEFT** (all measurement, no decision changed):
  `abstainStreak` rides the track beside `flagStreak` so the MIX behind a
  revocation is visible — the design intent says "2 consecutive certain
  opposite reads" but abstentions advance the same counter, so one of
  each also revokes; `flagDemoteMixed`/`abstainDemoteMixed` count it, and
  the constant is not moved until the share is known. The per-pass track
  probe now carries `as`, `ca` (clearAge) and `mm` (missMs), so the TTL
  paths and `stale` are joinable to a frame for the first time. The scene
  gate records its luma delta.

  **Still open, re-ranked:** (1) **the cut/clear trade** — 6-8 earned
  clears destroyed per minute, now counted; any fix is an exposure
  decision and needs the owner or a dedicated round. (2) **attribution**:
  `ownFaceIndex`'s fall-through picks the LARGEST face in the crop with no
  distance test when the head anchor is null (59% of weak-tier persons),
  and its tolerance `max(0.18, fw)` scales with the CANDIDATE's width —
  the crop geometry is stable across a verdict interval, so a stolen face
  is stolen twice, which is how any streak-of-2 protection is defeated.
  (3) the flag side's bar is `GENDER_MIN_SCORE 0.25` and is the only bar
  never recalibrated, while R6 measured female reads at 0.22-0.67 median
  0.54 — every female read above the noise floor is a certain flag; the
  join to compute the distribution behind an actual streak increment is
  free from stored traces. (4) `isNullRead` is male-only, so in MAN mode
  nothing refuses a null on the revoking side. (5) `positionOnly` drops
  `weakStreak` and `demoted`, which makes `GENDER_WEAK_STREAK_N 4`
  structurally unreachable — `weakWouldClear` reads 0 for reasons that
  have nothing to do with the population. (6) `setVerdictCadence` writes
  module-global coast budgets shared by every video element — the same
  defect class R21 fixed for `lastSlotDiag`. (7) `cover_life_p50` and the
  count-change blindness in `jitter`/`breathe` (S9 F1/F11), still unfixed.
