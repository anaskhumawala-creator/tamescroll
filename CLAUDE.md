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

**Last updated:** 2026-08-18 · workspace bootstrap · no code written yet.

### Where we are
Phase 0/1 boundary. Repo initialised, handoff + system map committed.
No extension scaffold yet — the two OPEN questions below gate it.
Nothing has been forked or reviewed yet (Phase 0 not run).

### Answered since the handoff
- **Machine OS:** Windows 11 Home, remote/cloud desktop. Project drive `Z:`,
  workspace at `Z:\Apps\Disconnect`. (Was OPEN in §7 — now closed.)

### Still OPEN — ask the owner, do not decide alone
1. **First test browser:** Chrome vs Brave vs Firefox. Identical MV3 code for
   Chrome/Brave; Firefox costs a small manifest fork now but buys Android
   (Phase 2) earlier.
2. **Project name:** folder is `Disconnect`; candidates were The Way Out,
   Tenblock, Reclaim. Note an unrelated privacy extension already ships as
   "Disconnect", so the store name may need to differ from the folder name.

### Analysis (2026-08-18) — see docs/setup-analysis.md
Flags below were investigated and verified. Full reasoning and the
recommended resolutions live in `docs/setup-analysis.md`. Headline: MV3
bans remotely hosted code but permits remote JSON data, which splits the
rules core into a data lane (remotely updatable) and a code lane (store
review). Recommendation on the table: drop ad blocking from v1. Owner has
NOT ruled on any of it.

### Technical flags raised in analysis (owner has NOT ruled on these)
These are corrections/risks against §4 and §8, not new scope.

1. **MV3 cannot network-block YouTube ads.** Same root cause the handoff
   already documents for iOS content blockers (§6): ads are served
   same-origin from youtube.com/googlevideo, so `declarativeNetRequest`
   never sees a blockable third-party request. Desktop ad removal is
   script + DOM work (auto-skip, ad-slot CSS, player state), not filter
   rules. Consequence for §4: the rules core needs **two lanes from day one**
   — a static lane (CSS hide + DNR) and a small scripted lane — or the ad
   work gets retrofitted into a format that cannot hold it. Feeds, Shorts
   and nags are pure static lane and unaffected.

2. **Blur-all thumbnails needs a reveal gesture.** With every thumbnail
   blurred, the user cannot find the video they deliberately came for, and
   search becomes unusable. Needs hover-to-reveal or click-to-reveal from
   the start. Cheap now; painful once the rules file has shipped.

3. **Ring 1 is weak on desktop.** §2/ring 1 claims "nothing to disable in
   two taps" — true in the mobile shell, false for a browser extension,
   which is two clicks away from disabled in `chrome://extensions`. Not
   fixable inside the extension; it is an OS-lock/playbook item. Should not
   be claimed as desktop bypass resistance.

### Next action when work resumes
Answer the two OPEN questions, then run Phase 0 (30 min: curate the
open-source base to fork — No Distractions / ShortShield lineage, plus
uBlock Origin's YouTube filters as a rules reference), then scaffold
Phase 1 per §9.
