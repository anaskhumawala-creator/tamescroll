# YouTube watch-click stall — scriptlet gap (owner-grill needed)

> **SUPERSEDED IN PART, 2026-08-25.** The mechanism section below blames a
> stream *renegotiation* for the multi-second stall. That was wrong.
> Measured: the stall is YouTube's SABR **fake buffering** — InnerTube
> attaches a backoff worth ~80% of the ad's duration to the stream it
> serves (https://iter.ca/post/yt-adblock/). Pruning ad fields removes the
> ad and leaves the penalty, so the user waits out the ad looking at
> black. Numbers, same video, same build: hard nav pruning ad fields only
> 24-37s to first frame; SPA click 6.8s; hard nav additionally dropping the
> embedded `streamingData` 4.4-11.5s across 3 videos.
>
> The fix shipped is neither option A, B nor C below: `streamingData` is
> dropped from the embedded `ytInitialPlayerResponse` so the player must
> issue the client-side `/youtubei/v1/player` request that our EXISTING
> `isInlinePlaybackNoAd` shaper already turns into an ad-free,
> backoff-free stream. No `serverContract` reload dance, no new fragile
> scriptlets. Desktop only until the same numbers exist from the phone.
> See rules/scriptlets.txt for the full reasoning and the trade.
>
> Also fixed same day: `set-constant` and `trusted-prune-window-json` both
> installed accessors on `window.ytInitialPlayerResponse` with an
> unconditional `Object.defineProperty`, so whichever the engine emitted
> last silently destroyed the other. That is why the pruner appeared inert
> while winning its race. Both now compose.

**Owner reports it feeds:** #1 "why did ad come up", #9 "loads a lot after
clicking a video". Dominant cause of both.

## What's proven (profiling agent, 2026-08-23, 6/6 runs, desktop)

Thumbnail-click → video playing on a watch page:
- tamescroll: **5.0–6.4s** to first media, ~4s visible spinner.
- clean Chrome: **0.24–0.43s**.

The 4.4s is **our own doing**: transplanting our 5 scriptlets into clean
Chrome reproduced the stall (5/6 runs). The mechanism:

- Our `json-prune` + `set-constant` DELETE `adPlacements`/`adSlots` from the
  `/player` response. That removes the ad — but YouTube's player then
  **renegotiates** the media stream (127-140B response, then ~4.4s silence,
  then real media). The stall IS the ad removal, done the cheap way.
- Fast runs are only fast because a **pre-roll ad played** instead.
- So today every SPA watch-click either shows an ad OR stalls 4.4s. And
  search→SPA is the ONLY click path to a video (home has no thumbnails).

## Why uBlock Origin doesn't stall

uBO shapes the **outbound** `/player` request so YouTube serves an ad-free
stream in the first place — no renegotiation. That needs scriptlets we
don't ship:
- `trusted-json-edit-xhr-request` (×4) / `trusted-json-edit-fetch-request`
  — inject `clientScreen:CHANNEL`, `params`, `lactMilliseconds` into the
  request body.
- `rpnt`/`trusted-rpnt` — inject the giant `serverContract()` player script
  that drives the reload-until-clean dance.
- `json-prune-xhr-response`, `trusted-prevent-dom-bypass` (×3), `nano-stb`,
  `rmnt`, `ra`, `nostif`, `trusted-replace-outbound-text` (×4).

## Why this is owner-grill, not autonomous-loop work

1. **Player red line.** These scriptlets rewrite the live `/player`
   request/response. A wrong edit = broken/blank player, worse than an ad.
   VISION.md: a broken player beats a missed shelf.
2. **Arms race.** This is YouTube's ad-bypass front line; the payloads
   change often. Committing to maintain a clean-room `serverContract`
   reimplementation is a standing cost, not a one-off.
3. **Licensing.** The generic scriptlets are ours to clean-room (MPL). The
   `serverContract` BLOB lives in vendored `rules/vendor/ubo-filters.txt`
   under uBO's licence — we redistribute it as data, we don't relicense.
   The `rpnt` scriptlet that injects it is generic and clean-roomable. Need
   to confirm the data/code boundary holds for each.
4. **Scope.** New behaviour on the most fragile subsystem, >1 context
   window. CLAUDE.md: starts with grill-with-docs, owner-invoked.

## Options to put to owner

- **A. Full parity** — clean-room all missing scriptlets; match uBO's
  ad-free-stream approach. Removes both ad AND stall. Highest cost/risk,
  standing maintenance.
- **B. Request-shaper only** — implement just `trusted-json-edit-xhr-request`
  + `-fetch-request` + `json-prune-xhr-response` (mirror our tested fetch
  code). Shapes the request so no ad is served → json-prune finds nothing
  to renegotiate. Medium cost; skips the `serverContract` reload dance
  (needed only when the first shaped request still buffers).
- **C. Accept the pre-roll** — stop deleting adPlacements on `/player`;
  let the occasional pre-roll play, kill the 4.4s stall. Lowest risk,
  but an ad sometimes shows (violates NO-ADS intent).

Recommend **B** as the grill starting point: mirrors code we already ship
and test, targets the proven mechanism, avoids the fragile reload script.

## Secondary loading causes (safe, separate)

- tfjs webgl backend init blocks main thread 1–2.2s per hard nav (worst in
  off mode: `kickNsfw()` fires immediately per locked review #8). Candidate
  lever: `WEBGL_USE_SHAPES_UNIFORMS` (currently false) — cuts shader
  recompiles, especially for the new **variable-face-count batched gender**
  path. Needs browser bench before shipping.
- 7.9MB bundle eval'd 3× per hard nav (~200ms each + IPC).
- region-blur 250ms heartbeat forces layout (146ms/15s).

---

## UPDATE 2026-08-23 — owner decision + corrected analysis (fable agent)

**Owner decided:** no ads AND no lag, "like Brave." Build the real
request-side system, clean-roomed (GPL rule: never copy uBO/Brave
scriptlet code — clean-room the behaviour like our existing
set-constant.js). Multi-day, phone-verified, OTA-maintained.

### Correction to Option B (it does NOT work as written)
The upstream request-shapers (`ubo-quick-fixes.txt:25-28`) are **gated on
userAgent markers** (`[?..userAgent*="channel"]`, `*="lactmilli"`) that
ONLY the `serverContract()` script (`:24`) sets — and only *after* it
detects a buffering/broken stream and drives a `loadVideoById` retry.
Every *unconditional* upstream shaper is commented out (`:34,:87-95`) —
uBO itself retreated from always-on shaping. So "request-shaper only,
skip the reload dance" has no working configuration: mirrored as-is the
shapers never fire; made unconditional it's a config uBO disabled, with
no recovery when YouTube serves a broken shaped stream. **B is dead.**

### The actual current uBO YouTube path (what "Brave does")
A coordinated 4-part system, all on `www.youtube.com`:
1. **`serverContract()` state-machine** (injected by `rpnt`,
   quick-fixes `:24`) — watches `#movie_player`; on buffering/stall it
   walks a userAgent-marker ladder (`["channel","lactmilli"]`), calls
   `loadVideoById` to retry, and gives up cleanly on premium/SSAP/live.
   This is the recovery ladder that makes request-shaping safe.
2. **`trusted-json-edit-xhr-request` ×4** (`:25-28`) — when a marker is
   set, injects `clientScreen:CHANNEL` / `params:8AUB` / `lactMilliseconds`
   / `#reloadxhr` referer into the outbound `/player` request body so
   YouTube returns an ad-free stream directly (no response-tampering).
3. **`trusted-prevent-dom-bypass` ×3** (`:79-81`, args
   `Node.prototype.appendChild` × {`fetch`,`Request`,`JSON.parse`}) —
   stops YouTube grabbing a pristine un-wrapped fetch/Request/JSON.parse
   via a freshly-appended node, which is how it detects tampering and
   forces the renegotiation.
4. **`set` EXPERIMENT_FLAGS** (`:30-31`) — disables YT's
   `network_machine` (the ad-reload mechanism). Coverable by our existing
   set-constant.js today.

Our stall = we ship only the *response-strip* half (json-prune /
trusted-replace, `:52-77`) WITHOUT parts 1-4, so YouTube always
renegotiates.

### Build plan (incremental, each step phone-verified by owner)
Clean-room, MPL, one scriptlet at a time; ship via APK (scriptlet code
can't OTA — store rule) but the *rules* that call them CAN OTA.

- **Step 0 (safe, testable on emulator):** `set` the two
  `network_machine` EXPERIMENT_FLAGS false (`:30-31`) via existing
  set-constant. Verify playback intact. Low risk, may cut some
  renegotiation on its own.
- **Step 1:** clean-room `trusted-prevent-dom-bypass` (the 3 YT args).
  Guards the wrappers we already ship. Verify playback + measure
  watch-click timing on the phone (does it cut the 4.4s alone?).
- **Step 2:** clean-room `trusted-json-edit-xhr-request` (the query-path
  mini-language for the 4 YT request edits). This is the ad-free-stream
  core.
- **Step 3:** clean-room the `serverContract` recovery state-machine
  (generic `rpnt`-injected player watcher) — the piece that makes Step 2
  safe when a shaped request buffers. Largest + most fragile.
- **Ongoing:** OTA rule tuning as YouTube shifts; scriptlet-code changes
  ride app updates.

**Verification reality:** the emulator does not get served real ads, so
ad-removal is owner-phone-only. Emulator proves playback-integrity +
stall-timing; the phone proves no-ads.

**Red line unchanged:** a broken/blank player is worse than an ad. Every
step gates on "video still plays" before "ad gone."

---

## UPDATE 2026-08-23 (2) — web research: the fix may be ONE public flag

Research agent (web) findings, provenance clean-room-safe:

**Legal:** confirmed. GPL/AGPL cannot ship in an App Store binary (VLC/GNU
FSF precedent — Apple's DRM/ToS are "further restrictions" §6 forbids).
No permissively-licensed real YouTube video-ad blocker exists (uBO +
AdGuard scriptlets both GPL-3.0; the MIT "youtube adblock" repos are
hosts-lists or nag-dismissers, not ad strippers). Clean-room from public
behavioral specs is the accepted, mandatory path.

**iOS:** our own WKWebView injection is NOT the Safari-content-blocker
declarative limitation — that only binds Safari extensions. Brave/Firefox
iOS inject arbitrary JS into their own WebViews and strip YouTube ads;
same category as us. Apple's ad-blocker rejections target VPN/root-cert
apps that modify OTHER apps' traffic — not a self-contained browser
cleaning content it renders itself. Our BLOCK-ONLY/own-webview shape is
safe.

**Mechanism (source: https://iter.ca/post/yt-adblock/ — independent blog,
protobuf reverse-engineering of Google's own public API, NO uBO code):**
- The 4.4s stall is a **SABR server "backoff"** instruction baked into the
  granted stream when the outbound `/player` request implies an ad slot.
  Response-side `json-prune` of `adPlacements` hides the ad UI but never
  removes the already-granted backoff → the freeze. Corroborates our own
  scriptlet-gap finding independently.
- **Named request-side fix:** set
  `playbackContext.contentPlaybackContext.isInlinePlaybackNoAd: true`
  on the `POST /youtubei/v1/player` request body → InnerTube serves an
  ad-free stream with NO backoff. One field. No serverContract reload
  ladder needed if it holds. This is the clean, minimal version of the
  request-shaper (old doc option B), discovered from YouTube's public
  protobuf surface (req2proto), not from uBO/AdGuard source.

**Revised build plan (supersedes the step 0-3 plan above):**
- **Step 1:** clean-room a small request-editor scriptlet that adds
  `isInlinePlaybackNoAd:true` to outbound `/youtubei/v1/player` request
  bodies (wrap fetch + XHR send; JSON-parse body, set field, re-serialize).
  Keep our existing response-strip as belt-and-braces OR remove it if the
  flag alone clears ads (owner phone-test decides — the flag may make the
  response-strip's stall moot).
- **Step 2 (only if Step 1 stream still buffers):** the serverContract
  recovery ladder. Likely unnecessary if the flag grants a clean stream
  directly — defer until proven needed.
- **prevent-dom-bypass:** may be unnecessary for us — we inject Rust-side
  at on_page_load, BEFORE YouTube's locker script, which a browser
  extension can't guarantee. Confirm our injection beats their locker
  empirically; only clean-room prevent-dom-bypass if they out-race us.

**MUST verify before betting on it:**
1. `isInlinePlaybackNoAd` is from a SINGLE source (iter.ca). Independently
   confirm the field exists (own req2proto pass / second writeup) before
   shipping.
2. SSAI (server-stitched ads) rollout ~6-12mo from mid-2026 defeats ALL
   client request/response tricks. Instrument graceful degradation
   (detect ad-shaped stream → fall back to today's UX, never worse).

**Provenance discipline (lightweight SFLC clean-room):** implement from
the public field name + public behavioral description only; do not read
uBO/AdGuard scriptlet source while writing; keep source URLs + extraction
method in the commit message.
