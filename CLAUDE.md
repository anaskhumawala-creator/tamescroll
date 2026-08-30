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

- **Never render test content on the owner's screen.** Verification
  that needs a feed -- searches, thumbnails, anything the blur is
  judging -- runs on the emulator or through CDP with the window off
  his desktop, and the dev app gets closed after. He said it once:
  "don't open this trash on my PC". Screenshots taken for evidence
  are deleted unless he asked for them.

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

**Last updated:** 2026-08-31 01:20 (1055 live, sha f3e5d960 -- the
patch-over-video bug is FOUND and FIXED; 1054 before it fixed the
miniplayer twice and the stale clamp).

**Session 2026-08-31 (loop 2) -- HE WAS RIGHT ALL THREE TIMES, AND EVERY
PROBE THAT SAID OTHERWISE WAS BLIND.**
- **`elementsFromPoint` CANNOT SEE A `pointer-events: none` ELEMENT**, and
  every patch we draw is pointer-events:none on purpose. So the 232 patch
  samples, the 900 in-player hit-tests and the eight walk-under samples
  were all asking a hit test about an element it is required to skip.
  They reported the only answer they could ever have produced. **Any
  future probe that hit-tests one of OUR overlays must set
  `pointerEvents = 'auto'` on it first.** occluderBottom is unaffected --
  it hit-tests for the page's own chrome, which is hit-testable.
  Written up in docs/technical-findings.md, because it retracts three
  "verified" claims.
- **RE-MEASURED, hit testing enabled, live m.youtube watch page, video
  playing: patch at index 0, player at index 1.** The recommendation's
  blur really does paint over the video. Three sessions of "cannot
  reproduce" were an instrument failure, not a wrong report.
- **THE CAUSE IS STACKING, NOT GEOMETRY.** makeOverlay picked z-index 2
  to sit above the <img> "inside the thumbnail's own stacking context".
  The host has no stacking context -- position:relative with
  z-index:auto does not create one -- and MEASURED on the live page there
  were **ZERO** stacking contexts between the patch and the root. So the
  patch's z-index 2 and the sticky player's z-index 2 were siblings in
  the ROOT context, where DOM ORDER decides, and #player-container-id is
  a child of <body> while the recommendations come after it.
- FIX: `isolation: isolate` on the host in resolveHost, which makes that
  original comment true. No layout, no geometry, no colour; it cannot
  reorder the host's own descendants, only stop the subtree escaping
  upward. Holds whether or not the occluder clamp fires -- which is what
  a bug reported three times deserves. A/B on the same instrument, same
  page, same overlapping geometry: **before iPatch 0 / iPlayer 1, after
  iPatch 7 / iPlayer 0.** Placement unharmed: 4 overlays, 4 on an image,
  0 stray.
- gaze 370/370, cargo 57/57. 1055 live, manifest and served APK both
  sha **f3e5d960**.


**Session 2026-08-31 (overnight) -- THE MINIPLAYER WAS EATING EVERY
UPWARD FLICK, AND IT NEVER ACTUALLY SHRANK.** He named three things:
the recommendation blur overlapping the video, the miniplayer being
"annoying ... it sometimes goes down and it doesn't function as it's
supposed to", and random shelves on the homepage. All three had a real
mechanism and all three were found by measuring, not by reading.

- **THE CLAIM GATE IGNORED DIRECTION.** onMove claimed a gesture at
  `|dy| >= 8` with no regard for SIGN and then preventDefaulted every
  touchmove for the rest of it -- while gestureVerdict and dragProgress
  BOTH refuse that direction while full. The sticky player is a 412x232
  band across the top of the screen, so "flick up to reach the comments"
  is the commonest gesture on a watch page and it did nothing at all.
  MEASURED (probe_mini_steal.py): upward 120px = **8 of 8 touchmoves
  defaultPrevented, player moved 0px**; a 30px flick = 6 of 6. After
  claimAxis(): **0 of 5 and 0 of 6**, downward still works.
- **COMMITTING THE DRAG PUT THE PLAYER BACK AT FULL SIZE.** parked()
  clears the inline transform to measure the untransformed box, and
  suppressed the transition first so the read would not land
  mid-animation -- with `style.transition = 'none'`, which an author
  `!important` beats. MEASURED on the live page: computed
  transitionDuration **0.22s** with the plain write, **0s** only with
  setProperty(..., 'important'). So the rect came off the already-shrunk
  box, miniTransform returned an IDENTITY transform, and landing mini
  left the video full size at the top while ts-mini, the cover, the
  buttons and the collapsed placeholder all said otherwise. That is his
  "it sometimes goes down". After: lands translate(169px, 649px)
  scale(0.5597) -- 231x130 at (169,697) -- verified 3/3 at flick speed
  with restore clearing cleanly each time.
- **THE OCCLUDER CLAMP NEVER RAN DURING A SCROLL.** positionEntry is the
  only place occluderBottom runs, and the 500ms sweep called it only
  when the element's PARENT-RELATIVE rect changed -- which a scroll
  cannot change, because a thumbnail moves with its parent. The clamp's
  own gate is VIEWPORT-relative. So a patch minted while its thumbnail
  sat low on the page kept occ = 0 for the life of the page and rode up
  under the sticky chrome still wearing it. **The clamp shipped in 1045
  to stop the exact frame he photographed, into a function a scroll
  never calls.** MEASURED before: a patch at top **-72** under a 48px
  fixed bar, unclipped, and another at -93. After, same page and same
  nine-step scroll: **0 unclipped**. Driven by a passive capture-phase
  scroll listener, rAF-coalesced; an entry pays a hit-test only in the
  top 60% of the viewport or while it still owes a clamp back.
  HONEST: proven against the top bar, whose own z-index hides the escape
  anyway. The player is z-index **2**, the same as a patch, and it is
  EARLIER in the document than the recommendations -- which is why the
  patch is what paints on top there -- but signed out a watch page
  recommends almost nothing our gender setting flags, so the visible
  escape itself is still not reproduced here.
