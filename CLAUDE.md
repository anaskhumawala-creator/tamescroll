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

**Last updated:** 2026-08-19 14:40 (day 2 — smart-mode gender parity + UI rebuild + text filter).

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
m.youtube watch-page related videos hidden (scoped off search — same
element ytm-video-with-context-renderer, verified both ways). Open App
topbar nag killed via a[href^="intent://"] (only stable hook — generic
button-shape classes; verified gone). Old promo nag selectors matched
0 on live DOM, annotated + kept belt-and-braces. Reddit mobile blur
verified (r/EarthPorn 8/8 imgs blur(16px)); player video filter:none
in blur-all — red line holds.
Emulator gotchas: Hijri First app steals foreground + ANR loops —
force-stop com.hijrifirst.app before evidence runs.

**Adversarial review (Opus) → 13 findings, all fixed + device-verified**
(commit 5e1bf59, probe18 evidence in spikes/). Critical three: smart
mode shipped Stage A CSS (class-less → unblur impossible), bundle
booted 2-4x/navigation (no re-entry guard), cross-origin video taint
→ permanent blur + 2Hz spam (now giveUp() fail-open). Probe18: blur-all
OK, smart boots once w/o static sheet (__TS_GAZE_BUNDLE__="v1"), watch
video filter:none, cold shortcut OK after bridge self-removal. **Probe19 positive control: smart mode WORKS** — "podcast interview
face" search flagged 5/8 big thumbnails (people visibly blurred, titles
sharp); probe18's 0-flag was a correct negative (searched "nature").
Threshold behaves both directions on real thumbnails; remaining smart
question is runtime feel (owner eyes). Probe19 also caught an
intermittent cold-start launcher failure: invoke("platforms") dies
with "platforms not allowed. Plugin not found" (~1 in 3 cold boots,
page JS races Rust webview registration) — mitigated with bounded
retry in main.ts (invokeStartup, 5 attempts); root cause is Tauri-side
registration timing, not fixable from JS. Other open notes: giveUp()
log path never fired on-device (player filter:none verified
regardless); rules/youtube-blur.txt deleted 25d1f37; x.txt tablist
rule leaks to profile pages (pre-existing).

**Blur strength presets SHIPPED** (7318da9, probe22/23): Light/Medium/
Strong pills under the blur picker (hidden on Off), radii via
--ts-blur / --ts-blur-strong CSS vars set at injection (Rust-held px
next to GAZE_STATE, mirrored set_blur_strength cmd + open_platform
strength param). Device-verified 28px/8px computed on m.youtube,
player filter:none held, row hides on Off. Also probe20: 6/6 cold
starts clean with the invokeStartup retry; probe21 desktop smoke
green (101 rules active, engine warm 1.89s).

**Shadow DOM pierced** (612bb04, probe25-27): smart mode was blind to
Reddit video (shreddit player = open shadow root; light-DOM discovery
only) AND document-level gaze styles were inert inside roots (pending
class, filter none). Now: 3-leg discovery (scan descends, boot
deep-scan, attachShadow wrap), per-root observer + per-root stylesheet
copy. Verified: shadow videos pending at blur(24px), 532/532 roots
styled, giveUp() tainted-canvas fail-open FIRED live once
(packaged-media.redd.it) — last unverified review path closed.
Image CORS fail-closed also observed live (cors-denied avatars stay
blurred, by design).

**Desktop smart mode never worked — found + fixed** (1de9fa0,
probe28-30): WebView2 loses the tail of a >1MB initialization_script
(early CSS IIFE of the same string ran, appended 1.6MB bundle left no
trace, node --check clean). Fix: desktop platform windows eval
page_load_gaze_script via .on_page_load — same delivery as Android.
Side effect (deliberate): desktop navigations follow CURRENT gaze
state, not window-creation mode. Verified: smart boots on desktop
www.youtube (2 pending + 4 flagged), player filter:none. NOTE for
future: never put big payloads in initialization_script on Windows.

**Protection engine grilled 2026-08-19 (day session):** gender filter +
compulsory suggestive removal + text signals. All decisions in
docs/handoff-protection-engine.md + CONTEXT.md; research in
docs/keyword-research.md. Spec NOT written — next step is to-spec in a
fresh session. TikTok blur rewritten blanket (all img+video, player
exempt) after two owner reports — fbd885e. Desktop dev relaunch with CDP
9223 verified 37/37 blurred in-app.

