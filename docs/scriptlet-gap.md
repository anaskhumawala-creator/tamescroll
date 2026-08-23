# YouTube watch-click stall — scriptlet gap (owner-grill needed)

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