- **THE SHELVES NOW HAVE THEIR OWN TOGGLE** (`home_shelves`, "Feed
  shelves", ships hidden). His feed is Shown, so everything scoped to
  `home` is correctly switched off and no shelf rule could ever fire --
  until now the only way to hide a shelf was to hide the whole feed with
  it. Every selector is gated on `:has()` against a shelf, so it can
  only match a section that actually contains one and a wrong name
  matches nothing rather than blanking his feed. VERIFIED with
  shown=['home']: home grid rule **absent**, section-list rule
  **absent**, both shelf rules **present in the sheet**, and
  ytm-rich-grid-renderer **1 of 1 still visible**.
- **HIS OLD PHONE CANNOT TAKE THE APP, MEASURED.** adb reaches
  M2010J19SI fine (debugging on, Android 12) but `adb install` returns
  **INSTALL_FAILED_USER_RESTRICTED** -- MIUI's "Install via USB", which
  he says needs a SIM. It is also not signed into his YouTube, so it
  could not show the Breaking news shelf even with the app. The device
  that matters is the 23122PCD1I and only READ access is needed.
- PROBE GOTCHA, new and it read a healthy page as a dead one: on
  m.youtube's WATCH page the scroller is **<body>**, not the document --
  documentElement.scrollHeight == innerHeight == 839 with 183
  recommendations in the DOM. window.scrollBy moves 0px. Drive the
  element with the most scroll room and PRINT the distance.
- INTERMITTENT, NOT REPRODUCED: one run left the player stuck mid-drag
  on a second minimise (scale 0.906, state never committed). Three fast
  round trips afterwards were clean, and the next gesture clears it.
- gaze 369/369, cargo 57/57. 1054 live, raw manifest and downloaded APK
  both sha **ad91f19b**.

**Session 2026-08-30 (loop 17) -- HIS HOME FEED IS SHOWN, WHICH IS WHY
THE BREAKING-NEWS RULE COULD NOT FIRE.**
- He reported the shelf still there after the OTA. His own 1053 report
  explains it: `kind: home`, 58 images judged, FORTY of them 686px
  thumbnails, previews playing. **A hidden home feed has no thumbnails
  to judge.** So Home feed is SHOWN on his phone, every rule I wrote is
  scoped to the `home` surface, and none of them can apply. The rule is
  not wrong -- it is switched off, correctly, because he wants the feed
  and not the shelf.
- CONSEQUENCE: breaking news needs its OWN surface (or the always-on
  tier where ads and nags live), so it goes whether or not the feed is
  shown. BLOCKED on the selector: it does not render signed out, and the
  phone on adb is the old M2010J19SI without the app. He will enable USB
  debugging on the 23122PCD1I later.
- **THE HISTORY NAG IS HIDDEN** (`ytm-feed-nudge-renderer`). "Your
  YouTube history is off ... turn on watch and search history" is an
  unsolicited prompt to change a setting, and NO NAGS is absolute here.
  MEASURED first, three surfaces: home 1 at 380x252 with ZERO video
  links inside it, search 0, watch 0. VERIFIED through the OTA: home 1
  present / **0 visible**, search 45 video links, untouched. Filed under
  mobile_nags; that surface is labelled "App install nags" and this is
  not one -- the label is his copy, so it is flagged, not rewritten.
- **FOUR OF THE SIX ReVanced-STYLE HIDES DO NOT EXIST ON MOBILE.** Read
  off the live watch DOM with the video PLAYING and controls revealed:
  no `ytp-cards-*`, no related-video overlay, no settings-menu classes
  -- only ytp-cued-thumbnail-overlay and ytp-timely-actions-content. End
  screen is already covered. Flyout items live inside twelve
  `ytm-bottom-sheet-renderer`s that carry every other sheet, so they need
  per-item selectors read from an OPEN menu.
- The two that ARE live were NOT shipped, deliberately:
  `ytm-slim-video-action-bar-renderer` is how he likes, shares and saves
  a video, and `player-time-display` is how he knows where he is in it.
  Neither is clutter the way an ad or a nag is.
- PROBE GOTCHAS, both of which read a healthy page as an empty one: a
  CUED player builds NONE of the below-player chrome (play it first), and
  the mobile player hides its controls during playback (tap to reveal
  before reading the timestamp). A third: 13s is not long enough for
  m.youtube search on this emulator -- one run reported 0 video links and
  the same probe at 22s reported 45.

**Session 2026-08-30 (loop 16) -- ALL THREE FIXES CONFIRMED ON HIS OWN
DEVICE, AND THE FOURTH IS REFUSED ON MEASUREMENT.**
- His 1053 report (23122PCD1I, home page, rulesGen 64f07672, otaLast ok):
  - **seen 272 / blocked 37.** Request blocking is alive on his phone.
    It was 0/0 two builds ago. The 1052 cross-thread fix is real.
  - **askedPerson 15,166ms, loadedPerson 15,335ms -- 169ms to load.**
    So the 78,807ms was ENTIRELY "asked late", never a slow parse, which
    is exactly the question `asked:person` was added to settle. The 15s
    is when he tapped a video (worker was ready at 1,465ms).
  - **longTasks 60, worst 444ms, longTasksOurs 2, worst ours 108ms.**
    The jank on his phone is YouTube's, not ours.
  - Cache fired 3 times in 40 ring entries, including one avatar with 6
    faces / 5 flagged replayed at 0ms.
- **I WAS WRONG ABOUT THE TINY FACES.** 11 of 16 player reads were
  `unknown` at 16-63px and I called it inference spent on noise. It is
  not: FACE_MIN_NATIVE_PX is 64 and genderFromNativeFace ABSTAINS
  without running the model. Across his two reports, 49 reads, the split
  is exact -- <=63px always abstains, >=71px always produces a gender.
  Free already. Do not re-open.
- **THE IMAGE FLOOR IS REFUSED, MEASURED.** handleImage really does run
  gender on EVERY box (one of his thumbnails: 8 faces, 1,206ms), so
  porting the 64px floor looked obvious. probe_face_px.py says no: a
  **53px face read male at 0.99** and would be CLEARED today; a 33px
  face read female at 0.57. A 64px image floor would newly cover that
  man -- his oldest complaint. A thumbnail is a tight framing, so 53px
  there is most of a head; 53px in a 1080p video frame is a bystander.
  Right floor for video, wrong floor for images.
- NOTHING SHIPPED THIS LOOP, deliberately: three items were already
  fixed and confirmed, one was never broken, one is refused.

**Session 2026-08-30 (loop 15) -- THE PHONE ON ADB IS NOT HIS PHONE.**
- **EVERY APK PUSH THIS SESSION WENT TO THE WRONG DEVICE.** The adb
  device `1ec2c48e0621` is `M2010J19SI` (Android 12) -- the OLD Redmi --
  and `pm list packages` shows tamescroll IS NOT INSTALLED on it. His
  diagnostics report came from `23122PCD1I` on Android 16, which is not
  connected here. So /sdcard/Download pushes are useless; he gets builds
  through the in-app updater, which is how he was already on 1051. DO
  NOT treat a successful `adb push` as "the phone has it".
- **HIS DESKTOP CHROME IS ALSO THE WRONG INSTRUMENT** (he said so):
  it runs its own ad blocker on top of the Unhook-style extension, and
  desktop YouTube is a different DOM from the mobile one the app shows.
  Stripping the 26 `hide_*` attributes worked exactly as documented, and
  the shelf still was not there -- desktop simply had no news shelf.
- **"breaking news still shows on the homepage" FIXED BY CLASS, NOT BY
  NAME.** The two mobile home rules only hid ytm-rich-grid-renderer and
  ytm-rich-section-renderer; a news shelf is neither. Now every feed
  container inside a browse page goes: item-section, shelf, rich-shelf,
  section-list.
- **A CAUTION FROM 2026-08-18 IS CLOSED.** The file asked whether mobile
  search renders inside ytm-browse too. MEASURED, one run: home
  ytm-browse 1 / single-column 1; SEARCH ytm-browse **0**, rendering in
  ytm-search with its own section list. Nothing scoped to browse can
  reach search.
- VERIFIED THROUGH THE REAL DELIVERY PATH: refresh_rules said "updated 1
  rule file(s)", then home = **0 visible feed containers, 0 video
  links**, search = **2 result sections, 39 video links**.
- HONEST: the Breaking news shelf itself is [unverified] -- it does not
  render signed out, and no harness here can reach his signed-in mobile
  home.
- NOTICED, LEFT ALONE: mobile home carries `ytm-feed-nudge-renderer`
  ("Your YouTube history is off ... turn on watch and search history").
  That is a nag, and NO NAGS is a hard rule -- but he named the news
  shelf, so it is flagged, not hidden.
- Also delivered: a triage of all 61 ReVanced v6.2.1 patches against the
  block-only rule (never / breaks-our-promise / already-ours / his call
  / not-on-the-web), published as an artifact at his request.

**Session 2026-08-30 (loop 14) -- LOADING IS NOT USING, AND THE LONG
TASKS ARE NOT OURS.**
- **MoveNet was only ever requested by the FIRST VIDEO FRAME that
  reached the worker.** So on a watch page a 4.94MB load queued behind
  the entire thumbnail drain, and his phone reported `loaded:person` at
  **78,807ms** -- the player had no person pass for the first minute and
  a half. The page now asks for it when it attaches a real WATCH player
  (feed previews keep the lazy path -- a preview is transient).
- **THE FIRST VERSION OF THE FIX FIRED NEVER, and the probe caught it.**
  A player attaches BEFORE the worker has a backend, so a one-shot
  `workerVideo()` check was false every time: asked stayed null for
  198s. Bounded poll instead (500ms, 40 tries). MEASURED after:
  **asked 5,033ms, loaded 13,007ms**, worker ready 4,689 -- and images
  judged 0 at that point, so the player's model got in AHEAD of the
  drain, which is the whole point.
- **`asked:person` IS NOW IN THE REPORT.** `loadedPerson` alone could
  not separate a model requested late from one that answered slowly, and
  his 78.8s number was exactly that ambiguity.
- **LONG-TASK ATTRIBUTION.** He reported 77 long tasks, worst 360ms, and
  the count alone cannot say whose they are. `spends` already records
  every main-thread segment we knowingly spend, so a long task that
  OVERLAPS one had our work inside it. MEASURED on a scrolled search
  page: **0 of 13 long tasks overlapped our work, worst 394ms, none of
  it ours.** HONEST: overlap is not authorship, and `spends` only
  covers segments we time (image prep, verdict apply, player pass) --
  so this is strong evidence, not proof.
- NOT DONE, he deferred it: the gender floor for faces under ~70px. His
  report has four `unknown` reads at 34-63px and several near-coin-flip
  males (0.04-0.33) below 92px, all of which are flagged anyway -- so a
  floor would be pure saved inference with no visual change. Waiting on
  his word.
- gaze 363/363, cargo 57/57.

**Session 2026-08-30 (loop 13) -- HIS PHONE REPORT ARRIVED, AND REQUEST
BLOCKING HAD NEVER RUN ON ANDROID.**
- He handed over a diagnostics report from the real device (23122PCD1I,
  Android 16, WebView 151, 8 cores, running 1051). It closed the oldest
  open question and opened a much worse one.
- **`seen: 0, blocked: 0` ON A WATCH PAGE.** The diagnostics block says
  seen==0 means page interception is not wired at all, and it was right.
  Reproduced on the emulator across THREE full page loads: seen stayed
  0. logcat: **1,107 warnings**, every one of them
  `block check failed, allowing: A WebView method was called on thread
  'ThreadPoolForeg'`.
- **THE CAUSE IS ONE LINE.** `shouldInterceptRequest` runs on a WebView
  worker thread, and every WebView method must be called on the thread
  that made the WebView -- so `view.url` inside our blocking wrapper
  threw on EVERY request, the fail-open catch swallowed it, and nothing
  was ever blocked. It looked healthy from outside because the
  synthetic-resource branch returns BEFORE that line, so the inference
  worker loaded normally the whole time. His 2026-08-20 report "ad
  blocking does not work at all" was half-fixed then; this was the other
  half, invisible for ten days.
- FIX: the page url is recorded on the MAIN thread (`onPageStarted` plus
  `doUpdateVisitedHistory`, because an SPA nav on m.youtube fires no
  onPageStarted) into a `@Volatile` field the interceptor reads.
  VERIFIED on the emulator, three navigations: seen **24 -> 64 -> 94**,
  blocked **2 -> 3 -> 3**, and **0** fail-open warnings (was 1,107).
- Also fixed: `where: 'cache'` was not in diag-report's closed enum, so
  every cache hit in his report was folded into `page`. 13 of the 40
  ring entries he sent were cache hits reported as in-page inference --
  ~32% hit rate on a watch page, far above the 2-6.5% the emulator
  showed on search.
- **THE PHONE'S REAL NUMBERS, at last.** worker backend **webgl** (the
  open question since 2026-08-28 -- the player is genuinely off-thread
  on his device), worker up 2723ms, ready 4373ms, image **p50 174ms /
  p95 434ms**, player verdict p50 433 / p95 1271, 39 passes, 0 fails, 0
  timeouts, 77 long tasks worst 360ms. So the emulator runs ~9x slower
  than his phone: every absolute number in
  docs/speed-findings-2026-08-29.md is an emulator number and should be
  divided by roughly nine.
- OPEN, from the same report: `loadedPerson` **78,807ms**. MoveNet took
  79 SECONDS to load on the real device. It loads lazily and after
  `ready`, so it does not gate thumbnails, but the player's person pass
  is unavailable for the first minute and a half of a watch page. Not
  chased this round.
- gaze 360/360, cargo 57/57.

**Session 2026-08-30 (loop 12) -- 1051 SHIPPED, AND THE TOUCH AUDIT IS
CLEAN ACROSS EVERY MODULE.**
- Released 1051 carrying loop 10's per-page verdict cache and loop 11's
  re-host guard. The guard is a net against the frame he photographed,
  and a net that sits on this disk cannot help him -- same reasoning
  that shipped the occluder clamp in 1045.
- **PASSIVE-LISTENER AUDIT, WIDENED AND CLEAN.** Every touch, wheel and
  scroll listener in app/gaze/src and app/src: the ONLY non-passive one
  in the whole app is the miniplayer's player-scoped touchmove
  (bindHost). All three document-level touch listeners in miniplayer.mjs
  are `{capture:true, passive:true}`, init-entry's scroll listener is
  passive, video-region's is passive, and the launcher TS registers
  ZERO touch/wheel/scroll listeners. Nothing in our code can take the
  fast scroll path away from a page.
- NOTICED, LEFT ALONE (a colour, and he did not ask): opening a platform
  from the launcher navigates the single Android WebView from our dark
  launcher into a page that paints white before YouTube does, so there
  is a white flash on every tile press. One line in MainActivity
  (`webView.setBackgroundColor`) would remove it -- it is a colour
  change, so it needs his word.
- gaze 359/359, cargo 57/57.

**Session 2026-08-30 (loop 11) -- A HOST IS ONLY CORRECT WHILE IT IS
STILL THE PARENT.**
- region-blur caches `entry.host` at mint time. applyRegionBlur
  re-resolves it on a reparent -- but ONLY when a new verdict arrives
  for that element. The 500ms sweep checked connectedness and
  host-became-player, and nothing else, so an image moved by a
  virtualising feed kept a patch hosted by a container it no longer
  belonged to.
- **THE ARITHMETIC HIDES IT.** The overlay sits at `elRect - hostRect`
  inside the host, so the host's offset cancels and the patch still
  lands on the image. What changes is the STACKING CONTEXT it inherits
  -- the difference between a patch behind the sticky player and one
  painting over it, which is the owner's open frame.
- MEASURED FIRST: m.youtube search, 116 images, eight scroll steps, **0
  reparented** (probe_reparent.py), matching the older 0 src/srcset
  swaps on that surface. So the guard is a NET like the occluder clamp,
  NOT a reproduction. The sweep now re-resolves, and restores whole blur
  when there is no host to take. Both directions covered.
- VERIFIED on a built x86_64 APK: 48 judged, 21 clear / 26 face / 1
  error, 0 on-screen pending, and 6 region patches of which **6 land
  entirely inside their own image, 0 stray**.
- **CORRECTION to loop 10:** a second sample gave 21 avatars / 19
  distinct = **9.5% repeats, not 30%**, and across three runs of the
  built app the cache answered 1, 3 and 3 of 45-48 images. Honest hit
  rate **2-6.5%**. Also dead, measured: normalising the `=s68` size
  token in a ggpht url widens the key by nothing -- every avatar on the
  page is already requested at s68.
- NO RELEASE (nothing he would see yet). gaze 359/359, cargo 57/57.

