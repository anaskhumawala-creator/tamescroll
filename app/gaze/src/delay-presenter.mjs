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

var CANVAS_CLASS = 'ts-gaze-delay';
var Z_INDEX = 15;
// Same fallback string dom.js uses for PENDING_CLASS/FLAGGED_CLASS, so the
// launcher's blur-strength preset (--ts-blur-strong, set on <html>) reaches
// the refill cover too instead of a second, disagreeing constant.
var COVER_FILTER = 'blur(var(--ts-blur-strong, 24px))';
// HTMLVideoElement exposes no synchronous fps. His phone decodes 640x360
// at 30fps (findings loop 38); that is the regime this ring is sized for.
var ASSUMED_FPS = 30;
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
    errors: [],
  };
  function noteError(label, e) {
    if (stats.errors.length >= ERRORS_MAX) return;
    stats.errors.push(label + ': ' + (e && e.message ? e.message : String(e)));
  }

  var ring = []; // [{ bitmap, mediaTime, at }], ascending by mediaTime (capture order)
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

  function currentBudget() {
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 360;
    return ringBudget(w, h, ASSUMED_FPS, delayMs);
  }

  function flush(why) {
    try {
      for (var i = 0; i < ring.length; i++) closeBitmap(ring[i]);
    } catch (e) {
      noteError('flush', e);
    }
    ring = [];
    stats.ring = 0;
    stats.flushes++;
    presentedMediaTimeVal = null;
    refillState = refillStep(refillState, 'flush');
    applyCover();
  }

  function presentTick() {
    if (detached) return;
    var target;
    try {
      target = presentTarget(video.currentTime, delayMs, video.playbackRate || 1);
    } catch (e) {
      noteError('presentTarget', e);
      return;
    }
    var pick = pickPresent(ring, target);
    if (pick < 0) {
      stats.late++;
      return;
    }
    var entry = ring[pick];
    try {
      if (canvas.width !== entry.bitmap.width || canvas.height !== entry.bitmap.height) {
        canvas.width = entry.bitmap.width;
        canvas.height = entry.bitmap.height;
      }
      if (ctx) ctx.drawImage(entry.bitmap, 0, 0, canvas.width, canvas.height);
      stats.presented++;
      presentedMediaTimeVal = entry.mediaTime;
    } catch (e) {
      noteError('present', e);
    }
    var wasRefilling = refillState === 'refilling';
    refillState = refillStep(refillState, 'picked');
    if (wasRefilling && refillState === 'live') stats.refills++;
    applyCover();
    for (var i = 0; i <= pick; i++) closeBitmap(ring[i]);
    ring = ring.slice(pick + 1);
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
    presentTick();
  }

  function onVideoFrame(now, meta) {
    if (detached) return;
    var budget = currentBudget();
    var resizeOpts = budget.scale !== 1 ? { resizeWidth: budget.w, resizeHeight: budget.h } : {};
    var mediaTime = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
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

  function statsFn() {
    return {
      captured: stats.captured,
      presented: stats.presented,
      refills: stats.refills,
      flushes: stats.flushes,
      capFailed: stats.capFailed,
      ring: stats.ring,
      late: stats.late,
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

  return {
    cover: cover,
    flush: flush,
    detach: detach,
    presentedMediaTime: presentedMediaTime,
    stats: statsFn,
    requestVerdictFrame: requestVerdictFrame,
  };
}
