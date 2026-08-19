# Handoff — Protection Engine (gender filter + suggestive removal + text signals)

**Written:** 2026-08-19, end of hands-on session. Grill complete, spec NOT
written. Next step: run `to-spec` on this doc in a fresh session, then
`to-tickets`. CONTEXT.md §"Protection engine" holds the settled vocabulary —
read it first.

## What the owner wants (their words, condensed)

The app acts on the Islamic principle of protecting the gaze (ghadd
al-basar, Qur'an An-Nur 24:30–31 — commanded to men and women
symmetrically). Not imposing on anyone: the user chooses the app, the app
then protects hard by default. "As tech progresses and filthy content
increases online, we need these kinds of approaches."

## Decisions (all owner-confirmed in the 2026-08-19 grill)

1. **Compulsory tier.** Anything the NSFW model flags as suggestive
   (Porn, Hentai, Sexy classes) is REMOVED from view outright — any
   confidence, every strictness mode, no setting to see it, ever. Owner
   rejected confidence gradation: "someone on the homepage isn't looking
   for specific things," so a false positive costs nothing.
2. **Gender question is compulsory onboarding.** Literal gender ("I am a
   man / woman"), honestly worded: "we filter the other gender by
   default." Stored on-device only. Full onboarding user-flow journey is
   a separate later design pass (owner explicitly deferred).
3. **Gender filter.** On-device face-gender classification; opposite
   gender filtered by default. Action (blur vs remove) rides strictness
   modes.
4. **Strictness modes.** Two actions exist: blur, remove-entirely. Modes
   decide which non-compulsory signals get which action. Mode structure,
   count, names, per-mode customization: DELIBERATELY UNDECIDED — owner
   wants to decide later. Do not invent them in the spec; spec the
   mechanism, leave the policy table open.
5. **Text signals.** Keyword matching over: creator/channel name, video
   title, profile bio (profile pages + hover cards only — bios aren't in
   feed DOM), post text + hashtags. Seed list + user-added terms.
6. **No reranking / no promotion engine.** Owner floated surfacing
   "productive" content; verdict (owner agreed): never reorder feeds —
   killing algorithmic surfaces IS the redirect. Parked instead:
   user-pinned destinations on the launcher (user picks, we rank nothing).
7. **No auto-actions on the user's account.** No auto-clicking "Not
   interested" etc. — block-only means local hiding; sending actions as
   the user is the ProTube death direction.
8. **Body beyond face:** nsfwjs "Sexy" class + (if too weak in testing)
   Bumble Private Detector (Apache-2.0) as reserve. Owner asked about
   body detection explicitly — the answer shipped to them was: nsfwjs
   covers skin/suggestive; granular body-part models (NudeNet) are
   GPL-3.0 = banned.

## Licenses (owner cares, re-verified this session)

- Human library (gender + face): MIT — the legal path to HaramBlur-parity
  gender blur. HaramBlur itself: AGPL, behavior reference ONLY.
- nsfwjs: MIT (already shipped, MobileNetV2Mid embedded).
- Bumble private-detector: Apache-2.0 (reserve).
- NudeNet: GPL-3.0 — BANNED. No GPL/AGPL anywhere, owner re-confirmed.
- Keyword seed: dsojevic/profanity-list (MIT, 809 patterns, severity +
  "sexual" tags) + `obscenity` npm (MIT) for evasion normalization.
  LDNOOBW list is CC BY 4.0 — needs owner sign-off on attribution if
  wanted. Owner also asked to be "very wary we don't include messed-up
  content via libraries" — answer given: model weights are numbers, no
  imagery ships; keyword list is plain words. Keep NOTICE updated.

## Research artifact

docs/keyword-research.md — content-creep mechanisms (Instagram Reels
served sexual content to 13yo test accounts in 3 min; TikTok explicit in
2 clicks with Restricted Mode on; Elsagate title-keyword hit rates
62–83%), algospeak catalogue ("seggs", "corn", "accountant", "leg
booty"), list licenses, prior-art matchers (BlockTube et al. match
channel + title, seed + user-editable). Sources inline.

## Engineering notes for the spec

- Compulsory tier must run regardless of the gaze toggle → detection
  pipeline needs to run always. INSTANT rule holds via blur-first:
  media is blurred/hidden first, detection only ever reveals or removes.
- Gender model: add to app/gaze pipeline next to BlazeFace + nsfwjs
  (embed pattern exists: app/gaze/build/embed-nsfw.js). Budget check —
  bundle is 7.16MB now, both eval channels verified to carry it, but
  measure inference added per face.
- "Remove" on virtualized feeds: hide via CSS/DOM removal per item;
  watch for layout gaps and re-hydration re-inserting nodes (shadow-DOM
  piercing infra exists in app/gaze/src/init-entry.js).
- Text matching is the cheap pre-filter: run BEFORE models, on the same
  discovery pass.
- Accuracy honesty: gender models ~90% on thumbnails; blur-first means
  misses fail safe (stay blurred).

## Open (owner-deferred) questions for later sessions

- Strictness mode structure + which signals map to blur vs remove per mode.
- Onboarding journey (multi-question flow; gender Q is one compulsory stop).
- Per-mode customization surface in Settings.
- Whether "women filtered" for a female user means identical UX (owner
  framed symmetric; edge cases like lecture channels came up but were
  not decided).
- User-pinned launcher destinations (parked, block-only-compatible).
