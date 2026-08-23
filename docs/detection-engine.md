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
| Video sample | 500ms | ≤2 inferences/s/video | guess |
| Clean streak | 4 samples | consecutive clean frames to unblur (~2s) | guess |
| Blur radius | 8/16/28px (Light/Med/Strong), 24px fallback | strength presets | owner-chosen |
| Gender min score | 0.85 (GENDER_MIN_SCORE) | below ⇒ face treated unknown, stays covered | calibrated 2026-08-23 (portrait set: wrong-gender scores reached 0.79 — 0.6 cleared the opposite gender) |
| Face min confidence | 0.2 | NMS score floor for a box to count | guess |
| Face NMS IoU | 0.1 | box de-duplication overlap | guess (Human-family default) |
| Face crop enlarge | 1.4× | context around face for gender crop | guess (Human-family default) |

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
