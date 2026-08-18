# Setup analysis — before Phase 1

Written 2026-08-18. Verified against Chrome extension documentation, uBlock
Origin's YouTube filters, and Chrome enterprise policy docs — not from
memory. Nothing here overrides §1–§3 of CLAUDE.md (mission, hard rules,
product shape). It touches §4 (rules core) and §8 (build order), which are
engineering calls, and it resolves the three flags raised in §10.

---

## The finding that reorders everything

**Manifest V3 bans remotely hosted code.** All executable logic must ship
inside the extension package; you cannot fetch and run JavaScript from a
server. But the same rules explicitly permit fetching *data* at runtime —
"your extension loads and caches a remote configuration (for example a JSON
file) at runtime" is called out as the supported pattern.

This splits the project's survival model (§4: "fixes ship to everyone
without app updates") cleanly in two:

- **Data lane** — CSS hide selectors, network rules. Fetchable from a remote
  JSON file, applied by bundled code. Ships in minutes, no store review. The
  EasyList model works here exactly as §4 describes.
- **Code lane** — scriptlets that patch page JavaScript. Must be bundled.
  Every fix requires a store submission and review. Days, not minutes.

Everything below follows from which lane a feature lands in.

---

## 1. Strategic call: do not block YouTube ads in v1

This contradicts §8's Phase 1 line ("ads gone"). I think §8 is wrong here,
and the reason is §3's own principle.

**Why ads are the expensive surface.** YouTube ads cannot be blocked by
network rules — the video segments come from the same origin as the content,
and the ad *metadata* arrives inside the player response JSON. uBlock Origin
kills them with scriptlets that hook `JSON.parse` and fetch responses to
prune `adPlacements`, `playerAds` and `adSlots` out of
`ytInitialPlayerResponse` before YouTube's player reads it. That is code, not
a filter rule. It lands in the code lane.

So ad blocking means: (a) every fix waits on store review, (b) the fix must
run in the MAIN world at `document_start`, ahead of YouTube's own script, and
(c) it edits the exact object the video player depends on. §3 states the
governing principle: *"a wrong selector that hides the player is worse than a
missed Shorts shelf."* Ad scriptlets are the highest-blast-radius code in the
entire project — they are the thing most likely to hide the player.

Add the detection arms race. uBlock Origin's issue tracker carries a
continuous stream of `youtube.com: detection` reports — YouTube actively
detects and responds to ad blocking. That is a permanent maintenance tax paid
by a solo beginner developer.

**Why ads contribute least to the mission.** §1 is about doom scrolling. Ads
are not the addiction engine — the infinite feed is. Ads are an annoyance;
Shorts and the algorithmic home feed are the trap. Blocking ads buys the
smallest fraction of the mission for the largest fraction of the maintenance
cost and nearly all of the breakage risk.

**Recommendation.** v1 ships feed removal, Shorts removal, nag stripping and
thumbnail treatment — all data lane, all remotely updatable, none of which
can break the player. Ads become an opt-in module later, or users are pointed
at uBlock Origin for ads, which the playbook already does for general
browsing. Revisit once the rules core and the watcher loop are proven.

**Cost if this is wrong:** low and reversible. Ads slot into the same rules
file later. Nothing about v1 forecloses them.

**Consequence if v1 keeps ads:** the §3 watcher loop cannot deliver its
promise for the ad rules, because approved fixes still queue behind store
review. This is precisely why uBlock Origin Lite (the MV3 build) is less
reliable on YouTube than the classic MV2 one.

---

## 2. Build the extension as an interpreter, not as a rulebook

The decoupling in §4 is right, but it only survives MV3 if the code/data
split is architectural from the first commit.

- Bundle a **small generic engine**: fetch rules JSON, cache it, apply hide
  selectors, register network rules, re-apply on SPA navigation.
- Ship **zero YouTube-specific knowledge in the code**. Every selector, every
  URL pattern, every surface name lives in the rules file.

Test of whether it is right: adding Instagram in Phase 2 should be a rules
file edit and no code change. If it needs code, the split leaked.

For the code lane later, copy uBlock Origin's shape — a handful of generic,
parameterised scriptlets bundled once, with their *parameters* supplied by
the rules data. That keeps even ad maintenance mostly data-shaped. Treat
remote parameters as a grey area with store policy, though; do not make the
survival model depend on it. The data lane is unambiguous. Bet there.

---

## 3. Do not adopt EasyList syntax — adopt the EasyList *model*

§4 says "EasyList model", which is right as a principle and would be a
mistake as a file format. ABP/uBO filter syntax needs a real parser; uBlock
Origin's runs to thousands of lines. The survival property comes from
separating data from engine, not from the syntax.

