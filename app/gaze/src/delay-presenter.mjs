// DELAY PRESENTER — DOM HALF OF THE DELAY LINE.
//
// Detection runs on a frame BEFORE the viewer sees it, so a subject can be
// covered from the first frame it is ever presented instead of one-or-more
// verdicts late (the two-way latency the owner reported: blur arriving
// late on a new subject, blur lingering after they leave frame). This
// module is the DOM engine for that: it hides the real <video> (opacity
// 0, decoding continues), captures every frame it produces into a ring of
// bitmap copies, and paints the caller a canvas that is always `DELAY_MS`
// behind `video.currentTime`. `delay-core.mjs` is the pure math this
// module drives (ring sizing, which entry to show, the refill state
// machine); nothing here computes without going through it.
//
// THE RING IS BITMAP COPIES, NEVER `VideoFrame` REFERENCES. Measured on
// the arm64 Redmi (spikes/delay-line/FINDINGS.md, Android section,
// 2026-09-02): a ring of live `VideoFrame`s references MediaCodec output
// buffers directly, and holding ~20 of them exhausted the decoder's
// buffer pool — the stream dropped to ~7fps (314 decoded frames in 45s,
// vs 2,543 with a `createImageBitmap` ring on the identical page). The
// desktop spike could not see this; WebView2's decoder pool is larger.
// So every capture here goes through `createImageBitmap(video, ...)` and
// closes its own copy when evicted or consumed — never `new
// VideoFrame(video)`.
//
// Every DOM and WebAudio call is wrapped: a presenter fault must degrade
// (recorded into `stats().errors`, capped) rather than throw into the
// player's render loop, which this sits directly in front of.

import { ringBudget, pickPresent, presentTarget, refillStep, DELAY_MS } from './delay-core.mjs';
import { GATE_SIZE, CUT_DELTA, lumaGrid, meanAbsDelta } from './scene-gate.mjs';

var CANVAS_CLASS = 'ts-gaze-delay';
var Z_INDEX = 15;
// Same fallback string dom.js uses for PENDING_CLASS/FLAGGED_CLASS, so the
// launcher's blur-strength preset (--ts-blur-strong, set on <html>) reaches
// the refill cover too instead of a second, disagreeing constant.
var COVER_FILTER = 'blur(var(--ts-blur-strong, 24px))';
// HTMLVideoElement exposes no synchronous fps. His phone decodes 640x360
// at 30fps (findings loop 38); that is the FALLBACK this ring is sized
// for until enough real samples exist to measure it (I9). A hard-coded
// 30 with no measurement left a 60fps stream's ring spanning 0.75s of a
// 1.0s delay: `pickPresent` returned -1 forever and the presenter never
// left 'refilling' -- permanent whole-video blur, which is the exposure
// that matters (a user who sees that turns the feature off).
var ASSUMED_FPS = 30;
// Rolling window of instantaneous fps samples (1 / mediaTime delta)
// between consecutive rVFC callbacks -- the real output cadence, not
// affected by whether a given frame's capture succeeds.
var FPS_SAMPLES_MAX = 30;
var FPS_SAMPLES_MIN = 10;
// How far the measured fps must drift from what the ring is CURRENTLY
// sized for before the eviction budget is re-derived. Without a
// threshold, per-frame timer jitter would thrash `ringBudget`'s frame
// count every single capture; a real rate change (30fps content next to
// 60fps content, say) must still move it.
var FPS_RESIZE_THRESHOLD = 0.2;
var ERRORS_MAX = 8;

/**
 * Attach a delay presenter to a playing player <video>. Returns null when
 * unsupported (no `requestVideoFrameCallback`, no `createImageBitmap`, or
 * `host` does not actually contain `video`) so the caller falls back to
 * the live (undelayed) path rather than half-attaching.
 *
 * opts: { delayMs, onFrame(bitmapClone, mediaTime, atMs) } — delayMs
 * overrides delay-core's OTA `DELAY_MS` for this attachment; onFrame is an
 * optional per-capture hook (a clone is handed out, same contract as
 * `requestVerdictFrame`), unused by the wiring today but part of the
 * interface for a future push-based consumer.
 */
