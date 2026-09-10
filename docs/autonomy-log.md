# Autonomy log

The owner asked (2026-09-05): "start implementing what you can right now
and keep working without stopping... for stuff that you know I'll
generally go with your recommendation, go ahead with it and then present
me the report." A 30-minute loop was scheduled (session-only; it expires
after 7 days). Each tick appends here. Exposure trades are never taken
here -- those are his rulings.

## 2026-09-05 15:05 -- tick 0 (manual, before the loop's first fire)

**Shipped: 1107, `app-v0.1.107`, sha256 `23eab0c2…01e2e`, isDraft false,
served APK re-downloaded and hash-matched against the raw manifest.**

### What changed
- **YouTube links open inside tamescroll.** Manifest claims
  youtube.com / www / m / youtu.be (VIEW, BROWSABLE) and text/plain SEND.
  MainActivity routes a link through the launcher as
  `?open=youtube&url=…` so it behaves exactly like a tile tap; cold start
  carries it over the existing one-shot bridge. `open_platform` takes an
  optional url, honoured only if its host belongs to the tile's platform.
  `youtu.be/<id>?t=` is rewritten to `m.youtube.com/watch?v=<id>&t=`
  before the webview sees it. Onboarding gains "Open YouTube links here",
  which opens Android's own Open-by-default page for our package.
- **The launcher no longer waits on a caption.** `start()` awaited
  `rules_summary`, which calls `engine()` per platform, which builds the
  152k-rule adblock engine synchronously if cold. A cold link sat on the
  launcher for 20s (engine warmed in 25.3s). The count is now requested
  and the caption fills in later.

### Verified on his phone (e3d369ee)
- cold `youtu.be/NWoT1ZVd1Lo?t=15` → `m.youtube.com/watch?v=NWoT1ZVd1Lo&t=15s`, playing at t=42
- warm `www.youtube.com/watch?v=KAWvDsghyc8` → watch page
- SEND `"look at this https://youtu.be/4u3jS_cTHH0 lol"` → watch page
- `https://example.com/x` aimed at our package → Android refuses to resolve; app untouched
- cargo 65/65 (2 new tests, both red-proved); gaze 901/901

### Not verified
- The un-gating's effect in isolation: the verifying run's engine warmed
  in 4.4s, not 25s, so the 20s case was not reproduced against the fix.
- The onboarding button opening the settings page (needs a finger).
- Whether the system routes a bare youtu.be tap to us: that is the
  user's Open-by-default choice, and it is off until they set it.

### Judgment calls
- Folded the link opener into 1107 and released THAT rather than cutting
  a 1106 release an hour before it -- one install for him, not two.
- Kept the tile launcher; did NOT add a URL bar. VISION.md says "no
  address bar, nowhere to wander" and the owner said he is not keen on a
  browser shape. HaramBlur ships on the App Store with named platforms
  and no URL bar, so the earlier store advice was over-cautious.
- `platformFromIntent` whitelist gained instagram/facebook (shortcuts
  exist for six platforms; the whitelist named four).

### For the owner
- **Engine warm-up varies 3–25s on your phone** and every cold start pays
  it. The adblock crate can serialise a built engine to disk; that is the
  next perf item and it is not started.
- **Open-by-default is off by default** and Android gives us no API to
  turn it on -- only to open the page. The onboarding button does that.
  Try it once: Settings → Apps → tamescroll → Open by default → enable
  youtu.be / youtube.com.
- Your `RENDER_EVERY` local override is still 2 (measured no gain).

## Queue state after tick 0
- [x] a. link opener (1107)
- [x] b. release 1107 + manifest, hash-verified
- [ ] c. still-scene clock: local build with STATIC_VERDICT_MS=3000, measure crops/s
- [ ] d. image budget fractions + IMAGE_LANES onto the OTA whitelist
- [ ] e. delay-presenter cover behind a dial, measured
- [x] f. instagram/facebook in the intent whitelist (done inside a.)
- [ ] g. Play-build updater kill-switch: design only
- [ ] NEW h. serialise the adblock engine (cold warm-up 3–25s)