Use versioned JSON. One file, per-platform blocks. An EasyList exporter can
be written later if interop ever matters.

**Every rule needs a machine-checkable test field from day one.** §3's watcher
— "tests every rule against the live page" — is impossible unless each rule
declares what proves it is still working: an expected match count, a probe
selector, an assertion. Retrofitting this across a grown rules file is the
most expensive mistake available in this design, and it costs nothing to
include now.

Minimum shape per rule: `id`, `platform`, `surface`, `action`, `target`,
`test`, `note`.

---

## 4. Flag 2 resolved — scope by surface instead of blur-all plus reveal

**The problem with blur-all.** With every thumbnail blurred, the user cannot
find the video they deliberately came for. Search becomes unusable, and an
unusable tool gets abandoned — which returns the user to the real YouTube.

**The problem with the obvious fix.** A hover- or click-to-reveal gesture is
itself a bypass affordance. It trains an un-blur reflex, which is the precise
habit the gaze module exists to break. Adding a reveal button to a gaze guard
is self-defeating.

**Better answer — treat surfaces differently, because they are different.**

- Home feed, Shorts shelf, related sidebar, end-screen cards: **removed
  entirely**, not blurred. Nothing to reveal, nothing to hover, no bait.
  These are the algorithmic surfaces — they are the mission.
- Search results and subscriptions: **thumbnails blurred, titles left fully
  readable**. Titles are how a person finds content they chose; text is not
  the bait. Intentional use stays possible; browsing-by-image does not.

No reveal gesture needed, the mission gets stronger rather than weaker, and it
is the same CSS cost as blur-all. It also hands the Phase 2 AI module a much
smaller surface, since the algorithmic feeds are already gone rather than
blurred.

---

## 5. Flag 3 resolved — force-install is the desktop ring 1

§2's ring 1 ("nothing to disable in two taps") holds in the mobile shell and
does not hold for a browser extension, which is two clicks from disabled in
`chrome://extensions`. There is no in-extension fix — an extension cannot
prevent its own removal.

There is an out-of-extension fix, and it is strong. Chrome's
`ExtensionInstallForcelist` enterprise policy installs an extension that
**users cannot uninstall or turn off** — the Remove button is greyed out or
absent entirely, including from the right-click menu. On Windows it is a
registry key under `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome`.
Brave and Edge honour their own equivalents of the same policy.

Setting it requires local administrator rights. That maps exactly onto §2's
ring 3: the trusted person holds the admin password, the same way they hold
the Screen Time passcode. Zero custom code; it is a playbook page.

Honest limit: anyone with admin can undo it. It is a ring, not a wall — which
is what §2 already claims each ring to be.

Implication for Phase 1: force-install needs a stable extension ID, which
means a published listing or a self-hosted update URL. Worth knowing before
the phase ends rather than after.

---

## 6. Repository and tooling shape

- **`rules/` sits at the repo root, as a peer of `extension/`** — not inside
  it. The rules file is the shared artifact for the app, the extension and
  everything later (§4); the directory layout should say so.
- **No build step, no bundler, no TypeScript at the start.** MV3 loads
  unpacked from plain files, and §7 records a beginner developer. Tooling gets
  added when its absence hurts, not before.
- **Study the open bases; do not fork one wholesale.** §8's Phase 0 says fork.
  Reading No Distractions / ShortShield and uBlock Origin's YouTube filters
  for their *selectors* is the valuable part; inheriting a whole extension's
  architecture and dead code means debugging someone else's design while
  learning. The selectors are the asset; the code is small enough to own.
- **Pick the licence before the first code commit.** §1 promises free and open
  forever, and forking a GPL base binds the project to GPL. That should be a
  decision, not a side effect — and the same care applies to HaramBlur's
  licence in Phase 2.

---

## 7. Recommended order

1. Answer the two open questions: first browser, project name.
2. Decide section 1 above — ads in or out of v1. Everything else is stable
   either way, but the rules file shape depends on the answer.
3. Pick the licence.
4. Phase 0, reframed: harvest selectors from the open bases into the rules
   file. Half an hour, no forking.
5. Phase 1: the generic engine plus the YouTube rules block, verified surface
   by surface in the browser with screenshots.
6. Write the force-install playbook page while Phase 1 is fresh.

---

## What is still unverified

- Whether remote *scriptlet parameters* survive Chrome Web Store review. Only
  matters if ads land in v1.
- Store listing requirements and fees for Chrome and Firefox.
- Brave's and Edge's exact policy key names for force-install.
