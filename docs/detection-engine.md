# Detection engine — system, thresholds, calibration

**Why this doc (owner, 2026-08-19):** "it needs to work well or people
just won't use it." Detection quality is an adoption feature. This doc is
the single place that says what the pipeline does, every tunable number
it contains, and the protocol for changing one. If a threshold is not in
this doc, it is not allowed to exist in code.

## 1. Pipeline (current, shipped)

Discovery (MutationObserver + shadow-DOM piercing, all platforms) →
blur-first (`ts-gaze-pending` before any inference) → per-media verdict:

- **Images:** face presence (BlazeFace) → if no face and the NSFW model
  loaded, NSFW classify (nsfwjs MobileNetV2Mid). Face or NSFW hit →
  stays blurred (`ts-gaze-flagged`); clean → unblur. Unverifiable
  (CORS-denied) → stays blurred (fail-closed).
- **Videos:** sampled frames, face presence only. Flag re-blurs
  instantly; a clean streak unblurs. Unreadable pixels (tainted canvas)
  → fail-open, plays normally. Player red line: anything inside the
  platform player is never touched.
- Total failure of the detector → fail-open sweep, page works untouched.

## 2. Pipeline (planned, protection engine — docs/handoff-protection-engine.md)

Order per item: **text signal → (compulsory) NSFW → face → gender.**

- **Text signal (BUILT + WIRED 2026-08-19):** `app/gaze/src/text-signals.mjs`
  — seed 467 terms (dsojevic sexual/shock subset, MIT) + algospeak
  supplement + user terms, obscenity-normalised (leetspeak/confusables),
  whole-word. Cheap pre-filter BEFORE models; a hit skips inference.
  Haystack: per-host feed-item container textContent (TEXT_ITEMS —
  youtube renderers + shreddit-post, all live-verified).
- **Compulsory tier (BUILT 2026-08-19, probe38):** NSFW hit ⇒ REMOVED
  from view (`ts-gaze-removed`, whole feed item when the container is
  known), every mode, no setting. The bundle now boots in ALL modes;
  `app/gaze/src/pipeline-plan.mjs` is the per-mode policy (unit-tested):
  off = pre-blur + text + NSFW-remove + reveal (no gender); blur-all =
  NSFW-remove only on top of the Stage A sheet; smart = everything.
  Judgment call: the owner's "any confidence" means NO gradation UI —
  internally the calibrated thresholds below still gate the classifier
  (a literal zero threshold would remove every image). Removals are
  deliberately NOT reverted by the fail-open sweep. Known gap: videos
  get no NSFW sampling yet (smart's face loop only; off/blur rely on
  Stage A / platform rules) — for the strictness spec pass.
- **Gender stage (BUILT 2026-08-19, device verification pending):**
  per-face boxes (full BlazeFace decode, adapted from Human, MIT) →
  gender per face (human-models gender.json — Oarriaga mini-Xception,
  MIT, 64×64 grayscale, ~202KB; ALL faces batched in ONE inference).
  Model swapped 2026-08-23: gender-ssrnet-imdb (verified byte-identical
  to upstream) outputs a single value saturated at ~1.0 for every real
  face under every documented preprocessing — with the old
  data[0]>data[1] reader every face scored 'male'/undefined, so verdicts
  were permanently 'flag': the real root cause of "both genders blurred".
  Opposite gender or low-confidence → covered; ALL faces confidently
  same-gender → unblurred (then NSFW still checks the image). No
  declared gender → old presence behavior. This turns smart mode from
  "every face stays blurred forever" into HaramBlur-parity behavior.
  Declared via the launcher's "You are" row (provisional home until
  onboarding); stored on-device only.

## 3. Why smart mode feels broken today (owner report 2026-08-19)

Working as built, but the build is v1-blunt: the detector is
**presence-only** — any face ⇒ permanently blurred, no gender, no
unblur path for safe faces. A tech channel where every thumbnail has a
face reads as "blur all". HaramBlur feels better because its detector
(Human — MIT, the same library we planned) classifies each face's
gender and only blurs what settings say; ordinary same-gender content
clears. Same architecture, one missing stage — not a redesign.

