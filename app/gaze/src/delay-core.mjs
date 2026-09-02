// DELAY LINE — PURE RING LOGIC.
//
// The delay presenter (delay-presenter.mjs) shows the viewer a frame that
// is already `DELAY_MS` old, so detection runs ahead of what is on screen
// and a subject can be covered on the FIRST frame it is ever presented,
// instead of one-or-more verdicts late. This module is the pure math
// behind that ring: how big it should be, which entry to show, and the
// two-state refill machine that covers the picture while the ring is
// still filling after a discontinuity (seek, resize, ratechange).
//
// THE RING MUST BE BITMAP COPIES, NEVER `VideoFrame` REFERENCES.
// Measured on the arm64 Redmi (spikes/delay-line/FINDINGS.md, Android
// section, 2026-09-02): holding a ring of live `VideoFrame`s references
// MediaCodec output buffers directly, and a ring of them exhausts the
// decoder's buffer pool — the stream dropped to ~7fps (314 decoded
// frames in 45s, was 2,543 with a `createImageBitmap` ring). WebView2's
// desktop decoder pool is larger and could not see this. `ringBudget`
// therefore sizes a ring of independent bitmap copies (RGBA, 4 bytes per
// pixel), and `delay-presenter.mjs` must build the ring with
// `createImageBitmap(video, ...)`, never `new VideoFrame(video)`.

export var DELAY_MS = 1000; // OTA; 0 = presenter off
export function setDelayMs(v) {
  DELAY_MS = v;
}

export var RING_BYTES_MAX = 64 * 1024 * 1024;

var BYTES_PER_PIXEL = 4; // RGBA bitmap copy
var MIN_SCALE_WIDTH = 640;

/**
 * Given the source video's native size and fps, the ring length (frames)
 * and the capture scale that fit RING_BYTES_MAX for delayMs + 500ms of
 * slack (the presenter needs frames older than the presentation target
 * still sitting in the ring so a small stall does not immediately go
 * LATE). scale is 1 (native) or the factor that brings width down to
 * MIN_SCALE_WIDTH (640) — the one demotion this ring supports, matching
 * his phone's own decode width (findings loop 38).
 *
 * frames is fixed by delayMs + slack and never reduced: shortening the
 * ring is an exposure/latency question, not a memory one, and belongs to
 * a human ruling on DELAY_MS, not this function silently forgetting
 * frames it was asked to keep. When even the downscaled ring would
 * exceed RING_BYTES_MAX, bytes is capped at RING_BYTES_MAX (a fits-the-
 * budget ceiling for the caller to allocate against) rather than
 * dropping frames underneath the delay window.
 */
export function ringBudget(w, h, fps, delayMs) {
  var frames = Math.ceil((fps * (delayMs + 500)) / 1000);
  var scale = 1;
  var bw = w;
  var bh = h;
  var bytes = frames * bw * bh * BYTES_PER_PIXEL;
  if (bytes > RING_BYTES_MAX && bw > MIN_SCALE_WIDTH) {
    scale = MIN_SCALE_WIDTH / bw;
    bw = MIN_SCALE_WIDTH;
    bh = Math.round(bh * scale);
    bytes = frames * bw * bh * BYTES_PER_PIXEL;
  }
  if (bytes > RING_BYTES_MAX) {
    bytes = RING_BYTES_MAX;
  }
  return { frames: frames, scale: scale, w: bw, h: bh, bytes: bytes };
}

/**
 * Index of the newest ring entry with mediaTime <= targetMediaTime, or
 * -1 when the ring holds nothing that old yet (still filling, or the
 * target is behind everything captured so far). ring must be sorted by
 * mediaTime ascending, which is capture order.
 */
export function pickPresent(ring, targetMediaTime) {
  var picked = -1;
  for (var i = 0; i < ring.length; i++) {
    if (ring[i].mediaTime <= targetMediaTime) {
      picked = i;
    } else {
      break;
    }
  }
  return picked;
}

/** Target media time for presentation: currentTime minus the delay, scaled by playback rate. */
export function presentTarget(currentTime, delayMs, playbackRate) {
  return currentTime - (delayMs / 1000) * playbackRate;
}

/**
 * Refill state machine: 'live' | 'refilling'. A discontinuity (seek,
 * resize, ratechange, loadstart) flushes the ring and moves to
 * 'refilling' — the presenter covers the whole picture while in this
 * state. The first successful pick after a flush moves back to 'live'.
 */
export function refillStep(state, event) {
  if (event === 'flush') return 'refilling';
  if (event === 'picked') return 'live';
  return state;
}
