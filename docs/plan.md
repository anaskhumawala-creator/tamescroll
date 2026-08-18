# The plan

Written 2026-08-18, after the scoping conversation that corrected the
original handoff. This supersedes §8 of CLAUDE.md (build order) and narrows
§3 (product). Mission (§1) and hard rules (§2) are unchanged.

---

## What we are building, in one paragraph

An app that opens your feeds and nothing else. It looks and feels like a
home screen — the icons you already tap, in the place you already tap them —
but what opens is the platform with its algorithmic machinery removed: no
Shorts shelf, no For You wall, no infinite home feed, no ads, no "open in
app" nags, and, for those who want it, no unguarded gaze. You stay signed
in. You keep your DMs, your subscriptions, your work accounts, the video
your friend sent you. What you lose is the part that was never yours.

## Who it is for, and the constraint that follows

Gen Z and Gen Alpha primarily, but age-independent. This audience matters
because it dictates a design constraint most tools in this space fail:

**It must not look like a parental control app.** Anything resembling Family
Link or Screen Time gets uninstalled or never installed, because it reads as
a punishment somebody else chose. The product has to feel like a tool you
picked up, not a leash you were handed. That means the launcher has to be
genuinely nice to look at, onboarding has to be under a minute, and the copy
never scolds. §2's "NO NAGS, ever" is not just about platform nags — it
applies to us.

The framing is harm reduction, not abstinence. Every competing product is
abstinence-shaped: block it, time-limit it, delete it. They fail because the
premise is false — people genuinely cannot leave. Work lives on X, family
lives on Instagram, culture lives on TikTok. We keep the access and remove
the manipulation. Nobody has built this.

---

## What we actually build — three artifacts, not a product suite

**1. The rules list.** A plain text file in EasyList syntax. It removes
feeds, Shorts, recommendation walls and nags across the platforms. It is the
shared artifact §4 describes, and it works two ways: our app consumes it,
*and* anyone can subscribe to it directly in Brave, uBlock Origin or AdGuard
without installing anything of ours. It ships value before the app exists.

**2. The app.** A thin shell over the OS webview, one codebase for Windows,
macOS, Linux, Android and iOS. It is a launcher plus cleaned web views. It
embeds an existing blocking engine rather than implementing one.

**3. The playbook.** Plain-language escape guide: install, lock, hand the
passcode to someone who loves you. First-class, per §3c.

Everything else — ads, trackers, general browsing — is delegated to tools
that already exist and are already maintained by funded teams. That is the
project's philosophy, and it is also its survival strategy.

---

## Architecture decisions, locked

**Shell: Tauri v2.** One Rust codebase to all five platforms, each running on
the OS's own webview (WebView2, WKWebView, Android WebView, WebKitGTK). This
satisfies §3a's "thin shell, never fork an engine" exactly — the Chromium
treadmill that killed Kiwi Browser never touches us.

**Blocking engine: embed `adblock-rust`.** This is Brave's engine, published
as a standalone Rust library for anyone to embed. It parses EasyList syntax
including cosmetic filters and scriptlet injection. Tauri is Rust, so it
drops in. We get Brave-grade blocking inside our own app without writing or
maintaining a blocker, and without depending on the user having Brave.

**Rules format: EasyList syntax, not a bespoke JSON schema.** An earlier
analysis recommended JSON; that assumed we would write our own engine.
Embedding `adblock-rust` means the syntax is parsed for us, and the same file
works in every third-party blocker. Interoperability is free.

**Gaze module: build only where nothing exists.** HaramBlur already covers
desktop browsers and Firefox on Android, is open source, and runs on-device.
On those platforms we point at it rather than rebuild it. We build gaze
protection *inside our app*, where the gap is real — especially iOS, where
HaramBlur's own modes are limited (§6).

**Ads: not our problem.** The embedded engine handles them with the same
lists Brave uses. No scriptlet maintenance, no anti-adblock arms race, no
code of ours near the video player.

---

## Platform order, by coherence

Not all five platforms survive the treatment equally, and pretending they do
would waste the early weeks.

