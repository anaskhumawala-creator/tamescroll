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

## What a real Android WebView actually said (2026-08-30)

Measured on the headless emulator through the app, three navigations to
an m.youtube search, worker on webgl:

| | first nav of the run | second | third |
|---|---|---|---|
| worker up | 1038ms | 666 | 596 |
| bundle eval | 118ms | 16 | 15 |
| model load (slowest) | ~2.9s | ~2.9s | ~2.9s |
| **warm-up** | **17,967ms** | 15,773 | 15,907 |
| ready | 19,397ms | 21,807 | 17,237 |
| first thumbnail | 21,067ms | 22,702 | 18,783 |

Three things fall out of that, and only one of them is actionable:

1. **The first navigation of an app run is NOT the slow one.** It is the
   one that gets the models inlined instead of fetched, and item 3 below
   predicted a 1.2-2.2s penalty for it. There isn't one: 21.0s against
   22.7s and 18.8s, inside the run-to-run spread. Persisting the
   proven-host set would buy nothing on Android. Do not spend the risk.
2. **Warm-up is 85-90% of time-to-first-thumbnail**, and nothing is
   judged until it finishes -- so the whole feed stays covered for it.
3. **The emulated GPU cannot answer the perf question.** A single
   BlazeFace pass on a blank 256px frame costs ~10s here and 20-60ms on
   the desktop. Ratios inside one run are meaningful; absolute numbers
   are not, and neither is any conclusion drawn from them about the
   phone.

What was fixed from it: `warmUp` ran each model a SECOND time to answer
"was that all compilation?" -- 9-18ms on the desktop, **face2 3,552ms +
nsfw2 3,070ms** here, on the critical path. Now behind `__TS_WARM_BENCH`.
HONEST: wall-clock warm barely moved (15,907 -> 15,683ms) because the
three models warm in parallel and the second runs hid inside the longest
chain, which is gender (`gender:compile` alone is ~10s). It is 6.6s of
GPU work that no longer happens; on a phone with one real queue that
should matter more than it does here, and that is a prediction, not a
measurement.

## The warm-up was doing the first image's work twice (2026-08-30)

`warmUp` did two things: a compile-only pass over all three models (the
parallel-shader-compilation win, worth keeping) and then a full blank
inference per model. The blank runs cannot make the first real image
cheaper -- they do that image's work early, on a frame nobody is looking
at, while `ready` is withheld and the whole fold stays covered.

Removing them from the critical path, three restarts each, Android:

| | before | after (median of 3) |
|---|---|---|
| warm | 22,684ms | **5,702ms** |
| ready | 24,040ms | **7,051ms** |
| first thumbnail | 18,783-22,702 | 19,582-21,724 |

**HONEST: time to first reveal did not move.** The compilation the blank
runs were doing is now paid inside the first real pass instead -- first
went from `ready + 1.5s` to `ready + 12.7s` and the total is the same,
inside the spread. What the change actually removes is ~17s of duplicated
GPU inference per navigation on this device: less heat, less contention,
and the drain is live from 7s instead of 24s so everything after the
first image pipelines earlier. Not shipped as a release on its own,
because the number the owner would feel is unchanged.

## The harness wobbles 28%, so most single-run deltas are noise (2026-08-30)

Scroll smoothness became measurable on the emulator for the first time
once the consent wall stopped locking `<body>`. The first A/B looked
decisive -- gaze smart 19.5fps against off 45.1fps on the same page and
the same gesture -- and it is not safe to act on.

`probe_scroll_repeat.py` runs ONE condition five times: **27.0, 31.5,
27.0, 32.8, 35.8 fps -- a 28% spread around the median**, with the app,
the page and the gesture identical. A second decomposition run
(neutralise the blur CSS, keep every model running) came back 6.6fps
*slower* without the blur painting, which is the wrong sign and simply
inside that band.

So: **on this harness, treat any frame-rate delta under ~30% as noise,
and never act on n=1.** Repeat the condition first; if the effect does
not clear the spread, it is not a finding. Long-task totals behaved
better than frame counts (0-1 tasks in most runs), but they were near
zero in every condition, so the scroll cost is not long main-thread
tasks -- which leaves GPU contention and small sub-50ms work, neither of
which this device can separate.

This is the third independent route to the same conclusion as item 1
below: the phone is the only machine that can answer a performance
question about the phone.

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

## What an image actually costs: faces, not pixels (2026-08-30)

The tempting optimisation was to stop handing tfjs the thumbnail at its
natural size. `createImageBitmap(el)` does no resize, so every distinct
thumbnail dimension reaches the models as a different tensor shape --
and tfjs keys its compiled WebGL programs by shape, while the warm-up
compiles exactly one shape (a blank 256x256 with one face box). If that
were costing anything, capping or quantising the bitmap would be a free
win.

`probe_shape_cost.py` reads the diagnostic ring on a settled m.youtube
search, drops the first three images (still paying the warm-up tail) and
groups what is left. Two runs, 30 settled images:

