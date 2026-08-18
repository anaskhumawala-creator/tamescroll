# Project Handoff — "The Way Out" (working name; alternatives considered: Tenblock, Disconnect, Reclaim)

This file is the complete context handoff from a planning session on claude.ai.
Everything below was decided WITH the project owner. Do not re-litigate settled
decisions; do not invent new rules or scope. Where something is marked OPEN,
ask the owner before deciding.

---

## 1. Mission (fixed — the north star)

- Give people who are addicted to doom scrolling — especially youth, but
  age-independent (the owner's grandfather scrolls Shorts too) — a structural
  way out. Willpower is explicitly NOT the plan; removing temptation is.
- Cover ALL major feed platforms, not just YouTube: YouTube, Instagram,
  TikTok, X, Reddit. Escaping one feed must not drop the user into another.
- Free and open-source, forever. No profit motive. Cost must never block
  someone's escape. Owner is fine with (and leaning toward) community
  open-source so the project outlives him (lesson: Kiwi Browser died in
  Jan 2025 because one maintainer couldn't sustain a million downloads/month).
- Guard the gaze (ghad al-basar), BOTH directions and configurable:
  a man may blur images of women; a woman may blur men; equally supported.
  Plus haram/NSFW content blurring. All detection on-device, private.
- The real gap in the world is not tech — it is integration + documentation.
  Endless videos name the problem; nobody ships a simple, documented,
  one-stop fix. The plain-language playbook is a first-class deliverable.

## 2. Hard rules (owner-set, non-negotiable)

- BLOCK-ONLY. Hide/blur/remove things on pages the user views. NEVER modify,
  repackage, or impersonate platform apps. No ReVanced-style patching, no
  microG-style service impersonation (owner had bad autofill/sign-in
  experience with that), no unlocking paid features (no background-play
  unlocks etc.). This keeps the project legally clean (ad-blocker precedent)
  and makes native sign-in/autofill work.
- INSTANT by default. The core is plain block rules + CSS with zero lag.
  Anything heavy (AI detection) is a module, never in the critical path.
- NO NAGS, ever. The product never pesters its own users. Platform
  "open in app" nags are hidden by the ruleset.
- Radical simplicity / zero plumbing. One tap and it works. No config
  required. A grandparent or a struggling teenager must be able to use it.

## 3. Product architecture (settled)

Three deliverables sharing ONE rules core:

a) CLEAN FEEDS APP (mobile; the flagship).
   - NOT a general browser. Deliberately narrow: it opens ONLY the five
     platforms (YouTube, Instagram, TikTok, X, Reddit) in cleaned web views.
     No address bar / general navigation. Owner explicitly rejected
     general-browsing scope ("other browsers handle that better").
   - Thin shell over the OS engine: WebView (Android) / WKWebView (iOS).
     We never fork a browser engine (Chromium treadmill killed Kiwi).
   - Native password autofill MUST work gracefully (iCloud Keychain /
     Google Password Manager / passkeys). Sign-in is one-time per platform;
     onboarding includes a graceful "set up your accounts" step.
   - Bypass resistance matters (1am-relapse scenario): inside the app there
     is no instant toggle to disable blocking. The playbook additionally
     pairs the app with OS-level locks (iOS Screen Time / Android Digital
     Wellbeing or Family Link) where the passcode can be held by a trusted
     person (parent/spouse/friend). This pairing is documentation + an
     onboarding step, not custom code.

b) DESKTOP EXTENSION (the seed / sibling).
   - Standard Web Extension format: one codebase → Chrome/Brave/Edge/Firefox;
     Firefox for Android accepts it near-free; Apple's Safari Web Extension
     Converter turns the same files into the iOS Safari extension.
   - For general web browsing outside the feeds app, users are pointed to
     extensions (ours + existing tools like HaramBlur, uBlock Origin).

c) THE PLAYBOOK (first-class deliverable, not an afterthought).
   - Plain-language, step-by-step escape guide anyone's parent can follow:
     install, lock, hand the passcode to someone who loves you.

## 4. The rules core (settled)

- EasyList model: plain-text block rules + CSS, decoupled from the engine,
  so fixes ship to everyone without app updates. Rules change daily;
  engine changes rarely. This is the 20-year-proven survival model.
- One shared rules file powers every shell. Adding a platform = adding a
  rules block, never a new app.
- MAINTENANCE MODEL (owner-approved): an AI-automated watcher (scheduled
  job, weekly or daily) loads each platform, tests whether rules still hit
  their targets, drafts selector fixes when they break, tests the draft,
  and sends the owner a one-tap approve. NEVER auto-ship rule changes —
  the owner is the human approval gate (a broken selector that hides the
  video player is worse than a missed Shorts shelf). Community fixes later
  merge into the same review queue. Owner accepts small hosting/API cost.

## 5. The gaze module (settled scope, Phase 2)

- On-device AI blur, HaramBlur lineage (it is open-source; owner loves that
  it works frame-by-frame INSIDE videos, not just thumbnails). Open bases
  also exist (e.g. NSFW Filter 2026 GPL, BlurNSFW-style approaches using
  TensorFlow.js/MobileNet).
