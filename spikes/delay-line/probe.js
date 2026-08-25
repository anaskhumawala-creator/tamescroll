// Delay-line spike — plan-blur-v2 Stage 2. EVIDENCE ONLY, nothing ships
// from this file. Injected over CDP into a live YouTube watch page.
//
// The owner's bar is "not a single frame where the other gender is
// visible". Every round so far has chased that by making detection
// FASTER, which cannot reach zero by construction: the pipeline reacts to
// a frame the user has already been shown. A delay line inverts that. The
// real <video> keeps decoding at opacity 0; we capture each frame into a
// ring and present it ~350ms later on a canvas. Detection then always has
// a head start on what the user sees, so a frame can be held back until
// its verdict exists rather than corrected afterwards.
//
// This probe answers only the questions that decide whether the approach
// is viable at all, in the order that kills it fastest:
//   1. does frame capture + delayed presentation work in WebView2?
//   2. does audio survive? createMediaElementSource is PERMANENT per
//      element and conflicting with YouTube's own graph = silent video,
//      which is the failure that would be unrecoverable on a real user.
//   3. does A/V stay inside the +-80ms bar?
//   4. what does it cost in dropped frames and GPU memory?
(function () {
  var host = document.querySelector('#movie_player');
  var v = document.querySelector('video');
  if (!v || !host) return { error: 'no player' };
  if (window.__TS_DELAY) return { error: 'already running' };

  var DELAY_MS = 350;
  var RING_MAX = 40; // ~1.3s at 30fps; VideoFrames are GPU-backed, close() matters

  var state = {
    ring: [],
    presented: 0,
    dropped: 0,
    closedForSpace: 0,
    lastPresentedMediaTime: null,
    audio: null,
    encrypted: false,
    started: Date.now(),
    errors: [],
  };
  window.__TS_DELAY = state;

  // --- video path ----------------------------------------------------
  var canvas = document.createElement('canvas');
  canvas.id = 'ts-delay-canvas';
  canvas.style.cssText =
    'position:absolute;left:0;top:0;width:100%;height:100%;z-index:5;pointer-events:none;background:#000';
  host.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // DRM kills canvas capture dead (black frames, no error). Detect it
  // rather than shipping a black player.
  v.addEventListener('encrypted', function () {
    state.encrypted = true;
  });

  function sizeCanvas() {
    if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
      canvas.width = v.videoWidth || 1280;
      canvas.height = v.videoHeight || 720;
    }
  }

  function flush(why) {
    for (var i = 0; i < state.ring.length; i++) {
      try {
        state.ring[i].frame.close();
      } catch (e) {}
    }
    state.ring = [];
    state.lastFlush = why;
  }

  // SEEK / ARROW KEYS / SCRUBBING — the owner's question, and the case
  // where a delay line is most dangerous rather than least.
  //
  // Arrow keys jump 5s, J/L jump 10s, clicking the scrubber jumps
  // anywhere, and each one makes mediaTime discontinuous. Two things go
  // wrong if the ring is not handled:
  //   1. presenting frames captured BEFORE the seek shows the user the
  //      previous scene for up to DELAY_MS — wrong content, and content
  //      whose verdict belongs to somewhere else entirely;
  //   2. the ring then needs DELAY_MS to refill, and during that gap
  //      there is nothing delayed to present.
  //
  // Flushing fixes (1). (2) is the interesting one, because the obvious
  // answers are both wrong: showing the LIVE video during the gap drops
  // us back to the reactive path we are building this to escape, and
  // holding the last frame shows stale content. So the gap is COVERED —
  // the same whole-blur the app already uses before models are ready.
  // Blur-first is the house rule and a seek is exactly an "unknown"
  // moment. It costs a third of a second of blur per arrow press, and it
  // cannot expose anybody.
  //
  // `seeking` fires on every one of these (arrow keys, J/L, scrubber
  // drag, chapter clicks, SPA restore) — it is the single choke point,
  // which is why it is the only listener needed for the whole class.
  var refilling = false;
  function coverWhileRefilling(why) {
    flush(why);
    refilling = true;
    canvas.style.filter = 'blur(24px)';
  }
  v.addEventListener('seeking', function () {
    coverWhileRefilling('seeking');
  });
  v.addEventListener('loadstart', function () {
    coverWhileRefilling('loadstart');
  });
  // A resolution change swaps the decoder and mediaTime keeps running,
  // but every buffered frame is the wrong size.
  v.addEventListener('resize', function () {
    coverWhileRefilling('resize');
  });
  // Rate changes rescale how much wall-clock DELAY_MS is worth. At 2x a
  // 350ms delay is 700ms of content, so the ring must be re-measured
  // rather than reused.
  v.addEventListener('ratechange', function () {
    coverWhileRefilling('ratechange');
  });
  state.refills = 0;

  var useVideoFrame = typeof VideoFrame === 'function';
  state.useVideoFrame = useVideoFrame;

  function onFrame(now, meta) {
    try {
      sizeCanvas();
      if (state.ring.length >= RING_MAX) {
        var old = state.ring.shift();
        try {
          old.frame.close();
        } catch (e) {}
        state.closedForSpace++;
      }
      var f = useVideoFrame ? new VideoFrame(v) : null;
      if (f) {
        state.ring.push({ frame: f, mediaTime: meta.mediaTime, at: now });
      }
      // Present the oldest frame that is at least DELAY_MS old.
      var cutoff = now - DELAY_MS;
      var pick = -1;
      for (var i = 0; i < state.ring.length; i++) {
        if (state.ring[i].at <= cutoff) pick = i;
        else break;
      }
      if (pick >= 0) {
        var entry = state.ring[pick];
        if (refilling) {
          // The ring has reached DELAY_MS of fresh content again, so the
          // frame we are about to present is genuinely from after the
          // seek. Uncover.
          refilling = false;
          canvas.style.filter = '';
          state.refills++;
        }
        ctx.drawImage(entry.frame, 0, 0, canvas.width, canvas.height);
        state.presented++;
        state.lastPresentedMediaTime = entry.mediaTime;
        // Everything up to and including `pick` is now spent.
        for (var j = 0; j <= pick; j++) {
          try {
            state.ring[j].frame.close();
          } catch (e) {}
        }
        state.ring = state.ring.slice(pick + 1);
      }
    } catch (e) {
      state.errors.push(String(e && e.message));
    }
    v.requestVideoFrameCallback(onFrame);
  }

  if (typeof v.requestVideoFrameCallback !== 'function') {
    return { error: 'no requestVideoFrameCallback' };
  }
  v.requestVideoFrameCallback(onFrame);
  v.style.opacity = '0';

  // --- audio path ----------------------------------------------------
  // THE DANGEROUS PART. createMediaElementSource() is permanent for the
  // lifetime of the element and there can be only one; if YouTube already
  // holds one, or if taking it breaks their graph, the page goes silent
  // and nothing here can undo it. So: try, and record exactly what
  // happened, on a page we are willing to throw away.
  state.audioAttempted = false;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      state.audioAttempted = true;
      var ac = new AC();
      var src = ac.createMediaElementSource(v);
      var delay = ac.createDelay(1.0);
      delay.delayTime.value = DELAY_MS / 1000;
      src.connect(delay);
      delay.connect(ac.destination);
      state.audio = { ok: true, ctxState: ac.state, delay: delay.delayTime.value };
      window.__TS_DELAY_AC = ac;
    }
  } catch (e) {
    state.audio = { ok: false, error: String(e && e.message) };
  }

  return { started: true, useVideoFrame: useVideoFrame, audioAttempted: state.audioAttempted };
})();
