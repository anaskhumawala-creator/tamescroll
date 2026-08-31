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

---

# Round 2 — pre-build research (2026-08-18)

Three parallel research passes run before writing the app. Sources checked
against Tauri v2 docs, wry/Tauri issue trackers, the `adblock` crate
source at v0.13.2, Apple's review guidelines and live App Store listings.

## Network blocking is not reachable through Tauri's public API

`WebviewBuilder::on_web_resource_request` only fires for the `tauri`
protocol, not remote `https://` navigations. `on_navigation` can cancel a
top-level navigation but never sees sub-resources, so it cannot do
per-request filtering. wry issue #1087 (open since Nov 2023) confirms no
general request-interception API exists.

Every platform *can* do it natively — Windows via WebView2's
`WebResourceRequested` COM event, Apple via `WKContentRuleList`, Android
via `WebViewClient.shouldInterceptRequest` — but each needs native code
below Tauri. `Bushido` (a Tauri v2 browser) does exactly this via WebView2
COM and is Windows-only as a result.

**Consequence: cosmetic filtering is the only cross-platform mechanism we
get for free.** This costs us almost nothing, because the plan already
delegates ads and trackers and keeps our own scope to feeds, Shorts and
recommendation surfaces — all of which are cosmetic. It does mean the app
cannot block ads itself on day one. Users who want ads gone use Brave or
uBlock for general browsing, exactly as the playbook already says.

The `adblock` crate does expose `FilterSet::into_content_blocking`, which
emits Safari content-blocker JSON — the path to real network blocking on
iOS and macOS later. Output fidelity unverified; WKContentRuleList caps
around 150k rules and supports a much smaller grammar than EasyList.

## The `adblock` crate API, as actually built against

Constructor is `Engine::new_with_filter_set(FilterSet)`; `FilterSet::
add_filter_list` takes an owned `String`. Cosmetic results come from
`engine.url_cosmetic_resources(url)` returning `UrlSpecificResources`.

There is no `style_selectors` field. `:style()` rules arrive inside
`procedural_actions` as JSON-encoded `ProceduralOrActionFilter`, and
`ProceduralOrActionFilter::as_css()` converts the ones expressible in
plain CSS into a `(selector, style)` pair. Filters needing real procedural
evaluation return `None` and must be skipped unless a JS-side evaluator
exists.

`:style()` is supported. `:has()` is passed through as native CSS, which
modern engines implement, so our `:has()` rules work. `:has-text()` and
`:matches-path()` are supported as procedural operators, though Brave has
a reported `:matches-path` divergence from uBlock Origin — avoid it.

## SPA navigation must be handled in JavaScript, not Rust

