# Google sign-in inside our WebView — what is actually possible in 2026

**Question (owner, verbatim):** "can't we have the sign in page automatically
show the existing accounts on the device so its easier for me to sign and
YouTube". Today he types his Google email + password by hand inside our
WebView. Chrome and the real YouTube app list device accounts and it is one
tap.

**Scope of this doc:** establish what is true in 2026, with citations, and
whether any *legitimate* path (respecting our hard rules) gets closer to
one-tap. Read-only research; nothing built, nothing signed into.

**Hard rules this is measured against** (`CLAUDE.md`): BLOCK-ONLY — never
impersonate/repackage a platform, never intercept credentials or scrape a
token out of another app; we must NEVER handle, store, proxy or see the
password; free/OSS, no Google partner agreement we cannot get; and nothing
may break our three load-bearing mechanisms — **page-load injection**, the
**adblock request interception** (`shouldInterceptRequest` in
`MainActivity.kt`), and the **gaze inference bundle** (served as a
same-origin synthetic resource, also via `shouldInterceptRequest`).

---

## TL;DR

The device-account chooser is unreachable for us by any legitimate means —
every mechanism that ever produced it is now either a **credential/token-theft
technique** (disqualified by BLOCK-ONLY and by Play policy) or **destroys the
WebView we depend on**. The realistic, honest, rule-respecting win is
**Android Autofill (Google Password Manager) offering his saved google.com
login inside our WebView** — that turns two hand-typed fields into a tap on a
suggestion chip, and it never lets our code touch the password. Plus: once he
has signed in **once**, a **second** Google account is genuinely one tap,
because YouTube's own account switcher reads sessions already in *our* cookie
jar.

---

## Option 1 — AccountManager `weblogin:` / `SID`/`LSID` → web session cookie

**What it was.** Android's `AccountManager` could mint a special `weblogin:`
token that redeems into a Google *web session cookie*, and the stock Android
Browser used exactly this to auto-sign-in to Google sites with the device's
accounts. Documented by Nelenkov (2012). ([nelenkov.blogspot.com, 2012-11][1])

**Why it is gone for us.**

- It was publicly demonstrated as **"Google's Skeleton Key"** at DEF CON 21
  (2013): any app holding `GET_ACCOUNTS` could obtain a `weblogin:` token and
  reconstruct a full Google web session for *any* Google property — the exact
  abuse Google then spent a decade closing. ([DEF CON 21, Craig Young][2])
- `GoogleAuthUtil.getToken` (the Play-services door to these tokens) is
  **deprecated**; Google's own guidance is "you should NOT use
  `GoogleAuthUtil.getToken`" and to move to Credential Manager / Authorization
  Client. ([developers.google.com GoogleAuthUtil ref][3];
  [migration guide][4])
- On **Android 8+ (API 26)** `GET_ACCOUNTS` no longer grants account
  visibility. Visibility is controlled by the **authenticator** (Google) via
  `setAccountVisibility`; by default a third-party app sees only accounts
  whose authenticator **signature matches** it. A non-Google-signed app is not
  shown the Google accounts at all. ([Microsoft Learn / AccountManager
  GetAccounts, reflecting AOSP][5])
- The surviving way to turn Google auth tokens back into web cookies is the
  undocumented **MultiLogin / MergeSession** endpoint — which in 2023–2024
  became the mechanism of **infostealer malware** ("revive cookies"), and
  which Google is actively killing with Device Bound Session Credentials
  (DBSC). ([CloudSEK 2023][6]; [BleepingComputer 2024-01][7])