| source width | n | median worker ms |
|---|---|---|
| 68px (avatars) | 13 | 1647 |
| 686px (thumbnails) | 16 | 1618 |

**A source ten times larger costs the same.** There is no per-shape
recompilation and no size dependence, so downscaling the bitmap buys
nothing -- and it would have cost gender-crop quality on small faces,
which is the defect that took four days to find in August.

What the cost is actually made of, same 30 images:

| faces in image | n | median worker ms |
|---|---|---|
| 0 | 1 | 309 |
| 1 | 22 | 1565 |
| 2 | 5 | 2366 |
| 3 | 2 | 3987 |

Detection is ~310ms; **every face after that adds ~1.25s, linearly.**
faceres is batched into one inference over all the faces in an image and
still shows no economy of scale, so the batch is not the lever either.
The main thread's share stayed at 18ms worst over the whole page.

So the per-image lever is the number of faces judged, not bytes moved.
The only ways to cut it are to run faceres on fewer faces (an accuracy
decision the owner has to make -- a 68px avatar reporting two faces was
verified as a real two-person avatar in August) or to make faceres
itself cheaper, which is item 4. Do not re-derive this from the totals:
`__TS_GAZE_IMGDIAG` carries `w` and `faces` per entry, which is what
separates the two explanations.

## The url verdict cache, on the population it actually helps (2026-08-30)

The old note says a url verdict cache hits 4-8% and is not worth it.
That was measured over thumbnails, and it is still true. Measured again
on a settled, scrolled m.youtube search (`probe_dupsrc.py`, exact
untruncated urls, images at or above the 48px floor):

| population | images | distinct urls | repeats |
|---|---|---|---|
| thumbnails | 28 | 28 | **0%** |
| avatars | 20 | 14 | **30%** |

YouTube's `sqp` parameter varies a thumbnail's crop per surface, so two
thumbnails of the same video are genuinely different pixels. A channel
avatar has no sqp, and the same channel appears repeatedly down a feed.

Shipped as `verdict-cache.mjs`, keyed on the EXACT untruncated url plus
the nsfw question (a face-only avatar verdict must never answer for a
thumbnail that also needed the nsfw check). Two properties make
replaying safe and both are load bearing: identical urls are identical
pixels, so the normalised boxes land exactly where they were measured;
and the cache lives and dies with the page, so a clear verdict can never
outlive the bytes it was made from. Errors are never cached -- one
transient failure must not cover a url everywhere it appears.

VERIFIED on the emulator, built app, two settled runs: **3 of 46 and 3
of 45 entries came back `where: cache`**, verdicts stayed differentiated
(13/33 and 20/24 clear/face), and **0 on-screen images were left
pending** in both. That is ~6.5% of images, below the 30% avatar repeat
rate because many repeated avatars are below the fold and never judged.
At loop 9's measured ~1.6s per image it is real work removed for no
accuracy cost, but it is not a number the owner would feel on a search
page -- it rides the next release rather than justifying one.

### Correction: the avatar repeat rate is page-dependent (2026-08-30)

A second sample of the same search, taken an hour later, came back 21
avatars / 19 distinct -- **9.5% repeats, not 30%**. Across three settled
runs of the built app the cache answered **1, 3 and 3** of 45-48 images,
so the honest figure is **2-6.5%**, and 30% was the high end of a
two-sample spread rather than the number. Nothing about the change is
wrong; the size of the win is smaller and more variable than the first
measurement suggested, which is exactly why it did not justify a release
on its own.

Also dead, measured: normalising the SIZE token in a ggpht avatar url
(`=s68-c-k-...`) to widen the key buys nothing. Every avatar on the page
was already requested at `=s68` -- 19 distinct exact urls, 19 distinct
normalised. `probe_avatar_norm.py`.

## A host is only correct while it is still the parent (2026-08-30)

`region-blur` caches `entry.host` when it mints a patch.
`applyRegionBlur` re-resolves it when the element has been reparented --
but only when a NEW verdict arrives for that element. The 500ms sweep
checked that both are still connected, and that the host had not BECOME
the player, and nothing else. So an image moved by a virtualising feed
kept a patch hosted by a container it no longer belonged to.

The arithmetic hides it: the overlay is positioned at
`elRect - hostRect` inside the host, so the host's own offset cancels
and the patch still lands on the image. What changes is the STACKING
CONTEXT it inherits -- which is the difference between a patch that
sits behind the sticky player and one that paints over it.

MEASURED first, on m.youtube search: 116 images over eight scroll steps,
**0 reparented** (`probe_reparent.py`) -- consistent with the earlier
finding of 0 src/srcset swaps on that surface. So this is a NET in the
same family as the occluder clamp, not a reproduction of the owner's
frame. The sweep now re-resolves the host, and restores whole blur if
there is no host to take; both directions stay covered.

Verified after the change on a built x86_64 APK: 48 images judged, 21
clear / 26 face / 1 error, **0 on-screen images left pending**, and 6
region patches of which **6 land entirely inside their own image, 0
stray**.