## 4. Threshold registry

Every knob, its value, and its calibration status. "guess" = shipped
conservative, never tuned against evidence.

| Knob | Value | Meaning | Status |
|---|---|---|---|
| Face logit | > 0 (= sigmoid 0.5) | any anchor ⇒ face present | guess |
| NSFW explicit | Porn + Hentai > 0.5 | REMOVED (compulsory, every mode) | guess |
| NSFW sexy | Sexy > 0.8 | same | probe38: fired on a live suggestive thumbnail, clean results untouched |
| Image min size | 64px | below = decorative, skip | guess |
| Image batch | 4 / idle slice | inference batching | ok (probe-verified no jank) |
| Video sample (feed) | 500ms | ≤2 inferences/s/video (whole-blur path) | guess |
| Player pass cadence | 250ms (~4Hz) | ONE person-primary pass per tick; overlay smoothness comes from 60Hz interpolation, not inference rate | redesign 2026-08-24 (audit: the 140ms multi-source loop ran 20-35 inferences/s on the page thread — measured 95 dropped frames + 8.2s long tasks / 77s) |
| Clean streak | 4 samples | consecutive clean frames to unblur (feed whole-blur path) | guess |
| Body expansion | shoulders ±1.2 face-w, torso +6.0 face-h, hair +0.3 (input de-inflated /1.4) | face box → whole-person patch — IMAGE path only now (player patches are the person box) | visual probe 2026-08-24 |
| Person model | MoveNet MultiPose Lightning (Apache-2.0), 256px input, EVERY player pass | up to 6 person boxes — the PRIMARY detector: the person is the unit of blur, faces run only on person crops | spike 2026-08-24: titlecard letters 0 persons, real groups boxed 0.28-0.62, 30ms warm desktop; hybrid uint8/f16 requant 9.45->4.94MB |
| Person min score | 0.25 (PERSON_MIN_SCORE) | MoveNet box score floor | spike range above |
| Person crop pad | 0.15 (PERSON_GATE_PAD) | padding around the person box for the face/gender crop | guess |
| Person crop | 256px long side, aspect-preserving, max 4 persons/pass | the ONLY face/gender path on the player — small faces are big at native crop res, so no rescue floor / recheck needed | aspect fix verified v9 screens 2026-08-24 (square-stretch flipped gender reads) |
| Track IoU min | 0.2 (PTRACK_IOU_MIN) | association floor; globally-greedy best-IoU pairing (centre-distance greedy swapped nearby identities) | redesign 2026-08-24 |
| Track EMA | 0.45 (PTRACK_EMA_ALPHA) | matched-box smoothing per 4Hz pass | guess |
| Track coast | 1000ms (PTRACK_MAX_MISS_MS) | lost track coasts on decayed velocity, then expires | guess |
| Clear hold | 1500ms (CLEAR_HOLD_MS) | CONTINUOUS confident same-gender time before a patch lifts; blur direction always instant; uncertainty never un-clears a known person | redesign 2026-08-24 — THE hysteresis boundary (patches follow track STATE, never per-sample verdicts) |
| Identity memory | **DELETED IN R13** — the whole mechanism, both directions | the match was a MAX over a bank that only grew, so the best-match score rose with bank size independently of who was on screen; the bank saturated at 8 within ~15s and re-covered people it had never seen | MEASURED across R11-R13 (128 same-person + 65 same-frame different-person pairs): same-person median 0.90 and 5th pct 0.28, but DIFFERENT people scored >=0.6 in 32% of pairs and >=0.9 in 17% — the distributions overlap across their whole useful range, so there is no operating point. Best-match FLOOR measured climbing 0.00 -> 0.68 inside one 15s window. Reintroducing recognition requires a descriptor test that actually separates, measured FIRST |
| Identity continuity | cos < 0.15 (IDENT_SIM_MIN) ⇒ track resets to blurred | only a GROSS mismatch counts as "someone else is standing here"; CLEARED_TTL_MS is the real absorption guard | MEASURED: same-person 5th pct is 0.28, so 0.15 rarely false-breaks and re-blurs a cleared man |
| Player overlay z-index | 20 | MUST sit above .html5-video-container (10) and below the bottom gradient (24) / .ytp-chrome-bottom (59) | MEASURED on the live player 2026-08-25 after z-index 5 shipped in v1013 and rendered every patch BEHIND the video (total exposure, caught by frame verification) |
| Cleared TTL | 5000ms (CLEARED_TTL_MS) | cleared track must re-prove with a confident clear read or reverts to blurred (bounds every absorption hole) | review A1 |
| Flag streak | 2 consecutive certain-opposite reads revoke an EARNED clear | single noisy opposite read no longer re-blurs a cleared person; all other paths blur instantly | owner "gender sways" 2026-08-24 |
| Blurred coast | 3000ms (PTRACK_MAX_MISS_BLURRED_MS) | a covered person is never uncovered by a 1s detector-miss timeout (cleared tracks keep 1000ms) | review A5 |
| Cut coast | 400ms (PTRACK_CUT_COAST_MS) | a box that survived a scene cut is kept for ONE pass so coverage holds through the gap, then dropped — the ordinary coast is calibrated for a detector MISS, where the box is probably still right, and across a cut it is probably wrong | MEASURED R15: a cut from a 16-person studio wide shot to a one-man close-up left FIVE patches from the old shot on screen for at least two verdict passes, painting a cloche, an appliance, blue tile and the man's own eyes, while the new shot's full-frame pass returned exactly ONE face (h 0.364) and zero MoveNet persons. Fix took that frame from 5 patches to 0. `cutCoastExpired` counts it |
| Face-derived person's own face | reused, never re-detected | a `fromFace` person carries `faceBox`; observePerson maps it into crop coordinates instead of running BlazeFace again | MEASURED R16: the re-detect was sub-spec BY CONSTRUCTION — the synthetic body is 7.8 x 7.4 face-heights, personCropRegion pads 15%, and detectFaceBoxes stretches that to 256, so the face arrives at ~2% of model input against BlazeFace's ~5% evaluation floor regardless of subject size. Removing it cut verdict p50 150 -> 93ms (man) and 140 -> 98ms (woman), p95 301 -> 162 |
| Faces inside an admitted person box | ONE claims it, the rest get their own body | largest face first claims the box it falls in; every other face inside it still becomes a synthetic person | MEASURED R16: `faceInsideAny` dropped every face inside any person box. A seated woman at cx 0.30 whose face WAS detected fell inside the SPEAKER's box (patch x 0.317-0.706) and produced no observation at all — fully sharp in the 0.087-wide gap between two patches, in man mode, on three frames. She was invisible to the fallback and to ownFaceIndex simultaneously. Fixed; the gap closes and the men beside her stay sharp |
| Face size floor | 64 native px (FACE_MIN_NATIVE_PX) | below this, faceres is asked nothing and the read abstains | **HAD NEVER FIRED UNTIL R15.** The `var` sat after a `return` in the boot closure, so the initializer was unreachable and the minifier emitted `var IY;` — every comparison was `px < undefined`, i.e. false. Moved into gender-verdict.mjs and published on the cfg probe. Turning it on changed ZERO patches (an unreadable face is still a covered face); what it removes is 16 of 53 reads per window and their ability to condemn or clear |
| Cut behavior | demote tracks + whole-frame blur until the forced pass lands | coverage holds through the pass gap; re-clears are re-earned from live reads (identity memory deleted in R13) | review C1/C2 |
| Render pad | 0.05 (PTRACK_PAD) | person box padding at render | guess |
| Overlay interpolation | 60Hz dead reckoning, extrapolation capped 600ms (MAX_EXTRAPOLATE_MS); rects re-read on 250ms timer + ResizeObserver, transforms only (zero per-frame layout) | video-region v2 | redesign 2026-08-24 |
| Scene gate size | 16×16 luma (GATE_SIZE), tick ≤10Hz (GATE_INTERVAL_MS 100) | mean-abs gray delta between gate ticks classifies player motion | plan-blur-v2 Stage 1 |
| Scene cut | delta ≥ 28 (CUT_DELTA), min 250ms between forced passes (CUT_MIN_GAP_MS) | forces an immediate full pass incl. gender read — cuts are where new people appear | MEASURED 2026-08-25 (695 ticks @10Hz, Linus video): p50 7.4, p95 19.5, p99 69.6 — ≥28 fires on 3.6% of ticks, ≥40 on 3.2%, so 28 sits in an empty valley between motion and cuts |
| Scene static | delta ≤ 3 (STATIC_DELTA) ⇒ 1Hz floor (STATIC_INTERVAL_MS) | relaxes cadence ONLY while no track is blurred (mid-verdict/drifting subjects keep full cadence) | MEASURED same run: only 8.2% of ticks ≤3 (1% ≤1) — conservative, rarely relaxes on real content |
| Player pixel path | fromPixels(video) direct + createImageBitmap crops | zero getImageData readback on the player; canvas fallback per-stream on error | plan-blur-v2 Stage 1 |
| Blur radius | 8/16/28px (Light/Med/Strong), 24px fallback | strength presets | owner-chosen |
| Gender min score | 0.25 (GENDER_MIN_SCORE) | certainty floor for the FLAG direction (opposite-gender reads) | recalibrated 2026-08-24 for the faceres swap: direction 7/7 correct on live thumbnails (spike gender-spike.html), male conf 0.3-0.94, female 0.42-0.69; old 0.85 softmax bar blurred most same-gender faces (owner report) |
| Gender clear score | 0.6 (GENDER_CLEAR_SCORE) | asymmetric: a same-gender read counts as a confident CLEAR only at this certainty — under-blur is the failure that matters | owner frame 2026-08-24: a misread child cleared at the shared 0.25 bar (daughter sharp, Linus covered) |
| Adult age floor | 18 (GENDER_ADULT_AGE) | faceres age head (age_pred/Softmax [N,100], expected value): below ⇒ gender untrusted BOTH directions, certain=false, unknown ⇒ covered | same owner frame — adult-trained gender models are unreliable on children; the age head was embedded all along, now read |
| Face min confidence | 0.35 flat (images AND person crops) | the 2026-08-24 small-rescue band died with the redesign (person crops make small faces big) | redesign 2026-08-24 |
| Face NMS IoU | 0.1 | box de-duplication overlap | guess (Human-family default) |
| Face crop enlarge | 1.4× | context around face for gender crop | guess (Human-family default) |
| Gender model | faceres (HSE-FaceRes via human-models, MIT) | multi-head age/gender/descriptor; gender head only | swapped from mini-Xception 2026-08-24 — live calibration showed overlapping bands + a misgendered male; faceres 7/7 direction-correct on the same set |

