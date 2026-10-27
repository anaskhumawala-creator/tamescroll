# Store release

How tamescroll gets into Google Play and the App Store, what is ready,
and what only the owner can do. The legal reasoning behind every line
here is in `docs/legal-position.md`. Listing files under `play/` follow
the fastlane `supply` layout, so they can be uploaded by hand now and by
a script later.

## Order

1. **Google Play first.** The Android app exists; the Play build type
   (`gradlew :app:bundleArm64Play`) already drops the self-updater and
   the install permission.
2. **App Store second.** It needs the iOS port (#16) before anything
   can be submitted. The Apple developer account already exists.
3. **The sideloaded APK keeps going** from the website and the in-app
   updater, alongside Play.

## Blockers before the first Play upload (code, ours)

These are the decisions of 2026-10-22. Each one answers a review rule,
so the store build should not go up without them.

- [x] A "search or type a site" box above the tiles, visible by
  default, #22 (Play Webviews policy, Apple 4.2 and 5.2.2: we are a browser,
  not a wrapper for someone else's site).
- [x] A per-site ads switch, #23 (Play Device and Network Abuse: the
  user, not the app, decides to block ads). Settings → Bring back →
  (platform) → Ads, Hidden by default. Shown turns off network blocking,
  the vendor cosmetic lists, the ad scriptlets and our ad and promo
  surfaces for that platform only.
- [x] No platform logo or brand colour in the store build, #24 (Play
  Impersonation, Apple 5.2.1). The in-app tiles already use muted letter
  glyphs. The `play` build type overrides the home-screen shortcut icons
  (`src/play/res/drawable-nodpi/shortcut_*.png`) with plain cream letters
  on our ink; the sideloaded build keeps the red play tile ZV chose for
  it on 2026-09-10.
- [x] A release signing config for the `play` build type that reads the
  upload key from outside the repo (`keystore.properties`, gitignored).

## Owner only

- [ ] **Play Console account: a NEW one, just for tamescroll** (ZV,
  2026-10-27). The existing console belongs to Hijri First, and a strike
  on tamescroll must not reach its apps. Fresh Gmail (doubles as the
  public contact email), sign up as "Yourself", developer name
  tamescroll. A personal account costs a one-time
  US$25 and needs ID verification. If it was created after 13 Nov 2023,
  Google requires a **closed test with at least 12 testers for 14 days
  in a row** before production access. Start recruiting testers early:
  family and friends with Android phones and a Gmail address.
- [ ] **Upload key.** Make it once and keep two backups off this
  machine; losing it means a key-reset request to Google:
  `keytool -genkeypair -v -keystore tamescroll-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000`
  Keep the .jks outside the repo, then create
  `app/src-tauri/gen/android/keystore.properties` (gitignored) with four
  lines: `storeFile=` (full path to the .jks, with forward slashes:
  `C:/Users/you/keys/tamescroll-upload.jks`), `storePassword=`,
  `keyAlias=upload`, `keyPassword=`. The `play` build signs with it.
  Opt in to Play App Signing (Google holds the app signing key).
