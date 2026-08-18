# tamescroll — project CLAUDE.md

**Read `docs/VISION.md` before doing anything.** It is the settled product
definition. The owner has corrected scope drift three times (extension-first,
Brave-pairing, "app can't block ads" — all dead, all listed there). Any
statement elsewhere that conflicts with VISION.md is stale.

## What this is

One self-contained, free, open-source app (Tauri v2 + embedded `adblock`
crate) that opens the feed platforms — YouTube, Reddit, X, Instagram — as
cleaned versions of themselves: no ads, no Shorts, no algorithmic feeds,
optional on-device gaze blur. Desktop + Android + iOS from one codebase.
Users install this one app and nothing else.

## Hard rules (owner-set, non-negotiable, from the original handoff)

- BLOCK-ONLY. Hide/blur/remove on pages the user views. Never modify,
  repackage or impersonate platform apps; never unlock paid features
  (that is what got ProTube removed — background play, audio-only).
- INSTANT by default. AI/detection never in the critical path; blur-first
  so nothing ever flashes.
- NO NAGS, ever — ours or the platforms'.
- Must not look or feel like a parental-control app.
- Free + open forever. Code MPL-2.0, our rules CC0.
- **Never copy code from HaramBlur or any AGPL/GPL source** — AGPL would
  legally end App Store distribution. Gaze module builds on Human +
  nsfwjs (both MIT). See NOTICE.
- Bundle identifier `app.tamescroll.client` is PERMANENT once published.
  Never change it; rename only the display name.

## Repo map

- `docs/VISION.md` — product definition. Overrides everything.
- `docs/plan.md` — phases, platform order, risks, decisions.
- `docs/technical-findings.md` — verified platform/store/engine facts.
- `docs/gaze-research.md` — gaze Stage B delivery architecture (CSP per
  site; models must be inlined base64; Worker + Reddit fallback).
- `docs/android-research.md` — Android build path (when present).
- `docs/handoff-original.md` — archived original planning handoff.
- `rules/` — our filter rules (EasyList syntax, CC0). Every rule carries
  a `! test:` line and a `[live]`/`[unverified]` tag. `rules/vendor/` —
  upstream list snapshots (their own licences, not CC0).
- `app/` — the Tauri app. `app/src-tauri/src/lib.rs` is the engine
  wiring + injection; frontend is vanilla TS launcher.

## Working agreements

- Owner is a beginner developer: explain as you go, small steps, working
  checkpoints they can SEE.
- Subagents: Sonnet by default, passed explicitly; Opus only for
  judgement calls (architecture, adversarial review).
- Selectors are read from the live DOM, never guessed from memory.
  Test-env gotcha: owner's Chrome runs an Unhook-style extension setting
  ~26 `hide_*` attributes on `<html>` on YouTube — strip them before
  reading the DOM (page-local, resets on reload).
- Verification is visual where the claim is visual: run the app,
  screenshot, compare. Player integrity is the red line — a broken
  selector that hides the video player is worse than a missed shelf.
- iOS work only happens in the cousin's visit window (§7 of the archived
  handoff): everything iOS must be prepared before, tested during.

## Session state (update every session)

**Last updated:** 2026-08-18 (Fable session — ads + gaze push).

Done: Phase 0 (name tamescroll, MPL-2.0/CC0, contributor agreement),
Phase 1 (rules/youtube.txt + youtube-blur.txt, verified on live DOM),
Phase 2 (Tauri shell runs on Windows; launcher → cleaned YouTube window;
Shorts/home feed gone in-app; Google sign-in page loads fine in WebView2
contrary to research warnings — untested past email field, untested on
Android).

In flight (agents): Phase 2.5 in-app ad blocking (vendor lists +
scriptlet injection wiring); Android build-path research.

Next after that: verify ads actually gone by playing a video; gaze
Stage A (CSS blur modes); Reddit + X rules; Android build; gaze Stage B
spike per docs/gaze-research.md (inline BlazeFace on reddit.com, the
worst-case CSP).

Open questions for owner: TikTok ships at all? Domain purchase
(tamescroll.com free as of 2026-08-18). GitHub repo push (needs owner OK —
outward-facing).