## 5. Calibration protocol (the rule for changing any number)

A threshold change ships only with a before/after evidence run, saved in
`spikes/`, covering all four controls:

1. **Positive control** — content that MUST flag (probe19 pattern:
   "podcast interview face" search ⇒ people blurred).
2. **Negative control** — content that must NOT flag (probe18 pattern:
   "nature" search ⇒ zero flags, thumbnails clear).
3. **Player red line** — chosen media plays with `filter: none`.
4. **Cold boot** — launcher round-trip still clean.

Run on at least m.youtube (Android emulator) + one desktop platform.
Record the number changed, both runs, and the verdict in this doc's
registry (status column moves guess → calibrated + date).

## 6. Budgets

- Bundle: 7.16MB today; both delivery channels verified to carry it.
  Gender model rides only after measuring added size + per-face ms
  (embed pattern: app/gaze/build/embed-nsfw.js). Budget call is
  owner-gated.
- First inference: ~600-720ms after navigation (shader compile,
  one-time). Blur-first covers the gap; INSTANT rule holds.
- Text matcher: pure JS, no model, no budget concern; runs first so a
  hit costs zero inference.

## 7. Standing rules (restated, non-negotiable)

Blur-first, nothing flashes. AI never in the critical path. Fail-open
video / fail-closed image. Player red line. Compulsory tier has no off
switch. No GPL/AGPL code, ever (HaramBlur = behavior reference only).