- [ ] **Privacy policy URL.** Play needs a public URL. Either redeploy
  tamescroll.com (#15) or turn on GitHub Pages for `web/`.
- [ ] **Contact email** for the listing (Play shows it publicly) and for
  the website's contact line. A dedicated address is better than a
  personal one.
- [ ] **Screenshots**: 2 to 8 phone screenshots, taken on the store
  build. Suggested set: the home tiles with the search box; a cleaned
  YouTube home; a watch page without the related column; the blur on a
  results page; the per-site switches. Use test content with no real
  people's faces in clear view, and no platform logo as the focus.
- [ ] **Sideload verification.** Android developer verification applies
  to apps installed outside Play (Brazil, Indonesia, Singapore and
  Thailand from 30 Sep 2026, worldwide in 2027). Register the package
  name `app.tamescroll.client` with the same identity as the Play
  account so the website APK keeps installing.

## Building and uploading

1. Double-click **`play-build.bat`** in the repo root. It builds the
   gaze bundle, the Rust library and the signed `.aab`, checks it, and
   prints the file to upload (`release-out/tamescroll-play-<code>.aab`).
   It publishes nothing.
2. Play Console → Testing → **Internal testing** first: no review wait,
   up to 100 testers, and it is the first time the minified (R8) build
   runs on a phone. Check the launcher, a tile, the blur, the search box
   and the Ads switch on it before anything else.
3. Then **Closed testing** with the 12 testers for 14 days, then
   **Production**.

## Roadblocks we already hit, and what stops them now

| Hit before | What happened | Now |
| --- | --- | --- |
| Models missing on a fresh clone | Engine reported `native-failed` and everything quietly ran on the slow worker | `play-build.sh` refuses to start without `assets/models/*.tflite` |
| Stale gaze bundle | `tauri android build` does not rebuild it; an APK shipped the previous bundle | The script builds it first |
| gradlew exit code | gradlew exits 0 when the task failed | The script checks the `.aab` mtime |
| Unstripped or duplicate `.so` | APK doubled in size | Strip into `jniLibs`, size check |
| Install permission | A listing asking for `REQUEST_INSTALL_PACKAGES` is refused | `src/play/AndroidManifest.xml` removes it; the script greps the bundle for it |
| Implied permissions | A dependency AAR added `READ_PHONE_STATE`, which needs a declaration form | Removed in the play manifest; checked in the bundle |
| Self-updater | Play forbids apps updating themselves | `BuildConfig.UPDATER=false`; rules still travel as JSON only |
| Never ran minified | The 2026-09-05 play `.aab` was built but never installed | Internal testing track before anything else |
| Brand look | Juno removed under Apple 5.2.2; Play impersonation rules | #22, #23, #24 in this file |

**Two things that will bite if not planned for:**
- **The Play app cannot update the sideloaded one.** Same package name,
  different signing key: Android refuses. Anyone moving from the APK to
  Play (ZV included) uninstalls first and loses their settings. Testers
  should be people who never installed the APK.
- **One versionCode per upload.** Play refuses a code it has seen. The
  Play build reuses the newest sideload code, so a second Play upload
  needs a `release.bat` run first.

## Play Console answers (ready to paste)

**App or game:** App. **Free.** **Category:** Tools (where
browsers sit).

**Contains ads:** No.

**App access:** All functionality is available without an account.

**Target audience:** 18 and over (or 16 and over). Do **not** pick an
under-13 or 13 to 15 band: that enrols the app in the Families policy,
and a browser that opens open-web content cannot meet it. Parents and
grandparents are the audience; the description talks to them.

**Content rating (IARC):** the app is a web browser, so answer **yes**
to "users can access unrestricted internet content" (browsers are rated
for what they can reach). Answer no to user interaction features
operated by us, no sharing of location, no purchases. Expect a teen or
mature rating; that is normal for browsers.

**Data safety:**
- Data collected: **No.** Data shared: **No.**
- Rationale for the reviewer, if asked: the app has no server and no
  analytics. It fetches a public rules file from GitHub without any
  identifier. The diagnostics log leaves the phone only when the user
  shares it through Android's share sheet, which Google's guidance
  counts as user-initiated, not collection.
- Encrypted in transit: Yes (HTTPS only; cleartext is off in release).
- Deletion request: not applicable (nothing is stored off the device).

**News app / health / financial / government:** No to all.

**Permissions:** `INTERNET` only in the Play build. No declaration
forms are needed.

## Reviewer notes (App access → instructions)

> tamescroll is a web browser. The box at the top searches the web or
> opens any address, and the tiles below are sites the user has added.
> Each site opens its own public mobile website in Android System
> WebView; tamescroll hides parts of the page (feeds, short-video shelves,
> autoplay) and blurs images on the device. It does not use any site's
> API, does not download or save media, and does not modify any other
> app. Ad blocking is on by default and can be turned off per site in
> Settings → Bring back → (the site) → Ads. No account is needed to
> review the app. To see
> the image blur, open any site from the tiles and scroll a page of
> thumbnails.

## Listing copy

`play/en-US/title.txt` (30 max), `short_description.txt` (80 max) and
`full_description.txt` (4,000 max). Rules the copy follows:

- No platform name in the title or the short description, and no
  platform logo in any graphic (Play Metadata and Impersonation
  policies).
- No "no ads ever": ads are blocked by default and the user can turn
  that off.
- Says "independent, not affiliated" in the description.
- Never says the app is "legal", "approved" or "official".

Graphics: `play/en-US/images/icon.png` (512 x 512) and
`featureGraphic.png` (1024 x 500), both from `docs/brand-kit`.

## App Store (after #16)

- Same answers in substance: browser shape, ads switch, own icons, no
  data collected (App Privacy: "Data Not Collected").
- Age rating: "Unrestricted Web Access" gives a high rating (16+ in
  the earlier review); accept it, as every browser does.
- iOS has no `shouldInterceptRequest`. Ad blocking moves to
  `WKContentRuleList`, which Apple supports for exactly this, and the
  gaze models run through Core ML or the TFLite Metal delegate.
- Review notes: the reviewer-notes text above, plus a line that the app
  is a WKWebView browser and ships no executable code over the air
  (rules are JSON data), which covers guideline 2.5.2.
- The listing will show the owner's legal name as the seller, because
  the account is personal. That was decided on 2026-10-22.