**Session 2026-08-30 (loop 10) -- THE URL CACHE WAS MEASURED ON THE
WRONG POPULATION.**
- The repo's own note says a url verdict cache hits 4-8% and is not
  worth it. That was measured over THUMBNAILS and it is still true --
  YouTube's `sqp` varies the crop per surface, so two thumbnails of one
  video are genuinely different pixels. Re-measured on a settled,
  scrolled m.youtube search over EXACT untruncated urls: thumbnails 28
  images / 28 distinct / **0% repeats**; AVATARS 20 images / 14 distinct
  / **30% repeats**. A channel picture has no sqp and the same channel
  appears again and again down a feed.
- Shipped `app/gaze/src/verdict-cache.mjs`. Key is the exact url PLUS
  the nsfw question, so a face-only avatar verdict can never answer for
  a thumbnail that also needed the nsfw check. Two properties make
  replaying a verdict safe and both are load bearing: identical urls are
  identical pixels, so the normalised boxes land exactly where they were
  measured (the old objection about boxes is an objection to a
  PATH-only key); and the cache dies with the page, so a clear verdict
  can never outlive the bytes it was made from. Errors are never cached.
  Bounded at 200 entries, oldest evicted.
- VERIFIED on the emulator with a freshly built x86_64 APK, two settled
  runs: **3 of 46 and 3 of 45 entries came back `where: cache`**,
  verdicts still differentiated (13/33 and 20/24 clear/face), **0
  on-screen images left pending** both times. One run had a single
  `error` entry and still ended with 0 pending -- loop 7's retry doing
  its job again.
- HONEST: 6.5%, not 30%, because most repeated avatars are below the
  fold and never judged. Real work removed at no accuracy cost, but not
  a number he would feel on a search page. NO RELEASE; it rides the
  next one.
- gaze 358/358, cargo 57/57.

**Session 2026-08-30 (loop 9) -- AN IMAGE COSTS FACES, NOT PIXELS.**
- The optimisation that looked free: `createImageBitmap(el)` does NOT
  resize, so every distinct thumbnail size reaches tfjs as a different
  tensor shape, while warmUp compiles exactly one (blank 256x256, one
  box). tfjs keys compiled WebGL programs by shape, so a mixed feed
  could have been recompiling per size.
- **IT IS NOT.** probe_shape_cost.py, settled m.youtube search, first
  three images dropped as warm tail, 30 images: 68px avatars median
  **1647ms**, 686px thumbnails median **1618ms**. A source TEN TIMES
  larger costs the same. Downscaling or quantising the bitmap buys
  nothing, and it would have cost gender-crop quality on small faces --
  the exact defect that took four days to find in August.
- **THE COST IS PER FACE AND IT IS LINEAR.** Same 30 images by face
  count: 0 faces 309ms, 1 face 1565, 2 faces 2366, 3 faces 3987. So
  detection is ~310ms and every face adds ~1.25s. faceres is already
  batched into ONE inference over all faces in an image and shows no
  economy of scale, so the batch is not the lever either. Main thread's
  worst share over the whole page: 18ms.
- CONSEQUENCE for the next perf round: the only levers are running
  faceres on fewer faces (an ACCURACY call that is the owner's -- a
  68px avatar reporting two faces was verified as a real two-person
  avatar in August, so refusing small faces is an exposure risk) or
  making faceres itself cheaper, which is the native-TFLite item and is
  gated on phone numbers. Do not re-derive this from totals:
  `__TS_GAZE_IMGDIAG` carries `w` and `faces` per entry.
- Nothing user-visible changed: NO RELEASE. gaze 351/351, cargo 57/57.

**Session 2026-08-30 (loop 8) -- 1050 IS CLEAN ON YOUTUBE, AND THE
EMULATOR CANNOT DO REDDIT AT ALL.**
- **THE FAILURE-CLASS SWEEP IS THE TECHNIQUE THAT KEEPS PAYING.** Read
  `why`/`msg`/`where` out of `__TS_GAZE_IMGDIAG` instead of the counter
  (probe_error_classes.py). On 1050, m.youtube search, twice in a row:
  **7 entries, 0 errors**, why = clear 2 / face 5, all in the worker, 0
  on-screen images left pending, 0 CSP violations. The worker timeout
  that stranded thumbnails last round did not recur -- the retry plus
  the shorter warm are both doing their job on the shipped build.
- **THE EMULATOR DIES ON REDDIT. THREE TIMES, AND ONCE IN OFF MODE.**
  Navigating the app to reddit.com/r/pics kills the whole emulator
  process (adb loses the device; `adb devices` can report it alive for a
  moment afterwards, which is stale). It happened with gaze OFF too, so
  it is not our pipeline -- it is swiftshader plus a page of large
  images. CONSEQUENCE: reddit / x / instagram cannot be exercised on
  this harness, and a four-site sweep must be run ONE SITE PER
  INVOCATION or a late death loses every earlier result.
  Restart recipe: `emulator -avd hijri_pixel -no-window -no-audio
  -no-boot-anim -gpu swiftshader_indirect`, boots in ~40s, the app
  survives the restart, then re-`adb forward` to the NEW pid.
- logcat came back EMPTY after each death, so there is no crash trace to
  chase; do not spend another round looking for one.
- Nothing user-visible changed: NO RELEASE. gaze 351/351, cargo 57/57.

**Session 2026-08-30 (loop 7) -- A TIMEOUT IS NOT A VERDICT, AND ONE WAS
COVERING THUMBNAILS FOR THE LIFE OF THE PAGE.**
- Reading the per-image diagnostic ring instead of the counters found
  it: **the first two images of a navigation came back `worker timeout`
  at 20.6s**, and the third -- the SAME avatar -- was judged normally at
  23.8s. The worker was not broken. It was still compiling shaders for
  tensor shapes a blank 256px warm-up frame never produces, and
  REQUEST_TIMEOUT_MS (15s) fired underneath it.
- **Failing closed is right; failing closed FOREVER is not.** Nothing
  put the image back on the queue, so it stayed blurred for the life of
  the page and looked identical to one still waiting. That is the
  owner's oldest and most repeated report -- "it processes some, then it
  halts", "thumbnails that never resolve".
- Both failure paths (worker AND in-page) now requeue: bounded at 3
  attempts, 1.2s apart, only while still in the document and not already
  queued. The bound is the whole safety argument so it lives in
  app/gaze/src/image-retry.mjs with tests -- an image that genuinely
  cannot be judged (CORS refused, decode failure) must settle into
  staying covered rather than looping. Retrying is safe ONLY because the
  image is covered while it waits.
- VERIFIED on the emulator, one settled search page: 8 entries, 1 worker
  timeout at 19.8s on its first attempt, one src appearing TWICE in the
  ring (the retry), 7 verdicts, ZERO on-screen images left pending.
- LESSON FOR NEXT TIME: `__TS_GAZE_IMGTOTAL` counts entries, and an
  ERROR entry counts too -- so a stuck image looks like a judged one.
  Read `why`/`msg` in `__TS_GAZE_IMGDIAG`, not the counter.
- gaze 351/351, cargo 57/57.

**Session 2026-08-30 (loop 6) -- THE WARM-UP WAS DOING THE FIRST IMAGE'S
WORK TWICE.**
- warmUp did a compile-only pass over all three models (the parallel
  shader compilation win -- KEEP) and then a full BLANK INFERENCE per
  model. A blank run cannot make the first real image cheaper: it does
  that image's work early, on a frame nobody is looking at, while
  `ready` is withheld and the whole fold stays covered.
- Three restarts each, real Android WebView: warm **22,684 -> 5,702ms**,
  ready **24,040 -> 7,051ms**, first thumbnail 18,783-22,702 ->
  19,582-21,724.
- **HONEST: TIME TO FIRST REVEAL DID NOT MOVE.** The compilation moved
  into the first real pass -- first went from ready+1.5s to ready+12.7s,
  same total, inside the spread. What it removes is ~17s of duplicated
  GPU inference per navigation (heat, contention) and the drain is live
  at 7s instead of 24s so everything AFTER the first image pipelines
  earlier. NO RELEASE: the number he would feel is unchanged.
- Blank runs still exist behind `__TS_WARM_BENCH`. A test pins that
  every blank inference is inside the flag and the compile pass is not.
- **TWO CLEAN AUDITS.** After a search page fully settles, ONE element
  is still covered and it is a 0x0 <video> with no src (the idle shared
  player); zero on-screen images left pending. And blur-first holds: of
  the on-screen thumbnails 120px or wider, ZERO are clear without having
  been judged.
- **DESKTOP CONSENT HIDE CONFIRMED LIVE** (1048): on www.youtube the
  lightbox host computes display none and the dialog measures 0 tall.
- HARNESS LIMIT FOUND: `Emulation.setDeviceMetricsOverride` does not
  take on this target -- innerWidth stayed 412 under a desktop UA, so
  www.youtube rendered no feed. Desktop-width layout cannot be tested
  here; the desktop masthead occluder path stays unverified.
- gaze 345/345, cargo 57/57.

**Session 2026-08-30 (loop 5) -- THE HARNESS WOBBLES 28%, SO MOST OF
WHAT IT SAYS ABOUT SPEED IS NOISE.**
- Scroll smoothness became measurable on the emulator FOR THE FIRST TIME
  once the consent wall stopped locking <body> (1047). The first A/B
  looked decisive -- smart 19.5fps vs off 45.1fps, same page, same
  gesture -- and it is NOT safe to act on.
- **probe_scroll_repeat.py runs ONE condition five times: 27.0 / 31.5 /
  27.0 / 32.8 / 35.8 fps, a 28% SPREAD around the median**, app, page
  and gesture identical. The decomposition run meant to separate paint
  from compute (neutralise the blur CSS, keep every model running) came
  back 6.6fps SLOWER without the blur -- wrong sign, inside the band.
- **RULE: on this harness treat any frame-rate delta under ~30% as
  noise, and never act on n=1.** Long tasks were 0-1 per run and near
  zero in EVERY condition, so the scroll cost is not long main-thread
  tasks; that leaves GPU contention and sub-50ms work, and this device
  separates neither.
- **resolveHost's page mutation is inert on m.youtube.** It writes
  `position: relative` onto YouTube's own element, which would change
  the containing block for any absolutely-positioned descendant (duration
  badge, progress bar). MEASURED on a live search feed: 0 of 36
  thumbnail hosts are static, so the write never fires, 0 descendants
  re-anchored, 0 elements moved.
- The drain showing 0 judged images during a scroll was the worker still
  WARMING, not a stall.
- Third independent route to the same conclusion: the phone is the only
  machine that can answer a performance question about the phone.
- No release: nothing user-visible changed. cargo 57/57, gaze 345/345.

**Session 2026-08-30 (loop 4) -- OUR OWN UI WAS THE ONE THAT STILL FELT
LIKE A WEB PAGE.**
- **EVERY SCREEN CHANGE WAS A HARD CUT.** Views, settings panes and
  onboarding steps all swap by toggling `hidden`, so the incoming screen
  replaced the outgoing one in a single frame. Taking an element out of
  `display:none` RESTARTS its CSS animations, so the incoming screen
  animates itself and nothing has to be sequenced in JS: `ts-enter`,
  180ms, opacity + 6px of travel, cubic-bezier(.2,0,0,1).
- **THE BLUR SWITCH SHOWED NOTHING WHEN PRESSED.** It is the only
  control of ours on someone else's page, chrome_css kills the platform
  tap highlight document-wide, and the pill is built from inline styles
  carrying no press state -- so a tap did nothing visible until the
  label changed. `.ts-gaze-pill:active{transform:scale(.94)}` with a
  120ms transition.
