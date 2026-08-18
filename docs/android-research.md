# Android porting research

Context: `docs/VISION.md`; `app/src-tauri/{Cargo.toml,tauri.conf.json,src/lib.rs}`; `app/src/main.ts`. Current arch: one `main` launcher window; frontend calls `open_platform`, which builds a **new `WebviewWindowBuilder` per platform** (`lib.rs:192`) against the real remote URL (`WebviewUrl::External`), with `.initialization_script()` injecting cosmetic CSS. No `.user_agent()` call today. `Cargo.toml` pins `tauri = "2"`, no Android target/gen dir yet.

## 1. Local machine audit

Ran on this box (PowerShell), 2026-08-18:

- `java -version` on PATH → **JDK 8** (`1.8.0_341`, Oracle legacy `javapath`). `JAVA_HOME` points to `...\HijriToolchain\jdk-17.0.19+10`, which **does not exist on disk** — stale var, no real JDK 17.
- Android Studio: not found at `%LOCALAPPDATA%\Programs\Android Studio` or `%PROGRAMFILES%\Android\Android Studio`. SDK was set up standalone.
- `ANDROID_HOME` = `...\Local\Android\Sdk` (valid). `ANDROID_SDK_ROOT`, `NDK_HOME`/`ANDROID_NDK_HOME` **unset**.
- SDK: `platforms\android-36` only; `build-tools` 35.0.0 & 36.0.0; `ndk` 27.0.12077973 & 27.1.12297006; `cmdline-tools\latest`; `platform-tools`, `emulator` present.
- `rustup target list --installed` → **only** `x86_64-pc-windows-msvc`; none of the 4 Android targets. (`rustc` 1.94.1, `rustup` 1.29.0, `@tauri-apps/cli` 2.11.4.)
- `emulator -list-avds` confirms both `hijri_pixel` and **`hijri_pixel_b`** exist.