**YouTube first.** Removing the algorithmic feed leaves a fully useful
product: search, subscriptions, links people send you, playlists. The
hardest DOM, the best payoff, and the most-cited addiction surface.

**Reddit second.** Web works well, old.reddit is even cleaner, and the feed
removal is straightforward. Low effort, real value.

**X third.** Web client is capable, "Following" already exists as a
chronological escape hatch we can force as the default.

**Instagram fourth, partial.** Meta deliberately cripples mobile web —
messaging and posting are restricted. We should be honest in the product
about what works and what does not, rather than shipping a broken-feeling
Instagram.

**TikTok last, and possibly never.** TikTok *is* the For You feed. Remove it
and nothing remains to open. A clean TikTok may simply be "not TikTok." We
should say so plainly rather than ship an empty shell. Revisit only if a
coherent use emerges (following-only feed, search, DMs).

---

## Phases

Each phase ends with something a person can actually use. No phase is
research-only.

### Phase 0 — Decisions (this session)
Lock the name, the licence, and the repo layout. Nothing else is blocked on
anything else. See "Open decisions" below.

**Done when:** name chosen, `LICENSE` committed, `rules/` and `app/` exist.

### Phase 1 — The list, shipped standalone
Write the YouTube rules block in EasyList syntax. Host it at a stable raw
URL. Anyone can subscribe in Brave (desktop, Android, iOS), uBlock Origin or
AdGuard and immediately get a YouTube with no Shorts, no algorithmic home
feed, no nags.

Every rule carries a comment recording what it targets and how to tell it
still works — the §3 watcher cannot test rules that do not declare what
passing looks like, and retrofitting that later is the most expensive
mistake available here.

**Done when:** the owner subscribes to the URL in Brave and sees a clean
YouTube on desktop and phone. Real users can benefit from this phase with
zero further work from us.

**Why this first:** it is the shared artifact everything downstream consumes,
it validates the rules against reality before any app depends on them, and it
delivers the mission to real people in days rather than months.

### Phase 2 — Shell spike
Smallest possible Tauri v2 app: one window, one webview, YouTube loaded,
`adblock-rust` embedded and consuming the Phase 1 list. Desktop only.

This exists to answer the three questions that could invalidate the whole
architecture, before anything is built on top of it:
1. Does `adblock-rust` actually filter inside a Tauri webview?
2. Does cosmetic filtering (element hiding) apply reliably on an SPA that
   rewrites its own DOM constantly?
3. Does signing in to YouTube work, and does the session persist?

**Done when:** a Tauri window shows a clean, signed-in YouTube. If this
fails, we learn it in week one with nothing invested.

### Phase 3 — The launcher and the real app
The home screen: platform icons, tap to open, no address bar, nowhere to
wander. Add Reddit and X. Ship desktop and Android.

This is where the product becomes itself. The launcher is the behavioural
mechanism — the habit is not "watch YouTube," it is *tap the red icon*. We
do not fight the reflex, we redirect it.

**Done when:** installed on the owner's Android phone, on the home screen,
used as the daily way into all three platforms for a week.

### Phase 4 — The gaze module
On-device detection inside the app, three modes chosen once (§5). Fail-safe
ordering is mandatory: blur every image by default via injected CSS at the
earliest possible moment, then reveal what detection clears. Tauri's
initialisation scripts on remote sites are not guaranteed to run before the
page's own JavaScript, so a reveal-after-detect design would flash exactly
the thing the user is trying not to see. Blur-first makes late injection
harmless.

Surface-scoped, not blanket. Algorithmic surfaces (home, Shorts, sidebar,
end cards) are removed entirely rather than blurred — nothing to reveal.
Search and subscriptions keep blurred images with fully readable titles, so
intentional use survives and browsing-by-image does not. No hover-to-reveal
gesture: it trains the un-blur reflex the module exists to break.

**Done when:** the owner runs it in all three modes for a week without a
flash of unblurred content.

### Phase 5 — iOS (the cousin window)
Everything iOS is compressed into the few days the iPad is available (§7).
Nothing desktop-shaped may be built during that window.

Prepare beforehand: build tested on macOS, signing sorted, TestFlight ready,
a written test script for the iPad. The window is for testing and
publishing, not for discovering problems.