- MOTION ONLY, both: no icon, colour, spacing or copy touched, and a
  phone set to reduce motion gets the hard cut back (global media query
  in styles.css, own guard in chrome_css). A rust test walks the pill's
  declarations and fails if anything but transition/transform/opacity
  appears there.
- VERIFIED live on the emulator: launcher view carries ts-enter 0.18s
  with the right curve; opening settings starts a RUNNING 180ms
  animation on the incoming view; the About pane starts one too; the
  reduced-motion rule is live. On a real m.youtube watch page the pill
  computes transition-property "transform, opacity" at 0.12s and the
  injected sheet carries the :active rule and its guard.
- NOTICED, LEFT ALONE (owner did not ask): the settings nav has no
  indicator that moves between items, and the onboarding step dots do
  not animate. Both are layout/visual decisions, not motion fixes.
- cargo 57/57, gaze 345/345, tsc clean.

**Session 2026-08-30 (loop 3) -- THE EMULATOR ANSWERED THE WRONG
QUESTION, TWICE, AND CLOSED A LEDGER ITEM DOING IT.**
- **A WARM-UP DIAGNOSTIC WAS ON THE CRITICAL PATH.** warmUp ran face and
  nsfw a SECOND time to answer "was that all compilation?" -- 9-18ms on
  the desktop, **face2 3552ms + nsfw2 3070ms on a real Android WebView**,
  while nothing is judged and the feed stays fully covered. Now behind
  `__TS_WARM_BENCH`. HONEST: wall-clock warm barely moved (15,907 ->
  15,683ms) because the three models warm in PARALLEL and the second
  runs hid inside the longest chain (gender; `gender:compile` alone is
  ~10s). It removes 6.6s of GPU work; the phone benefit is a PREDICTION.
  No release on its own.
- **LEDGER ITEM 3 IS CLOSED: the first navigation of an app run is not
  the slow one.** It is the one that gets models INLINED rather than
  fetched, and the ledger predicted 1.2-2.2s for it. Measured through
  the app, three navs in one run: first thumbnail 21,067 / 22,702 /
  18,783ms -- the first is the FASTEST of the three. Persisting the
  proven-host set across runs would buy nothing on Android, so its risk
  (a stale "reachable" record recreates the all-blurred failure) is not
  worth taking. Do not revisit without a number from the phone.
- **WARM-UP IS 85-90% OF TIME-TO-FIRST-THUMBNAIL** on Android and gates
  the drain, so the feed is covered for all of it. No ordering trick
  removes it: ENGINE_COMPILE_ONLY is a GLOBAL flag, so a real pass can
  never overlap another model's compile phase.
- **THE EMULATED GPU CANNOT ANSWER A PERF QUESTION.** One BlazeFace pass
  on a blank 256px frame: ~10s here, 20-60ms on the desktop. Ratios
  inside one run are usable; absolute numbers are not.
- NOT DONE, deliberately: profiling the owner's PHONE, which is ledger
  item 1 and the only way past all of the above. It is plugged in and
  adb sees it, but launching the app and driving it to YouTube at 3am
  wakes his screen with feed content on it. Needs his go-ahead.
- gaze 345/345, cargo 56/56.

**Session 2026-08-30 (loop 2) -- THE DESKTOP WALL, AND THE PATCH THAT
CANNOT REACH THE PLAYER.**
- **DESKTOP CONSENT IS A DIFFERENT ELEMENT AND A DIFFERENT SITUATION.**
  MEASURED on www.youtube with cookies cleared: a tp-yt-paper-dialog at
  z-index 2202 inside `ytd-consent-bump-v2-lightbox`, 412x839 -- but it
  locks NOTHING. body stays static, a scroll moved 600px behind it,
  7,188px of results already laid out. So the hide stands alone and is
  deliberately NOT `:has()`-gated (mobile's is, because there the hide
  and the scroll release must arrive together). VERIFIED live: dialog
  839 -> 0, host display none, scroll 600 -> 1800, 21 results.
- **THE IMAGE PATCH CANNOT PAINT OVER THE STICKY PLAYER, third
  independent measurement.** probe_patch_over_player.py mints a patch
  the way region-blur does (host = the image's parent, relative if
  static, overlay absolute z-index 2) on a REAL watch-page
  recommendation and walks it under the player in 60px steps: 8 samples
  with genuine overlap, patch top 269 -> -149, and the player wins
  elementsFromPoint every time. With the 232 patch samples and 900
  in-player hit-tests from 1045, the z-index question is answered as
  well as the geometry one. The occluder clamp stays as the net; the
  owner's frame is still unexplained and needs the video + scroll
  position to go further.
- **PROBE GOTCHA THAT INVENTED A BUG:** a probe that CDP-navigates
  straight to m.youtube never calls open_platform, so Rust's
  SHOWN_STATE is empty and every default-shown surface reads as hidden
  -- watch recommendations came back 196 elements all display:none,
  which looks exactly like a broken default. Invoke open_platform from
  the launcher first (it survives every later navigation in that
  process). The real path was checked too: a force-stop resumes at the
  LAUNCHER, so a restart cannot leave a page on an empty shown state.
- cargo 56/56, gaze 344/344.

