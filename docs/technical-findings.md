# Technical findings

Verified 2026-08-18 against primary sources — Chrome extension documentation,
Brave's `adblock-rust`, Apple's App Store guidelines, Tauri v2 docs and
uBlock Origin's YouTube filters. Facts only. The decisions that follow from
them live in `plan.md`.

An earlier version of this file (`setup-analysis.md`, commit `c43c3b4`)
reasoned from the assumption that the product was a browser extension. That
assumption was wrong — the product is the app. The findings below are the
part that survived; the recommendations built on the wrong frame were
dropped, and `plan.md` replaces them.

---

## Manifest V3 constrains extensions only

MV3 prohibits remotely hosted code: "all of your extension's logic must be
part of the extension package. You can no longer load and execute remotely
hosted files." Fetching *data* at runtime is explicitly permitted — a remote
JSON configuration is the documented supported pattern.

**Relevance to us:** none, directly. We are not shipping an extension. This
matters only as the reason a Chrome extension was the wrong vehicle, and as
context for why uBlock Origin's Chrome build is weaker than its Firefox one.

## YouTube ads cannot be blocked by network rules

Ad segments are served from the same origin as the video content, and the ad
*metadata* arrives inside the player response JSON. uBlock Origin removes
them with scriptlets that hook `JSON.parse` and fetch responses to prune
`adPlacements`, `playerAds` and `adSlots` out of `ytInitialPlayerResponse`
before the player reads it.

**Relevance to us:** this is why we embed an engine rather than write one.
Those scriptlets are maintained continuously by uBlock and Brave against
active detection — uBlock's tracker carries a running stream of
`youtube.com: detection` reports. Embedding `adblock-rust` means we inherit
that work instead of repeating it.

## Brave's blocking is native, and available as a library

Brave Shields is not an extension. It is `adblock-rust`, a Rust engine
compiled into the browser, sitting below the extension layer with full
request visibility and native CSS and scriptlet injection, fed by lists
Brave updates from its own servers. It parses the same EasyList and
EasyPrivacy syntax uBlock Origin uses, including cosmetic filters, and uses
uBlock-compatible resources for scriptlet injection.

Critically, it is published as a standalone library "for anyone to use."

**Relevance to us:** this is the core architectural unlock. Tauri is Rust, so
Brave's engine drops into our shell. We get Brave-grade blocking inside our
own app without depending on the user running Brave.

## Brave supports custom filter list subscriptions on all platforms

Filter lists can be subscribed to by raw URL (a `.txt`) and are refreshed
automatically in the background, weekly. Managed at
`brave://settings/shields/filters` on desktop and via Shields settings on
Android.

**Unverified:** iOS appears to expose *custom filters* (manually entered
rules) but URL-based list subscription support is less clear — there is an
open request against `brave-ios` for it. Confirm before promising iOS users
an auto-updating list.

**Relevance to us:** Phase 1 can deliver real value to real people with no
app at all. Anyone on Brave subscribes to our URL and gets clean feeds today.

## Tauri v2 initialisation scripts are not guaranteed to run first on remote URLs

For remote URLs, Tauri uses `onPageStarted`, which is not guaranteed to run
before other scripts on the page. On Android, where
`addDocumentStartJavaScript` is unavailable, initialisation scripts are
prepended to the document head — and that implementation only covers custom
protocol URLs, not remote sites.

**Relevance to us:** harmless for hiding feed elements, which can be applied
late and re-applied on mutation. Not harmless for the gaze module, where late
injection means a visible flash of the content being guarded against. Hence
the fail-safe ordering in `plan.md` Phase 4: blanket-blur first, reveal after
detection.

## Apple's rules on remote scripts and on wrappers

**Guideline 2.5.2** — apps "may not download, install, or execute code which
introduces or changes features or functionality of the app." Web content
inside a WebView is generally fine; the flagged risk is remote scripts that
reach native bridges to invoke device features. Our injected scripts modify
third-party *pages* and touch no native bridge, which sits on the safe side —
but reviewers apply this inconsistently, so treat remotely updated scripts on
iOS as probably acceptable rather than proven.

**Minimum functionality** — Apple rejects apps that are thin wrappers around
a website. Our app clears this on substance (launcher, embedded filtering
engine, on-device gaze detection are real native features), but it must
present as an app rather than a bookmark list. Confirm properly before the
iOS window; it is the single largest distribution risk.

## Chrome's `ExtensionInstallForcelist` (retained for the playbook)

The enterprise policy installs an extension users "can't uninstall or turn
off" — the Remove button is greyed out or absent, including from the
right-click menu. On Windows it is a registry key under
`HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome`. Setting it requires
local administrator rights, which maps onto §2's ring 3: the trusted person
holds the admin password the way they hold the Screen Time passcode. Anyone
with admin can undo it — a ring, not a wall.

**Relevance to us:** not for our app, but a genuinely useful playbook page for
users who browse the open web in Chrome or Brave alongside our app, paired
with HaramBlur or uBlock Origin.

## HaramBlur is a viable base

Open source, on-device, uses the Human library for face detection and
`nsfwjs` for NSFW classification. Ships for Chrome and for Firefox including
Firefox on Android. Contributions accepted upstream.

**Unverified:** the licence. Must be checked before any code is derived from
it, since it constrains our own licence choice.

---

## Still to verify

- Brave iOS: URL-based filter list subscription, or manual custom filters only.
- HaramBlur's licence.
- Apple minimum-functionality risk, properly, before the iOS window.
- Whether `adblock-rust`'s cosmetic filtering can be driven from Tauri's
  webviews on each platform, or whether per-platform interception is needed.
