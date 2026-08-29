# What actually made the app fast (2026-08-29)

Owner, on the phone after 1044: *"It's much better at load times, etcetera
... can we even do it more better"*. This is the ledger of what moved the
numbers, so the next round does not re-derive it — and what is left.

Every number is m.youtube under a mobile UA on the dev machine unless it
says otherwise. The phone has still never been profiled.

## The five that moved it

**1. The models stopped riding inside the script.** 93.9% of a 22.7MB
bundle was base64 model weights, parsed on every worker start before it
could accept its first image. They are fetched as bytes now (`lib.rs
synthetic_resource`, `detector.js ioHandlerFor`). Worker hello
**827-970ms → 471-529ms**, bundle **22.7MB → 0.98MB**, APK **61.2 →
55.8MB**. The note claiming a runtime fetch is CSP-dead was stale: it
succeeds on all five platforms with zero violations.

**2. The first thumbnail was paying for shader compilation.** It cost
1.25s while every thumbnail after it cost 60-100ms — lazy WebGL kernel
compilation, proven by a second run of the same graph costing 9-18ms.
Every model now runs once on a blank frame before the worker reports
ready, under `ENGINE_COMPILE_ONLY` so all programs compile in PARALLEL:
**1481-2047ms → 439-607ms**.

**3. Each model warms the moment it lands**, so its compilation overlaps
the download of the ones behind it. First thumbnail **1057-1258ms**,
worker ready **959-1164ms**.

**4. A query string gets our own urls past a service worker.**
www.youtube.com's service worker answered `/__tamescroll/...` with
YouTube's own 404, so the inference worker had never started on desktop
YouTube at all. The same path with `?v=` returns our bundle in 10ms.
Desktop YouTube went from a dead worker and 22.7MB parsed in-page to a
live worker and 19ms of page eval.

**5. The worker starts before the page does.** It boots at
document_start and is adopted with its message backlog replayed. Cold
worker start **1531ms → 179ms**. HONEST: the cold first thumbnail did
not move (2932 vs 2907ms) — cold cost is model load plus shader
compile, not start time.

Net, warm navigation: first thumbnail **2182-3200ms → 1057-1258ms**.

## Two that were bugs wearing a performance costume

- **One Android cache slot answered every one of our urls.** The first
  `/__tamescroll/` request filled it and every later one got those bytes,
  so no model parsed and blur-first covered every thumbnail forever.
- **A feed preview ran the whole video pipeline under a scrolling
  finger.** m.youtube plays previews into the shared player, so scrolling
  home paid for person detection, repeated passes and an overlay loop on
  top of judging every thumbnail. The watch page's list plays no
  previews — which is exactly why the owner found it smoother.

## What is left, in the order worth doing

1. **Profile the phone.** Every number above is this desktop. The single
   most valuable next measurement is `worker.backend` and per-image cost
   on the Helio G88 — if the worker lands on CPU there, the player
   silently runs in-page and none of this describes his device.
2. **The cold navigation, 2932ms.** Model load 1197ms + warm 1189ms,
   both cold-cache. A persistent shader cache is the browser's, not
   ours; what we control is fetching the models earlier — the prestart
   worker could begin its fetch before the page's own subresources.
3. **An unproven host still gets the models inlined once per app run**
   (up 1782-2793ms against 521ms once proven). Persisting the
   proven-host set across runs would remove it, and was deliberately NOT
   done: a stale "reachable" record recreates the all-blurred failure.
   Revisit only with a fallback that cannot leave images covered.
4. **Native inference (Kotlin + TFLite, GPU delegate / XNNPACK).**
   Plausibly 2-3x on the models themselves, but it is a second pipeline
   to maintain, needs a gender model with a clean licence in tflite
   form, and the pixel handoff between WebView and Kotlin can eat the
   win. Gated on item 1: do not start it until the phone says inference
   is the bottleneck.
5. **Dead ends, measured, do not retry:** cross-image batching
   (BlazeFace fixes its batch dim), a URL verdict cache (4-8% hit —
   `sqp` varies the crop per surface), the scroll-time budget fraction,
   and SharedWorker (Android WebView does not have it).