`on_page_load` does not reliably fire for remote pages (tauri #4037, open)
and neither it nor `on_navigation` fires on `history.pushState`. YouTube
navigates that way constantly. Re-application therefore has to live in the
injected script, patching `pushState`/`replaceState` and listening for
`popstate`. This is what the app does.

`initialization_script` gives `document_start` timing on desktop. On
Android, timing is explicitly not guaranteed to precede page scripts.

## Google sign-in in embedded webviews — needs testing, not assumption

Google returns `disallowed_useragent` for sign-in attempts from user
agents it identifies as embedded webviews, enforced since 2021 and
tightened in 2023. A Tauri project (Pake) reports exactly this failure.

**This is reported as a blocker but has not been tested for our case, and
the detail matters.** Detection is largely user-agent based, and the
giveaway markers differ per platform — Android WebView appends `; wv)` to
its UA, while Windows WebView2 presents an Edge-like UA that is difficult
to distinguish from the real browser. So desktop may well pass untouched
while Android needs a user-agent override, which
`WebviewWindowBuilder::user_agent()` supports.

Test this empirically before redesigning around it. If sign-in genuinely
cannot work, the fallback options are, in order of preference: override
the user agent; accept that Google sign-in escapes to the system browser
once per session; or ship logged-out YouTube, which loses subscriptions
and therefore most of the "keep what is yours" promise.

Reddit and X are not subject to Google's policy and were not tested.

## Store distribution — precedent exists, one clause is the risk

Apple's minimum-functionality rule (4.2) rejects bare website wrappers,
but **talavo, SwizzTube and CleanTube are live today** doing precisely
what we do: WKWebView plus CSS rules stripping ads and Shorts. They ship
under Utilities, not a browser category, and lead with native features.
Covering four platforms rather than one strengthens the case.

The real exposure is **guideline 5.2.2**: if an app displays content from
a third-party service, the developer must be "specifically permitted" to
do so and must provide authorisation on request. No such permission exists
from YouTube. General browsers escape this in practice because they render
the open web generically rather than targeting a named service — a
distinction Apple applies but has never written down.

ProTube was pulled in 2017 after direct complaints from Google, over
background playback and audio-only mode. Those are paid-feature unlocks,
which §2 already forbids us from building. Staying inside that rule is
what keeps us unlike ProTube.

Ad blocking itself: VPN and root-certificate blockers were banned in 2017;
Safari content-blocker extensions are explicitly fine; in-app webview CSS
injection is a third lane with no guideline either way, currently
tolerated. Legally, the German Federal Supreme Court settled in 2018 that
ad blocking is not unfair competition, but a separate copyright theory
about DOM modification was revived in July 2025 and is unresolved. No US
case law found.

## Still to verify

- Whether Google sign-in actually works in our webviews, per platform.
- Whether Tauri v2's Android runtime allows wrapping the `WebViewClient`
  wry installs, which would unlock network blocking there.
- `FilterSet::into_content_blocking` output quality for iOS.
- Google Play's stance on multi-site wrapper apps — no precedent found.

## A hit test cannot see a `pointer-events: none` overlay (2026-08-31)

`document.elementsFromPoint` is specified to skip elements that are not
hit-testable, and every blur patch this app draws is
`pointer-events: none` — deliberately, so it never eats a tap meant for
the page underneath.

**This invalidated every "the patch is not on top" measurement in the
repo.** All of them asked a hit test about an element the hit test is
required to ignore:

- 2026-08-30, 232 patch samples, "0 escapes"
- 2026-08-30, 900 in-player hit-tests, "0 patches on top"
- 2026-08-30, `probe_patch_over_player.py`, eight walk-under samples,
  "the player wins elementsFromPoint every time"

All three reported the only answer they could ever have produced. The
owner reported a blur painting over his video three times across three
sessions and was told each time that it could not be reproduced.

**Re-measured with hit testing enabled on the probe's own patch** (paint
order and hit order follow the same tree order, so this changes what can
be observed and not what is painted), on a live m.youtube watch page
with the video playing: the patch came back at index **0** and the
player at index **1** — the patch is on top of the playing video.

Two consequences worth keeping:

1. **A probe that hit-tests one of our overlays must set
   `pointerEvents = 'auto'` on it first**, or it is measuring nothing.
   `occluderBottom` is unaffected: it hit-tests to find the *occluder*,
   which is the page's own chrome and hit-testable.
2. **The cause was a stacking assumption, not geometry.** makeOverlay
   picked `z-index: 2` to sit "above the <img> inside the thumbnail's own
   stacking context" — but `position: relative` with `z-index: auto` does
   not create a stacking context, and measured on the live page there
   were **zero** stacking contexts between the patch and the root. So the
   patch's z-index 2 and the sticky player's z-index 2 were siblings in
   the root stacking context, where DOM order decides, and
   `#player-container-id` is a child of `<body>` while the
   recommendations come after it. Fixed by putting `isolation: isolate`
   on the host, which makes the original comment's assumption true.

## Hiding a shelf costs YouTube's lazy loader, so it costs us nothing (2026-08-31)

We hide feed shelves on home, and the obvious worry was that the ~4-14
thumbnails inside a hidden shelf were still being judged -- `tagImage`
gates only on `naturalWidth`, and there is no visibility check anywhere
in the queue path or the drain.

MEASURED on the emulator, m.youtube home, feed Shown and `home_shelves`
hidden: the hidden `ytm-rich-section-renderer` holds **4 `<img>`, 0 of
them with a `src`, 0 loaded, 0 at or above the 48px floor**. YouTube
lazy-loads thumbnails, and an image under a `display: none` ancestor
never enters the viewport, so its loader never fires. It has no
`naturalWidth`, so `tagImage` never queues it.

CONSEQUENCE: a visibility gate in the image pipeline would buy nothing,
and it would cost a computed-style read per tag. Do not add one. Every
`display: none` rule we ship already removes its own inference.

## `isolation: isolate` on a patch host traps nothing on a feed (2026-08-31)

`resolveHost` writes `isolation: isolate` on every patch host, which is
a live mutation on YouTube's own element: anything inside that relied on
escaping to the root stacking context can no longer do so.

