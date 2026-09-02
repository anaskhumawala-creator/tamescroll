# Delay-line spike — Stage 2 first results (2026-08-25)

Owner ask, verbatim: *"Do make sure that the buffer works. I do not want a
single frame with the opposite gender visible. Or whatever is the best
methodology."*

## Why this is the right methodology

Ten gauntlet rounds have chased zero-exposure by making detection faster.
That cannot reach zero by construction: the pipeline reacts to a frame the
user has already been shown, so the floor is one pass of exposure on every
new subject. A delay line inverts the dependency — the real `<video>` keeps
decoding at `opacity: 0`, frames go into a ring, and the user sees a frame
~350ms old. Detection then runs *ahead* of what is on screen, so a frame can
be **held back until its verdict exists** instead of corrected afterwards.
That is the only shape that makes "not a single frame" a property of the
design rather than a target to approach.

## What is ANSWERED

Both kill-risks survived, which is the whole point of running the spike
before building anything.

- **`VideoFrame` + `requestVideoFrameCallback` work in this WebView2.**
  `useVideoFrame: true`, frames captured into the ring, `close()` honoured,
  no errors across two runs.
- **AUDIO SURVIVES — this was the one that could not be undone.**
  `createMediaElementSource()` is permanent per element and there can be
  only one; if YouTube already held it, or if taking it broke their graph,
  the page would go permanently silent with no way back. It succeeded:
  `{ok: true, ctxState: "running", delay: 0.35}`, `AudioContext` running
  after the run. Probed on a throwaway page exactly because of this.
  CAVEAT: the element was `muted: true` in both runs, so this proves the
  graph was accepted, **not** that sound is audible through it. An unmuted
  confirmation is still owed.
- **No DRM on this content** — `encrypted` never fired, so the canvas is
  not black. Needs re-checking on other videos; DRM would kill the approach
  for that content and the fallback must be the live path.
- **No new dropped frames** attributable to the ring (`dropped` 2 → 2,
  4 → 4 across the two runs).

## What is NOT answered

- **Throughput.** Both runs had a badly stalled player — `currentTime`
  advanced ~4s in 20s and `getVideoPlaybackQuality().totalVideoFrames` rose
  by only 43, i.e. rVFC fired ~2/s. `presented: 0` in the second run is a
  consequence of that (frames need to age `DELAY_MS` before presentation
  and almost none arrived), not evidence about the ring logic. **Re-run on a
  healthy player before believing any number here.** The runner now refuses
  to measure until `currentTime` is genuinely advancing, and that guard was
  too weak — it accepts a brief blip. Tighten it to require sustained
  real-time playback.
- A/V sync against the ±80ms bar. Needs audible audio and throughput first.
- GPU memory of the ring at 1080p.
- Controls / scrubber / fullscreen / SPA-nav checklist.
- Anything on the Helio G88.

## Seek, arrow keys, scrubbing — the owner's second question

Arrow keys jump 5s, J/L jump 10s, the scrubber jumps anywhere. Each makes
`mediaTime` discontinuous, and a delay line is *most* dangerous here, not
least. Two failures:

1. Presenting frames captured **before** the seek shows the previous scene
   for up to `DELAY_MS` — wrong content, carrying a verdict that belongs
   somewhere else entirely.
2. After flushing, the ring needs `DELAY_MS` to refill, and during that gap
   there is nothing delayed to present.

(1) is fixed by flushing. (2) is the interesting one, and both obvious
answers are wrong: showing the **live** video during the gap drops straight
back to the reactive path this exists to escape, and holding the **last**
frame shows stale content. So the gap is **covered** — the same whole-blur
the app already uses before its models are ready. Blur-first is the house
rule and a seek is precisely an "unknown" moment. Cost is about a third of
a second of blur per arrow press, and it cannot expose anyone.

`seeking` is the single choke point for the entire class (arrow keys, J/L,
scrubber drag, chapter clicks, SPA restore), which is why one listener
covers all of it. Also handled: `loadstart` (new video), `resize`
(resolution change — mediaTime keeps running but every buffered frame is
the wrong size), and `ratechange` (at 2x a 350ms delay is 700ms of content,
so the ring must be re-measured rather than reused).

Still unhandled and worth thinking about before wiring: pause/resume
(the ring ages in wall-clock while `mediaTime` stands still — presentation
should key off `mediaTime`, not `at`, which is a change to the pick logic),
and fullscreen transitions (the canvas is parented to `#movie_player`, so
it should follow, but this is unverified).

## Next

1. Re-run on a healthy player; get real throughput and A/V numbers.
2. Unmuted audio confirmation.
3. Switch the presentation pick from wall-clock `at` to `mediaTime` so
   pause/resume and rate changes are correct by construction.
4. Only then wire detection: verdict keyed per `mediaTime`, mask final
   before presentation. That is the step that actually delivers the bar.