- Three modes chosen ONCE at setup, in plain language:
  (1) explicit content only;
  (2) explicit + opposite gender (either direction, user's choice);
  (3) strictest (all people/faces).
- Modular: keeps the core instant; heavy detection never blocks the
  critical path. Respect upstream licenses; credit; keep derivatives open.

## 6. Why nothing existing suffices (verified by research in session)

- SwizzTube / ProTube / talavo / CleanTube / No Shorts: iOS clean-YouTube
  apps exist and validate the browser-app model, but are YouTube-only,
  closed/paid, and have no gaze protection.
- No Distractions / ShortShield: open, multi-platform feed hiding, but no
  ads coverage (or partial), no gaze module, weak/roadmap mobile.
- HaramBlur: gaze protection exists, but its iOS app modes are limited
  (in-app YouTube lacks Shorts blocking; device-wide mode lags — owner
  tested personally) and it doesn't do ads/Shorts/feeds.
- one sec (peer-reviewed ~57% usage reduction) intercepts only NATIVE APP
  launches — browser use is its blind spot, which is exactly where this
  project lives. Soft-pause friction is a candidate v2 feature (owner liked
  the science; "pause feels chosen, block feels punished").
- Key iOS technical fact: Safari content blockers cannot catch YouTube ads
  (served same-origin from youtube.com); script injection in an app's web
  view is what works (talavo's documented approach). On iOS all browsers
  must use WebKit, so "own browser" adds nothing there.

## 7. Constraints & assets

- Owner has a paid Apple Developer account ($99/yr) already. Users never
  need one; App Store distribution covers everyone.
- iOS build requires a Mac + Xcode. Owner has no iOS device; his cousin
  (with an iPad) visits for a FEW DAYS — all iOS testing must be timed to
  that window. Do not spend that window building desktop things.
- Owner self-describes as a beginner developer ("not an experienced
  developer"). Write code accordingly: explain as you go, small steps,
  working checkpoints.
- Owner works on a cloud/remote desktop machine at home. OS: OPEN — ask.
- First test browser (Chrome vs Brave): OPEN — ask.
- Project name: OPEN — working candidates above.

## 8. Build order (settled)

- Phase 0 (30 min): curate the open-source base to fork (No Distractions /
  ShortShield lineage for rules structure). Fork, don't reinvent.
- Phase 1 (first session — START HERE): YouTube desktop extension.
  Block-only: ads gone, Shorts/algorithmic home feed hidden, thumbnails
  blurred (blur-all via CSS — no AI needed for this), app-nags stripped.
  The rules file born here is THE shared artifact for everything later.
  Rationale: fastest proof, easiest dev tools, YouTube is the hardest test
  (same-origin ads, frequent DOM changes), and the files port everywhere.
- Phase 2 (weeks 1–3): gaze module wired in (3 modes); Instagram, TikTok,
  X, Reddit rule blocks; Android via Firefox extension.
- Phase 3 (cousin window): iOS — clean feeds app (WKWebView + script
  injection + autofill) and/or converted Safari extension; test on the
  iPad; publish with owner's dev account.
- Phase 4 (ongoing): open the repo to community, AI rules-watcher live,
  home-screen icons (save-to-home links styled like the real apps — the
  zero-install distribution trick), optional soft-pause friction layer,
  and the playbook.

## 9. First task for this Claude Code session

Read this file, confirm understanding in a few lines, ask the two OPEN
questions (machine OS; Chrome or Brave first), then scaffold Phase 1:
project folder structure, manifest, the rules/CSS for YouTube
(ads, Shorts, home-feed, thumbnail blur-all, nag-strip), and instructions
to load it unpacked and verify each rule works. Small working checkpoints;
the owner should SEE YouTube get cleaner step by step.

---

## 10. Session state (maintained by Claude Code — update every session)

**Last updated:** 2026-08-18 · scoping corrected · no code written yet.

### IMPORTANT — §8 and part of §3 above are superseded
A scoping conversation on 2026-08-18 corrected the build order and the
product shape. **Read `docs/plan.md` before acting on §3 or §8.**
Mission (§1) and hard rules (§2) are unchanged and still govern.

What changed and why:
- **No desktop browser extension.** §8's "Phase 1: YouTube desktop
  extension" is dropped. The owner does not want an extension experiment;
  the product is the cross-platform app from the start.
- **We embed an engine instead of writing one.** Brave's `adblock-rust` is
  a standalone Rust library; Tauri is Rust. Ads, trackers and the
  anti-adblock arms race are inherited from funded teams, not maintained
  by us. Ad blocking is no longer a thing we implement.
- **Shell is Tauri v2** — one codebase to Windows, macOS, Linux, Android,
  iOS, each on the OS's own webview. Satisfies §3a's "never fork an
  engine" exactly.
- **The framing is harm reduction, not abstinence.** People cannot leave
  these platforms; we keep the access and remove the manipulation. The
  launcher (home-screen icons that redirect the existing tap reflex) is
  the core behavioural mechanism, not a nicety.
- **Platforms are not equal.** YouTube, Reddit, X are coherent cleaned.
  Instagram is partial (Meta cripples mobile web). TikTok *is* the For You
  feed and may never ship.
- **Rules format is EasyList syntax**, reversing an earlier
  recommendation of bespoke JSON — embedding `adblock-rust` means the
  syntax is parsed for us and the same file works in Brave and uBlock.

### Documents
- `docs/plan.md` — the plan. Phases, platform order, risks, open
  decisions. This is the forward document.
- `docs/technical-findings.md` — verified facts with sources checked
  (MV3, `adblock-rust`, Tauri injection timing, Apple 2.5.2 and minimum
  functionality, Brave filter subscriptions, HaramBlur). Facts only.
- `docs/system-map-v3.html` — the original planning-session visual.
  Still accurate on mission; its "desktop extension sibling" panel is
  superseded.

### Answered
- **Machine OS:** Windows 11 Home, remote/cloud desktop, workspace at
  `Z:\Apps\Disconnect`. (Was OPEN in §7.)
- **First browser:** moot — no extension is being built. Brave remains the
  recommended pairing for users' general browsing in the playbook.

### Decided (Phase 0 complete)
- **Name: `tamescroll`.** Clear on `.com`, `.app`, `.org`, GitHub org and
  App Store. Names the behaviour people recognise in themselves, not the
  mechanism. Working directory is still `Z:\Apps\Disconnect` — the folder
  has not been renamed.
- **Licence: MPL-2.0 for code, CC0 for `rules/` data.** MPL matches
  `adblock-rust`, keeps our files open, and — unlike GPL/AGPL — does not
  conflict with App Store terms. CC0 on rules lets Brave, uBlock and
  AdGuard absorb them.
- **Contributor agreement live** in `CONTRIBUTING.md` from the first
  outside contribution, preserving the right to relicense later.
- **HaramBlur code must never be copied in.** It is AGPL-3.0; taking its
  code would make the whole project AGPL and end iOS distribution. Build
  the gaze module on `Human` and `nsfwjs` (both MIT) directly, which is
  what HaramBlur itself is built on. Recorded in `NOTICE` and
  `CONTRIBUTING.md`.

### Still OPEN
1. **Whether TikTok ships at all** — TikTok *is* the For You feed; there
   may be no coherent cleaned version.
2. **Domain not registered.** `tamescroll.com` was free as of 2026-08-18.
   Costs money — owner's call, do not buy.

### Phase 1 in progress
`rules/youtube.txt` (core) and `rules/youtube-blur.txt` (optional blur)
are written. Selectors were read from the live DOM, not guessed. Every
rule carries a `! test:` line; rules are tagged `[live]` (counted in the
real DOM) or `[unverified]` (surface did not render on the test account).

Verified 2026-08-18 by injecting the rules as CSS on a real watch page:
recommendation sidebar and end screen went to zero height, player height
unchanged at 556.45px before and after, video element still present,
comments and description intact.

**Test-environment gotcha for future sessions:** the owner's Chrome runs
an Unhook-style extension with everything enabled — it sets `hide_feed`,
`hide_shorts`, `hide_search` and ~23 more `hide_*` attributes on `<html>`
and YouTube looks empty as a result. To read the real DOM, strip them
first (page-local, resets on reload, does not touch their settings):
`[...document.documentElement.attributes].forEach(a=>{if(a.name.startsWith('hide_'))document.documentElement.removeAttribute(a.name)})`

Also note the test account's home feed returns no items at all, so home
and Shorts-shelf rules could not be verified live. Needs an account with
watch history on.

### Phase 2 complete — the shell spike works (2026-08-18)

`app/` is a Tauri v2 project. Launcher window lists the platforms; clicking
YouTube opens a second webview window with the rules applied. Verified by
screenshot: **Shorts is gone from the sidebar and the home grid is empty
inside our own app.** 16 rules active.

Architecture confirmed working:
- `adblock` crate v0.13.2 embedded, `Engine::new_with_filter_set`, fed
  `rules/youtube.txt` via `include_str!`.
- Cosmetic CSS built in Rust from `url_cosmetic_resources`, injected via
  `initialization_script`, re-applied on SPA navigation by patching
  `pushState`/`replaceState` in the injected JS.
- Bundle identifier `app.tamescroll.client` — PERMANENT once published.
  Do not change it. Rename the display name instead.

Two research findings corrected by testing:
1. **Google sign-in is NOT blocked on desktop.** Research said embedded
   webviews get `disallowed_useragent`; the real Google sign-in page
   serves normally in WebView2. Untested past the email field (entering
   credentials is off-limits) and untested on Android, where the `; wv)`
   user-agent marker is the likely trigger — `WebviewWindowBuilder::
   user_agent()` is the lever if it bites.
2. **Network blocking is not reachable through Tauri's public API** —
   cosmetic filtering only, cross-platform. Costs us little because ads
   were already delegated, but the app cannot block ads itself yet.

### Next action
Reddit and X rule blocks (both are `ready: false` in `PLATFORMS`), then
Android — the SDK and an emulator are already installed on this machine.
Before Android, test Google sign-in there.