MEASURED across a scrolled m.youtube search feed and a playing watch
page, 19 candidate hosts: **0 feed hosts contain a positioned descendant
that paints outside the host's own box.** The ONE host that does -- 39
children, a descendant at z-index 41 escaping 15px -- is the fixed top
bar, which hosts the account avatar. The write now refuses a
`position: fixed` host for that reason; a fixed bar already paints above
the scrolled player, so a patch inside it has nothing to win by
escaping. VERIFIED on a built APK: 13 hosts, 7 isolated, 1 fixed host,
**0 fixed hosts isolated**.

## The occluder clamp cannot see the sticky player, and it must not (2026-08-31)

The clamp added in 1045 samples `elementsFromPoint` once, at the top row
of the image that is still on screen: `x = centre`, `y = max(1, top+1)`.
On m.youtube's WATCH page that point is at y=1, and the sticky player
occupies 48..279 — so the sample is always ABOVE the player and can
never find it. MEASURED, four independent scroll positions with a patch
riding up into the player's band: `occluderBottom` returns 0 every time,
and its reason is always the same — `our image on top: IMG.ytCoreImageHost`.

**That answer is correct, and firing the clamp there would be a bug.**
`ytm-mobile-topbar-renderer` is present and `position: fixed` at
[0,0,412,48], but while the watch page is scrolled it is not
hit-testable: at y=1, 10, 30 and 47 the top hit is our own thumbnail.
So the strip 0..48 genuinely shows the scrolled feed. Clamping the patch
top to the player's bottom (279) would leave that visible strip with no
patch and no chrome over it — an exposure, in exchange for nothing.

What keeps the patch off the video in the 48..279 band is the
`isolation: isolate` write from 1055, not the clamp. MEASURED over 165
patch samples on a playing watch page, 3 of which overlapped the band:
**0 where the patch outranks the player** (patch at stack index 5-6,
player at 0).

CONSEQUENCE, and it is the reason this is written down: in that band the
isolate write is the ONLY protection, and `resolveHost` deliberately
skips it when the host is `position: fixed`. Every recommendation host
measured is `relative` (loop 6: 0 fixed feed hosts, and the one fixed
host is the top bar, which paints above the player anyway). If a fixed
feed host ever appears, the patch in that band has nothing holding it.

Loop 8's "0 of 170 unclipped above the bar" was measured on SEARCH,
where the bar IS hit-testable. It does not transfer to watch.

## A `display: none` overlay is still a patch element, and 67 probes count it (2026-09-01)

Same class as the `pointer-events: none` retraction above: an instrument
answering the only question it could ever have answered.

`video-region.mjs` sets `display: none` on an overlay in two places — the
video rect measured zero, and the clip fell entirely outside the picture
— and **leaves the element in the DOM and in `entry.tracks`**. So
`document.querySelectorAll('.ts-gaze-vregion-host').length` counts a
patch that paints nothing, and `__TS_GAZE_VTRACKS` reports its box. Both
of the sources every patch probe in this repo reads from.

**IT BIT A REAL MEASUREMENT AND THE NUMBER LOOKED LIKE A DEFECT.**
probe_mini_land_live reported a shortfall of **6.3673 video-heights**
with a patch outside the video box during the miniplayer restore, the
SAME float on two independent runs — which reads exactly like a
deterministic geometry bug. It is arithmetic on a hidden element:
`getBoundingClientRect()` on a `display: none` node is 0x0 at the
origin, and normalizing that against a parked video at (169, 697) 231x130
gives `d[3] = (0 - 697) / 130 = -5.3615`, so a track whose padded `y2` is
1.0058 yields `1.0058 + 5.3615 = 6.3673`. Exact, to four decimals.

A second instrument written to log RAW VIEWPORT PIXELS
(probe_mini_restore.py) found **0 stray frames over 54** across the same
transition. Two instruments disagreeing is not a tie: the one that reads
raw rects wins.

**THE DIRECTION OF THE BIAS IS THE DANGEROUS ONE.** For every probe that
merely COUNTS patches, a hidden overlay inflates the count — so coverage
is overstated and an exposure is under-reported. 67 probes under
`spikes/gauntlet/` query one of the two patch classes with no `display`
check. They are not all wrong (many count only while a patch is known
live), but none of them can tell a drawn patch from a hidden one.

**RULE: any probe that counts, ranks or measures one of our patches must
filter `getComputedStyle(el).display === 'none'` and a zero-area rect
first.** `emu_cdp.VISIBLE_PATCHES_JS` is the snippet.