Per Tauri v2 prerequisites ([v2.tauri.app/start/prerequisites](https://v2.tauri.app/start/prerequisites/)) — needs `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, 4 rustup targets. Fixes:

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
[Environment]::SetEnvironmentVariable("JAVA_HOME","<installed-path>","User")
[Environment]::SetEnvironmentVariable("NDK_HOME","$env:LOCALAPPDATA\Android\Sdk\ndk\27.1.12297006","User")
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT","$env:ANDROID_HOME","User")  # optional, conventional
```
SDK/build-tools/NDK packages are already correct — no `sdkmanager` install needed. Open a new shell after setting vars. Android Studio itself is the documented prereq but not strictly required since SDK/NDK/cmdline-tools already exist.

## 2. Google Sign-in / disallowed-useragent

Google OAuth policy ([developers.google.com/.../oauth2/policies](https://developers.google.com/identity/protocols/oauth2/policies)): "A developer must not direct a Google OAuth 2.0 authorization request to an embedded user-agent," naming `android.webkit.WebView`. Remediation ([support.google.com/faqs/answer/12284343](https://support.google.com/faqs/answer/12284343?hl=en-GB)): "Google recommends that developers replace this WebView with a Chrome custom tab." **That's the real fix, not UA spoofing** — spoofing to evade detection violates Google's ToS and is actively fingerprinted.

wry `WebViewBuilder::with_user_agent` ([docs.rs/wry](https://docs.rs/wry/latest/wry/struct.WebViewBuilder.html)) documents a Windows-only WebView2-version requirement; secondary sources (GitHub discussion) claim it's a no-op on macOS/Linux/Android/iOS — **UNVERIFIED at source level** (couldn't reach wry's Android source file; raw path 404'd).

`X-Requested-With`: no wry/Tauri-specific handling found. Android WebView itself gates this header behind `setRequestedWithHeaderOriginAllowList` since WebView 103 ([android-developers.googleblog.com](https://android-developers.googleblog.com/2023/02/improving-user-privacy-by-requiring-opt-in-to-send-x-requested-wih-header-from-webview.html)) — absent by default unless an origin opts in. Whether Tauri exposes control here — **UNVERIFIED**.

## 3. Tauri v2 Android specifics

- `initialization_script` ([docs.rs/tauri WebviewWindowBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html)): uses `WebViewCompat.addDocumentStartJavaScript` when supported. **For remote URLs it falls back to `WebViewClient.onPageStarted`, "not guaranteed to run before other scripts."** Matches this app's own `lib.rs` comment about SPA-nav re-injection — the race is real, slightly worse on Android. Minimum WebView version for `addDocumentStartJavaScript` — **UNVERIFIED**.
- Multi-window: each Tauri window = a separate Android Activity via Jetpack Activity Embedding ([v2.tauri.app/learn/mobile-multiwindow](https://v2.tauri.app/learn/mobile-multiwindow/)) — needs per-window Activity subclasses, manifest registration, split-pair rules (min API 32). On phones, windows don't split side-by-side; a new window pushes onto the Activity back stack (Back → launcher). Concretely: `open_platform`'s one-`WebviewWindowBuilder`-per-platform pattern needs one Activity subclass per platform registered in `AndroidManifest.xml`, not ad-hoc windows off one Activity as on desktop.
- Cookies: Android `CookieManager` persists to disk automatically, no manual sync needed on modern WebView — widely documented but **not confirmed via a verbatim primary-source fetch** in this pass (CookieManager reference page returned only its nav shell). Session cookies without `Max-Age` still won't survive restart — that's cookie semantics, not a Tauri gap.

## 4. YouTube mobile web

`m.youtube.com` (WebFetch, no UA control) 302-redirects to `https://www.youtube.com/?app=desktop` — without a mobile UA, YouTube's edge sends mobile→desktop domain, implying UA-sniffed server-side split. Couldn't fetch real `ytm-*` markup directly. Two independent public filter lists — uAssets ([raw filters.txt](https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt), scriptlets only, no selectors) and `ublock-hide-yt-shorts` ([raw list.txt](https://raw.githubusercontent.com/gijsdev/ublock-hide-yt-shorts/master/list.txt)) — confirm `m.youtube.com` uses `ytm-*` elements distinct from desktop's `ytd-*`:
- Shorts shelf: `ytm-reel-shelf-renderer`, `ytm-shorts-lockup-view-model`(-v2), under `ytm-rich-section-renderer`/`grid-shelf-view-model`.
- Shorts nav tab: `ytm-pivot-bar-item-renderer:has(.pivot-shorts)`.
- Feed/related items: `ytm-rich-item-renderer`, `ytm-video-with-context-renderer`.
Third-party lists, not YouTube's own docs — **UNVERIFIED against a first-party source**, corroborated by two independent maintainers.

## 5. Signing + Google Play

Keystore ([v2.tauri.app/distribute/sign/android](https://v2.tauri.app/distribute/sign/android/)): `keytool -genkey -v -keystore $env:USERPROFILE\upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload`. Config in `gen/android/keystore.properties` (git-ignored), wired into `gen/android/app/build.gradle.kts`'s `signingConfigs`.

Play ([v2.tauri.app/distribute/google-play](https://v2.tauri.app/distribute/google-play/)): `.aab` required — `tauri android build -- --aab`, output `gen/android/app/build/outputs/bundle/universalRelease/app-universal-release.aab`; first upload done manually in Play Console to verify signature/bundle ID; Play Console developer account required. Tauri's stated min supported Android is **7.0/API 24** (`minSdkVersion`). Google Play's current mandatory *target*-API policy for new submissions was not stated on this page — **UNVERIFIED**.

## Unverified callout

- Tauri/wry control over Android's `X-Requested-With` header.
- wry source-level confirmation that `user_agent()` no-ops on Android.
- Minimum WebView version for `addDocumentStartJavaScript`.
- Verbatim primary-source CookieManager persistence text.
- Real `ytm-*` markup from a live UA-spoofed fetch (inferred from filter lists only).
- Google Play's current mandatory target-API-level policy for new submissions.


## First build + run — verified findings (2026-08-18, emulator-5556, x86_64)

Evidence: spikes/android-first-run.png, spikes/android-yt.png,
spikes/android-build.log, spikes/gradle-build2.log.

**Build path that works on this machine (no Developer Mode):**
1. `npx tauri android init` — clean.
2. `npx tauri android build --debug --target x86_64` — Rust
   cross-compile succeeds (~2 min), then FAILS at the symlink step
   (Windows refuses symlinks without Developer Mode).
3. Workaround: `Copy-Item` the built
   `target/x86_64-linux-android/debug/libapp_lib.so` into
   `gen/android/app/src/main/jniLibs/x86_64/`, then
   `.\gradlew.bat assembleX86_64Debug -x :app:rustBuildX86_64Debug`
   (the excluded task only re-invokes the tauri CLI / symlink).
   BUILD SUCCESSFUL ~1 min. APK ~150MB debug.
   Every future build needs this until Developer Mode (owner call) or
   upstream fix. Frontend is embedded in the Rust binary — the empty
   gen/android assets dir is normal.

**Runtime findings:**
- Launcher renders 1:1 with desktop; engine warms in 3.6s on-device.
- NO multi-window: tapping a tile navigates the single WebView
  in place (numActivities=1). Desktop's window-per-platform model has
  no Android equivalent here — Android UX needs an in-app back path to
  the launcher (system Back may suffice; unverified).
- UA redirect www.youtube.com -> m.youtube.com happens AFTER injection;
  the injected CSS must carry the ytm-* rules regardless of host
  (fixed in lib.rs surfaces_css, test-pinned).
- Injection race is REAL on Android: repeated
  `Cannot redefine property: __TAURI_*` logcat errors confirm init
  scripts re-inject unreliably on remote URLs. Cosmetic hiding did not
  visibly apply on m.youtube.com (Shorts tab survived — partly the
  host-filter bug above, partly this race). NEXT: reliable Android
  injection (onPageStarted-style or runtime re-injection via
  MutationObserver-boot script) before calling Android "cleaned".
- Sign-in and video playback untested; player script threw an internal
  error once (undiagnosed).


## Cleaning verified working on Android (2026-08-18, evidence runs 1-4)

Systematic-debugging outcome, evidence in spikes/logcat-evidence*.log:

1. Injection delivery was never the blocker in current Tauri (2.11.5):
   the plugin `js_init_script` runs on every page load including remote
   hosts — TS_UNIVERSAL debug markers (debug builds only) show
   enter -> matched -> style_present=true on m.youtube.com. Upstream
   issue tauri#7863 (init scripts skipped on Android remote URLs)
   evidently no longer applies. The `runCallback` TypeError seen at
   navigation is launcher-teardown noise, not the cause.
2. The real blocker was selector drift: the mobile Shorts tab is
   `div.pivot-bar-item-tab.pivot-shorts` inside
   `ytm-pivot-bar-item-renderer` — NOT a link, so the guessed
   `:has(a[href^="/shorts"])` matched 0 tabs. Fixed + [live]-tagged in
   rules/youtube.txt; android-yt-fixed.png shows the nav with only
   Home and You. Home-grid rule also live (blank body when logged out).
3. Back key: wry's own callback does canGoBack->goBack, but the
   back-stack is empty after the tile navigation, so Back fell through
   to the task beneath in recents. MainActivity.kt now overrides
   onWebViewCreate with a launcher-first callback: on a platform page
   Back walks history (or loads the launcher), on the launcher Back
   backgrounds the app. Verified on-device 2026-08-18: press 1 lands
   on the launcher, press 2 backgrounds (android-back2-press*.png).

RESOLVED (same day) — relaunch-blank root cause found by task-lifecycle
evidence (logcat-relaunch-repro.log): the launcher-Back fallback used
the default dispatcher, which FINISHES the activity while the Rust
process lives; Android then created a fresh task whose new activity
Tauri cannot attach a webview to (one Start proc, new Task, zero
TS_UNIVERSAL). Fix: moveTaskToBack(true) — verified across two
background/relaunch cycles (mtb-relaunch*.png): one process, same
task resumes, launcher renders. Follow-up fixed the same run's other
find: a second tile tap silently failed because the "youtube" window
label already exists on Android — open_platform now navigates the
existing window (desktop: focuses it).

ORIGINAL ISSUE TEXT (for the record) — relaunch after backgrounding renders blank: process
alive, activity RESUMED, WebView navigates to tauri.localhost
(TS_UNIVERSAL marker fires) but the surface stays white for 18s+
(android-back2-relaunch*.png, logcat-back2-relaunch.log; also a burst
of cr_VideoCapture getCameraCharacteristics errors — emulator has no
camera; relevance unknown). Smells like a wry Android surface
re-attach problem after activity recreate. NOT yet investigated —
next systematic pass. Repro used `monkey` LAUNCHER intent; user-path
recents-tap unverified.

## Re-tap bug — root cause + single-webview model (2026-08-18, probe runs 1-9)

Symptom: after tile -> platform -> Back, tapping any tile did nothing.
Six instrumented device runs (spikes/logcat-probe*.log) chased it:

- IPC bridge was NEVER the problem: a debug ts_ping command
  round-tripped from the restored launcher every time.
- The false lead: the click resolved "open ok" in JS with zero Rust
  log lines. Cause of the silence: an early label-reuse guard at the
  TOP of open_platform (set_focus + return Ok) sat ABOVE the debug
  eprintln, so re-tap invokes reached Rust all along and "succeeded" —
  set_focus is visually a no-op on Android. Lesson: instrument at
  function ENTRY, above every early return.
- Real defect: window-per-platform is a desktop model. On Android the
  first tap built a second webview ("youtube" label); every later tap
  focused a window that cannot come forward. CDP inspection
  (logcat-probe6, /json/list) showed the split brain: two
  tauri.localhost page targets, the visible one attached:false.

Fix (verified probe8: 6/6 taps incl. re-taps + cross-platform
Reddit/X): Android never builds or focuses platform windows —
open_platform navigates the single "main" webview in place; cosmetic
injection rides the ts-inject plugin script which fires on every page
load. Desktop keeps window-per-platform (focus if open).

Companion Kotlin fix (MainActivity): Back never history-restores INTO
the launcher — goBack() onto the custom-protocol page can revive a
back/forward-cache zombie document (visible but detached; taps land in
it) — when the back entry is tauri.localhost we loadUrl a fresh
launcher instead. History grows a couple of entries per cycle; WebView
caps the list, acceptable.

Shared-emulator gotcha for future probe runs: dev.mobile.maestro and
com.hijrifirst.app (other projects) sometimes inject input or steal
foreground. Always env-check (ps + dumpsys window) before trusting a
failed-input repro, and re-locate tiles fresh from a screencap before
every tap.
