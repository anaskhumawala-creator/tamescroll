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