**Rule check.** This is credential/token extraction from the device's Google
session — precisely what BLOCK-ONLY forbids ("credential interception,
scraping a token out of another app"), and it is a Play-policy and
security-red-line technique. Even if it were reachable, we could not ship it.

**Verdict: DEAD.** Disqualified by our hard rules *and* closed off by the
platform (account visibility + deprecation + anti-malware hardening). Do not
pursue.

---

## Option 2 — Credential Manager (`androidx.credentials`) / Sign in with Google

**What it returns.** A **Google ID token** (a signed JWT asserting identity to
*your* backend), or — for the WebView variant — **passkey/password**
credentials for **a website you own**, gated behind **Digital Asset Links**
proving you control that domain. ([Credential Manager SIWG impl][8];
[Credential Manager for WebView][9])

**Can any of it become a youtube.com cookie? No.**

- The ID token is an *identity assertion scoped to our app's client ID*. It is
  designed to be POSTed to *our* server to establish *our* session. There is
  no Google API that exchanges it for a `.youtube.com` / `.google.com` login
  cookie, and there could not be — that would be a session-minting oracle.
- The WebView passkey/password path (`setWebAuthenticationSupport`,
  `WEB_AUTHENTICATION_SUPPORT_FOR_APP`) is explicitly for **the domain the app
  owns via Digital Asset Links**. We do not (and must not) own youtube.com, so
  it will not fill or mint anything for YouTube. ([Credential Manager for
  WebView][9])

**Rule check.** Nothing here touches the password (good), but it produces no
YouTube session, so it does not solve the problem.

**Verdict: DEAD** for the stated goal. Correctly returns an app-scoped
identity, not a platform cookie session.

---

## Option 3 — Chrome Custom Tabs / Trusted Web Activity (shared cookie jar)

**What is true.** A **Custom Tab (CCT) and a TWA share Chrome's cookie jar and
profile** — that is their whole selling point, and it is why the user is
already signed in there. ([Chrome for Developers, Custom Tabs overview][10])

**But the host app cannot get anything back out of it.** Chromium's own
security FAQ is explicit that the embedding app is **blocked from** "history
from past sessions, cookies, passwords, full DOM access, arbitrary script
injection, network request interception, etc." The app may see the current URL
only after an explicit user tap, plus low-entropy engagement signals and
(with Digital Asset Links) postMessage. ([Chromium Custom Tabs security
FAQ][11])

So a CCT can show his device accounts and let him sign in — but the resulting
cookies stay in **Chrome's** jar, invisible and unextractable to our WebView.
Owner's claim (d) is **correct**.

**What about hosting the platform itself in a TWA?** A TWA *does* run the site
in Chrome with the shared cookie jar, so sign-in would be one tap. But a TWA is
Chrome, not a WebView we control: **"a native app doesn't have any access to
the web state of the content displayed in the TWA"** — no JS injection, no
request interception, no DOM. ([TWA developer intro / Ionic feature request
thread][12])

Against our three load-bearing mechanisms, a TWA loses **all three**:

| Mechanism | Survives in a TWA? |
|---|---|
| Page-load injection (our cleaning CSS/JS, gaze boot) | **No** — no script injection into Chrome content |
| Adblock `shouldInterceptRequest` | **No** — no network interception in a TWA |
| Gaze inference bundle (same-origin synthetic resource) | **No** — we cannot serve a synthetic resource into Chrome |

A TWA would trade the *entire product* for a one-tap login. That is not a
trade — it is deleting the app.

**Verdict:**
- CCT for login handoff: **DEAD** (cookies unextractable; would also mean two
  cookie jars and a broken session in our WebView).
- TWA as the platform host: **DEAD** — kills injection, blocking, and gaze
  simultaneously.

---

## Option 4 — `disallowed_useragent` — the owner's claim (b) is being MISAPPLIED

**Precise scope.** The `disallowed_useragent` block applies to **Google's
OAuth 2.0 *authorization* endpoint** (the `accounts.google.com/o/oauth2/...`
consent flow) when it is loaded in an embedded WebView. Enforcement began
**Sept 30, 2021**. It is *not* a blanket ban on all Google account activity in
a WebView. ([Google Developers Blog, embedded-webview OAuth changes][13])

**This is why his manual login works today.** A plain email/password
`ServiceLogin` at `accounts.google.com` is **not** the OAuth authorization
endpoint, so it is **not** what `disallowed_useragent` rejects — which is
exactly why he can sign in by hand in our WebView right now. (Google *may*
still throw "This browser or app may not be secure" heuristically on some
WebView logins, but he is evidently getting through, matching the fact that
the hard block is scoped to the OAuth endpoint.) ([Grayjay issue #2789,
YouTube "may not be secure" in WebView][14])

**Correction to the reasoning I gave the owner:** I implied Google "refuses
OAuth inside embedded WebViews" as if that were *why* one-tap is impossible.
It is not the operative barrier here — his flow is not OAuth, and it works.
`disallowed_useragent` only rules out the idea of us running a *"Sign in with
Google" OAuth consent* screen inside our WebView; it says nothing about the
password login he already uses. The real barrier to one-tap is Options 1–3,
not this.

**Verdict:** Not a blocker for the existing manual login; only rules out an
in-WebView OAuth consent flow (which we were not going to build anyway).

---

## Option 5 — Android Autofill / Google Password Manager in our WebView (THE FIX)

**What is true.** WebView is wired into the **Android Autofill framework since
API 26 (Android 8)** and, when the device has a WebView/Chrome of a modern
version, **WebView detects fillable fields and raises autofill requests
automatically** — the framework is on by default, the app does not have to
build an autofill client. WebView reports the **page's web domain** to the
autofill service so it offers **domain-matched** credentials, and Google
Password Manager warns if the domain may not belong to the hosting app but
**still offers to fill** for the real domain (here `accounts.google.com`).
([Android Developers Blog, Autofill][15]; [caniwebview — Autofill][16];
academic analysis of WebView autofill domain handling][17])