## Weak tier: the back-turned person (gauntlet R18)

| Constant | Value | Where | Measured on |
|---|---|---|---|
| `PERSON_WEAK_KP15` | 9 | person-gate.mjs | 4086 slots / 56 runs |
| `PERSON_WEAK_MAXKP` | 0.25 | person-gate.mjs | same |
| `PERSON_WEAK_ANCHOR` | 0.20 | person-gate.mjs | 78 R18 candidates |

MoveNet emits all 17 keypoints always, with low confidence rather than
absence, so a subject facing AWAY has a full skeleton at 0.15-0.29 and
nothing at all above `PERSON_KEYPOINT_MIN` 0.3. Four gates key on that
one threshold (`PERSON_STRONG_KEYPOINTS`, `PERSON_MIN_KEYPOINTS`, the
head-or-both-shoulders anchor, and `confident` itself), so a back-turned
person fails all four at once and no single-threshold change reaches
them. The weak tier is keyed on `nKp15` and `maxKp` instead, and NOT on
box score — in the R18 classroom the correctly-admitted adult teacher
never scores above 0.321.

Corpus behaviour, counting only slots the previous gate rejected: **0.00
extra admits per pass on all 33 low-density runs** (R9-R14 close-ups, the
R12 TED audience, the R13 talking heads whose noise band is what makes
`PERSON_LOW_SCORE` unsafe to lower), 0.17-0.37 on R15/R17 — inspected,
all real people the old gate was dropping — and 2.3-2.7 on the two dense
runs, R16's auditorium and R18's classroom.