**Session 2026-08-30 (overnight loop) -- GOOGLE'S COOKIE WALL, AND THE
SCROLL LOCK THAT OUTLIVES HIDING IT.**
- **m.youtube SERVES A FULL-SCREEN CONSENT WALL AND WE WERE SHOWING
  IT.** MEASURED signed out on the headless emulator: search AND home
  render `ytm-consent-bump-v2-renderer` ("Before you continue to
  YouTube"), position fixed, 412x839, over a page that is fully built
  behind it (39 feed items, 12,140px of content). NO NAGS, and this is
  the biggest one there is.
- **THE TRAP: HIDING IT ALONE IS WORSE THAN LEAVING IT.** The lock is
  not on the dialog. <body> gets a `modal-open-body` ATTRIBUTE and
  YouTube's own sheet is `[modal-open-body]{position:fixed;left:0;
  right:0}` plus an inline `top:0`; window.scrollY stays 0 whatever you
  drive. display:none on the renderer leaves a page that looks
  completely normal and cannot be scrolled at all.
- So both ship from `consent_css()` in lib.rs, NOT rules/youtube.txt:
  surfaces_css only ever emits `display: none`, so the release could
  not sit beside the hide there, and an OTA delivering one without the
  other IS the frozen page. Both selectors are gated on the same
  `:has()` so an old WebView drops BOTH and the user gets the ordinary
  wall -- annoying, and working.
- VERIFIED three states in one emulator run: wall + no fix = body
  fixed, scrollY 0; with the fix = body static, scrollY 1800, dialog
  display none; CONTROL, a legitimate `modal-open-body` with no consent
  element = still locked, moved 0 (YouTube's own sheets untouched).
  Delivered: the live injected sheet carries both rules, 36,004 bytes.
- **TWO NEGATIVE RESULTS, do not redo them.** (1) Non-passive listener
  audit across gaze/src and src: the ONLY scroll-blocking listener in
  the app is the miniplayer's own player-scoped touchmove. Nothing else
  can make a touch feel caught. (2) The image drain is NOT stuck when
  it stops: 35 pending images all sat at top -4728..-5730, correctly
  deferred as more than two viewports behind, and scrolling back
  drained 34 -> 21 in 10s.
- PROBE GOTCHA: on m.youtube the consent wall makes <body>
  position:fixed, so `document.scrollingElement.scrollBy` moves 0px and
  a probe reads a healthy page as a dead one. Drive `window.scrollBy`
  and PRINT the distance. spikes/gauntlet/probe_scroll_emu.py does.
- cargo 56/56, gaze 344/344.

**Session 2026-08-30 -- THE DRAG STOPPED ARMING ON THE FEED, AND THE
MINI PLAYER GREW THE REST OF YOUTUBE'S.** Two owner reports, both of
them the same module.
- **1045: THE GESTURE WAS ARMING ON THE HOME FEED.** Owner: "the video
  gets highlighted again and again ... I'm not tapping it." m.youtube
  plays feed previews into the SAME shared #movie_player, so a finger
  landing on a preview bound our non-passive touchmove right there and
  took the fast scroll path away at exactly the moment he was scrolling
  past. The miniplayer is a watch-page behaviour anyway -- leaving
  /watch is a hard navigation -- so onDown now refuses off /watch and
  unbinds a listener a single-page nav left behind.
- **1045: A PATCH STOPS AT THE CHROME ABOVE IT.** His frame showed a
  recommendation's blur painting over the sticky player. HONEST: the
  mechanism was NOT reproduced (232 patch samples, 0 escapes; 900
  in-player hit-tests, 0 patches on top). occluderBottom in
  region-blur.mjs is a cause-independent safety net: an entry samples
  elementsFromPoint once while it is in the top 60% of the viewport,
  walks each hit's ANCESTOR chain for a fixed/sticky box that does not
  contain the image, and clamps the patch top to its bottom (display
  none when fully covered).
- **1046: "make mini player function exactly like yt".** Three of the
  four native behaviours are reachable on a web page; the fourth is
  not, and miniplayer.mjs says so at the top.
  (1) THE SHRINK FOLLOWS THE FINGER. blendTransform interpolates the
  parked transform by dragProgress; ts-mini-drag kills the eased
  transition while the finger holds it, because a transition running
  under a finger IS the chasing feel. Measured on the emulator in one
  gesture: scale 0.94 / 0.84 / 0.75 / 0.62 at 10/25/40/60px, landing
  at 231px on the 12px margin.
  (2) PLAY/PAUSE AND CLOSE. Every child of the container is inside the
  scale, so a flat 32px button paints at 18 -- they are sized
  calc(32px / var(--ts-mini-k)) and measured 57 physical px. The icon
  follows the VIDEO's play/pause events, not our own click.
  (3) A SIDEWAYS FLING THROWS IT AWAY, 1:1 with the finger, fading,
  then stops the video. Where the native app leaves it gone, ours
  restores the page: our player lives IN the page, so a hidden one
  leaves a collapsed 232px band with no way back. Verified paused
  true, placeholder 232 again, 0 buttons, transform cleared.
  parked() measures with `transition:none` inline -- a forced layout on
  a cleared transform is enough to start the animation from full size.
- HARNESS: every check above ran on the HEADLESS emulator
  (`emulator -no-window`) through spikes/gauntlet/probe_mini_yt.py and
  emu_cdp.py. Nothing from a feed is ever drawn on the owner's monitor.
  emu_cdp exposes `page()` (a ws url) and `Tab`; `page()` is not a Tab.
- docs/speed-findings-2026-08-29.md records what actually made the app
  fast and what is left, in order. Read it before optimising again.
- gaze 344/344, cargo 55/55, tsc clean.

**Session 2026-08-29 evening -- AN AVATAR HAS NO BODY, AND A HEADLESS
EMULATOR IS THE HARNESS.** Owner, on the phone: "profile picture blur
is spreaded all over, and it isn't confined to the profile picture
area"; "the home page ... when I touch the finger, it acts like there's
something that was stopped"; and the control that named the cause,
"recommendation page is much nicer to scroll through".
- **HE DOES NOT WANT FEED CONTENT ON HIS MONITOR** ("don't open this
  trash on my PC"). Verification now runs on `emulator -no-window`.
  `adb forward` DOES work with -s once the daemon is restarted -- the
  earlier "more than one device/emulator" was a stale daemon, not the
  two devices. So: headless emulator + CDP (spikes/gauntlet/emu_cdp.py)
  = real Android WebView, full page state, nothing on his screen.
- **EVERY FLAGGED FACE WAS EXPANDED TO A BODY, INCLUDING ON A 68px
  AVATAR.** expandToBody reaches 1.2 head-widths sideways, a head above
  and SIX head-heights below; on a profile picture all four run off the
  edge and clamp, so the patch was the whole square over a round photo.
  Below IMAGE_MIN_SIZE the face IS the subject: padBox(0.22) plus the
  element's own border-radius. VERIFIED on the emulator: patches 13-31px
  inside a 68px avatar (was the full 68), and on a two-person avatar the
  woman is covered while the man beside her stays sharp.
- **A FEED PREVIEW NO LONGER RUNS A PASS WHILE THE FEED IS SCROLLING.**
  m.youtube plays previews into the SHARED player, so scrolling home ran
  the whole video pipeline -- person model, repeated passes, an overlay
  loop pinned to a moving player -- on top of every thumbnail. The watch
  page's list plays no previews, which is exactly the difference he
  felt. Skipped passes cover the preview WHOLE (blur-first, nothing
  exposed) and patches return when the finger stops.
  HONEST: NOT verified on a live home feed -- signed out, m.youtube
  renders no feed anywhere we can reach. What IS verified is the
  control: on /watch, passes keep running through a 11,274px scroll
  (24 -> 25 -> 29), so the gate does not touch the real player.
- His "didn't get blurred" thumbnail could NOT be reproduced: on 1043,
  both desktop and real Android cover her (one face, female 0.89), and
  the man in the next result reads male 0.88 and stays sharp. His phone
  was on an older build or a different mode. Still open.
- gaze 331/331, cargo 55/55.
**Session 2026-08-29 afternoon -- A QUERY STRING IS WHAT GETS PAST A
SERVICE WORKER.** Owner: "do all improvements available".
- **www.youtube HAS RUN THE INFERENCE WORKER FOR THE FIRST TIME.** Its
  service worker answered our bare `/__tamescroll/` path with YouTube's
  own 404 (758 bytes). The IDENTICAL path with a query comes straight
  through to our interceptor: 200, our 1027768-byte bundle, 10ms, and a
  Worker built from it answered in 52ms -- while the bare path, asked
  for moments later on the same page, still failed. Every synthetic url
  now carries `?v=<bundle stamp>` (app/gaze/src/synthetic-url.mjs);
  both interceptors already matched on path and dropped the query.
  MEASURED on www.youtube, two navs: worker alive on webgl, up 307-389ms,
  models 461-559ms, warm 360-462ms, page eval 19-20ms, and the page
  carries NO models at all. Before: dead worker, 22.7MB parsed in page.
  DO NOT "simplify" the query away.
- **EACH MODEL IS WARMED THE MOMENT IT LANDS**, so its shader
  compilation overlaps the download of the ones behind it. m.youtube
  first thumbnail 1057-1258ms (was 1242-1290), worker ready 959-1164
  (was 1150-1196). warmMs READS HIGHER now because it spans the loads
  it hides behind -- do not read that as a regression.
- **THE PRESTART NOW HAS A MODE STAMP.** The sessionStorage hint can
  only exist after a page of ours already ran on that origin, so the
  first navigation of a session could never prestart. The window's mode
  is stamped in and consulted ONLY when there is no hint; a hint the
  page wrote always wins, so switching to off still stands it down.
  Cold worker start 1531ms -> 179ms. HONEST: cold first thumbnail did
  NOT move (2932 vs 2907ms) -- cold cost is model load + shader
  compile, not start time. Android is unaffected (its init script is
  built once at app start, when the mode is still "off"), so the phone
  keeps prestarting from the second navigation on.
- REGRESSION SWEEP after the query change, all five platforms in one
  run: reddit / x / instagram / facebook / m.youtube all worker alive,
  backend webgl, **0 CSP violations**.
- NOT DONE, decided: persisting SYNTHETIC_HOSTS across runs would save
  the one slow page per host per launch (an unproven host still gets
  the models inlined: up 1782-2793ms vs 521ms once proven), but a stale
  "reachable" record recreates exactly the all-blurred failure of this
  morning. Left in memory deliberately.
- gaze 324/324, cargo 55/55.
**Session 2026-08-29 morning -- ONE CACHE SLOT ANSWERED EVERY ONE OF OUR
OWN URLS.** Owner, on 1041: "the home screen all the thumbnails are
blurred", then "even in recommendations".
- **THE BUG IS ANDROID-ONLY AND IT WAS OURS FROM LAST NIGHT.**
  MainActivity.syntheticResponse held ONE `syntheticFile`: the first
  `/__tamescroll/` request (gaze-page.js) filled it and every later one
  was answered with those same bytes. The 08-29 overnight round moved
  the models to fetched urls, so the worker asked for blazeface.json and
  got 1MB of JS -- no model parsed, `loadFailed` killed the worker, the
  page had no models either, and blur-first left EVERY thumbnail covered
  on every surface. Desktop answers per request (WebResourceRequested),
  which is exactly why every number measured overnight was clean.
- FIX: cache keyed by url path, right mime per file (json /
  octet-stream / javascript), directory emptied once per process so a
  new build can never be served the previous build's bytes. The orphan
  `tamescroll-synthetic.js` an old build leaves behind is deleted too
  (that one landed AFTER the 1042 apk -- it rides the next release).
- **VERIFIED ON THE ANDROID PATH, emulator-5554 x86_64 1042:**
  cache/tamescroll-synthetic/ holds SEVEN distinct files (gaze-page.js
  1027768, models_blazeface .json/.bin, models_faceres .json/.bin,
  models_nsfw .json/.bin) where the old code wrote one. Search feed
  screenshot (spikes/emu-search-1042.png): men sharp, avatar sharp,
  women covered -- differentiated verdicts, not blanket blur.
- HARNESS: the owner's phone (M2010J19SI, arm64) is plugged in and adb
  sees it, but MIUI still refuses `adb install`
  (INSTALL_FAILED_USER_RESTRICTED) -- push to /sdcard/Download and he
  installs from Files. `adb forward` refuses with "more than one
  device/emulator" even WITH -s/-e/-t, so no CDP into the emulator this
  session; run-as + screencap answered it instead. Git Bash mangles
  /sdcard and /data paths -- MSYS2_ARG_CONV_EXCL on the adb arg only.
- RELEASE GOTCHA: `gh release create` names the asset after the FILE, so
  uploading from a temp path published tmp-tamescroll-v0.1.42.apk and
  the manifest url 404d. Re-upload under the right name; the download
  url then 404s for ~a minute before it serves.
- gaze 321/321, cargo 54/54 (new test fails if the single slot returns).
**Session 2026-08-29 (overnight) -- THE FIRST THUMBNAIL, AND A SERVICE
WORKER THAT EATS OUR OWN URLS.** Owner: "just work on YouTube bugs and
fixes optimization ... it needs to work blazing fast". Every number below
is m.youtube under a mobile UA on this desktop; the phone is still the
machine that has never been measured.
- **A SERVICE WORKER CAN TAKE OUR OWN URLS AWAY FROM US.**
  www.youtube.com registers one; every same-origin request from a
  controlled page goes through it, and what it answers itself NEVER
  reaches WebView2's WebResourceRequested. `/__tamescroll/...` comes back
  as YouTube's own 404 page (758 bytes -- the same unexplained response
  seen once on 08-28). m.youtube registers NONE and the identical fetch
  returns our bytes. So the inference worker has never started on desktop
  YouTube, which is why every worker number in this repo was taken under
  a mobile UA. DO NOT re-diagnose this as an interception bug: the
  request counter says seen 53 / blocked 8 on the very page that 404s.
- **A HOST HAS TO EARN THE MODEL-FREE BUNDLE** (SYNTHETIC_HOSTS in
  lib.rs). Splitting the page and worker artifacts meant a host that can
  neither start a worker nor fetch model bytes had NO MODELS AT ALL, and
  blur-first means every image stays covered forever -- a regression
  introduced and caught the same night. Now a host gets the full bundle
  until we have actually served it a synthetic resource. VERIFIED in one
  run: www.youtube models in page / worker dead / 11 images judged;
  m.youtube first load full, second load model-free with a live worker.
- **THE WORKER WAS PARSING 22.7MB OF BASE64 TO SAY HELLO** (827-970ms).
  93.9% of the artifact is four inlined models. gen-embed.js's note that
  a runtime fetch is CSP-dead is STALE: fetching our own url succeeded on
  ALL FIVE platforms with zero violations (json 3ms / bin 5-7ms), and
  workers are live on reddit, x, instagram, facebook. synthetic_resource
  now also serves the raw model files; detector.js fetches them
  (ioHandlerFor) and falls back to the inlined blobs, which is what makes
  the SW hosts still work.
- **THE FIRST THUMBNAIL COST 1.25s AND THE REST 60-100ms.** Lazy WebGL
  kernel compilation, proven not assumed: a second run of the same graphs
  costs 9-18ms. warmUp() runs each model once before the worker reports
  ready, under ENGINE_COMPILE_ONLY first so every program compiles in
  PARALLEL (KHR_parallel_shader_compile): 1481-2047ms sequential ->
  439-607ms. The flag is cleared in a `finally` and a test pins that --
  left set, BlazeFace answers "no faces" on every image and the drain
  REVEALS it.
- **THE PRESTART IS WORTH ~100ms, NOT 400.** The worker now starts at
  document_start (worker_prestart_script, adopted with its message
  backlog replayed) -- but document_start on m.youtube is ITSELF 311-326ms
  into the navigation and our bundle evaluates only ~100ms later. Gated
  on a note the previous page left in sessionStorage, smart mode only,
  top frame only, self-terminating if unadopted. Measured honestly
  because the first version was unfalsifiable.
- DELIVERY GOTCHA THAT COST A CYCLE: an appended initialization_script
  never ran. On Windows the tail is what gets lost -- PREPEND. (Same
  defect family as the 2026-08-19 >1MB truncation.)
- MEASURED: first thumbnail 2182-3200ms -> **1175-1468ms** warm,
  ~2100ms on a cold first navigation. gaze 321/321, cargo 52/52, tsc
  clean.
- **THE MODELS SHIPPED TWICE and the APK went 61.2 -> 79.6MB**: base64
  inside the bundle, and again as the raw files. Now the raw files are
  the only copy and models_script() base64s them on demand, once per run,
  for the one delivery that cannot fetch. gaze-init.js is DELETED -- one
  artifact, no models, pages and workers both run it. APK **55.8MB**,
  smaller than before any of tonight's work.
- **SCROLL, RE-MEASURED HONESTLY** (m.youtube, mobile UA, 6x throttle,
  5600px): 34 images in 7.4s = **4.62 img/s**, 0 left pending, 19% of
  frames over 32ms, our long tasks worst 105ms. Two probe artifacts had
  to be fixed first, both of which read a working pipeline as a dead
  one: __TS_GAZE_IMGDIAG is a 120-entry RING so its length saturates
  (use __TS_GAZE_IMGTOTAL), and Input.synthesizeScrollGesture moves
  m.youtube 0px under a mobile UA (drive the scroller and print the
  distance).
- Audits after all of the above: youtube/mobile surface audit 0 dead
  toggles, 0 leaks. Desktop www.youtube leaves 3 elements permanently
  `ts-gaze-pending` -- measured, all three are 0x0: two
  ytd-yoodle-renderer placeholders with no src and the idle shared
  player. Nothing visible; not chased.
- NOT DONE: SharedWorker (would keep models and compiled shaders across
  navigations, worth ~800ms) is DEAD for the owner's target -- Android
  WebView has no SharedWorker.

**Session 2026-08-28 night — v0.1.40/1040 LIVE (sha d0908dc5, raw
manifest verified). Four fixes, three of them his words.**
- **A NON-PASSIVE `touchmove` ON THE DOCUMENT** (miniplayer.mjs, shipped
  that morning) took the fast scroll path away from EVERY page in the
  app. Owner: "when scrolling through thumbnails show a pressing
  impression when I'm just scrolling", "make it feel like native yt
  app". The gesture only ever acts on a touch that STARTED in the
  player, so only the player's subtree is non-passive now (bindHost, on
  touchstart). VERIFIED: page scrolls 325px while the main thread is
  blocked 600ms; probe_mini_live still drags both ways. Regression test
  greps the source for a non-passive document touch listener.
- **THE IMAGE BUDGET WAS CHARGING THE MAIN THREAD FOR WORKER TIME.** It
  was calibrated when the models ran in page; since inference moved off
  thread, ONE worker image (152ms at 6x) blew the 150ms scroll budget
  and the drain slept 250ms, repeatedly -- his old "processes some, then
  halts", recreated by its own fix. noteSpend now subtracts the ms the
  worker reports. Measured over one scroll: images finished 5 -> 13, our
  real main-thread share 489ms of the page's 2,116ms of long tasks
  (worst task 742ms, of which ours can be at most 102ms -- so the
  remaining jank at 6x is YouTube's).
- **PROFILE PICTURES WERE NEVER LOOKED AT** (owner: "profile pics do not
  get blurred"). Sub-120px images were cleared unchecked as UI chrome --
  which is also where every profile picture lives, and size cannot tell
  a person's photo from a channel logo. IMAGE_MIN_FACE_SIZE 48: images
  in [48,120) get the FACE question only (noNsfw through the worker
  protocol -- nsfwjs costs the same at any source size and has nothing
  to say about a head shot). LIVE on a search feed: 13 avatars checked,
  13 faces found, 5 covered, 8 cleared, 0 images below the new floor.
- **A TOGGLE COULD NOT REACH AN OPEN WINDOW (desktop).** Pressing a tile
  for an already-open platform only focused it, so the page kept the
  sheet from whenever it last navigated. Measured on reddit: 1,951 bytes
  with <recent-posts> hidden while Discovery read Shown, 1,642 the
  instant it reloaded. `rules_refresh_script` (CSS only -- no scriptlets,
  no `__TS_RULES__` guard) is eval'd on focus. This also invalidated an
  earlier "DEAD TOGGLE" audit finding: the audit's two passes were
  reading one stale window.
- **A PAGE COULD KILL OUR WINDOW.** window.close() takes the WebView2
  controller down and leaves the label taken: get_webview_window still
  answers, set_focus AND eval both still return Ok, so every later tile
  press succeeded and did nothing, permanently (measured on x.com; both
  Rust liveness signals tried first). The injected script now routes
  window.close to the launcher. HARNESS CONSEQUENCE: probes can no
  longer close a platform window with window.close().
- **"home feed is not showing"** has a second half, measured: signed out,
  m.youtube renders no feed at all -- "Start watching videos to help us
  build a feed of videos that you'll love". The surface fix from earlier
  today was real; the empty page is YouTube's. His phone's feed comes
  from that WebView's own history, and could not be reproduced here.
- Audits: probe_surface_audit + probe_leak clean on YouTube mobile AND
  desktop (0 dead toggles, 0 leaks) and reddit desktop (0 after the fix).
  x/instagram not yet swept. PROBE GOTCHAS FIXED, both of which invented
  bugs: a device-metrics override from an earlier session sticks to the
  target and survives clearDeviceMetricsOverride (a "desktop" run read
  innerWidth 412 and called 20 healthy recommendations a dead toggle);
  and a visibility walk must stop BELOW body -- desktop ytd-app is fixed
  so body's box is 0 tall.
- gaze 307/307, cargo 47/47.

**Session 2026-08-28 (overnight) — META PLATFORMS, AND THREE SILENT
NO-OPS.** Owner asked for Facebook + Instagram overnight; three separate
delivery bugs turned up on the way, each of which made correct rules do
nothing.
- **THE THUMBNAIL CROP WAS STRETCHED.** cropAndResize squashes the
  detector box into 224x224, so faceres read a distorted face on every
  image: a clear front-facing man read `male` at 0.06 and was covered
  (the owner's screenshot). Aspect-preserving crop (detector.js
  `square`) -> male median 0.76, and the genders finally separate:
  men 0.45-0.98, WOMEN misread as male 0.16-0.28. So
  GENDER_IMAGE_MIN_SCORE 0.12 -> 0.4; the old bar was clearing those
  women (a yoga thumbnail fully sharp = exposure). The child gate's cost
  went to zero for free (childP max 0.22 over 48 reads, was 0.25-0.31).
  IG explore still over-covers small distant faces (44-67px reading
  0.34-0.40) — safe direction, accepted.
- **DESKTOP RULES FOLLOWED THE WINDOW, NOT THE PAGE**, and then three
  writers fought over one style id with no precedence, so the winner was
  whoever found document.head first. Reddit opened from the YouTube tile
  kept 8,564 bytes of ytd-* rules and NONE of its own — measured. Fix:
  the page-load payload stamps `data-ts-scoped` and overwrites; the
  host-blind writers stand down. All five platforms verified in one
  window; r/popular now hides its feed 1/1 and an ad post 1/1.
- **A RULE WITHOUT A `!surface:` ABOVE IT IS DROPPED SILENTLY.**
  facebook.txt's first draft had 11 rules and 0 surfaces; three headers
  were written `! !surface: id | Label | note`, which is a comment. Test
  added: every rule line in every file we own must reach a surface, by
  count, per platform.
- **INSTAGRAM IS LIVE-VERIFIED WITHOUT A LOGIN**: /explore/ renders
  signed out under a mobile UA. blur 12/12 images, Reels nav 1/1 hidden,
  Explore nav 1/1, smart mode 48 verdicts. Two drafted selectors were
  wrong (live hrefs are `/reels` and `/explore`, no trailing slash).
  Tile is READY.
- **FACEBOOK IS WIRED, NOT VERIFIED**: signed out it is a login wall (0
  links, 0 articles). Delivery is confirmed (our exact selectors in the
  injected sheet, gaze bundle boots); every selector is [unverified] and
  says so. Tile is open so it can be tested on his phone.
- Releases: 1031 (crop), 1032 (tiles), 1033 (fb rules apply), 1034
  (per-host ownership). gaze 272/272, cargo 42/42.

**Session 2026-08-28 early (v0.1.30/1030, commits eca278e / 3c055ca).

**Session 2026-08-28 — PREVIEW STAND-DOWN NEVER FIRED.** Owner phone
screenshot: scrolling the feed, image patches drawn across a PLAYING
preview, describing nothing on screen. The stand-down for exactly this
shipped the session before and looked for `ytm-video-preview` /
`.ytmVideoPreviewHost` / `ytd-video-preview`. MEASURED on the live
mobile-UA feed: those are 0 elements, `#movie_player` is 1 — m.youtube
previews reuse the SHARED player (same fact rules/youtube.txt records).
Query now includes it; a `playing`/`pause` capture listener sweeps
immediately instead of waiting out the 500ms heartbeat (10-11ms
measured, poll-limited). Verified on a fresh page against the real
player: playing+covering -> display:none, paused -> back, resumed ->
gone. probe_stray found 0 misplaced patches over 10 scrolls, and
probe_recycle found ZERO src/srcset swaps on m.youtube search, so
thumbnail recycling is NOT the mechanism — do not chase it again.