## 2026-09-05 15:30 -- sign-in verified (manual)
Owner asked whether he needs to sign in; he was already signed in. Read
live off his phone via CDP (`probe_signin.py`, scratch): `LOGGED_IN:
true`, avatar present, `/feed/library`, SID cookie set. The
disallowed_useragent risk named in the replacement report is CLOSED.

## 2026-09-05 16:40 -- his ruling: front door first (manual)
He asked whether his list was implemented. Honest tally: link plumbing
shipped (1107), guided onboarding NOT built. Measured on his phone: the
YouTube app wins a bare tap in every state of OUR package; only YouTube's
master "Open supported links" OFF + ours ON hands the tap to tamescroll.
`pm disable-user` refused by MIUI. All settings reverted.

## Queue state (reordered on his ruling)
- [ ] i. guided "make tamescroll your YouTube" onboarding: open YouTube's
      Open-by-default page (master toggle off) -> ours (on) -> pin YouTube
      shortcut (requestPinShortcut) -> offer YouTube app-info for uninstall;
      show a done-state if DomainVerificationManager can read it
- [ ] j. Play build variant: updater + REQUEST_INSTALL_PACKAGES out, AAB,
      drop the 3 GPLv3 uBO lists; upload key waits for his "make the key"
- [ ] c. still-scene clock (local build)   - [ ] d. image budgets on OTA
- [ ] e. delay-presenter cover dial        - [ ] h. serialise adblock engine
- [x] g. updater kill-switch design -> folded into j

## 2026-09-05 16:45 -- 1108 shipped: the front door (manual)
Grilled (7 rulings), spec + plan in docs/superpowers. Reskin, new
onboarding, links view + home card, TsLinks bridge extended. Verified
on his phone: DomainVerificationManager reads YouTube's state; self-test
link lands here when YouTube allowed=false + ours selected, opens
YouTube otherwise. Settings reverted. Release a613bb22, hash-verified.
- [x] i. guided onboarding (1108)

## 2026-09-05 17:00 -- j: Play build variant (manual)
Built as a build TYPE `play` (not a flavor: the autogenerated rust
plugin wires tasks by the arm64/universal flavor names). `src/play/
AndroidManifest.xml` removes REQUEST_INSTALL_PACKAGES plus three
permissions the merger implied from a dependency AAR (READ_PHONE_STATE,
READ/WRITE_EXTERNAL_STORAGE). `BuildConfig.UPDATER=false` keeps the
TsUpdater bridge out; main.ts hides the update card on Android without
it. Release minify now keeps every @JavascriptInterface method.
`gradlew :app:bundleArm64Play` -> `app-arm64-play.aab`, unsigned (key
waits for his "make the key"), debug-profile Rust lib.

