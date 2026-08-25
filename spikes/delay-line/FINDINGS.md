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