**Session 2026-08-28 evening -- THE PAIN-POINT AUDIT, WORKED.** Owner:
"check my most pain points". Four items off
docs/research/pain-points-2026-08-28.md + docs/plan-balance-2026-08-28.md.
v0.1.39 (1039) live, apk sha 8fa75ea1.
- **THE MOBILE SABR "GAP" IS NOT ONE.** rules/scriptlets.txt carried
  "DESKTOP ONLY ... until the same numbers exist from the owner's
  phone", which read as a half-finished ad fix. MEASURED: m.youtube's
  ytInitialPlayerResponse HAS NO streamingData (keys are
  responseContext, playabilityStatus, playbackTracking, captions,
  videoDetails, playerConfig, storyboards, microformat, trackingParams
  -- no stream, no ad fields). Mobile ALWAYS fetched client-side, which
  is why it never had the 24-37s hard-nav stall: first frame 3.2s, no
  ad, no .ytp-error. DO NOT "finish" it -- there is nothing to remove
  and it would cost the embedded fallback for free.
- **THE REQUEST SHAPER DOES LAND ON MOBILE**, read off the wire via CDP
  Network (not a page hook YouTube could capture first): ONE POST to
  /youtubei/v1/player, 4111 bytes, body carrying isInlinePlaybackNoAd,
  video playing to t=21s. Delivery [live]; ad-free EFFECT still needs a
  session actually served ads.
- **THE DIAGNOSTICS ENGINE BLOCK WAS EMPTY.** rulesGen/otaLast/otaAgeH/
  cssBytes/blocked all read from __TS_DIAG_APP, which carried
  versionCode + blurPx only -- so the block built to answer "which
  rules was the phone running" was null in every real report. Now:
  ota.rs keeps a generation hash over the rules the engine is actually
  built from + last refresh outcome/age; lib.rs counts every JUDGED
  request and every BLOCKED one (our own IPC deliberately uncounted).
  seen==0 means page interception is not wired at all (the 08-25 bug,
  invisible for weeks); seen>0 with blocked==0 means wired, nothing
  matched. cssBytes measured IN PAGE so a wrong-platform sheet shows up.
  Live desktop: rulesGen c3a3f5f7, otaLast ok, cssBytes 4140, counters
  seen 96 -> 262 -> 300 / blocked 0 -> 7 -> 9 across three navs.
- **LOOK CONTRACT FROZEN** (video-region.mjs `LOOK`): featherFrac 0,
  radiusPx 8, blurFrac 0.09, blurMaxPx 72 -- values UNCHANGED, pinned by
  a test quoting him. Nine "low quality" reports across four dates came
  from accuracy rounds moving geometry under cosmetic dials. A round
  that needs one must change the test.
- **SQUARE CROP EXTRACTED** to app/gaze/src/crop-geometry.mjs with a
  test that fails if an inline copy reappears -- the defect that lived
  four days and three model swaps in the image path after being fixed
  in the video path. Tests assert square-in-PIXELS (on 16:9 the naive
  version is off by 1.78x), never shrinks, stays centred, edge faces run
  off-frame rather than squash, 0x0 source passes through. Live both
  directions on one search page: man 0/6 flagged, woman 19/25.
- **CONNECTED != RENDERED** (video-region refreshRects): a player under
  a display:none ancestor answered getBoundingClientRect with zeroes and
  the renderer re-read it 60x/s forever. getClientRects().length answers
  it in one read. Bounded: the kill path fires ONLY when the host paints
  no pixels (nothing to expose) -- never on a confidence signal.
  Re-verified: 22 patch samples over a scrolled sticky player, 0
  outside, 0px overhang.