A weak-tier patch is MoveNet's raw box plus `PATCH_MARGIN`: the keypoint
union only takes keypoints over `PERSON_KEYPOINT_MIN`, so a skeleton
entirely below that threshold contributes nothing to the geometry. That
is why `LOW_TIER_MAX_SPRAWL` cannot fire on this tier and does not need
to.

## Child gate: mass, not mean (gauntlet R18)

| Constant | Value | Where |
|---|---|---|
| `GENDER_ADULT_AGE` | 18 | gender-verdict.mjs |
| `GENDER_CHILD_MASS` | 0.25 | gender-verdict.mjs |

faceres' age head is a 100-bin softmax and `detector.js` reduces it to an
expected value. A mean over a bimodal posterior lands where no mass is:
on a child, probability splits between a young mode and the model's adult
training prior, and the mean comes out in the twenties. Detector now also
carries `childP`, the mass under 18, and `isAdultRead` gates on it.

Calibrated on the only corpus footage with a known child and a known
adult in the same frame (R18, 2nd-grade classroom):

| Subject | Directed reads | childP range |
|---|---|---|
| boy, ~8 years old | 16 | 0.15-0.72, median 0.42 |
| teacher, adult woman | 23 | 0.09-0.18, **max 0.18** |

In MAN mode that run produced 11 reads confident enough to clear a track.
Ten of them were the eight-year-old; the mean-based gate caught two of
those ten, the mass gate catches ten of ten. Adult regression on the
baseline video: 1 of 66 adult reads gated, and that one scored 0.18, far
below any clear bar.

A child read is also an ABSTENTION now, not merely an uncertain flag —
otherwise it is absorbed for `CLEARED_TTL_MS` by a track that was cleared
on somebody else, which is the maximum-duration absorption case the
pipeline can produce.

## personFromFace close-up cap (gauntlet R20)

| Constant | Value | Where |
|---|---|---|
| `PFF_CLOSEUP_H` | 0.18 | person-gate.mjs |
| `PFF_HALF_CAP` | 0.35 | person-gate.mjs |

`halfX = 3.911 * h / ar` is a constant number of face-widths per side,
and that is only the right SHAPE of rule while the whole body is in
frame. Measured over 1246 faces that fall inside an admitted MoveNet box
across 56 runs, MoveNet's own half-width for the same person — expressed
in face-widths — falls monotonically as the face grows, because in a
close-up the shoulders are cropped by the frame (`h` de-inflated):

