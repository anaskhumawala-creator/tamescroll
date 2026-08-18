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