- NOT done from the plan: B6 (models out of the page-side eval) and the
  gender-band half of B3 -- both need numbers from his phone, and B3's
  band half needs licence-clean face fixtures.
- gaze 306/306, cargo 44/44.

**Session 2026-08-28 afternoon -- THE MINIPLAYER, AND THE SIGN-IN WALL.**
v0.1.38 (1038) live and hash-verified (22c1ea2d...).
- **DRAG-TO-MINIPLAYER SHIPPED** (owner asked twice; he waived the
  grill: "both no need to do the grill"). app/gaze/src/miniplayer.mjs,
  installed from init-entry BEFORE the mode gate -- it is a player
  behaviour, not a gaze one, so it works in off mode too.
  What it can NOT be, measured not assumed: m.youtube's back out of
  /watch is a HARD navigation (window globals gone, 0 videos, container
  gone), so no element survives to float over the next page. So the
  scope is the watch page: the sticky player shrinks to the
  bottom-right and the comments/recommendations take the full screen.
  Geometry is a TRANSFORM, never a resize -- YouTube sizes
  #movie_player in px from its own JS, so a narrower container just
  crops a 397px video; a scale leaves children (our overlays included)
  intact.
  TWO THINGS THE LIVE PAGE TAUGHT IT: (1) `.player-placeholder`'s 223px
  is a padding-bottom aspect trick, so `height:0` computed to 0px and
  still measured 223 tall -- `padding:0` is load-bearing. (2) SCROLL
  COMPENSATION WAS ITSELF THE BUG: adding the class moved scrollY
  600 -> 377 on its own (Chromium scroll anchoring already holds the
  position) and correcting it again moved the landmark 453 -> 676. Now
  no scroll write exists in the module and a test fails if one returns.
  Verified live, mobile UA: 412x232 @ (0,48) -> 231x130 with
  right/bottom exactly on the 12px margin, video playing across the
  transition, placeholder 223 -> 0, tap restores to the pixel, landmark
  453/453/453. Inert on desktop youtube and reddit (no container).
  The in-player blur pill is hidden while mini (it outranked the cover's
  z-index and ate a third of a 231px box).
- **GOOGLE SIGN-IN: HALF OF IT IS A PLATFORM WALL.** A WebView cannot
  offer a device account chooser -- Android 8+ account visibility only
  exposes Google accounts to signature-matched apps, and the cookie
  reconstruction path is literal infostealer behaviour (also BLOCK-ONLY).
  Custom Tabs' jar is unreadable; a TWA would cost injection, request
  blocking and gaze. Shipped what IS available: autofill, one line in
  MainActivity (`importantForAutofill = IMPORTANT_FOR_AUTOFILL_YES`,
  API 26+), so Google Password Manager offers his saved login and the
  password never touches our code. NOT `..._YES_EXCLUDE_DESCENDANTS` --
  WebView's autofill nodes ARE virtual descendants. Full option
  analysis: docs/research/google-signin-2026-08-28.md.
  UNVERIFIED on device; his phone is the only place it can be seen.
- gaze 293/293, cargo 43/43, tsc clean.

**Session 2026-08-28 morning — THE PLAYER LEFT THE MAIN THREAD, AND THE
PHONE CAN NOW ANSWER FOR ITSELF.** Releases 1036 and 1037, both live and
hash-verified (5c19cb5d.../d66693df..., 21660c77...).
- **PLAYER INFERENCE IN THE WORKER.** runPass/workerVideo/banWorkerVideo
  in init-entry; vframe/vfaces/vgender/vgender1/vrelease in
  worker-entry. A watch page with a live worker loads ZERO models in
  page (was four): heap 211MB -> 145-179MB, slow frames 21-45 -> 0-4
  over the same 45s. Policy ALL stays on the main thread; the worker
  only executes models. Crop uploads are kept under a `cid` so the
  "decide before you pay for gender" ordering survives.
  Gated on THREE things and one-way on failure: worker alive, backend
  === 'webgl' (a CPU worker is slower than the thread it relieves), and
  MoveNet loaded there. Verified both directions: worker 120 passes /
  0 fails with in-page models never loaded; __TS_NO_WORKER 118 / 0 with
  all four.
- In-page NSFW is no longer loaded while the worker owns images (it was
  only ever for the image path).
- **CROP BUDGET 3-4 -> 6 on the worker path** (owner: "what if you drop
  the blur frame rate for it to work more accurately"). Off-thread the
  cap costs nothing but accuracy; the cadence self-adjusts because
  effZoom is lastVerdictMs * VERDICT_DUTY.
- **THE FEATHER IS OFF.** Owner settled the dial he had moved three
  times: "I'm fine with fully hard rectangle with rounded corners/edges
  since it looks higher quality." FEATHER_FRAC 0, 8px corners kept.
  Do NOT re-tune this without him saying so.
- **PATCHES CANNOT PAINT OUTSIDE THE PLAYER** (owner phone: a patch
  running down over the recommendation below a scrolled sticky player).
  Overlays now live in a `ts-gaze-vregion-clip` layer, inset:0 +
  overflow:hidden, so the browser clips from the player's CURRENT
  geometry with no cached rect of ours involved. Plus an arithmetic
  clip to the video rect and a scroll-dirty rect refresh.
  HONEST LIMIT: the mechanism behind his frame was NOT reproduced --
  the sticky player does not drift during a scroll (measured 0px over 8
  samples at 250ms). The fix is deliberately cause-independent.
  Verified on the surface it happened on (mobile UA, m.youtube, sticky
  player, 14 scroll steps): 28 patch samples, 0 outside, 0px overhang.
- **DIAGNOSTICS SHIPPED (1037).** Owner: "can't you implement a
  diagnostics feature ... so you can always check the logs", then "or
  give me the control of reporting" -- he collects, HE sends, nothing
  uploads (the About pane still says no telemetry, and that stays true).
  app/gaze/src/diag-report.mjs builds a report from the rings that
  already exist; `reportViolations` walks the SERIALIZED report and
  rejects anything not numeric or in a closed enum, free text only in
  keys ending `R` after redactFreeText. Runs in tests AND at runtime
  before hand-off. Dropped/transformed: imgdiag `src` (a thumbnail url
  identifies the video -- gone), every error message, the luma series
  (-> 6-bin histogram; a 10Hz delta series is a footage fingerprint).
  Stored by a TsDiag Android bridge into a capped rotating JSONL in
  app-data; Settings -> About has Share/Copy/Clear. Desktop reads the
  same report over CDP via `window.__TS_DIAG_NOW()`.
  Live desktop report, 5088B, 0 violations: backend webgl, person model
  2947ms, verdict p50 89 / p95 172, position p50 33, image gaps p50 69
  / p95 1074.
- **THE OPEN QUESTION IS ON HIS PHONE:** `worker.backend`. If Android's
  worker lands on CPU, workerVideo() refuses and the player runs in the
  page exactly as before -- silently -- and every number above
  describes a machine he does not own.
- **Fable audits, both worth reading before the next round:**
  docs/research/pain-points-2026-08-28.md (six recurring complaints,
  why each earlier fix did not stop it) and
  docs/plan-balance-2026-08-28.md (the diagnostics design + a ranked
  accuracy/cost plan, B2-B7, several gated on phone numbers).
- Noticed, left alone: a YouTube "turn on watch history" nag on the
  desktop watch page (NO NAGS miss).
- gaze 284/284, cargo 43/43, tsc clean.

**Session 2026-08-27 night — INFERENCE LEFT THE MAIN THREAD.** Owner's
report was "it processes some then it halts"; the answer was not a
faster model.
- **WORKER SHIPPED ON YOUTUBE.** The blocker was never Workers, it was
  `require-trusted-types-for 'script'` refusing a blob: url. YouTube
  sends it with NO `trusted-types` allow-list, so our own policy is
  allowed and a SAME-ORIGIN script url loads. Our request interceptor
  answers it: `synthetic_resource` (lib.rs) on WebView2's
  WebResourceRequested, `shouldInterceptRequest` on Android.
- **ONE ARTIFACT, TWO ROLES.** gaze-init.js boots its worker half when
  it finds no `document` (src/worker-entry.js `startWorker`). A second
  bundle cost 17MB of APK (78.1MB) for byte-identical tfjs + models;
  collapsing it put the APK back at 61.2MB / entries 69.3MB.
- **A PARTIAL WORKER IS A DEAD WORKER.** Any `loadFailed` kills it, or
  it would answer "no faces, not suggestive" and images would be
  REVEALED unchecked. No Worker / bad script / timeout all fall back to
  the in-page pipeline. Verified both ways: probe_worker_live 12/12
  verdicts in the worker with in-page models never loaded;
  probe_fallback 19/19 in page with __TS_NO_WORKER.
- Earlier in the day, measured and shipped: double decode of every
  thumbnail removed, one GPU upload serves all three models, drain
  no longer stops on scroll, two image lanes. One image 89ms -> 50ms,
  worst image 11.0s -> ~1.2s, scroll throughput 0.31 -> 2.21 img/s.
  MEASURED DEAD ENDS, do not retry: cross-image batching (BlazeFace's
  graph fixes batch to [1,256,256,3]), URL verdict cache (4-8% hit,
  `sqp` varies the crop per surface), scroll budget fraction.
- **HAIR (owner: "why is the hair visible of women... in all blurs"):**
  images got 0.3 face-heights above the detector box, which is less
  than the crown alone -> 1.0; video pinned the top edge 1.1
  head-widths above the head keypoints (eye level) -> HEAD_ANCHOR_UP
  1.6. Top edge ONLY, so no patch got wider and no cleared neighbour is
  newly covered. NOT verified on a frame where hair was previously
  escaping — every close-up in the two runs captured is fully covered
  either way; the change is arithmetic, monotone, and did not regress
  the drawn output.
- gaze 271/271, cargo 40/40.

**Session 2026-08-27 evening — RESPONSIVENESS, three releases.** Owner
was testing on the phone: "it's processing multiple together but the
speed is still much less compared to the speed that someone scrolls ...
it processes some, then it halts, then it takes time to process the
next." All numbers below are DESKTOP at a 6x CPU throttle; **nothing was
measured on his device** (no adb to it — the phone is remote).
- **1025** shipped the previous session's uncommitted work (model
  warm-up, model reorder, avatar un-blur, idle budget).
- **1026, the real win: every cross-origin thumbnail was DECODED TWICE.**
  30 of 30 fetched twice; the bytes came from cache, the decode did not
  — 39ms of an 89ms image, bigger than BlazeFace and faceres together.
  Fix is `preflightCors` (init-entry): set `crossOrigin='anonymous'` on
  images that have NOT loaded yet, so the page's own decode is usable and
  our clone disappears. Guarded by a measured-ACAO host list + an error
  handler that restores the plain load. Verified 44 tagged / 0 broken on
  YouTube, 110 / 0 on Reddit. One image 89 -> 61ms, duplicate fetches
  30 -> 0. Also: one GPU upload per thumbnail instead of three; a scroll
  caps the drain instead of stopping it; batch re-arm on a macrotask
  instead of requestIdleCallback.
