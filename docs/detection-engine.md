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
