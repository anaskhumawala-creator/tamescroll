# Owner-reported issues — live tracker

Owner order 2026-08-23: "keep track of all the issues I am mentioning and
take upon them". One row per report, newest first. Status: OPEN /
IN-PROGRESS / FIXED-verified / FIXED-unverified / ANSWERED.

| # | Reported | Issue (owner's words, compressed) | Status | Evidence / next step |
|---|----------|-----------------------------------|--------|----------------------|
| 14 | 08-23 | "blur shows above the menu or a title" | FIXED-verified (emulator) | Region overlays (max z-index, document-anchored) punched over m.youtube's position:fixed topbar when a face thumbnail scrolled behind it. clampToInset() clips overlay top to the header line (fully-behind hide; over-blur preserved). topInset() walks each elementsFromPoint hit's ANCESTOR chain — the top-center hit is a static <button> inside the fixed topbar, so direct-hit-only found inset 0. probe48: barBottom 48, punchThrough []; screenshot shows search bar clean. Shipped v0.1.3 (1003). |
| 13 | 08-23 | Stop re-sending APK via WhatsApp — better delivery to remote phone | DONE (verified) | In-app updater live end-to-end (probe46): emulator v1000 checked live GitHub manifest -> saw v1001 -> card -> downloaded 45MB -> sha256 verified -> FileProvider -> system installer consent prompt fired. Release published (app-v0.1.1, arm64). APK stripped 329->45MB. Bootstrap: owner installs current arm64 from Files ONCE (has updater); future updates in-app. Next-build flow exercised for v0.1.3 (issue #14 fix): bump 1003, strip 45MB, gh release v0.1.3, manifest pushed. |
| 12 | 08-23 | "why did ad come up" (desktop watch) | GRILL-READY | Root cause + 3 options written to docs/scriptlet-gap.md (recommend request-shaper-only). Player-red-line work -> owner-grill, not autonomous. Same root as #9. |
| 11 | 08-23 | Sign into YouTube with device accounts instantly | ANSWERED | Not feasible: WebView sandboxed from device Google accounts; cookies persist so sign-in is once per device. Optional: verify Android password autofill in WebView. |
| 10 | 08-23 | Blue selection box on search click + general unpolish | FIXED-verified (emulator) | styles.css: tap-highlight killed, focus ring, user-select, autofill tint, overscroll, drag ghosts. probe49c: add-platform input focused+typed — tapHighlight transparent, outline 0px, border #343434 (clean subtle field, no blue box); no-circumvention 'We don't support that' intact. Shipped v0.1.3. |
| 9 | 08-22/23 | App "loads a lot" after clicking a video | GRILL-READY | Dominant cause = #12 scriptlet stall (docs/scriptlet-gap.md). Secondary safe levers listed there: WEBGL_USE_SHAPES_UNIFORMS SHIPPED (benched on real Android WebView: gender shader compiles 223->98, per-new-batch recompiles 68->12 at batch5, output bit-identical). 3x bundle eval remains. region-blur heartbeat thrash FIXED (probe-guard, 1 read/tick when static + skip when hidden; gaze 32/32). |
| 8 | 08-22 | In-video live blur must work on mobile, perf "very well optimized" | IN-PROGRESS | Batched gender (N faces -> 1 inference) + single-download JS NMS shipped; desktop true cost 19.6ms/frame face, 17.1ms NSFW (dataSync bench). Emulator x86_64 inference minutes-slow (GPU emulation, known) — real-hw verify needs owner phone. |
| 7 | 08-22 | Both genders face-blurred even with "male" selected | FIXED-verified (emulator) | Root cause: embedded gender-ssrnet-imdb broken (single saturated output; data[1]=undefined -> every face flagged). Replaced with Oarriaga gender.json (MIT). probe44 in-app man mode: Trump (clear male) CLEARED/sharp, obscured faces region-blurred (0.85 fail-safe) — differentiated verdicts the old model couldn't produce. Real-hw timing still owner-phone. NOTE: 0.85 over-blurs obscured/low-confidence male faces (MrBallen) by design. |
| 6 | 08-22 | In-video blur toggle wanted | FIXED-verified | Pill inside #movie_player, desktop+emulator verified (pre-compaction). |
| 5 | 08-22 | Blur boxes "where they don't even belong" | FIXED-verified | Region overlays document-anchored + 250ms heartbeat + snap guard (probe32/33). Watch for recurrence. |
| 4 | 08-22 | Pinch-to-zoom in fullscreen | FIXED-verified | ScaleGestureDetector 1-3x, reset per enter/exit (probe41). |
| 3 | 08-22 | Fullscreen doesn't actually fullscreen | FIXED-verified | Delegating WebChromeClient + immersive landscape (probe41). |
| 2 | 08-22 | OTA - "will I have to redownload?" | ANSWERED | Rules OTA only; code/scriptlets/models need new APK. |
| 1 | 08-22 | "Lot of loading" (first report) | IN-PROGRESS | Superseded by #9 breakdown. |

Perf findings backlog (from 08-23 profiling agent, not owner-visible yet):
- Scriptlet gap: json-prune-xhr-response, trusted-json-edit-xhr-request,
  rpnt/trusted-rpnt (serverContract), nano-stb, trusted-prevent-dom-bypass,
  rmnt — skipped in rules.rs as "anti-detection", actually load-bearing for
  watch-click latency (4.4s) and hard-nav pre-rolls.
- off-mode kickNsfw() immediate -> 2.2s main-thread webgl compile during
  page load; consider idle-deferred backend warm without violating pre-blur.
- Bundle eval'd 3x per hard nav (Started+Finished+unknown 3rd) ~200ms each.
- region-blur heartbeat forced layout 146ms/15s (clientWidth reads).
- Bench gotcha: hidden-tab timer throttling makes async tfjs downloads
  look 35-3000x slower than real; bench only in visible tabs or dataSync.