- **1027:** the drain flag was released when the idle callback STARTED,
  so batches interleaved — that is the clump-then-halt he described.
  Serial now: worst single image 11,056ms -> 649ms. Plus the queue skips
  images more than two viewports away (visible-settle A/B on 3 fresh
  pages: 3.8-4.1s vs 4.4-4.6s, defer ahead 3/3) and a page with no video
  no longer loads MoveNet.
- **DEAD ENDS, both measured, do not retry blind:** (1) batching
  inference across images is IMPOSSIBLE — BlazeFace's graph fixes its
  batch dim ("must be [1,256,256,3], but was [4,256,256,3]",
  spikes/perf-harness/bench-batch.html). (2) a verdict cache keyed by
  thumbnail url serves 4-8% — YouTube's `sqp` varies the crop per
  surface; a path-only key is only safe for CLEAR verdicts because a
  flagged one carries boxes that would land wrong on another crop
  (probe_cache.py). (3) the scroll-time budget fraction is NOT a lever:
  0.02/0.15/0.35 gave 0.78/0.75/1.02 img/s and 17/16/20% dropped frames,
  inside run-to-run variance.
- **The ceiling is now per-image cost** (61ms desktop, ~370ms at 6x),
  and the models are fixed-input, fixed-batch. The next real cut would be
  a smaller face model — an accuracy call the owner has to make.
- New probes, all in spikes/gauntlet: probe_stage (per-stage cost),
  probe_gaps (intervals between images), probe_far_ab (visible settle,
  A/B), probe_budget_ab, probe_scrollfeel (frames + throughput together),
  probe_clone, probe_cache, probe_person_defer. Runtime overrides
  `__TS_IMG_BUDGET` and `__TS_IMG_FAR` exist so both sides of an A/B run
  on one build. imgdiag entries now carry `t` (completion wall clock).
- gaze 271/271, cargo 40/40. Release recipe unchanged and it worked three
  times: `npx tauri android build` still fails on the symlink AFTER
  producing the .so, so strip that .so into jniLibs and run
  `:app:clean :app:assembleArm64Debug -x :app:rustBuildArm64Debug`.

**Session 2026-08-26 night — GAUNTLET ROUNDS ARE OVER.** Owner: "stop
with the gauntlet run and let's do run just based upon polishing the app
and making it optimized and working accordingly." He rejected the v1018
blur in four parts: "very messy and not smooth and very jettery... looks
very low quality", "the before gauntlet blur was the best"; comments and
recommendations show only a spinner; the miniplayer is gone; "map it
out, optimize it more".
- **The word is SOLID, not small.** Two rounds of margin cuts moved
  patch height 0.97 -> 0.935 and stopped: MoveNet's own box is p50 0.560
  on this footage, so geometry is not the lever. What he is looking at
  is COUNT and MOTION. `mergeTracks` unions overlapping tracks again
  (S12's head-split refusal fired 90-99/min): patches 1.05 -> 0.87/0.80
  mean, MAX 3 -> 2, dCount 0.53 -> 0.48/0.27/s, stable 0.949/0.977.
  Plus a 2%-of-span MOVE_DEADBAND in lerpRect (a still subject now gets
  a genuinely still patch; SETTLE_PX is a quarter pixel and never
  caught anything), PATCH_MARGIN 0.08->0.045, PTRACK_PAD 0.05->0.04,
  PTRACK_PAD_TOP 0.12->0.06, and a per-keypoint cushion proportional to
  the person's height instead of a flat 0.178 of frame height.
  breathe 0.274/s against pre-gauntlet 0.229 and 0.372 at the start of
  the stability work. Gate both directions, every frame read: EXPOSURE
  0, GHOST 0, PARTIAL 0, DRIFT 0; FALSE COVER 3 (man inside the
  neighbour's patch) = the cost his solid-patch rule accepts.
- **"Comments don't load" is NOT blocking — MEASURED.** All eight watch
  endpoints incl. /youtubei/v1/next pass should_block_request; SPA nav
  survives (a window mark set before a thumbnail click is still there
  after, one navigation entry); scrolling the live dev app loads 20 then
  40 comment threads and 20 related items. It is main-thread starvation
  on the G88: YouTube's lazy IntersectionObserver + fetch callbacks
  queued behind our inference. FIX SHIPPED: sampleOnce yields when
  navigator.scheduling.isInputPending() is true (verified present in
  WebView2), bounded at 3 consecutive skips. Phone effect UNVERIFIED.
- **MINIPLAYER: mobile web does not have one.** m.youtube ships ZERO
  minimized-player experiment flags and no minimized element; the drag
  gesture does nothing there. What it does have is `player-container
  sticky-player` pinned at y=48, and that WORKS in our app (verified
  under a mobile UA + touch emulation: player stays pinned and playing
  across 1042px of scroll while related grows 24 -> 72). The swipe-down
  miniplayer he is accustomed to is a NATIVE YouTube app feature. On
  desktop the button is gone for YouTube's own reason: the
  `ytp-delhi-modern` player renders no `.ytp-miniplayer-button` at all
  (control bar enumerated: autonav, subtitles, settings, size,
  remote, fullscreen, pip) even though showMiniplayerButton is true in
  WEB_PLAYER_CONTEXT_CONFIGS, and our injected CSS matches nothing
  miniplayer-related. Building our own shim is open, unasked, and
  touches the player red line.
- Release recipe run: strip 187MB -> 54MB, :app:clean + assembleArm64
  -x :app:rustBuildArm64Debug, APK 61.2MB (entries 69.3MB), aapt2 1019,
  gh release app-v0.1.19, manifest raw-verified sha 98ab9eb9.
- gaze 228/228, cargo 37/37.


**Session 2026-08-26 (gauntlet R21, rotation entry 3 = TED talk, man):**
First round scored in the regime where **MoveNet returns 0 persons and
every patch is manufactured by the face detector alone** (8 of 10
frames). Three GHOST frames: a patch over a text-only slide, no human
anywhere in frame — the owner's third bar item.
- **SHIPPED `frameHasNoHumanShape` (person-gate.mjs):** an uncorroborated
  face is refused when MoveNet's best keypoint across all 6 slots is
  below PFF_FRAME_KP_FLOOR 0.1, and ONLY when the person pass admitted
  nobody. The face path is not removable (it exists because of a measured
  child close-up EXPOSURE) and R7 settled that face confidence cannot
  separate a graphic from a small face — so the discriminator has to come
  from the OTHER model. GHOST 3 -> 1.
- **HONEST LIMIT, measured, in the log:** the typography band is
  0.05-0.11, so 0.1 LEAKS one frame in ten. 0.12 would close it and is
  REFUSED — the nearest real case (forearms workbench, two people's hands
  filling the lower third) is 0.120 and lastSlotDiag rounds maxKp to 2dp,
  so that is calibrating against rounding. R22 item 1 = record 3dp, then
  re-derive over ALL passes, not only face-bearing ones.
- **The critic's 0.17 refused**, reason written into person-gate: three
  frames its labelling counts as failures in the 0.12-0.16 band are
  hands/forearms of real people. A hand is part of a person, so a patch
  there is not GHOST and refusing the mint is EXPOSURE.
- **Two defects fixed in the same diff:** the gate read module-global
  `lastSlotDiag` inside a promise — one detector instance serves EVERY
  video element, so a player + feed preview page reads the wrong pass;
  now captured synchronously as `persons.noHumanShape` in detectPersons.
  And refused faces still counted as evidence, so `emptyFrame` stayed
  false (eraser stood down over a graphic) and faceHeight*3 armed
  wipeIfEmpty's `big` shortcut.
- **News-graphics GHOST is NOT reachable this way** (measured): a title
  card produces MoveNet noise at maxKp 0.10-0.52 against a real
  close-up's 0.14-0.76 — the regimes overlap on score, maxKp and nKp15
  alike. Critic's route: BlazeFace's 6 facial landmarks are computed and
  thrown away at detector.js:282 (wider download of a tensor already on
  the GPU, NO extra inference, our own model, no licence question). That
  is a PROBE ask for R22, not a fix.
- gaze 170/170, cargo 36/36. Cost unchanged: verdict p50 75ms, pass p50
  25ms. `first == max` again = model warm-up.
- **RELEASE GOTCHA (cost a cycle):** the arm64 rust exclude task is
  `:app:rustBuildArm64Debug`, NOT `rustBuildAarch64Debug` — and gradlew
  exits **0** on that failure. Check the APK mtime, never the exit code.

**Session 2026-08-25 (owner: "Again ads came" / "still ads come"):**
Two separate causes, both measured, both fixed + live-verified on desktop.
- **Scriptlets clobbered each other.** A watch page emits our pruner AND
  four `setConstant("ytInitialPlayerResponse.<adfield>")`; every one
  installed an accessor on the same global with an unconditional
  `Object.defineProperty`, so the last one emitted silently destroyed the
  rest. The pruner WON its race against the page and was still inert.
  Both scriptlets now COMPOSE over an existing configurable accessor.
  Regression test pins both emit orders (scriptlet-collision.test.mjs).
- **Killing the ad did not kill its cost.** Hard nav was still 24-37s to
  first frame. NOT renegotiation (docs/scriptlet-gap.md was wrong, now
  annotated) — it is SABR **fake buffering**: InnerTube ships a backoff
  worth ~80% of the ad duration (https://iter.ca/post/yt-adblock/). Fix:
  drop `streamingData` from the embedded ytInitialPlayerResponse so the
  player MUST issue the client-side /youtubei/v1/player request that our
  existing isInlinePlaybackNoAd shaper already reshapes ad-free.
  Measured 4.4-11.5s across 3 videos x 2 loads, no ad, no .ytp-error.
  **DESKTOP ONLY** — m.youtube keeps the old field list until phone
  numbers exist (dropping the embedded fallback stream is player-red-line).
- **GOTCHA that cost hours: the OTA cache in app-data SHADOWS local
  rules/ edits.** Rules changes cannot be verified locally until pushed.
  And `touch lib.rs` is not proof of a reload — only an app.exe **PID
  change** is (binary mtime lies; cargo test rebuilds it independently).
- ReVanced comparison (owner asked): it patches the APK bytecode
  (AdPlaybackController/VideoAdsManager -> no-ops) + spoofs the InnerTube
  client. The patching half is permanently closed to us (hard rule, and
  it is what got ProTube removed); the request-shaping half is what we
  now do. Their client spoofs are currently breaking as InnerTube retires
  Android VR/TV; isInlinePlaybackNoAd is not a client spoof.
- STILL OPEN: gauntlet track churn (diagnostics built in person-track.mjs,
  uncommitted, never measured — birthFresh/birthNearMiss/coastExpired);
  29+ commits since v0.1.14 with no release, so the phone has none of it.

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

## Blur patches are SOLID (owner, 2026-08-26, said twice)

Never punch holes, windows, cut-outs or sharp regions into a blur patch,
and never split a patch into pieces around someone. Both forms have
shipped and both were rejected: `subtractBox` (four sibling rectangles)
is the owner's "multiple boxes here and there", and the mask hole R24
finally made render is "weird face cutouts in the blur".

The requirement in his words: *"blur the subject so well that its shape
is not visible"*, qualified as *"slight shape visible is fine in some
cases, it just shouldn't be super tight"* — so a loose, solid,
soft-edged patch. A silhouette-tight mask is the wrong direction too.

The cost is accepted and must not be re-litigated: a cleared person
inside someone else's patch gets covered. Fix that upstream — better
association, refusing a merge, tighter observation geometry — never by
cutting a window in the blur.
