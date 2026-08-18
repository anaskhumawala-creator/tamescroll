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
- `docs/rules-updates.md` — hosted rules OTA design note (Phase 6 prep).
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

**Last updated:** 2026-08-18 (Fable session 2 — gaze A, spike, search junk).

Done: Phase 0-2.5 as before (see git log). This session: **Gaze Stage A
shipped** — rules/blur/{youtube,reddit,x}.css, launcher Off/On toggle
(localStorage tamescroll.blur), page_css() in lib.rs unit-tests the
toggle wire; Reddit blur scoped off post_detail so opened posts play
normally. **Gaze Stage B spike: SPIKE_OK** — inline base64 BlazeFace ran
on live reddit.com under default-src 'none' (720ms first inference,
1.57MiB bundle, zero network; Workers surprisingly unblocked in WebView2
— engine-specific, fallback stays; docs/gaze-research.md updated).
**YouTube search inserts removed** (owner report): promoted block,
shelf inserts, "People also search for", topic watch card — verified
live, 46/49 organic videos + both channel results survived. Reddit/X
rules live-verified second pass (recent-posts replaced a guessed name;
r/all redirects to /hot when logged in). m.youtube.com rules written
[unverified until emulator]. rules/instagram.txt DRAFT committed.
Android machine prep done (JDK 17, NDK, 4 rustup targets).

**Android first run DONE** (emulator-5556): APK builds via the
symlink workaround (copy .so + gradlew -x :app:rustBuildX86_64Debug —
see docs/android-research.md), launcher renders 1:1, engine warms
3.6s. Found + fixed: mobile rules were host-filtered out of the
injected CSS (UA redirect happens after injection). **Android cleaning
VERIFIED on-device** (evidence runs 1-4, spikes/logcat-evidence*):
injection delivery works (plugin js_init_script; tauri#7863 no longer
applies); real blocker was selector drift — mobile Shorts tab is
div.pivot-bar-item-tab.pivot-shorts, fixed + [live]. Back key fixed
launcher-first in MainActivity.kt (press1 launcher, press2
background, verified). Relaunch-blank RESOLVED same day
(root cause: Back was finishing the activity under a live Rust
process; moveTaskToBack(true) fixed, verified 2 cycles). Tile re-tap
after Back also fixed (window-label reuse -> navigate/focus).
Android milestone COMPLETE: cleaned YouTube + working launcher
round-trip on the emulator.
**Settings pane DONE**: !surface: markers in rules files, our rules
now a toggleable CSS layer outside the engine, Bring back section
with Hidden/Shown pills; ads/promoted/nags always-on. 14/14 tests.

Rules-change gotcha: rules/*.txt are include_str'd — the dev watcher
does NOT watch rules/, so touch a src-tauri file to force the rebuild,
then REOPEN the platform window (injection happens at window creation).

**Android re-tap bug FIXED + VERIFIED** (probe8: 6/6 taps incl.
re-taps and cross-platform). Root cause was NOT IPC: an early
label-reuse guard in open_platform (set_focus + Ok) silently
"succeeded" on every re-tap — set_focus is a visual no-op on Android.
Real model fix: Android never builds platform windows; open_platform
navigates the single "main" webview in place (desktop unchanged:
focus-if-open + builder). Kotlin: Back never history-restores into the
launcher (BFCache zombie — CDP evidence) — fresh loadUrl instead. Full
saga + probe-run lessons in docs/android-research.md §re-tap. Debug
probes stripped; two cfg(debug_assertions) eprintlns remain in
open_platform.

**Overnight session 2026-08-19:** Gaze delivery on Android SHIPPED —
Rust-held mode (set_gaze_mode cmd + open_platform), ts-inject plugin
on_page_load evals blur CSS (Started+Finished, id-guarded) + Stage B
in smart mode; m.youtube blur selectors harvested live via CDP
(ytm-thumbnail-cover etc.) and VERIFIED visually (probe12: thumbnails
blurred, titles sharp; smart boots __TS_GAZE_MODE). Home-screen
shortcuts SHIPPED: shortcuts.xml + own letter-glyph icons (never
platform logos), cold start via one-shot ShortcutBridge JS interface
(URL race with wry made loadUrl unreliable — probe12 fail, probe13
3/3 pass: cold/warm/plain). Landing page web/index.html committed,
Chrome-verified (interactive demo, blur texture fix, mobile nav).
Desktop regression: launcher renders identical on new build.
Emulator gotchas: Hijri First app steals foreground + ANR loops —
force-stop com.hijrifirst.app before evidence runs.

Next: gaze smart-mode runtime feel (owner eyes); nsfwjs budget call
(owner); owner one-time sign-ins; TikTok draft awaiting owner go
(rules would be [unverified] — site blocked in India); Instagram
rules verify (needs sign-in); iOS prep (cousin window).
docs/rules-updates.md = Phase 6 OTA design note (committed).

Owner decisions 2026-08-18 (evening): domain — owner will purchase
tamescroll.com soon. TikTok — yes in principle ("a lot of user base"),
BUT owner is in India where TikTok is banned: no live DOM access from
this machine, so rules can only ship [unverified] until someone outside
India verifies (Phase 6 community, or owner VPN — owner-gated). GitHub
push still deferred ("without GitHub at the initial stage").