**What this gets him.** When he taps the Google email field in our WebView,
Google Password Manager surfaces his saved google.com login as a suggestion
chip; one tap fills email (and then password), he confirms with his device
biometric/PIN. It is not the device *account chooser*, but it is the same
practical outcome: **no hand-typing**, one or two taps. Critically, **our code
never sees the password** — the autofill service injects it directly into the
field. This respects every hard rule and breaks none of our three mechanisms
(autofill is orthogonal to injection, request blocking, and gaze).

**Is it already working for him?** It should be, on API 26+ with an autofill
service selected (Settings → Passwords & accounts → Autofill service =
Google) and a saved google.com credential. If it is **not** offering, the
usual breakers are:

1. No autofill service selected on the device, or no saved google.com
   credential in Google Password Manager (device-side, not ours).
2. An outdated Android System WebView (autofill parsing lives in WebView; very
   old WebView degrades it).
3. An ancestor view marked `importantForAutofill="no"`, or the field never
   getting an autofill context.

**The one code lever on our side** (low-risk, in `onWebViewCreate`,
`MainActivity.kt`), if device-side checks pass and it still does not offer:

```kotlin
// API 26+; make the WebView explicitly autofill-eligible in case an
// ancestor or theme suppressed it.
if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
  webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
}
```

Nothing else in our current `MainActivity.kt` should be disabling autofill:
the WebViewClient/WebChromeClient wrappers delegate fully and do not touch
autofill, and the edge-to-edge inset/IME listener consumes insets but does not
suppress the autofill popup. **Unverified on device** — this is read-only
research, no build/run — so the honest status is: autofill is very likely
already functional and the fix (if any) is device-side settings, with the
`importantForAutofill` line as the only app-side insurance. Confirming
requires his phone.

**Verdict: VIABLE — this is the recommendation.** Legitimate, password-safe,
breaks none of our mechanisms. Cost: ~1 line of defensive code plus a
device-side check; possibly **zero code** if it already offers.

---

## Option 6 — Multi-account: second sign-in is genuinely one tap (free)

Once he has signed into **one** Google account in our WebView, that session
lives in **our** cookie jar. YouTube/Google's **own account switcher**
(the avatar menu → "Switch account", backed by `accounts.google.com`'s
account chooser and the `authuser=`/`SESSION_INDEX` multi-session cookies)
lists every session already in that jar and switches with one tap — no
re-login. ([YouTube account-switching behavior / account chooser][18])

So the "list existing accounts" experience *does* exist for us — but only for
accounts already signed into our jar, not for device accounts we were never
given. First account: autofill-assisted (Option 5). Every account after:
one tap. **Verdict: VIABLE, already available, no work needed** beyond making
sure we do not block `accounts.google.com` account-chooser requests (we do not
— it is not an ad host).

---

## Recommendation

1. **Ship/confirm Autofill (Option 5).** This is the real answer to his ask.
   Verify on his device that Google is the selected autofill service and a
   google.com credential is saved; add the one-line `importantForAutofill =
   IMPORTANT_FOR_AUTOFILL_YES` as insurance. Expect the saved-login suggestion
   chip to appear on the Google sign-in field. No password ever passes through
   our code.
2. **Tell him the device-account chooser is genuinely off-limits** — not out
   of caution, but because every path to it is now either malware-class token
   theft (Option 1) or replaces our controllable WebView with Chrome and
   deletes injection + blocking + gaze (Option 3/TWA). This is a platform
   wall, not a gap in our effort.
3. **Second and later accounts are already one tap** (Option 6) via YouTube's
   own switcher, once the first is in.

---

## Where my original answer to the owner was right vs wrong

