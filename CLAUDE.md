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

**Last updated:** 2026-08-25 overnight (blur v2 Stage 1 + owner-feedback wave, v1012 release in flight).

**Session 2026-08-24→25 overnight (blur v2):** docs/plan-blur-v2.md =
owner-approved implementation plan + risk register (research settled in
docs/research/blur-architectures-2026-08-24.md). Shipped since v1011,
all frame-verified on the Linus video (NWoT1ZVd1Lo) via CDP:
- **Stage 1 zero-readback** (bundle v6): person pass = fromPixels(video)
  DIRECT; gender crops = createImageBitmap(video, crop, {resize}); no
  getImageData in the player path (canvas fallback kept per-stream via
  directPersonOk). Measured: long tasks 1338ms -> 247ms/87s, dropped 0.6%.
- **Scene gate** (scene-gate.mjs): 16x16 luma delta @<=10Hz; cut(>=28) =
  wipe tracks + immediate full pass (fixes owner's "blur interchanging
  between people" — IoU association is meaningless across a cut);
  static(<=3) = 1Hz floor only while no track is blurred.
- **Identity memory** (owner: "keep the person in memory"): faceres
  [1024] descriptor (was discarded) L2-normed per gender read; per-video
  memory stores EARNED states only (served hold / certain flag);
  re-appearing face matching a remembered clear at cos>=0.6 AND reading
  confident-clear inherits instantly. Child can never inherit (age gate
  upstream). MEM_SIM_CLEAR 0.6 / MEM_SIM_UPDATE 0.45 UNCALIBRATED.
- **Close-up fallback**: full-frame face pass every verdict tick; faces
  outside person boxes -> expandToBody synthetic persons (fixed a real
  exposure: v17-560 daughter close-up, MoveNet 0 persons, fully sharp).
- **mergeTracks**: overlapping video patches union into one (owner ask).
- **Head anchor** (person-gate): head keypoints get guaranteed margin.
- **Edge cases** (owner asks): seeked = wipe tracks + immediate pass;
  pause zeroes velocities + re-pins; playbackRate>1 tightens cadence;
  loadstart wipes identityMemory.
- **Flag streak**: an EARNED clear takes 2 consecutive certain-opposite
  reads to revoke (gender sway was re-blurring Linus repeatedly).
- gaze 77/77, cargo 31/31, bundle marker v6. v1012 release recipe run
  overnight — check updates/app-manifest.json before assuming shipped.
- Background agents launched: Fable adversarial critic of all of the
  above; Sonnet brand-kit agent (owner's falcon brand kit from
  Z:\Downloads	amescroll-screens-drop\ -> web favicon/logo + tauri
  icon set; isolated worktree, commits only, NO deploy).
- NEXT (plan-blur-v2): Stage 2 delay-line spike (desktop WebView2:
  VideoFrame ring + delayed present + DelayNode audio — owner
  independently asked for exactly this "longer buffer"); then flow
  tracking, silhouettes. Owner bar: "not a single frame should pass."

**Session 2026-08-24 overnight, part 2 (v0.1.11/1011, commit 516cc54):**
owner live-tested v1010 (phone + watching the dev app) and fired 5
feedback rounds; all addressed + frame-verified:
- "laggy / patch trails / hands showing" -> SPLIT CADENCE (position pass
  floors 120ms ~8Hz, crops+gender every <=400ms, positionOnly obs move
  tracks w/o touching verdicts; clear credit accrues by verdictDt gap);
  ADAPTIVE throttle 1.5x measured pass cost cap 1s (phone self-slows);
  keypoint UNION covers hands (wrists >=0.3 + 0.03 margin).
- "jittery, corners distorting" -> overlay v3: translate-only (scale
  warped border-radius), size writes only >=2px change, 60Hz render
  lerp 0.25 so passes glide not snap. Size velocity extrapolates
  OUTWARD only.
- "logos/avatars blurred" -> IMAGE_MIN_SIZE 64->120 (UI chrome exempt;
  accepted trade: <120px imgs skip NSFW too).
- Pill = visible SWITCH (green track + knob, 36px touch) — same on
  Android.
- 192px MoveNet input experiment REVERTED same night (missed a corner
  facecam person — small subjects outrank phone perf; cadence is the
  phone lever, not input size).
- OPEN (flagged, not built): small-person recall (tiled/hi-res person
  pass = next milestone); m.youtube feed autoplay-preview removal still
  blocked on signed-in m.youtube DOM capture (feed preview reuses
  #movie_player — hiding it breaks the player red line).

**Session 2026-08-24 overnight (v0.1.10/1010, commit b66ef14):** owner
"lagging + hit-and-miss, set a Fable instance to analyze" -> full
redesign per the audit (docs/research/blur-pipeline-audit-2026-08-24.md
— READ IT before touching the video pipeline again):
- Root causes CONFIRMED by measurement: old loop = 20-35 inferences/s on
  YouTube's main thread (95 dropped frames + 8.2s long tasks per 77s);
  hit-and-miss = 5 detection sources racing at 3 cadences (2.4/7Hz beat).
- NEW: ONE person-primary pass @250ms (MoveNet -> per-person native-res
  aspect crop -> gender), person-track.mjs (IoU association + blur STATE
  MACHINE: instant blur, clear needs 1.5s accumulated confident reads,
  uncertain DECAYS not zeroes), video-region v2 (cached rects, transform
  moves, 60Hz velocity interpolation). Deleted: track.mjs, person gate,
  torso-ghost, static suppression, rescue floor, recheck, MIN_HITS.
- **CHILD FIX** (owner frame: daughter sharp, Linus covered): faceres
  AGE head (age_pred/Softmax [N,100], embedded all along) now read;
  age<18 => gender untrusted, never clears. Asymmetric certainty:
  clear needs score>=0.6 (GENDER_CLEAR_SCORE), flag stays 0.25.
- Measured after: dropped 95->8, long tasks 69->14, stall 8.2s->1.3s.
  Frames: Linus sharp incl. looking down; daughter single tracked patch.
- Worker offload DEAD on YouTube: Trusted Types blocks Blob workers even
  via trustedTypes.createPolicy (spike). 4Hz main-thread + interpolation
  is the architecture. Owner asked "custom local AI?" — answered: models
  already local; bottleneck was architecture, not model speed; custom
  training = weeks + dataset, revisit only if phone numbers demand.
- Remaining known gap: ~250ms first-detection window on scene entry
  (new subject can be exposed for one pass; instant-cover after).
- Phone perf still UNVERIFIED (levers: PERSON_INPUT_SIZE 192, 3Hz).

**Session 2026-08-24 late night, part 2 (v0.1.9/1009 RELEASED, commit
199c0e1):** owner's "double triple blur don't look good, merge it" +
"still blurs Linus sometimes" — both fixed + frame-verified:
- **Per-person zoom classify** (the real multi-pass): every MoveNet
  person region gets its own crop -> BlazeFace+gender at native scale;
  results REPLACE full-frame dets inside those regions (centerInAny).
  CRITICAL FIX: crop must be ASPECT-PRESERVING (scale by max(sw,sh),
  min 32px) — the first square-stretch version distorted faces and
  re-blurred Linus (v8 screens). ZOOM_MAX_PERSONS 4, zoomFresh reset at
  all 7 videoTracks=[] sites.
- **mergeOverlapping** (region-blur.mjs): unions overlapping patches
  until stable, called in the video render + applyRegionBlur — one
  merged patch per person, no stacked rectangles.
- Evidence screens/v9-her-{120,300,900}.png: Linus fully sharp at 120s
  next to covered daughter; single patch every frame. gaze 82/82,
  cargo 31/31.
- NOTE: v1008's commit 0f71489 only carried the model binaries — ALL
  person-gate/zoom source landed in 199c0e1 (check `git show --stat`
  before assuming a release commit has the source).
- **tamescroll.com LIVE** (owner bought domain, authorized agent w/ his
  Chrome): Cloudflare Worker `tamescroll` serves web/index.html, bound
  to apex + www, HTTPS verified. Judgment call: www bound directly, no
  canonical redirect to apex — flag to owner.

**Session 2026-08-24 late night (v0.1.8/1008 RELEASED):** MoveNet
MultiPose person gate BUILT + SHIPPED same night (owner commanded the
humanoid ask; also "made it worse / inconsistent" on v1007's pure
temporal gates — person evidence replaces guesswork).
- Model: MoveNet MultiPose Lightning tfjs f16 fetched via the tfhub
  ?tfjs-format=file double-redirect (curl -L works; -I 404s). OUR
  hybrid uint8/f16 requant (app/gaze/build/requant-uint8.py): full
  uint8 = DEAD OUTPUT (depthwise convs, 2.8 abs err); absolute 0.02
  error bound keeps those f16 -> 4.94MB, output parity spot-checked.
  Bundle 22.7MB. NOTICE updated (Apache-2.0).
- person-gate.mjs (pure, 8 tests): parsePersons [1,6,56]; gateDetections
  drops ONLY ambiguous candidates (uncertain + conf<0.6) outside person
  regions — null persons = inert, empty = real evidence; facelessPersons
  = backside coverage (person box IS the patch). Person pass every 3rd
  player sample on own 256 canvas; loads after NSFW; failure = no gate.
- embeddedIoHandler now passes signature through (needed for MoveNet
  default-output resolve).
- Verified live (screens/v6-, v7-): titlecard letters = 0 persons ->
  phantom class dead; crates/plank clean; daughter covered across 4
  scenes incl. tracked movement; Linus sharp (one brief uncertain flag
  at 15:00 scene — fail-safe, cleared). __TS_GAZE_PERSONS = probe marker.
- v1008 LIVE: APK 61MB (entries match), aapt2 1008, manifest raw sha
  dddb105b verified. gaze 79/79, cargo 31/31.
- **NEXT: person-crop zoom classify** (the real version of owner's
  "double pass" idea): run face+gender on each PERSON'S zoomed crop
  instead of the 128px full frame — fixes small-subject gender reads +
  consistency. (Same-frame repeat passes are deterministic = useless;
  multi-SCALE is the standard small-object practice. Look-ahead decode
  impossible on YouTube MSE — answered owner twice.)
- Perf UNVERIFIED on phone: 22.7MB bundle eval + MoveNet every 3rd
  sample on Helio G88. If phone chokes: drop PERSON_INPUT_SIZE to 192/
  160, or person pass every 5th sample.

**Session 2026-08-24 night (v0.1.7/1007 RELEASED):** owner escalations all
night (small subjects missed, random blurs on text/planks/shirts, males
re-blurred, wide boxes swallowing the neighbour face, pill vanishing,
backside not blurred, "track the person"). Shipped + CDP-frame-verified
on desktop dev app:
- **faceres gender model** (HSE-FaceRes via human-models, MIT) replaced
  mini-Xception — live bench showed mini-Xception bands overlap + one
  misgender; faceres 7/7 direction-correct. GENDER_MIN_SCORE 0.25
  (= certainty 2*|sigmoid-0.5|). Bundle now 16.2MB.
- **track.mjs person tracker** (clean-room SORT-style; abewley/sort is
  GPL — NEVER copy): EMA glide, velocity coast (8 misses), sticky flags,
  clear streak 5, MIN_HITS 3 phantom gate, GENDER MEMORY (3 confident
  clears absorb uncertain flags; certain opposite always wins), STATIC
  suppression (10 samples, eps 0.025, maxConf<0.6 = graphics), TORSO-
  GHOST drop (uncertain "face" inside a cleared face's body column =
  shirt graphic). All calibrated from live measurements, registered in
  docs/detection-engine.md.
- **Small-subject rescue** video-only: detector floor 0.2 for boxes
  <0.14 frame (flat 0.35 for images), + native-res zoom recheck of the
  rescue band (2x crop from the VIDEO element, not the 128px canvas).
  MEASURED GOTCHA (zoom-score sweep, 16 frames): recheck must NOT extend
  above 0.35 — real distant faces zoom to 0 while logo letters zoomed
  0.59; BlazeFace-128 alone cannot separate face-like graphics from
  small faces. That separation = the person-gate milestone.
- Body box shoulders 1.6→1.2 half-widths (owner: Linus face swallowed).
- In-player pill ALWAYS visible now (owner: it's the blur switch).
- **Verified** (scratchpad screens/v5-*): daughter blurred head→torso and
  patch TRAVELS with her; Linus sharp beside her incl. shirt graphic;
  crates/plank/titlecard phantoms gone; gaze 72/72, cargo 31/31.
- **v1007 LIVE:** release recipe followed (strip 179MB→47MB, :app:clean,
  APK 54MB = entry sum, aapt2 1007, gh release app-v0.1.7, manifest
  pushed, raw sha 5888f72e verified). Phone updates in-app.
- **NEXT (owner-commanded): humanoid/person detection** — fixes backside
  view, remaining graphic phantoms, and "no blur straight up" scenes
  (detector misses, not timing; look-ahead won't help — answered owner).
  docs/research/person-gate.md: MoveNet MultiPose Lightning, Apache-2.0,
  up to 6 persons, boxes+keypoints, raw tf.loadGraphModel viable, uint8
  input NO normalization; open risk = tfjs int8 size (~5MB target) +
  Helio G88 timing (no published numbers). m.youtube preview autoplay
  emulator check still queued.

**Session 2026-08-24 evening (v0.1.6/1006 RELEASED, commits 2c3b6a5+):**

**Session 2026-08-24 evening (v0.1.6/1006 RELEASED, commits 2c3b6a5+):**
Owner escalation: "in-video face blur never worked, markers weirdly
rounded, sometimes false blurs, HaramBlur covers the whole body — capture
frames yourself and verify". All four fixed + VISUALLY VERIFIED on the
desktop dev app via CDP frame captures (cdp.py in session scratchpad;
WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223 + npx
tauri dev works fine — the earlier "flaky CDP" didn't reproduce):
- **Never-worked root cause:** video-region v1 used position:FIXED
  overlays inside #movie_player — fixed re-anchors to any transformed
  ancestor (YouTube player tree has them), so overlays landed at wrong
  coords. v2 = position:absolute relative to the player, coords from two
  getBoundingClientRects (ancestor transforms cancel), rAF re-pin loop.
- **Whole-body:** expandToBody() (region-blur.mjs, shared image+video):
  MUST de-inflate detector boxes by /1.4 first (FACE_ENLARGE) — without
  it the compounded expansion swallowed 788px of an 815px player.
  Shoulders ±1.6 face-w, torso +6.0 face-h, hair +0.3. Registered in
  docs/detection-engine.md.
- **Markers:** border-radius 30%/28% → 8px (near-rectangular).
- **False blurs:** FACE_MIN_CONFIDENCE 0.2 → 0.35.
- **Frame evidence (scratchpad vframe3-*/male-clear3/thumbs.png):**
  female TED speaker = body-column blurred head→frame-bottom, TRACKS a
  camera zoom, background sharp; male speaker (owner=man) = fully sharp
  0 overlays; TED intro card sharp; search thumbnails 13 rectangular
  body patches, titles sharp. gaze 50/50, cargo 30/30.
- **v0.1.6 (1006) LIVE:** release recipe followed; APK 45MB on GitHub
  Releases v0.1.6, manifest 1006 pushed + raw-verified (sha a6be57d6…).
  GOTCHA: gradle incremental packaging produced an 83MB APK with an
  ORPHANED duplicate .so (entries 45MB, file 83MB) — :app:clean +
  assemble fixed it; check APK size vs entry sum before every upload.
  Phone gets 1006 via in-app updater.
- Noticed, left alone: desktop watch page shows a YouTube Premium
  family-plan nag (NO NAGS miss, www.youtube.com desktop); pre-roll ads
  on desktop watch (known scriptlet gap #9/#12, owner-gated).
- Still unverified on real hw: 140ms player sampling cost on Helio G88
  (in-player pill is the escape hatch), Android fullscreen overlay
  behavior.

**Session 2026-08-24 (owner asks, commit 5a7aee1 pushed):** Two items.
- **In-player blur was WHOLE-video → now FACE-REGION** (owner: "whole video
  blurred instead of a specific face, HaramBlur does it better"; picked
  "just build it"). New app/gaze/src/video-region.mjs: overlays anchored
  INSIDE #movie_player (NOT body — body overlays vanish in element/native
  fullscreen and expose the face), rAF loop pins each to the live video
  rect. Player samples at 140ms (was 500) so the overlay chases the face;
  boxes padded 35% (padBox, region-blur.mjs) to cushion between-sample
  drift — over-blur never a flash. Feed videos KEEP whole blur (too
  small/fast). Falls back to whole blur if no backdrop-filter / no player
  host. In-player pill now treats regionActive as "covered" so it stays
  reachable when only a face is blurred. gaze 48/48, cargo 30/30, tsc
  clean. NOT verified on-device: overlay pixel placement under YouTube's
  real player CSS (position:fixed assumes no transformed ancestor) +
  fullscreen coverage (esp. Android native custom-view fullscreen) — owner
  phone, real inference (emulator GPU minutes-slow). If placement is off,
  next fix is absolute-within-a-positioned-player-wrapper instead of fixed.
  Needs a v1006 APK release to reach the phone (bundle is compiled in).
- **"Video previews" surface** (hover/scroll autoplay toggle, owner picked
  "hover/preview autoplay"). Toggleable surface in rules/youtube.txt,
  hidden by default, Bring-back re-enables — zero Rust/TS change, settings
  pane auto-lists it. Hides ytd-video-preview (live-verified via in-app
  browser: 1 on youtube.com/, OUTSIDE #movie_player — red line holds).
  Ships via OTA (pushed) — should appear in Settings→Bring back after the
  phone's next rules refresh (UNVERIFIED on-device). m.youtube feed preview
  REUSES the shared #movie_player element, so it is NOT a safe hide —
  deferred, needs a signed-in m.youtube feed DOM capture (noted in rule).

**Session 2026-08-23 (issue-loop, app v0.1.3/1003):** Cleared every
autonomously-fixable owner report from docs/owner-issues.md.
- **#14 blur-over-menu FIXED+verified** (probe48, feeb54c): region-blur
  overlays (max z-index, document-anchored) punched over m.youtube's
  position:fixed topbar when a face thumbnail scrolled behind it.
  clampToInset() clips overlay top to header line (fully-behind hide,
  over-blur preserved). topInset() walks each elementsFromPoint hit's
  ANCESTOR chain — top-center hit is a static <button> inside the fixed
  topbar, so direct-hit-only found inset 0. insetFromChain pure+tested.
  On-device: barBottom 48, punchThrough []; search bar clean. 10/10
  region tests, 36/36 gaze.
- **#10 launcher polish FIXED+verified** (probe49c): add-platform input
  focus is a clean subtle field — tapHighlight transparent, outline 0px,
  no blue box; no-circumvention "We don't support that" intact.
- **v0.1.3 (1003) SHIPPED** to reach the phone via in-app updater: arm64
  debug APK on GitHub Releases v0.1.3 (stripped 45MB), updates/
  app-manifest.json sha256-pinned + pushed. Owner's phone sees it on next
  launch / About Check-for-updates. Version bumps: tauri.properties
  (gitignored) + tauri.conf.json 0.1.3 + appupdate.rs 1003.

Emulator gotcha reconfirmed: relaunching MainActivity resumes the single
webview wherever it was (YouTube), NOT the launcher — press Back
(launcher-first) to get the launcher. CDP page label flips
tauri.localhost <-> m.youtube accordingly.

BLOCKED on owner (report + decide, do not build blind):
- **#9/#12 "very slow" after video click** — dominant cause is the
  scriptlet gap (docs/scriptlet-gap.md); fix touches the player red line,
  needs owner A/B/C pick (recommend B, request-shaper-only). Safe perf
  levers already shipped in 1002/1003 (WEBGL_USE_SHAPES_UNIFORMS, JS-NMS,
  batched gender, hidden-tab drain gate, deferred models). Do NOT retry
  page-side eval dedup — CSP-dead, reverted by design.
- **#8 in-video blur real-hw timing** — emulator x86 GPU is minutes-slow;
  only owner's phone gives real numbers.


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
