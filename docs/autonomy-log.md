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