**Day-2 session 2026-08-19 (afternoon):** Smart mode now HaramBlur-
parity gender-aware — BlazeFace full box decode + SSR-Net gender
(both MIT, from vladmandic/human; NOTICE updated), faceVerdict clears
own-gender faces, opposite/low-score stay covered (probe31 both
directions). Face-REGION blur: backdrop-filter overlays, document-
anchored so scroll never exposes (owner report fixed, probe32/33);
videos/NSFW keep whole blur. Thresholds + calibration protocol now in
docs/detection-engine.md (owner "systemize" ask). UI rebuilt to
owner's Claude Design boards (ff2be57): launcher/settings/onboarding,
type-to-match platform add (no-circumvention: never list platforms),
Filters pane. web/index.html rebuilt to board 1F. Text signals
SHIPPED (ade2925): dsojevic seed + algospeak + user terms via
obscenity, Rust USER_TERMS -> __TS_USER_TERMS, pre-model text filter
on per-host item containers (TEXT_ITEMS — ytd-video-renderer +
ytm-video-with-context-renderer, both live-verified). probe36: 6/6
crypto-term items flagged, non-matching cleared. DEBUG LESSON:
below-fold lazy imgs have no src -> never tagged (naturalWidth gate);
class-absence probes count them as "cleared" — always filter probes
to imgs with a real src (probe35 artifact cost half a session).
Verification probes must select by item container, not bare img
(avatars/decoys skew counts). Tests: gaze 20/20, cargo 20/20, tsc
clean. Not yet built: compulsory NSFW-remove tier, strictness levels
(pane is placeholder), Android re-verify of gender/terms/region-blur.

**Day-2 continued (evening):** Text-filter "misses" root-caused as a
MEASUREMENT ARTIFACT (probe35): below-fold lazy imgs have no src, fail
tagImage's naturalWidth gate, never process — class-absence probes
counted them "cleared". Filter was correct all along; two speculative
re-check passes reverted; probe36 6/6 flagged. Reddit text container
shipped: shreddit-post (light-DOM thumbnails, closest() works) —
probe37 verified in-app (608ccf3). **Compulsory NSFW-remove tier
SHIPPED (3e91c27, probe38):** bundle boots in ALL modes;
pipeline-plan.mjs = unit-tested per-mode policy (off: pre-blur + text
+ NSFW-remove + reveal, no gender; blur-all: NSFW-remove only; smart:
full). ts-gaze-removed hides the whole feed item; removals survive
fail-open. Live-verified: off mode removed a suggestive search row
outright (sexy>0.8 fired), blur mode removed same row, smart
regression clean. Known gap: no NSFW on videos yet. **Android APKs
built** (arm64 first ever): owner phone (Redmi, MIUI blocked USB
install) got APK pushed to /sdcard/Download/tamescroll-debug.apk —
owner installs from Files. JAVA_HOME env var is STALE
(HijriToolchain) — set 'C:\Program Files\Eclipse
Adoptium\jdk-17.0.20.8-hotspot' before gradlew. Emulator re-verify of
gender/terms/region/compulsory in progress (x86_64 inference is
minutes-slow on emulated GPU — real hw much faster; off-mode CPU cost
on low-end phones = open perf question). GitHub: owner asked "do we
need it" — advised private repo for backup (repo exists only on this
machine); owner-gated.

**Owner phone test round 1 (2026-08-20):** two reports, both fixed +
emulator-verified (probe40, commits 0ed7405 + 06fc819): (1) status-bar
overlap -- template enableEdgeToEdge() had no inset handling; content
view now pads by system bars, strips painted launcher-dark. (2) "ad
blocking does not work at all" -- Android's only rules delivery was the
universal script = surfaces CSS ONLY; engine ad cosmetics + scriptlets
NEVER shipped on Android (emulator never got served ads, so invisible).
Now page_load_rules_script evals full payload per page load (engine
cosmetics for actual URL + scriptlets + surfaces at current SHOWN_STATE,
guarded), and it must REMOVE the universal sheet first (same style id --
apply() no-oped, cssLen stuck 2332; now 35484 on m.youtube). Owner
priority saved to global CLAUDE.md: execute, don't editorialize.
Phone APK re-pushed w/ all fixes (Download/tamescroll-debug.apk).
Video PRE-ROLL ads on Android = scriptlet timing at onPageStarted,
unverified vs real ads -- owner retest decides.

