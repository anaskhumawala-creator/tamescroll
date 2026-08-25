# Live worklist

Top item is what to work on. Edit as things land. This file is the
answer to "what now" — the scheduled ping reads it rather than guessing.

## 1. ADS — network blocking (owner: "the biggest issue we have")

Root cause found 2026-08-25: the adblock engine has been in the app
since Phase 2.5 with EasyList/EasyPrivacy/uBO compiled in, and the code
only ever asked it `url_cosmetic_resources`. Cosmetic filtering hides
ELEMENTS; it cannot stop a request, and a YouTube pre-roll is not an
element. Never a regression — network blocking was never wired.

Measured reaching the network from one watch page, ad playing:
googleads.g.doubleclick.net/pagead/id, static.doubleclick.net/instream/
ad_status.js, www.youtube.com/ptracking, /pagead/viewthroughconversion/.

- [x] `blocks_request()` in lib.rs + tests both directions (cargo 35/35)
- [x] JNI entry `nativeShouldBlock` (fails open, catches panics)
- [x] Android delegating WebViewClient wrapping wry's, blocks in
      `shouldInterceptRequest`, returns an empty 204 not an error
- [ ] BUILD the APK and verify on-device that the four measured URLs are
      blocked and the player still plays. Not done = not fixed.
- [ ] Desktop WebView2 equivalent (owner watches on desktop too)
- [ ] Release once verified — owner OK required before publishing

## 2. GAUNTLET — blur accuracy loop

`spikes/gauntlet/GOAL.md` holds the bar, the five failure classes, the
rotation and the ROUNDS log. R0-R3 landed real fixes. R4 in progress.

Standing target: verdict-pass cost tail. Measured p50 162ms but p95
2048ms and max 6120ms on a DESKTOP — the owner's phone is a Helio G88
and he has said optimization is what makes the app usable at all.

Also open from R4's capture: 5-6 stacked patches appeared while a
pre-roll AD was playing (runs/r4-man f008/f009). Worth checking whether
ad frames are a distinct failure mode — and note that fixing item 1
removes those frames entirely.

## 3. Deferred by the owner

- Cartoons/animation: "not the biggest concern, do that later."
- tamescroll.com serves a copy predating the brand commit; the spiral
  mark is in web/index.html but not live. Redeploy is outward-facing,
  needs an explicit OK.