---

# Android arm64 results (2026-09-02, Redmi M2010J19SI / SD662 / Adreno 610, app 1091, m.youtube watch page, 720p60 stream)

`probe_android.js` + `run_android.py`, raw in `result_android.json`. Three
configs, 45s each, a +5s seek at 40% and a 3s pause at 70% of every run.

| config | captured / presented | capture ms p50 / p95 | present ms | ring p50 / max | A/V skew p50 | audio through delay | pause |
|---|---|---|---|---|---|---|---|
| VideoFrame, native, D=1.5s | 69 / 9 | 0.1 / 0.3 | 1.9 | 13 / 22 | -100 | 31 of 181 samples | suspended |
| ImageBitmap, native 1280x720, D=2.5s | 689 / 249 | 2.1 / 6.2 | 0.1 | 40 / 66 | -49 | 143 of 150 | suspended |
| ImageBitmap, 640x360, D=2.5s | 526 / 230 | 1.3 / 6.3 | 0.1 | 33 / 41 | -49 | 132 of 142 | suspended |

**ANSWERED, on the device class that matters:**

- **A `VideoFrame` ring STARVES THE HARDWARE DECODER on Android.** Holding
  22 VideoFrames dropped the stream to 314 decoded frames in 45s (~7fps)
  and rVFC fired 69 times; the identical page under the ImageBitmap ring
  decoded 2,543. `new VideoFrame(video)` references MediaCodec output
  buffers; a ring of them exhausts the pool. **The ring must be COPIES**
  (`createImageBitmap`). The desktop spike could not see this because
  WebView2's decoder pool is larger.
- **The copy is cheap: 1.3-2.1ms per frame** on this GPU, presentation
  0.1ms. A native 1280x720 ring reached 66 frames (~244MB of bitmaps)
  with **zero capture failures and zero evictions**; the 640x360 ring
  (his phone's decode size, findings loop 38) is 41 x 0.9MB = ~37MB.
- **AUDIO FLOWS THROUGH THE DELAY, UNMUTED.** AnalyserNode RMS on the
  delayed output non-zero on 143 of 150 samples with the source
  non-zero on 118 of 150 (the source analyser reads the same graph so
  this is corroboration, not proof of the delay length). `pause` ->
  `AudioContext.suspend()` froze it: RMS tail 0.005 and state
  `suspended` 3s into the pause, then `play` resumed it.
- **Presentation keyed on `mediaTime` survives a pause**: A/V skew p50
  -49ms (the ring's frames are presented within one frame of D), and
  the pause did not collapse the delay on resume (the desktop probe's
  wall-clock pick would have).
- **The delayed canvas paints the real picture.** Read back with
  getImageData: mean luma 26 -> 81, sd 30 -> 64 across 8s. The CDP
  screenshot reads BLACK for a `desynchronized: true` canvas -- that is
  the screenshot path, not the display; do not use screenshots as
  evidence for this canvas.
- **The app's own pipeline kept running on the opacity-0 video** (its
  rVFC loop and patches are on the same element). Our canvas at z-index
  15 sits under the app's clip layer at 20, so the existing patches
  paint over the delayed picture with no renderer change.
- No DRM (`encrypted` never fired), no errors in any run.

**COSTS, honest:**

- **Seek recovery is 3.2-4.8s at D=2.5s, not D.** The player itself
  takes 1-2s to resume after a seek on this device and the ring only
  starts refilling once frames arrive. Every seek is a covered (whole
  blur) window of that length. Blur-first says that is correct; it is
  still the most visible cost of the design.
- **Frame drops were 39% with the native ring against 22-38% without**
  on a 720p60 stream this device cannot play cleanly with or without
  us; inconclusive here, and this device is not his (his phone decodes
  640x360 at 30fps).
- rAF read 20-22Hz with the ring and 11.7Hz in a control taken
  afterwards on the same page -- the render-loop number on this device
  is too noisy to attribute; the per-frame cost above is the honest
  figure.
- A seek/`resize`/`ratechange`/`loadstart` all flush; `seeking` is
  still the single choke point.

**WHAT THIS BUYS, sized against the shipped pipeline on this device
(live stage ring, 75s, all MoveNet slots n:0):** verdict pass 1337ms =
MoveNet+BlazeFace 799 (MoveNet alone 511, read off the position passes,
which admit nobody) + gender 536; verdicts every 2.1s; position passes
511ms each producing zero observations. So a frame captured at t has a
verdict by t + 2.1 + 1.3 = 3.4s worst case today. The delay the design
needs is (verdict interval + verdict latency) at whatever cadence the
GPU allows; dropping MoveNet where it admits nobody (his regime, 100%
of his phone) and running gender only for NEW or unresolved face tracks
brings the per-frame verdict to ~300ms (BlazeFace) and the interval to
the same, which puts D near 1s. That is the round that follows a yes.