| face h | n | MoveNet width p50/p90/max | half-width in face-widths p90 |
|---|---|---|---|
| 0.00-0.05 | 39 | 0.280 / 0.430 / 0.430 | 11.63 |
| 0.05-0.08 | 298 | 0.250 / 0.410 / 0.650 | 5.89 |
| 0.08-0.12 | 396 | 0.280 / 0.420 / 0.560 | 3.48 |
| 0.12-0.18 | 322 | 0.390 / 0.500 / 0.920 | 3.04 |
| 0.18-0.28 | 173 | 0.470 / 0.550 / 0.650 | 2.12 |
| 0.28-1.00 | 18 | 0.585 / 0.590 / 0.590 | 1.87 |

This reconciles R8 (constant too NARROW on a podium subject, h ~0.064
de-inflated) with R19/R20 (whole-frame bodies at h 0.35-0.56). One
constant cannot serve both ends. Past h ~0.23 the uncapped half-width
exceeds the frame, so every face that large produced a whole-frame body:
7 of 86 synthetic bodies in the `obs` corpus, every one from a face of
0.485-0.79 inflated.

The cap binds only at h >= 0.18, leaving R8's regime and the 0.12-0.18
band (widest observed MoveNet box 0.920, wider than the cap) bit-for-bit
unchanged. Where it binds, the 0.70-wide result still exceeds the widest
MoveNet box ever observed in those bands (0.650, 0.590), so it cannot
introduce EXPOSURE relative to a successful person pass. Horizontal only
— the vertical clamp is correct for a close-up.

`h` here is DE-INFLATED (the detector's box is FACE_ENLARGE-inflated by
1.4). Getting that wrong is a factor of 1.4 and it is the fourth hidden
unit in this function's neighbourhood.


## FACE_MIN_NATIVE_PX is a size proxy for a content question (2026-08-31)

He reports men being blurred. The mechanism is measured: 24 player face
reads in one window on his phone read **male 14, female 2, unknown 8** --
a third abstained -- with facePx p50 74 and **min 53**, against a floor of
64. Every face under it abstains and fails closed, which is the man he
sees covered. Lowering the floor is an exposure trade, so it is his call;
this section exists so the call is made on numbers.

Two arms, both on his phone, through the SHIPPING functions
(`detectFaceBoxes` + `classifyFaceGenders`, square crop included) --
`spikes/gauntlet/probe_face_px_curve.py`, bench in
`app/gaze/bench/small-face.js`.

**Arm 1 -- real faces, resolution degraded.** 28 faces detected at >=150
native px (refs male 11, female 17), each re-read after being resampled
down to N px and handed over as the whole frame, which is exactly what
the pipeline sees when a face is natively N across:

| native px | 32 | 40 | 48 | 56 | 64 | 72 | 88 | 112 | 160 |
|---|---|---|---|---|---|---|---|---|---|
| agrees with the full-res read | **1.00** | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| CERTAIN and wrong (score >= 0.25) | **0** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| score p50 | 0.76 | 0.78 | 0.81 | 0.83 | 0.85 | 0.85 | 0.87 | 0.85 | 0.86 |

28 of 28 agree at every size down to **32px**. Resolution alone does not
flip this model's gender read.

**Arm 2 -- the control, and it is the one the floor exists for.**
`genderFromNativeFace` refuses a small face because "the null answer
arrives labelled male with a score that clears GENDER_MIN_SCORE". That is
a claim about crops that are NOT faces, and feeding the model only real
faces could never test it. 34 crops from thumbnails where BlazeFace
detected nothing at all:

| native px | 32 | 40 | 48 | 56 | 64 | 72 | 88 | 112 | 160 |
|---|---|---|---|---|---|---|---|---|---|
| reads CERTAIN (score >= 0.25) | 18 | 14 | 15 | 14 | 15 | 14 | 13 | 13 | 11 |
| caught by `isNullRead`'s band | 33 | 33 | 30 | 31 | 31 | 31 | 32 | 32 | 31 |

The claim is true -- **38-53% of non-face crops produce a confident
answer** -- and it is **flat in size**. A 160px crop of a car bonnet
reads certainly-male about as often as a 32px one. So:

- The null-read failure is a function of CONTENT, not RESOLUTION.
  FACE_MIN_NATIVE_PX guards the wrong axis: it refuses real faces that
  read correctly, and lets through large non-face crops that do not.
- The gate that IS on the right axis already ships. `isNullRead`'s band
  [0.545, 0.705] catches **30-33 of 34** at every size (88-97%).