export function attachDelay(video, host, opts) {
  opts = opts || {};
  if (!video || !host) return null;
  if (typeof video.requestVideoFrameCallback !== 'function') return null;
  if (typeof createImageBitmap !== 'function') return null;
  if (typeof host.contains === 'function' && !host.contains(video)) return null;

  var delayMs = opts.delayMs > 0 ? opts.delayMs : DELAY_MS;
  var onFrame = typeof opts.onFrame === 'function' ? opts.onFrame : null;

  var stats = {
    captured: 0,
    presented: 0,
    refills: 0,
    flushes: 0,
    capFailed: 0,
    ring: 0,
    late: 0,
    // I9: a presentation forced past the target because the ring is at
    // its own cap and cannot hold anything older -- the delay
    // effectively shrank for that frame rather than the picture staying
    // frozen/covered. See presentTick.
    delayCollapsed: 0,
    // Blur-in-frame: frames redrawn because the patch list moved between
    // two presented frames, and the patch count drawn on the last one.
    repaints: 0,
    patchesDrawn: 0,
    errors: [],
  };
  function noteError(label, e) {
    if (stats.errors.length >= ERRORS_MAX) return;
    stats.errors.push(label + ': ' + (e && e.message ? e.message : String(e)));
  }

  var ring = []; // [{ bitmap, mediaTime, at }], ascending by mediaTime (capture order)
  var lastPresented = null; // the ring entry on the canvas right now
  // I9: rolling fps measurement. `fpsSamples` holds instantaneous fps
  // values (1 / mediaTime delta) from consecutive rVFC callbacks;
  // `sizedForFps` is the rate the ring's CURRENT eviction budget was
  // last derived from -- only re-derived when the measured rate has
  // moved past FPS_RESIZE_THRESHOLD, so ordinary sample jitter cannot
  // thrash the ring size every frame.
  var fpsSamples = [];
  var lastCaptureMediaTime = null;
  var sizedForFps = ASSUMED_FPS;
  // Blur-first: covered until the ring has filled enough for a real pick.
  var refillState = 'refilling';
  var externalCover = false;
  var presentedMediaTimeVal = null;
  var detached = false;
  var audioGraph = null;
  var listeners = []; // [{ target, type, fn }] — removed on detach

  function addListener(target, type, fn, trackForDetach) {
    try {
      target.addEventListener(type, fn);
      if (trackForDetach !== false) listeners.push({ target: target, type: type, fn: fn });
    } catch (e) {
      noteError('listen:' + type, e);
    }
  }

  var canvas = null;
  var ctx = null;
  try {
    canvas = document.createElement('canvas');
    canvas.className = CANVAS_CLASS;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    // A canvas is a REPLACED element: inset:0 alone leaves it at its
    // intrinsic (frame) size, so a 640x360 ring drew a 640x360 picture
    // into a 393x221 player and the viewer saw its top-left crop
    // (measured on the Redmi, latency-ab-stageB: canvas [0,48,640,360]
    // against video [0,48,393,221]). Stretch it to the host like the
    // video it replaces.
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // And CONTAIN it, the way the <video> it replaces is laid out. In
    // portrait the player box and the video coincide, so a stretched
    // canvas looked right; rotated (or fullscreen) the player is wider
    // than the video and the video letterboxes inside it -- measured on
    // the Redmi in landscape: video [85,48,652,367] inside a canvas
    // [0,48,823,367]. A stretched canvas there draws a 16:9 frame at
    // 2.24:1, and every patch (positioned against the VIDEO rect) lands
    // beside the face it was drawn for. object-fit applies to a canvas
    // as to any replaced element; the letterbox shows the host's black.
    canvas.style.objectFit = 'contain';
    canvas.style.zIndex = String(Z_INDEX);
    canvas.style.pointerEvents = 'none';
    host.appendChild(canvas);
  } catch (e) {
    noteError('canvas', e);
    return null;
  }
  try {
    ctx = canvas.getContext ? canvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
  } catch (e) {
    noteError('ctx', e);
  }
  try {
    video.style.opacity = '0';
  } catch (e) {
    noteError('opacity', e);
  }

  function applyCover() {
    try {
      canvas.style.filter = refillState === 'refilling' || externalCover ? COVER_FILTER : '';
    } catch (e) {
      noteError('applyCover', e);
    }
  }
  applyCover();

  function closeBitmap(entry) {
    try {
      if (entry && entry.bitmap && typeof entry.bitmap.close === 'function') entry.bitmap.close();
    } catch (e) {
      noteError('close', e);
    }
  }

  // I9: called once per rVFC callback with that frame's own mediaTime,
  // BEFORE capture is attempted -- the output cadence is real whether or
  // not this particular frame's async createImageBitmap succeeds.
  function noteFrameInterval(mediaTime) {
    if (lastCaptureMediaTime != null) {
      var dt = mediaTime - lastCaptureMediaTime;
      // Only a sane, forward, sub-second gap counts. A seek/loadstart
      // (flush resets lastCaptureMediaTime) or a non-monotonic read must
      // not corrupt the estimate with a division by a near-zero or
      // negative delta.
      if (dt > 0 && dt < 1) {
        fpsSamples.push(1 / dt);
        if (fpsSamples.length > FPS_SAMPLES_MAX) fpsSamples.shift();
      }
    }
    lastCaptureMediaTime = mediaTime;
  }

  function measuredFps() {
    if (fpsSamples.length < FPS_SAMPLES_MIN) return ASSUMED_FPS;
    var sorted = fpsSamples.slice().sort(function (a, b) {
      return a - b;
    });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function currentBudget() {
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 360;
    var fps = measuredFps();
    if (Math.abs(fps - sizedForFps) / sizedForFps > FPS_RESIZE_THRESHOLD) {
      sizedForFps = fps;
    }
    return ringBudget(w, h, sizedForFps, delayMs);
  }

  function flush(why) {
    try {
      for (var i = 0; i < ring.length; i++) closeBitmap(ring[i]);
    } catch (e) {
      noteError('flush', e);
    }
    ring = [];
    lastPresented = null;
    stats.ring = 0;
    stats.flushes++;
    presentedMediaTimeVal = null;
    refillState = refillStep(refillState, 'flush');
    // I9: a discontinuity's mediaTime jump must not be read as a frame
    // interval (it would corrupt the fps estimate, possibly badly), so
    // the sample history resets with it. `sizedForFps` is left alone --
    // a seek does not change the stream's own frame rate.
    fpsSamples = [];
    lastCaptureMediaTime = null;
    applyCover();
  }

  function presentTick(budget) {
    if (detached) return;
    var target;
    try {
      target = presentTarget(video.currentTime, delayMs, video.playbackRate || 1);
    } catch (e) {
      noteError('presentTarget', e);
      return;
    }
    var pick = pickPresent(ring, target);
    var collapsed = false;
    if (pick < 0) {
      // I9: normally "nothing old enough yet" means wait for the next
      // capture. But when the ring is already at its OWN eviction cap
      // and its oldest entry is still newer than the target, waiting
      // can never help -- the cap guarantees nothing older will ever
      // arrive (each new capture evicts the oldest first). Left alone
      // this is a PERMANENT freeze: pickPresent returns -1 forever,
      // refillState never leaves 'refilling', and the whole video stays
      // covered for the life of the page. Present the oldest entry
      // anyway -- the delay effectively shrinks for this frame, which
      // is the safe direction (still covering, never exposing a frame
      // detection has not seen) -- and count it separately so a report
      // can tell "waiting normally" apart from "the ring cannot serve
      // the requested delay".
      if (ring.length > 0 && budget && ring.length >= budget.frames && ring[0].mediaTime > target) {
        pick = 0;
        collapsed = true;
      } else {
        stats.late++;
        return;
      }
    }
    var entry = ring[pick];
    // The picked entry STAYS in the ring until something newer is
    // picked. rVFC skips frames under load (the Redmi captured 22 of 30
    // a second), so consecutive ring entries can be two frame periods
    // apart while the target advances one tick at a time: dropping the
    // picked frame made the very next tick find nothing old enough and
    // count itself `late` -- 42% of ticks in latency-ab-stageB, and a
    // picture that held for a tick then jumped. Re-picking the same
    // entry is a no-op: nothing drawn, nothing counted.
    if (entry === lastPresented && !collapsed) {
      for (var k = 0; k < pick; k++) closeBitmap(ring[k]);
      if (pick > 0) ring = ring.slice(pick);
      stats.ring = ring.length;
      return;
    }
    lastPresented = entry;
    try {
      if (canvas.width !== entry.bitmap.width || canvas.height !== entry.bitmap.height) {
        canvas.width = entry.bitmap.width;
        canvas.height = entry.bitmap.height;
      }
      if (ctx) ctx.drawImage(entry.bitmap, 0, 0, canvas.width, canvas.height);
      drawPatches(entry.bitmap);
      stats.presented++;
      if (collapsed) stats.delayCollapsed++;
      presentedMediaTimeVal = entry.mediaTime;
    } catch (e) {
      noteError('present', e);
    }
    var wasRefilling = refillState === 'refilling';
    refillState = refillStep(refillState, 'picked');
    if (wasRefilling && refillState === 'live') stats.refills++;
    applyCover();
    for (var i = 0; i < pick; i++) closeBitmap(ring[i]);
    ring = ring.slice(pick);
    stats.ring = ring.length;
  }

  function onCapturedFrame(bitmap, mediaTime, atMs, budget) {
    if (detached) {
      try {
        bitmap.close();
      } catch (e) {
        /* best-effort */
      }
      return;
    }
    stats.captured++;
    ring.push({ bitmap: bitmap, mediaTime: mediaTime, at: atMs });
    while (ring.length > budget.frames) {
      closeBitmap(ring.shift());
    }
    stats.ring = ring.length;
    if (onFrame) {
      try {
        Promise.resolve(createImageBitmap(bitmap)).then(
          function (clone) {
            try {
              onFrame(clone, mediaTime, atMs);
            } catch (e) {
              noteError('onFrame', e);
            }
          },
          function (e) {
            noteError('onFrame-clone', e);
          }
        );
      } catch (e) {
        noteError('onFrame', e);
      }
    }
    presentTick(budget);
  }

  function onVideoFrame(now, meta) {
    if (detached) return;
    var mediaTime = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
    // I9: fed from the real rVFC cadence before anything else touches
    // this frame, so the fps estimate is not skewed by capture success.
    noteFrameInterval(mediaTime);
    var budget = currentBudget();
    var resizeOpts = budget.scale !== 1 ? { resizeWidth: budget.w, resizeHeight: budget.h } : {};
    var atMs = now;
    try {
      Promise.resolve(createImageBitmap(video, resizeOpts)).then(
        function (bitmap) {
          onCapturedFrame(bitmap, mediaTime, atMs, budget);
        },
        function (e) {
          stats.capFailed++;
          noteError('capture', e);
        }
      );
    } catch (e) {
      stats.capFailed++;
      noteError('capture', e);
    }
    try {
      video.requestVideoFrameCallback(onVideoFrame);
    } catch (e) {
      noteError('rvfc', e);
    }
  }

  function onDiscontinuity(evt) {
    flush((evt && evt.type) || 'discontinuity');
  }
  addListener(video, 'seeking', onDiscontinuity);
  addListener(video, 'loadstart', onDiscontinuity);
  addListener(video, 'resize', onDiscontinuity);
  addListener(video, 'ratechange', onDiscontinuity);

  if (typeof document !== 'undefined' && document.addEventListener) {
    addListener(document, 'visibilitychange', function () {
      if (document.hidden) flush('hidden');
    });
  }

  // WebAudio: one AudioContext + createMediaElementSource per element,
  // forever — the source node cannot be reattached elsewhere and a
  // second one on the same element throws. The pause/play listeners that
  // keep it in step with playback are NOT torn down on detach; the graph
  // outlives the visual presenter so a later re-attach does not have to
  // recreate it and does not risk a second createMediaElementSource call.
  function setupAudio() {
    try {
      var AC =
        (typeof AudioContext !== 'undefined' && AudioContext) ||
        (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
      if (!AC) return;
      var graph = video.__tsDelayGraph;
      if (!graph) {
        var ctx2 = new AC();
        var src = ctx2.createMediaElementSource(video);
        var delayNode = ctx2.createDelay(5.0);
        src.connect(delayNode);
        delayNode.connect(ctx2.destination);
        graph = { ctx: ctx2, src: src, delay: delayNode };
        video.__tsDelayGraph = graph;
        addListener(
          video,
          'pause',
          function () {
            try {
              graph.ctx.suspend();
            } catch (e) {
              noteError('audio-suspend', e);
            }
          },
          false
        );
        addListener(
          video,
          'play',
          function () {
            try {
              graph.ctx.resume();
            } catch (e) {
              noteError('audio-resume', e);
            }
          },
          false
        );
      }
      graph.delay.delayTime.value = delayMs / 1000;
      audioGraph = graph;
    } catch (e) {
      noteError('audio', e);
    }
  }
  setupAudio();

  try {
    video.requestVideoFrameCallback(onVideoFrame);
  } catch (e) {
    noteError('rvfc', e);
  }

  function cover(v) {
    externalCover = !!v;
    applyCover();
  }

  // --- BLUR DRAWN INTO THE FRAME (idea #5) ----------------------------------
  // The renderer hands over, every rAF, the rectangles it would have
  // placed as overlay divs (video-region.setPainter), normalized to the
  // video: {x,y,w,h, br: blur radius / video width, rr: corner radius /
  // video width}. Each is drawn as a rounded clip filled with the SAME
  // frame region blurred by ctx.filter -- the source rect padded by 2x
  // the radius so the clip edge sits on fully-sampled pixels and stays
  // solid (a blur of an unpadded region fades to transparent at its
  // border, which would be a soft-edged patch the LOOK contract forbids).
  // presentTick draws the frame THEN the patches, so a new frame is never
  // on screen without the latest patches; paintPatches redraws the held
  // frame only when a rounded canvas-pixel rect actually changed.
  var patches = [];
  var patchesKey = '';
  function canPaint() {
    try {
      return !!ctx && 'filter' in ctx;
    } catch (e) {
      return false;
    }
  }
  function roundRectPath(g, x, y, w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + rr, y);
    g.lineTo(x + w - rr, y);
    g.arcTo(x + w, y, x + w, y + rr, rr);
    g.lineTo(x + w, y + h - rr);
    g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    g.lineTo(x + rr, y + h);
    g.arcTo(x, y + h, x, y + h - rr, rr);
    g.lineTo(x, y + rr);
    g.arcTo(x, y, x + rr, y, rr);
    g.closePath();
  }
  function drawPatches(bitmap) {
    if (!ctx || !patches.length || !bitmap) {
      stats.patchesDrawn = 0;
      return;
    }
    var W = canvas.width;
    var H = canvas.height;
    var n = 0;
    for (var i = 0; i < patches.length; i++) {
      var q = patches[i];
      var x = Math.round(q.x * W);
      var y = Math.round(q.y * H);
      var w = Math.round(q.w * W);
      var h = Math.round(q.h * H);
      if (!(w > 0) || !(h > 0)) continue;
      var b = Math.max(1, Math.round(q.br * W));
      var r = Math.round(q.rr * W);
      var pad = 2 * b;
      try {
        ctx.save();
        ctx.beginPath();
        roundRectPath(ctx, x, y, w, h, r);
        ctx.clip();
        ctx.filter = 'blur(' + b + 'px)';
        ctx.drawImage(bitmap, x - pad, y - pad, w + 2 * pad, h + 2 * pad, x - pad, y - pad, w + 2 * pad, h + 2 * pad);
        ctx.restore();
        n++;
      } catch (e) {
        try { ctx.restore(); } catch (e2) { /* already balanced */ }
        noteError('patch', e);
      }
    }
    stats.patchesDrawn = n;
  }
  function paintPatches(list) {
    if (detached) return;
    var next = Array.isArray(list) ? list : [];
    var W = canvas.width;
    var H = canvas.height;
    var key = '';
    for (var i = 0; i < next.length; i++) {
      var q = next[i];
      key += Math.round(q.x * W) + ',' + Math.round(q.y * H) + ',' + Math.round(q.w * W) + ',' + Math.round(q.h * H) + ',' + Math.round(q.br * W) + ';';
    }
    if (key === patchesKey) return;
    patches = next;
    patchesKey = key;
    if (!lastPresented || !ctx) return;
    try {
      ctx.drawImage(lastPresented.bitmap, 0, 0, W, H);
      drawPatches(lastPresented.bitmap);
      stats.repaints++;
    } catch (e) {
      noteError('repaint', e);
    }
  }

  function detach() {
    if (detached) return;
    detached = true;
    for (var i = 0; i < listeners.length; i++) {
      var l = listeners[i];
      try {
        l.target.removeEventListener(l.type, l.fn);
      } catch (e) {
        noteError('detach-listener', e);
      }
    }
    listeners.length = 0;
    try {
      for (var j = 0; j < ring.length; j++) closeBitmap(ring[j]);
    } catch (e) {
      noteError('detach-flush', e);
    }
    ring = [];
    lastPresented = null;
    stats.ring = 0;
    presentedMediaTimeVal = null;
    try {
      if (canvas.parentNode && canvas.parentNode.removeChild) canvas.parentNode.removeChild(canvas);
      else if (host.removeChild) host.removeChild(canvas);
    } catch (e) {
      noteError('detach-canvas', e);
    }
    try {
      video.style.opacity = '';
    } catch (e) {
      noteError('detach-opacity', e);
    }
    if (audioGraph) {
      try {
        audioGraph.delay.delayTime.value = 0;
        audioGraph.ctx.resume();
      } catch (e) {
        noteError('detach-audio', e);
      }
    }
  }

  function presentedMediaTime() {
    return presentedMediaTimeVal;
  }

  /** Media time of the newest captured frame (the one the live video is
   *  showing), or null when the ring is empty. The scene gate keys a cut
   *  on it so the cut lands ON the frame that showed it, not at a clock
   *  reading 10-100ms later (1096f). */
  function newestMediaTime() {
    return ring.length ? ring[ring.length - 1].mediaTime : null;
  }

  function statsFn() {
    return {
      captured: stats.captured,
      presented: stats.presented,
      repaints: stats.repaints,
      patchesDrawn: stats.patchesDrawn,
      refills: stats.refills,
      flushes: stats.flushes,
      capFailed: stats.capFailed,
      ring: stats.ring,
      late: stats.late,
      delayCollapsed: stats.delayCollapsed,
      errors: stats.errors.slice(),
    };
  }

  /** Newest ring frame, cloned — the freshest thing the ring holds, for
   * detection to read ahead of what is presented. The ring keeps its own
   * copy; the caller owns and must close the clone it gets back. */
  function requestVerdictFrame() {
    if (detached || !ring.length) return Promise.resolve(null);
    var newest = ring[ring.length - 1];
    try {
      return Promise.resolve(createImageBitmap(newest.bitmap)).then(
        function (clone) {
          return { bitmap: clone, mediaTime: newest.mediaTime, atMs: newest.at };
        },
        function (e) {
          noteError('verdict-clone', e);
          return null;
        }
      );
    } catch (e) {
      noteError('verdict-clone', e);
      return Promise.resolve(null);
    }
  }

  // THE CUT IS LOCATED ON THE RING, NOT AT THE GATE SAMPLE (phase-m M4).
  // The scene gate samples the live video every 100ms and compares two
  // samples, so all it knows is that the cut happened somewhere in the
  // 100ms ending at the sample; keying it there put up to 3-4 presented
  // frames of the NEW shot on the old shot's side of `cutBetween`, where
  // boxesAt resolved them against the old shot's snapshot. The ring holds
  // every frame of that window, so the frame that carried the cut can be
  // found by the same 16x16 luma delta the gate uses, frame by frame:
  // the largest single-frame delta in (from, to] is the first frame of
  // the new shot, and a cut keyed AT it lands that frame on the new side
  // (cutBetween is (from, to]). Returns null when the ring cannot answer
  // (no frames in the window, or no frame-to-frame delta reaching half
  // the gate's own threshold -- a gradual change is not a cut) and the
  // caller keeps the gate's own reading. Cost: at most the frames of one
  // gate interval through a 16x16 canvas, only when the gate fires.
  var cutCanvas = null;
  function frameLuma(entry) {
    if (!cutCanvas) {
      cutCanvas = document.createElement('canvas');
      cutCanvas.width = GATE_SIZE;
      cutCanvas.height = GATE_SIZE;
    }
    var g = cutCanvas.getContext('2d', { willReadFrequently: true });
    if (!g || typeof g.getImageData !== 'function') return null;
    g.drawImage(entry.bitmap, 0, 0, GATE_SIZE, GATE_SIZE);
    return lumaGrid(g.getImageData(0, 0, GATE_SIZE, GATE_SIZE).data, GATE_SIZE * GATE_SIZE);
  }
  function locateCut(fromMediaTime, toMediaTime, minDelta) {
    if (detached || ring.length < 2) return null;
    if (typeof fromMediaTime !== 'number' || typeof toMediaTime !== 'number') return null;
    var floor = typeof minDelta === 'number' ? minDelta : CUT_DELTA / 2;
    try {
      var best = -1;
      var bestDelta = -1;
      var prevIdx = -1;
      var prevL = null;
      for (var i = 1; i < ring.length; i++) {
        var m = ring[i].mediaTime;
        if (m <= fromMediaTime) continue;
        if (m > toMediaTime) break;
        var a = prevIdx === i - 1 ? prevL : frameLuma(ring[i - 1]);
        var b = frameLuma(ring[i]);
        if (!a || !b) return null;
        var d = meanAbsDelta(a, b);
        if (d > bestDelta) {
          bestDelta = d;
          best = i;
        }
        prevIdx = i;
        prevL = b;
      }
      if (best < 0 || bestDelta < floor) return null;
      return ring[best].mediaTime;
    } catch (e) {
      noteError('locateCut', e);
      return null;
    }
  }

  return {
    cover: cover,
    flush: flush,
    detach: detach,
    presentedMediaTime: presentedMediaTime,
    stats: statsFn,
    requestVerdictFrame: requestVerdictFrame,
    newestMediaTime: newestMediaTime,
    locateCut: locateCut,
    canPaint: canPaint,
    paintPatches: paintPatches,
  };
}