### For the owner: the uBO lists cannot simply be dropped
Counted: every YouTube ad-strip rule (json-prune adPlacements/adSlots,
replace-fetch-response) lives in uBO's GPLv3 lists -- 26 in quick-fixes,
42 in filters.txt, 1 in EasyList, 0 in our youtube.txt. Dropping the
three lists ends YouTube ad blocking. Options: (a) keep them and treat
lists as data (the README's current position, same as Brave/AdGuard);
(b) write our own CC0 YouTube ad rules calling our own scriptlets and
drop the lists; (c) drop and lose ads. Not decided here.

## 2026-09-05 17:10 -- 1109 shipped: h, and the opt-level 0 finding (manual)
Every shipped .so was opt-level 0 (`--debug` builds, no profile
override). `[profile.dev] opt-level = 3`: engine warm-up on his phone
4.0s -> 0.23s, APK -12MB, cold link launcher->open_platform 112ms.
Serialised engine cache also in (key = crate+version+list bytes). Play
variant plumbing rides along, inert in this build. sha256 c50453522394fce4bbfaf9f66053b909c88ee1d55b35d68d602ee9fe5260bc64.
- [x] h. engine warm-up (1109)   - [x] j. Play variant built, unsigned; list question open

## 2026-09-05 17:25 -- d: image budgets on the OTA whitelist (manual)
`src/image-budget.mjs` holds IMG_BUDGET_SPEND/SCROLL/IDLE (0.05-0.8) and
IMAGE_LANES (1-3) with setters; init-entry reads them; tuning.mjs SPEC +
GETTERS, overlay labels, tuning.json, rules manifest regenerated. gaze
902/902. Ships in the next build (1109 refuses the keys harmlessly).
- [x] d. image budgets on OTA (next build)

## 2026-09-05 17:45 -- c: still-scene clock measured, no win found (manual)
`probe_static_rate.py` on his phone, video Ary1gIbaOTc, 60s windows:
clock off 2.18 passes/s, 1.53 verdicts/s, still<=3 41%; clock 3000 (via
his local override store, restored after) 3.10 passes/s, 1.60 verdicts/s,
still<=3 32%. No saving visible; the scene was still under half the
time, and the report's `applied` shows the OTA value, so the override's
reach is not proven by this run. Not worth a build. Parked.
Also seen: 1109 refuses the 4 new image-budget keys (tuning.refused=4),
as designed, until the next build.
- [~] c. still-scene clock: measured, no win, parked

## 2026-09-05 17:55 -- his ruling: uBO lists stay, as data
Reverses the morning's "drop them, elect EasyList": the YouTube ad rules
live only there. Lists are filter data consumed by the engine, same
stance as Brave/AdGuard (rules/vendor/README.md). Applies to the Play
build too. No code change.

## 2026-09-05 18:05 -- his direction change: app first, stores later (manual)
Play work paused on his word. Direction memo published (artifact
30a38158): no URL bar, yes a paste-a-link field; extension stays dead
unless he reopens it; iOS groundwork without a Mac; web page honest.

## 2026-09-05 18:10 -- e: startup stutter, MEASURED, shipping at 1
DELAY_LATE_ATTACH: the presenter waits for the first verdict, the whole
video wears the flagged class until then (stricter, not exposure). His
phone, cold launches, NWoT1ZVd1Lo, 2 rounds each arm (run_startup_ab.py):
  control  first10s 11.9%  60s 5.6%
  late     first10s  1.8%  60s 0.9%
Handover watched live: verdict 1 at ~1s, presenter attached by 3s, patch
painted at 35s. Ships 1 in tuning.json; needs 1110 (1109 refuses the key).
- [x] e. startup stutter (1110)

## 2026-09-05 18:12 -- also this hour
Open-a-link field on home (YouTube hosts only, Rust re-checks). Web page:
dead github.com/tamescroll links fixed, Android APK is the download,
credits link. Core ML: all three models convert (neuralnetwork format,
iOS14 target; mlprogram's BlobWriter is macOS-only) --
spikes/native/coreml/, parity check needs a Mac. Desktop Windows build
runs; welcome screen fine at 1442px; copy made device-neutral.

## 2026-09-05 18:20 -- 1110 shipped
DELAY_LATE_ATTACH 1, open-a-link, image-budget dials, credits. sha256 9807fcdc87ed226006019ece0f84f347498c9a362dc60c5f6226e3ad78c7185f.

## 2026-09-05 18:35 -- bring-back sweep found Subscriptions blank (manual)
probe_bringback.py, every YouTube surface shown alone on his phone: all
toggles do what their label says. BUG: m.youtube's Subscriptions feed
is the same ytm-rich-grid-renderer as the home feed, so the default
(home hidden) blanked Subscriptions and channel pages. Fix: the bundle
writes html[data-ts-page] from pageKind() (feed/channel/home/...), the
grid rule is scoped `html:not([data-ts-page="feed"]):not([data-ts-page=
"channel"])` -- fails closed on old bundles. pageKind gains 'feed' for
/feed/*. DELAY_LATE_ATTACH code default now 1 (tuning test insists json
== code). 1111 building.

## 2026-09-05 18:45 -- 1111 shipped
Subscriptions/channel fix. sha256 7ba59c78527e89375034e95894863cf53ed179607891396e6c86926e361f5a5d. His asks 18:45: Shorts off should
also clear channel pages; a /shorts/ link should open in the normal
player; YouTube must feel blazing fast (speed pass next).

## 2026-09-05 19:00 -- his two Shorts asks, built (manual)
Channel page: `yt-tab-shape[tab-title="Shorts"]` joins the shorts surface
(the reel shelf and lockups were already hidden). A short is a video:
/shorts/<id> -> /watch?v=<id> on every route -- Rust canonical_link_url
for links from outside, shorts-redirect.mjs in the bundle for in-page
clicks (capture-phase) and any other arrival (500ms tick). Unconditional,
not gated on the Shorts toggle. gaze 906/906, cargo 66/66. 1112 building.

## 2026-09-05 19:15 -- 1112 shipped
Shorts asks, verified on his phone (intent, in-page, channel tab). sha256 da34319317582ec3ad8d4c27259fe81cd68f4c399ddfcd50f2be5211b832ad0b.

## 2026-09-05 19:30 -- speed pass, first numbers (his "blazing fast")
probe_speed.py on his phone, smart mode, 1112: home open 1.15s from the
tile, Subscriptions 1.36s, search 1.71s, 8 real flicks on Subscriptions
0 dropped of 795 frames, 0 long tasks. Watch page (full navigation,
3 videos x 2 rounds): off 2.3-3.0s, smart 2.1-2.8s to playing --
identical; YouTube's own responseEnd is 1.3-1.7s of it. Our injected
code adds nothing measurable to a page load. Image-clear timing not
captured (IMGDIAG ring empty in this run; needs the probe flag).

## 2026-09-05 19:50 -- speed pass, corrected (manual)
The first scroll figure was invalid: synthesizeScrollGesture coordinates
were outside the 406x816 CSS viewport, nothing scrolled. Fixed in
probe_speed.py. Real flicks on Subscriptions, smart mode: 887 frames,
13 dropped (1%), worst 116ms; thumbnails processed as they scroll in
(ring total 14 -> 32 over six flicks), cleared ones lose their class
(that is the design, not a miss). In-app tap to playing video 1.1-1.6s.
Nothing in our code shows up in the page-load numbers; YouTube's own
responseEnd is 1.3-1.7s. The "feel" levers left are UX ones (skeletons,
what the launcher shows while a page loads), not engine ones.

## 2026-09-05 19:05 -- 1113: the tile tap answers at once (manual)
probe_open_frames.py (screencap every ~500ms across a real tile tap, his
phone): launcher frozen 0-0.5s, YouTube skeleton 1.1s, then a BLANK black
home for 9s+ because the home feed is hidden by design. The freeze: the
launcher document is torn down ~50ms after navigate() and its pending
frame with it, and open()'s success path restored the tile BEFORE that,
so the last painted frame was the un-dimmed one (a manual invoke with no
restore painted fine at 51ms -- that was the tell). Fix: two rAFs before
the invoke, and on Android the feedback is kept (document dies anyway);
desktop restores. Verified: tile dimmed + "Opening YouTube..." at 121ms
and 688ms. Search path (probe_search_frames.py): box 0.09s, suggestions
~0.5s, results ~1.0s, thumbnails load blurred ~1.6s, clear after verdict.
Nothing of ours in it except the verdict delay (p50 248ms). The "ts" text
at the bottom-left of every YouTube page is our #tamescroll-home button.
sha256 0119d88ae4d32aa54876d64896b9db4109bd6c97e5cbbde2590f1ce96493efc6.

### For the owner
- The first thing a user sees after the tile is an EMPTY home (feed
  hidden by default). Land on /feed/subscriptions when home is hidden?
  Saves one tap + 1.4s on every open. Product call, not made.
- His 19:00 asks: (1) most-used points -- search measured above, watch
  tap-to-playing 1.1-1.6s from the earlier pass; (2) YouTube updates:
  no per-surface breakage signal exists today; probe_bringback.py is the
  manual canary. Proposal below in the session summary, needs his shape.

## 2026-09-10 -- his direction (his words, 09-09 evening), NOTED FOR THE RECORD
Mobile first; desktop and extension after. Extension: my pick NO (MV3,
uBO already better at ads, second product) -- he accepted. Play: listing
pack is his-only work (key, copy, 3 screenshots, privacy page); AAB
exists. Blur patches: the student model is the real fix (finding 50).

## 2026-09-10 -- NULL_MINT_NM_FLOOR 6 tried and REFUSED (manual)
He ruled 6 on my "+1.1 pts" quote. The control-triple bench then said:
ten-video corpus exposure man 13.5s -> 17.5s, woman 15.0s -> 20.5s
(+30-37%) for a junk cut worth ~0.3% of detections. Told him; my pick
keep 5; he agreed ("Fine then"). Ships 5. Clamp widened [0,7] so 6 can
be tried over OTA without a build. Two test defects fixed on the way:
the image-path floor test read the VIDEO constant; the clamp test now
pins <= 7.

## 2026-09-10 -- why his phone said CPU: the breadcrumb one-strike (manual)
probe_gpu_note.py on his phone, 1113: face gpu, person gpu, gender CPU
with whyR "previous trial did not return", gpuMs -1. The crash breadcrumb
is written before the shader compile (1.4-3.9s); a swipe-away or a
probe force-stop in that window reads as a driver crash and locks the
model on CPU for the whole build. faceres compiles longest, so it is
the one that gets caught. Fix: strikes counter, three launches that never
return before giving up. The pill shows worst-of, so one CPU model reads
"CPU". 1114 building.

## 2026-09-10 -- bounded refusal: ALREADY SHIPPED, and its length is now a dial
He asked for "refuse the first sighting, cover on the second". It has
been in person-track.mjs since the unbounded gate was reverted, and his
phone's live counters prove it working: nullDropped 24, nullMintedHeld 4.
Added NULL_HOLD_PASSES (OTA, [0,3], ships 1 = unchanged; gear label
"Weak-face patience"). bench/null-hold-ab.mjs over the ten-video corpus:
  hold 0  man 12/137/627.5   woman 14.5/187.5/720.5   (phantom +43%)
  hold 1  man 13.5/115.5/439 woman 15/180/522.5       (= CONTROL)
  hold 2  man 13.5/115.5/435 woman 15/179/516.5
  hold 3  same as 2
So one pass already takes the transient junk; longer holds are free but
buy ~nothing on the corpus. What he still sees is PERSISTENT weak reads
-> student model. Thumbnails have no temporal state; their levers are
GENDER_IMAGE_NM_FLOOR and the unmeasured detector-on-text rate (finding
48's thumbnail half) -- next.

## 2026-09-10 -- 1114 shipped; his watch-page complaints, measured
1114 sha 821f0a2ab5c1faa01f08dd7192943a3f93dc21e492967a7ff9a23df035bbc756:
three-strike GPU breadcrumb (his phone now gpu x3, gender 12ms vs
57ms), NULL_HOLD_PASSES dial, nm clamp 7.
probe_watch_ux.py on his phone: the watch page below the actions is
EMPTY with a spinner ring, and YouTube kept fetching related videos
into the hidden column -- 62 /youtubei/v1/next pages, 643 items in ~20s,
because per-item hiding leaves the load-more sentinel in view. Rule
change (OTA, pushed): hide `ytm-item-section-renderer[section-identifier=
"related-items"]`; 0 fetches in 12s vs 13; comments survive (screenshot).
Back from a watch page: NOT reproducible from here -- HyperOS ignores
injected KEYCODE_BACK and nav-bar taps even in Settings; the old Redmi's
CDP touch injection times out and it is PIN-locked. Needs one press
from him while I watch. "Recommendation bar on scroll": the watch page
does not scroll at all with related hidden; needs his screenshot.
The "ts" bottom-left is #tamescroll-home (ours).

## 2026-09-10 -- 1115 built, NOT yet released: link handoff flash
His: "opening a YouTube link first shows the tamescroll page". Cause:
start() painted the launcher before consuming the bridge/?open request.
Now pendingRequest() runs first and the page holds a dark "Opening
YouTube..." line (#handoff) until YouTube replaces the document; desktop
restores the launcher after open() resolves. tsc clean, gaze 907/907.
Verification (probe_link_frames.py, cold VIEW intent + screencaps)
blocked: his phone left the cable mid-run. Release after the frames.
Pin-to-home and uninstall-YouTube steps ALREADY exist in the links
setup (data-step pin/uninstall); the icon is ours by design (logo
impersonation is the store killer) -- his design call, in the map.
Map published: artifact e198a03e.

## 2026-09-10 -- 1115 shipped; the thumbnail rate was already on disk
1115 sha dbd3fb32e238d6001d... (manifest): cold youtu.be link on his
phone, frames: no launcher, "Opening YouTube..." at 1.2-2.0s, watch page
at 2.6s (1114 baseline showed the full launcher 1.9-2.4s). OTA rule
verified live on his phone: related section display none, 0 /next.
Back press: two watch windows, he never pressed; still open.
Thumbnail "text marks": NOT unmeasured -- finding 52's bank answers it.
Person-free-search thumbnails with nobody admitted: 129; detector fires
on 39 (30.2%); after the shipped image guard 16 junk marks remain
(~12%), all weak male reads nm 1.4-5. Next cut is GENDER_IMAGE_NM_FLOOR
6 (OTA, clamp [0,6]): -5 junk / -4 real per finding 52's table. His
call. Map artifact e198a03e corrected.

## 2026-09-10 -- CORRECTION: the student model WAS tried, and lost round one
His question exposed it. Sept 5 overnight (student-queue/queue2/sweep3,
student-w1-s112-*): MobileNetV3 students at 112-192px on dima806's
labels over 16,405 teacher rows (5,451 in-domain + 10,954 FairFace).
Held-out corpus AUC: best 0.9769 (d4-s176), most 0.80-0.97; shipped
grey is 0.9855 on the same 2,159 rows. sweep3 pooled false cover
76-83%. The one run that printed "women wrong 1.5%" (queue, epoch 5)
scored rows it trained on. One config crashed (KeyError 'crop'). No
finding was written; CLAUDE.md said "nothing measured". So: the student
is NOT a pending free win, it is a research bet that lost its first
round. Map corrected. The remaining accuracy levers are the dials he
already has and grey (shipped behind GENDER_GREY).

## 2026-09-10 -- 1116 + 1117: the home-screen icon and an honest pin step
1116 sha 97cf70d972acc53b...: shortcut_youtube.png is now a red
rounded tile with a white play triangle (our own red, our glyph, label
"YouTube" unchanged) -- his ruling, the only shape that survives a
store review. Verified as bytes in the APK and iconRes in dumpsys
shortcut; the system pin dialog could not be screenshotted because...
his launcher is olauncher, and the FIRST pinShortcut returned nothing.
1117 sha e597798dd53786ac...: pinShortcut returns pinned | requested |
unsupported | unavailable | refused; pinState reports {supported,
pinned}; the links step shows "On your home screen." (button hidden),
the long-press route when the launcher refuses, or the Add button.
First cut threw: WebView.getUrl() off the UI thread from a
JavascriptInterface -- now a FutureTask on the UI thread. On his phone:
state {supported:true, pinned:true}, pin -> "pinned". Raw manifest CDN
lagged 5+ min behind the push; verified through the contents API.
Left for the icon mechanism (map): the ONBOARDING never mentions the
home icon -- it lives only under the links "Set up" card -- and a
launcher that hides app shortcuts (olauncher and kin) has no route but
"switch launcher". Both are his to shape.

## 2026-09-10 -- 1118: his four rulings, shipped
Rulings (his words): Subscriptions landing YES; image floor 6 "fine";
grey -- ALREADY ON (tuning.json GENDER_GREY 1 over OTA; he did not know);
home icon into onboarding YES; student PARKED.
1118 sha 0794cea61bed3cde...: landingUrl() in the launcher opens
/feed/subscriptions unless the home surface is in his shown list;
home-redirect.mjs sends any in-page "/" with a hidden grid there
(no grid yet = no redirect, once per href); onboarding step 5 offers
"Put YouTube on your home screen" when pinState says supported and not
pinned; GENDER_IMAGE_NM_FLOOR 6 in code and tuning.json. gaze 910/910.
Verified on his phone (probe_1118.py): tile -> subs 0.92s, logo ->
subs 0.55s with 16 items, step 5 reached with the button present
(hidden on his phone: already pinned).

## 2026-09-10 -- 1119: Subscriptions landing REVERTED on his word
"I wanted a blank homepage anyways." landingUrl() and home-redirect.mjs
(and its test) removed; onboarding icon step and image floor 6 stay.
Verified on his phone: tile -> m.youtube.com/, logo -> m.youtube.com/.
Lesson for the record: he said "of course yes" to the landing at 19:55
and reversed at 20:15 once he saw it; a landing change is visible
enough to deserve a one-line "you sure" before a build.