**NOT CHANGED, deliberately -- it is a protection decision and his.** The
options are (a) leave 64 and accept the covered men, (b) lower it toward
53 and lean on the null band, (c) drop the size gate and rely on the null
band alone. What this measurement does NOT cover, and it is the honest
limit: a 53px face in a VIDEO frame is detected from ~13px in BlazeFace's
256 model space, so its box may be a worse box, not just a smaller one --
this harness used real detections at >=150px and degraded them, which
isolates resolution and bypasses detection quality. A degraded thumbnail
also has no motion blur and different compression from a video frame.

### The discriminator the ghost gate wants already ships (2026-09-01)

The two arms above were measured to answer the size floor, and they
answer a second question they were not built for.

`frameHasNoHumanShape` (PFF_FRAME_KP_FLOOR 0.1) exists to stop a patch
being minted over a graphic when MoveNet corroborates nobody. On his
phone MoveNet corroborates nobody **on every pass** -- twelve slots
`n:0` in every window since loop 27 -- so that floor alone decides
whether a detected face becomes a patch, and it currently refuses about
**three detected faces in four** (`faceNoShape` 127 against ~41 gender
reads in one 250s window on 1073). Its calibration corpus was gauntlet
footage; it has never been measured on his hardware.

`isNullRead`'s band on the faceres sigmoid, [0.545, 0.705], is on the
right axis and its numbers are much better:

| population | in the null band |
|---|---|
| 28 real faces, at every size 32-160px | **1-2 of 28** (3.6-7.1%) |
| 34 non-face crops, at every size 32-160px | **30-33 of 34** (88-97%) |

So the band keeps ~95% of real faces and catches ~91% of non-faces,
while the keypoint floor is discarding three quarters of the faces on
the device that matters. It is also the cheaper signal in the sense that
counts: it comes from a model that is already being run on that crop.

**BAND CORRECTION, because the numbers above were taken with the wrong
one.** The shipped band is `NULL_V_LO` 0.53 to `NULL_V_HI` 0.72; the
bench used [0.545, 0.705], which is narrower on both sides. So the real
band catches at least as many non-faces as the 30-33 of 34 above, and
rejects at least as many real faces as the 1-2 of 28. Both figures are
bounds, in the direction that favours the band on graphics and
disfavours it on faces. Re-run the bench against the real constants
before anything is built on them.

**NOT CHANGED.** Two reasons, and the first is a rule: this is a
protection decision. The second is that the refused POPULATION is still
unmeasured -- if those 127 refusals are mostly BlazeFace firing on
graphics, the gate is doing its job and the exposure is imagined. 1074
records exactly that (`gateRefused` / `gateKept`, each face's
confidence, native size, and the frame keypoint maximum), so the
comparison can be made on his own footage before anything moves.


### DECIDED: the size floor is 40 (owner, 2026-09-01)

He ruled the three options himself after the measurement: leave 64,
lower toward 53, or drop the size gate and lean on the null band. He
took the middle, at 40.

`FACE_MIN_NATIVE_PX` 64 -> **40**. Everything under the old floor
abstained and failed closed, and his player reads faces down to 53px
(p50 74), so that whole tail was covered without ever being asked --
which is the man he has reported as blurred more than once. The
degradation curve says the refusal bought nothing: 28 of 28 real faces
agree with their own full-resolution answer at every size down to 32px,
0 certain-wrong.

**The honest cost, and it is real.** A small BAD detection now gets
asked, and a non-face crop reads CERTAIN 38-53% of the time. What
stands between that and a wrong verdict is `isNullRead`, which is on the
right axis but is not perfect (30-33 of 34 in the bench, measured
against a narrower band than ships). Watch the artifact after this: a
rise in confident reads at small `px` with no corresponding subject is
what this change would look like going wrong.

He also ruled the other two: **leave the render loop at ~30Hz** (the
tracking is worth the frames), and **hold the ghost gate** until 1074's
`gateRefused` / `gateKept` say what it is actually refusing.

### The ghost gate is not separating faces from graphics (2026-09-01)

The populations it splits are now measured, and they are the same
population.

