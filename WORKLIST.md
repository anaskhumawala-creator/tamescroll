# Live worklist

Top item is what to work on. Edit as things land. This file is the
answer to "what now" — the scheduled ping reads it rather than guessing.

## 2. ADS — network blocking (owner: "the biggest issue we have")

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
- [x] Desktop WebView2 (`install_request_blocker`) — VERIFIED: 7 ad
      requests answered 204, zero through, player still playing
- [ ] PRE-ROLL VIDEO still plays. Its stream is googlevideo.com, which
      is also the real content stream, so it cannot be blocked by URL.
      The page embeds `ytInitialPlayerResponse` with `adSlots` (4 on the
      measured page) — prune those at document start, before YouTube's
      own script reads the object.
- [ ] BUILD the APK and verify on-device that the four measured URLs are
      blocked and the player still plays. Not done = not fixed.
- [ ] Desktop WebView2 equivalent (owner watches on desktop too)
- [ ] Release once verified — owner OK required before publishing

## 1. GAUNTLET — blur accuracy loop (owner 2026-08-25: "pursue gauntlet properly")

`spikes/gauntlet/GOAL.md` holds the bar, the five failure classes, the
rotation and the ROUNDS log. R0-R3 landed real fixes. R4 in progress.

Standing target: verdict-pass cost tail. Measured p50 162ms but p95
2048ms and max 6120ms on a DESKTOP — the owner's phone is a Helio G88
and he has said optimization is what makes the app usable at all.

Also open from R4's capture: 5-6 stacked patches appeared while a
pre-roll AD was playing (runs/r4-man f008/f009). Worth checking whether
ad frames are a distinct failure mode — and note that fixing item 1
removes those frames entirely.

## Harness gotchas — do not repeat

A LOCAL EDIT TO `rules/` IS INVISIBLE UNTIL IT IS PUSHED. The OTA fetches
`rules/*` from raw GitHub main on launch and installs them as OVERRIDES,
which win over the `include_str!`'d copies compiled into the binary. So a
freshly-rebuilt dev app immediately overwrites your local rule edits with
whatever is on main, and the log line that says so is easy to skim past:

    rules ota: updated 2 rule file(s)

Sequence that actually works: edit rules → `node scripts/gen-rules-manifest.mjs`
→ commit + push → wait for raw.githubusercontent to serve BOTH the file and
the new `manifest.json` (they propagate independently; a refresh in between
fails hash verification, and a refresh before either lands reports the
honest but misleading "rules up to date") → `refresh_rules` → RELAUNCH.

THE RULES CSS IS BAKED AT WINDOW CREATION. Reloading the page or clicking
the platform tile again reuses the existing webview and re-injects the SAME
string — the injected `#tamescroll-rules` length stays pinned (4312 across
four reloads while the cache on disk already held the new rules). Only a
fresh window, i.e. an app relaunch, picks up refreshed rules. Verify by
reading that style element's length, not by trusting the refresh return.

NEVER run the dev app as a TRACKED background task. `npx tauri dev` ran
that way for 13 hours, and a session holding a live tracked task never
reaches idle — which is the only state a scheduled ping can fire in. Not
one tick fired in five attempts at four different intervals, and the
cron expression was never the problem. Launch it DETACHED instead:

    powershell -NoProfile -Command "
      $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
      Start-Process cmd.exe -ArgumentList '/c','npx tauri dev > Z:\Apps\Disconnect\spikes\devapp.log 2>&1'         -WorkingDirectory 'Z:\Apps\Disconnectpp' -WindowStyle Hidden"

Then poll `curl http://127.0.0.1:9223/json` in the FOREGROUND with a
bounded loop. Log lands in spikes/devapp.log.

NEVER launch `until <cond>; do sleep N; done` with run_in_background.
One of those spun for 12h39m waiting on a condition that had already
passed, and a session with a live background task never goes idle — so
the scheduled ping could not fire even once. That, not the cron
expression, is why the loop looked dead. Poll in the FOREGROUND with a
bounded timeout, or just re-check on the next ping.

## 3. Deferred by the owner

- Cartoons/animation: "not the biggest concern, do that later."
- tamescroll.com serves a copy predating the brand commit; the spiral
  mark is in web/index.html but not live. Redeploy is outward-facing,
  needs an explicit OK.