**Done when:** running on the iPad, signed in, feeds clean, gaze module
working, submitted with the owner's developer account.

### Phase 6 — Open it up
Public repo, the AI watcher live against the rules list, community fixes into
the same review queue, the playbook, home-screen icons, optional soft-pause
friction (§6's one-sec science).

**Localisation belongs here and is not cosmetic.** The playbook translated
into Urdu, Arabic, Hindi, Indonesian, Spanish and French reaches far more
people than any feature will, and translations are the contribution most
easily accepted from the community. App stores also allow a localised
display name and subtitle per region, so local-language framing ships
without touching the brand.

---

## Risks that could kill this, and when each gets tested

**`adblock-rust` may not integrate cleanly with Tauri's webviews.** Tested in
Phase 2, cheaply. If it fails, the fallback is per-platform interception
(Android `shouldInterceptRequest`, Windows `WebResourceRequested`, iOS
`WKContentRuleList`) — more work, still viable.

**Apple's minimum-functionality rule rejects thin website wrappers.** Our app
clears the bar on substance — launcher, filtering, on-device gaze detection
are real native features — but it must *read* as an app to a reviewer, not a
bookmark list. Must be confirmed properly before Phase 5, because the iPad
window is the only shot.

**Platforms cripple their mobile web deliberately.** Already priced into the
platform order. Instagram is the known case; watch for YouTube following.

**Login and session persistence in an embedded webview.** Tested in Phase 2.
Native autofill (§3a) is the part most likely to be fiddly.

**Solo maintainer burnout — the Kiwi Browser lesson (§1).** The entire
architecture is a defence against this: we own a text file and a thin shell,
and delegate every hard, fast-moving problem to funded teams. Phase 6 opening
the repo is the second layer.

---

## Decisions made

**Name: `tamescroll`.** Verified clear on every channel that matters —
`.com`, `.app`, `.org`, GitHub organisation, and no exact-name app in the
App Store. Chosen over `tamefeed` because it names the behaviour people
actually recognise in themselves ("doom scrolling" is the culture's own
phrase, and §1 opens with it) rather than the mechanism. "Feed" is fading
as everyday language; under-20s say scrolling. Grammatically the object of
"tame" is the scroll, not the person, so it does not read as a parental
control.

Not a globally translatable name, and that is accepted: Brave, Signal,
Proton and Telegram are all English words with global reach, because a
brand is learned as a token rather than parsed. The globalisation effort
belongs in the playbook translations and UI strings, not the name.

**Licence: MPL-2.0 for code, CC0 for rules data.** MPL is file-level
copyleft — our files stay open even if someone builds a product around
them — and it is the same licence as `adblock-rust`, so embedding is
frictionless. Critically it does *not* conflict with App Store terms the
way GPL and AGPL do; that conflict pulled VLC from the store in 2011 and
would foreclose iOS. Rules data is CC0 so Brave, uBlock Origin and AdGuard
can absorb it freely, which spreads the mission further than our own app
can.

A contributor agreement is in place from the first outside contribution
(`CONTRIBUTING.md`), preserving the ability to relicense later. Without it
a single un-relicensable patch could permanently block a change the
project's survival depends on.

### Keeping the name reversible

The name is cheap to change everywhere except two places, so both are
designed around it now:

- **App bundle identifier** is permanent once published to either store —
  changing it means a new listing and every user reinstalling. It is
  invisible to users, so it is treated as permanent infrastructure rather
  than branding, and the display name is free to change on top of it.
- **The rules list URL** is cached by everyone subscribed to it in Brave.
  It is served from a path we control that can redirect indefinitely.

Everywhere else the name lives in a single configuration constant and is
never hardcoded. Practical effect: renaming is free until first store
submission (Phase 5), and even then only the hidden identifier locks.

## Still open

**Whether TikTok ships at all.** See platform order.

## What this plan deliberately does not do

No desktop browser extension. No general-purpose browsing. No browser engine
fork. No ad-blocking implementation of our own. No account system, no
telemetry, no sync, no server beyond a static file host for the rules list.
Each of these was considered and cut, and each cut is what makes a solo
maintainer with a day job able to keep this alive.