| Claim I gave | Verdict | Evidence |
|---|---|---|
| (a) WebView is sandboxed from AccountManager; only Chrome/Google-signed apps can read it | **Survives in effect, imprecise in mechanism** | It is not "WebView sandboxing" — the app *can* call AccountManager. The real barrier is Android-8+ **account visibility** (Google's authenticator only exposes accounts to signature-matched apps) **plus** the `weblogin:` cookie path being a disqualified token-theft technique. Right conclusion, wrong reason. [2][3][5] |
| (b) Google refuses OAuth inside embedded WebViews (`disallowed_useragent`), so sign-in is blocked | **Being MISAPPLIED** | `disallowed_useragent` blocks only Google's **OAuth authorization endpoint** in a WebView, not the plain password `ServiceLogin` he actually uses — which is exactly why his manual login works today. This is not the barrier to one-tap. [13][14] |
| (c) Credential Manager returns an app-scoped ID token that cannot become a youtube.com cookie | **Fully correct** | ID token is scoped to our client ID for our backend; WebView passkey path is gated to a domain we own via Digital Asset Links. No cookie-minting path exists. [8][9] |
| (d) Custom Tab cookies live in Chrome's jar, not our WebView | **Fully correct** | Chromium security FAQ: the embedding app is explicitly blocked from cookies/DOM/script/network in a CCT; TWA shares the jar but forbids all web-state access. [10][11][12] |

---

## Sources

[1]: https://nelenkov.blogspot.com/2012/11/sso-using-account-manager.html "Nelenkov — Single sign-on to Google sites using AccountManager (2012-11)"
[2]: https://www.defcon.org/images/defcon-21/dc-21-presentations/Young/DEFCON-21-Young-Google-Skeleton-Key-Updated.pdf "Craig Young — Android weblogin: Google's Skeleton Key, DEF CON 21 (2013)"
[3]: https://developers.google.com/android/reference/com/google/android/gms/auth/GoogleAuthUtil "GoogleAuthUtil reference — deprecated; use Credential Manager (accessed 2026-08-28)"
[4]: https://developers.google.com/identity/sign-in/android/migration-guide "Migrate from GoogleAuthUtil and Plus.API (accessed 2026-08-28)"
[5]: https://learn.microsoft.com/en-us/dotnet/api/android.accounts.accountmanager.getaccounts?view=net-android-35.0 "AccountManager.GetAccounts — Android 8+ account visibility rules (accessed 2026-08-28)"
[6]: https://www.cloudsek.com/blog/compromising-google-accounts-malwares-exploiting-undocumented-oauth2-functionality-for-session-hijacking "CloudSEK — MultiLogin/MergeSession cookie regeneration abuse (2023)"
[7]: https://www.bleepingcomputer.com/news/security/malware-abuses-google-oauth-endpoint-to-revive-cookies-hijack-accounts/ "BleepingComputer — Malware abuses Google OAuth endpoint to revive cookies (2024-01)"
[8]: https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation "Implement Sign in with Google — Credential Manager (accessed 2026-08-28)"
[9]: https://developer.android.com/identity/sign-in/credential-manager-webview "Credential Manager for WebView — passkeys/passwords for a domain you own (accessed 2026-08-28)"
[10]: https://developer.chrome.com/docs/android/custom-tabs "Overview of Android Custom Tabs — shared cookie jar (accessed 2026-08-28)"
[11]: https://chromium.googlesource.com/chromium/src/+/refs/tags/125.0.6422.16/docs/security/custom-tabs-faq.md "Chromium — Custom Tabs Security FAQ (embedder blocked from cookies/DOM/script/network)"
[12]: https://github.com/ionic-team/ionic-framework/issues/17766 "Ionic #17766 — TWA gives no access to web state (no JS injection / no interception)"
[13]: https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/ "Google Developers Blog — disallowed_useragent scoped to the OAuth 2.0 authorization endpoint (enforced 2021-09-30)"
[14]: https://github.com/futo-org/grayjay-android/issues/2789 "Grayjay #2789 — YouTube 'This browser or app may not be secure' in WebView"
[15]: https://android-developers.googleblog.com/2017/11/getting-your-android-app-ready-for.html "Android Developers Blog — Getting your app ready for Autofill (framework since API 26)"
[16]: https://caniwebview.com/features/autofill/ "caniwebview — WebView relies on the Android Autofill framework"
[17]: https://arxiv.org/pdf/2104.10017 "A Security Analysis of Autofill on iOS and Android — WebView domain-matched filling"
[18]: https://www.clrn.org/can%CA%BCt-switch-youtube-accounts-browser/ "YouTube account switching relies on session cookies already in the jar (accessed 2026-08-28)"