**Rules OTA SHIPPED** (c804cbc, 2026-08-22): rules/manifest.json
(sha256 per file, gen by scripts/gen-rules-manifest.mjs — RERUN + commit
after ANY rules/ edit or shipped apps never see it) fetched from raw
GitHub main on launch + 24h + About-pane Check-for-updates button
(refresh_rules cmd). ota.rs: hash-verify + HTML/empty sanity gate,
all-or-nothing apply, app-data cache restored on boot, silent failures
(NO NAGS). ENGINE now RwLock<Arc<Engine>>, surfaces rebuild via bounded
Box::leak, blur CSS same override layer. Scriptlets/resources.json
binary-only (store rule). Hashes LF-normalized (autocrlf). 26/26 tests
incl. e2e local-HTTP refresh test; live raw hash verified matching.
Test gotcha: OVERRIDES is process-global — mutation tests use ADDITIVE
overrides + TEST_LOCK or parallel readers flake.

**Fullscreen video FIXED** (phone round 2, probe41): wry generated
RustWebChromeClient REJECTS Fullscreen API (onShowCustomView calls
onCustomViewHidden immediately) -> m.youtube pseudo-fullscreen w/ bars.
Fix in MainActivity.kt: delegating WebChromeClient wrapper (installed
webView.post AFTER wry attaches; class is final, attach order
setWebView->onWebViewCreate->setWebChromeClient) forwards all wry
behavior, owns fullscreen pair: view onto decorView, immersive bars,
forced USER_LANDSCAPE (WebView has no screen.orientation.lock),
KEEP_SCREEN_ON, Back exits fullscreen first. Emulator-verified both
ways. API 26+ only. Owner report "lot of loading" UNDIAGNOSED —
suspects: 1.6MB bundle eval/parse per page load + NSFW inference on
Helio G88 + debug build; needs owner mode + evidence run.

**Phone round 3 fixes** (2026-08-23, probe42): (1) both-genders-
blurred = gender model loaded LAST + no re-verdict -> permanent
presence-only flags on slow devices; drain now waits genderSettled
(loaded OR failed), gender loads 2nd, NSFW last. (2) region overlays at
stale coords after thumbnail tap = SPA nav fires no scroll/resize;
250ms heartbeat repositionAll while entries exist (verified 18->1
overlays 2s after SPA home nav; faces pinned correctly on search).
(3) pinch-to-zoom fullscreen video: ScaleGestureDetector at
dispatchTouchEvent (never consumed), scales view 1-3x, reset on
enter/exit — UNVERIFIED on device (no touch sim for pinch; owner
retest). Owner asks OPEN: live blur INSIDE playing video (player is
exempt BY DESIGN — red line; reversing = protection-engine spec work +
perf question on low-end hw) + in-player blur toggle. Owner arch
question answered: Tauri stays. Probe gotcha: region-blur removes
FLAGGED_CLASS once overlays active — class-based probes count
region-blurred imgs as cleared; count #tamescroll-gaze-regions
children instead.