**First, a correction that kills the device hypothesis.** MoveNet reads
`n:0` on his phone and 2-3 persons per pass on the emulator -- but those
two runs were at different points in the same video (t=55 against
t=217-303). Driven to HIS timestamps the emulator reproduces his regime
exactly: **all slots n:0, faceNoShape 93 over 111 passes, gateRefused
60.** The fixed-input worker bench had already shown the model itself is
fine on his device -- 25 persons admitted over 20 thumbnails on both
machines, maxKp p50 0.779 on both, identical WebGL flags. So this is
FOOTAGE, not hardware, not our uint8 requant, and not precision.

**Second, the split itself**, read off the 1074 rings in that regime
(emulator, 111 passes, m.youtube watch page):

| | n | face confidence p05 / p50 / p95 | native px p05 / p50 / p95 | frame maxKp p50 / max |
|---|---|---|---|---|
| REFUSED | 60 | 0.40 / **0.74** / 0.84 | 30 / **46** / 79 | 0.049 / 0.098 |
| KEPT | 44 | 0.40 / **0.76** / 0.85 | 28 / **47** / 103 | 0.117 / 0.179 |

**The refused faces are indistinguishable from the kept ones.** Same
confidence distribution to two decimal places, same size distribution.
The only thing separating them is `maxKp`, which is a property of the
FRAME and not of the face -- and it straddles PFF_FRAME_KP_FLOOR 0.1
almost exactly: the refused population tops out at **0.098** and the
kept population starts at **0.101**.

So on this footage the gate is not deciding "is this a face or a
graphic". It is deciding "did MoveNet's noise clear 0.1 on this frame",
and throwing away the same face when it did not. That is his report in
one line: the same person covered in one frame and sharp in the next.

**A SECOND VIDEO, SAME STORY**, so this is not one shot's quirk
(Ary1gIbaOTc, 107 passes, slots n:0 throughout):

| | n | conf p50 | px p50 | maxKp p50 / max |
|---|---|---|---|---|
| REFUSED | 60 (ring cap) | **0.73** | 37 | 0.047 / **0.099** |
| KEPT | 16 | **0.73** | 51 | 0.127 / 0.205 |

Identical confidence again, the same split at the floor again, and a
worse ratio -- roughly four faces in five refused. Both rings cap at 60,
so the refusal counts are floors, not totals (`faceNoShape` reached 93
over 111 passes on the first video). The one honest difference between
the populations is size: refused faces run smaller here (37px against
51px), so some of that tail may be weaker detections -- but the model's
own quality signal, its confidence, does not separate them at all.

**AND THE REFUSALS ARE NOT REDUNDANT.** The obvious defence of the gate
is that a thrown-away face is often covered anyway -- by a second person
in the same shot, or by the same subject still held on a coasting track.
Measured by asking, at the moment of refusal, whether any BLURRED track
already contained that face's centre (emulator, his regime, 108 passes):

| | n | already covered |
|---|---|---|
| REFUSED | 60 | **12 (20%)** |
| KEPT | 23 | 0 |

So **48 of 60 refusals were an uncovered face**.

**THE HONEST BOUND ON THAT NUMBER, because it is easy to overclaim.**
"Not covered" is not the same as "should have been covered": the gate
refuses BEFORE any gender read, so we cannot know what those faces would
have read as, and in MAN mode a man reads clear and stays sharp
correctly. From his own phone's read distribution (24 reads: male 14,
female 2, unknown 8) roughly a third would have ABSTAINED -- and an
abstain fails closed, i.e. covered -- with a small further share
flagged. So of those 48, on the order of twenty would have produced a
patch. That is still his complaint, and the abstain share is
blur-first being bypassed rather than applied.

**STILL NOT CHANGED.** He ruled on 2026-09-01 that the gate is held
until the data says what it is refusing. The data has now arrived and it
says the gate is refusing people -- but the ruling was his and the
change is a protection change, so it waits for him. What the fix cannot
be is a different number: 0.098 against 0.101 is not a threshold that
can be moved into the right place, because the quantity itself does not
carry the information. The candidate on the right axis is `isNullRead`,
whose numbers are in the section above.