**Overnight run 2026-08-23:** in-player live blur SHIPPED (owner
reversed player red line, HaramBlur parity — smart mode only): player
video samples live, whole-video blur, 1s clean-unblur, in-player pill
toggle (visible only while covered or toggled off; resets per video via
loadstart). Model loads deferred to post-load idle EXCEPT off mode
(review #8). OTA round-trip PROVEN live on emulator (pushed rule ->
"updated 1 rule file(s)"; CDN lag ~2min). Opus adversarial review: 14
findings, all addressed — CRITICAL: page-side eval() fallback is
CSP-dead on Reddit/X/YT (trusted-types), REVERTED to dual full eval
(perf idea needs a Rust-side race signal; do NOT retry page eval);
nsfwSettled drain gate (unchecked reveals); region snap guard +
read/write batching; video-element reuse reset (loadstart); JSON-escape
injection CSS (${ was remotely lethal via OTA vendor lists);
validate_payload LF-norm + per-file skip; 15min fail retry; cache
app-version stamp; IME insets. Emulator re-verified post-fix (rules
35484B, shorts hidden, player pending+pill). Phone APK pushed w/
everything. tfjs research memo in session transcript: WASM backend
spike = candidate for low-end perf (no official inline-binary API,
needs blob-shim spike); eval'd strings never byte-cached in WebView.
Loading complaint root causes addressed (dedup parse was reverted —
remaining lever = deferred models, shipped); owner answer pending on
whole-time vs first-seconds.

**Session 2026-08-23 (perf + gender root-cause):** Owner order — track
all reported issues, don't stop (docs/owner-issues.md = live tracker).
**"Both genders blurred" ROOT CAUSE found + fixed (2d58f1b):** embedded
gender-ssrnet-imdb model is broken upstream — single output saturated
~1.0 on every real face under every documented preprocessing (verified
byte-identical to human-models, so not our conversion). Old reader did
data[0]>data[1] with data[1]=undefined -> every face 'male'/undefined ->
faceVerdict permanently 'flag' regardless of setting. Replaced with
human-models gender.json (Oarriaga mini-Xception, MIT, 64x64 GRAYSCALE,
[female,male] softmax); bench-proven directional (Obama male .988, Swift
female .88); GENDER_MIN_SCORE 0.6->0.85 (wrong-gender scores hit .79 —
0.6 could clear opposite gender). NOTICE + docs/detection-engine.md
updated. **Perf:** the 694-1000ms/frame webgl "catastrophe" was a
hidden-tab nested-timer THROTTLING ARTIFACT (Chrome clamps GPU-readback
fence-wait setTimeouts to ~1s in hidden tabs); true cost 19.6ms face /
17.1ms NSFW per frame (dataSync bench, RTX 3060 Ti). Still shipped real
wins: detectFaceBoxes now ONE [896,5] GPU download + JS NMS
(src/nms.mjs, 6 tests) instead of nonMaxSuppressionAsync + 2 downloads;
classifyFaceGenders batches ALL faces into ONE inference; drainImages
parks while document.hidden, resumes on visibilitychange. gaze 31/31,
cargo 26/26, tsc clean. **Watch-click 'loads a lot' / 'ad came up'
(#9/#12): GRILL-READY** — profiling agent proved 4.4s SPA stall +
hard-nav pre-rolls come from our partial scriptlet set (json-prune
deletes adPlacements -> YouTube renegotiates stream 4.4s; fast runs just
play a pre-roll). Fix needs request-shaping scriptlets
(trusted-json-edit-*-request) = fragile YouTube-ad-bypass front line on
the player red line -> owner-grill, 3 options in docs/scriptlet-gap.md
(recommend request-shaper-only). **Launcher polish (#10):** styles.css
tap-highlight/focus-visible-ring/user-select/autofill/overscroll/svg-drag
(FIXED-unverified). **YouTube device-account sign-in (#11): ANSWERED**
not feasible (WebView sandboxed from device Google accounts; cookies
persist so it's once-per-device). New APKs built both targets; arm64
pushed to phone Download/tamescroll-debug.apk (gender fix + perf +
polish). Emulator gender re-verify impractical (emulated-GPU inference
minutes-slow — needs real hw). Desktop dev-app live-verify BLOCKED this
session: npx tauri dev relaunch flaky (CDP never came up after 5
attempts, redirect log never written) — gender fix stands on bench proof
+ tsc/tests. cdp.py needs suppress_origin=True (WebView2 403s cross-origin
WS) + websocket-client pip pkg.

**Loop ticks 2026-08-23 (post-gender-fix):** region-blur heartbeat
thrash FIXED (6dfb7ec) — probe-guard reads 1 rect/tick when static +
skips when hidden (was N reads 4Hz = 146ms/15s forced layout); gaze
32/32. Both APKs rebuilt; arm64 pushed to phone (gender+region-blur+
polish together), x86_64 reinstalled on emulator-5556. **Gender fix
VERIFIED in-app (probe44, #7 -> FIXED-verified):** emulator man mode,
Trump (clear male) rendered SHARP/cleared, obscured/low-conf faces
region-blurred by 0.85 fail-safe — differentiated verdicts the old
broken model never produced (it whole-blurred every thumbnail). Logcat
clean of gaze model errors. Real-hw timing still owner-phone. Known:
0.85 over-blurs obscured male faces by design. Emulator/launcher share
one webview on Android (re-tap fix) so gender flip needs back->relaunch.
Blocked this session: WEBGL_USE_SHAPES_UNIFORMS bench (Chrome ext
disconnected), desktop dev-app CDP (flaky launch).

**In-app updater SHIPPED (f8aa177, owner ask — stop WhatsApp-ing APKs to
remote phone):** appupdate.rs = cross-platform CHECK only (fetch signed
manifest, compare versionCode, never installs; evaluate() 4 tests, cargo
30/30), app_update_check cmd degrades to up-to-date on any failure (no
nag). MainActivity UpdateBridge (Android) install() takes NO url from JS
— re-fetches the fixed manifest itself, hash-pins APK to manifest
sha256, FileProvider -> system installer (user-confirmed);
REQUEST_INSTALL_PACKAGES added. About 'App update' card hidden unless
newer build exists. updates/app-manifest.json (resting 1000/empty ->
available:false) + scripts/gen-app-manifest.mjs. probe45: bridge
registered, card hidden at rest, install() round-trips JS->Kotlin->
network->JS. TWO GATES before updates actually flow: (a) owner OK to
publish GitHub Releases (host the APK); (b) STRIP the 329MB debug APK to
~50MB (llvm-strip libapp_lib.so — in-app download can't be 329MB).
Bootstrap: phone must install current arm64 (has updater) once from
Files; pushed to Download/tamescroll-debug.apk. Manifest URL hardcoded
in BOTH appupdate.rs and MainActivity.kt — keep in lockstep.

**In-app updater DONE + LIVE (owner approved GitHub Releases 2026-08-23,
verified probe46):** release app-v0.1.1 published (arm64, 45MB), manifest
on raw main points at it, emulator v1000 -> saw v1001 -> downloaded ->
sha256-verified -> system installer consent prompt. Owner phone got the
stripped v1001 at Download/tamescroll-debug.apk (install ONCE from Files
to get the updater; future updates in-app). **RELEASE RECIPE for next
build:** (1) bump app/src-tauri/gen/android/app/tauri.properties
versionCode (+1) & versionName, and appupdate.rs CURRENT_VERSION_CODE to
match (tauri.properties is GITIGNORED/autogen — lockstep lives in
tauri.conf.json version + appupdate.rs), (2) tauri android build --debug
--target aarch64, (3) STRIP: llvm-strip --strip-unneeded the .so
(NDK 27.1 .../llvm-strip.exe; 170MB->38MB->45MB APK) BEFORE copying to
jniLibs/arm64-v8a, (4) gradlew assembleArm64Debug -x rust, (5) gh release
create app-vX.Y.Z <apk> --repo anaskhumawala-creator/tamescroll, (6) node
scripts/gen-app-manifest.mjs <apk> <releaseDownloadURL> "<notes>", (7)
commit+push updates/app-manifest.json. Manifest URL hardcoded in
appupdate.rs AND MainActivity.kt — keep in lockstep.

**Post-v1001 loop wins (not yet in a release APK):** region-blur
heartbeat probe-guard (6dfb7ec), WEBGL_USE_SHAPES_UNIFORMS (e668561 —
benched on real Android WebView: gender shader compiles 223->98,
per-new-batch recompiles 68->12, output bit-identical). Batch these into
the NEXT release (v1002) when enough accumulates rather than churning a
release per commit. WEBGL flag bench harness proven: point the emulator
WebView at http://10.0.2.2:8899/bench.html via CDP (host bench server),
tf.env().set(flag) before setBackend, wrap linkProgram to count compiles
(arch-independent) — emulated-GPU TIMING is unreliable but compile COUNT
+ output parity are not.

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
LIVE 2026-08-20 (owner approved): github.com/anaskhumawala-creator/
tamescroll, PUBLIC, origin=main. Rules-OTA raw URL base now exists.
