// Delay-line spike, ANDROID ARM (2026-09-02). EVIDENCE ONLY, nothing ships
// from this file. Injected over CDP into the app's live m.youtube watch
// page on the arm64 test device.
//
// The desktop spike (probe.js, 2026-08-25) answered the two kill risks:
// VideoFrame + rVFC work, and createMediaElementSource is accepted. It
// could not answer throughput, memory, unmuted audio, or anything on a
// phone. This one answers, on the device that matters:
//   1. ring memory: how many native frames the WebView holds before
//      capture starts failing, and what a 640x360 downscale buys;
//   2. capture + present cost per frame (VideoFrame vs createImageBitmap);
//   3. does audio actually FLOW through the delay (AnalyserNode RMS on
//      the delayed output, video UNMUTED), and does pause freeze it;
//   4. A/V skew: (presented frame age) - DELAY, keyed on mediaTime so a
//      pause does not collapse the delay;
//   5. seek: flush -> covered -> refill -> uncovered, and how long.
//
// Config is passed in by the runner as window.__TS_DELAY_CFG:
//   { delayMs, mode: 'videoframe'|'bitmap', resize: [w,h]|null, ringMax }
(function () {
  var cfg = window.__TS_DELAY_CFG || {};
  var host = document.querySelector('#movie_player');
  var v = document.querySelector('#movie_player video') || document.querySelector('video');
  if (!v || !host) return { error: 'no player' };
  if (window.__TS_DELAY) return { error: 'already running' };

  var DELAY_MS = cfg.delayMs || 1500;
  var MODE = cfg.mode || 'videoframe';
  var RESIZE = cfg.resize || null;
  var RING_MAX = cfg.ringMax || 120;

  var st = {
    cfg: { delayMs: DELAY_MS, mode: MODE, resize: RESIZE, ringMax: RING_MAX },
    ring: [],
    captured: 0,
    presented: 0,
    capFail: 0,
    closedForSpace: 0,
    capMs: [],
    presMs: [],
    skewMs: [],
    ringLen: [],
    rvfc: 0,
    refills: 0,
    flushes: [],
    errors: [],
    encrypted: false,
    started: performance.now(),
    inflight: 0,
  };
  window.__TS_DELAY = st;

  var canvas = document.createElement('canvas');
  canvas.id = 'ts-delay-canvas';
  // Between the video (html5-video-container z 10) and our clip layer
  // (z 20), so the app's own patches keep painting over the delayed
  // picture exactly as they paint over the live one.
  canvas.style.cssText =
    'position:absolute;left:0;top:0;width:100%;height:100%;z-index:15;pointer-events:none;background:#000';
  host.appendChild(canvas);
  var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  v.addEventListener('encrypted', function () { st.encrypted = true; });

  function frameW() { return RESIZE ? RESIZE[0] : v.videoWidth; }
  function frameH() { return RESIZE ? RESIZE[1] : v.videoHeight; }
  function sizeCanvas() {
    if (canvas.width !== frameW() || canvas.height !== frameH()) {
      canvas.width = frameW() || 640;
      canvas.height = frameH() || 360;
    }
  }
  function closeFrame(e) {
    try { e.frame.close(); } catch (x) {}
  }
  function flush(why) {
    for (var i = 0; i < st.ring.length; i++) closeFrame(st.ring[i]);
    st.ring = [];
    st.flushes.push({ why: why, at: Math.round(performance.now() - st.started), mt: v.currentTime });
  }
  var refilling = false;
  var refillStart = 0;
  function coverWhileRefilling(why) {
    flush(why);
    refilling = true;
    refillStart = performance.now();
    canvas.style.filter = 'blur(24px)';
  }
  v.addEventListener('seeking', function () { coverWhileRefilling('seeking'); });
  v.addEventListener('loadstart', function () { coverWhileRefilling('loadstart'); });
  v.addEventListener('resize', function () { coverWhileRefilling('resize'); });
  v.addEventListener('ratechange', function () { coverWhileRefilling('ratechange'); });

  // --- capture -------------------------------------------------------
  function capture(meta) {
    var t0 = performance.now();
    if (MODE === 'videoframe') {
      var f = new VideoFrame(v);
      st.capMs.push(performance.now() - t0);
      return Promise.resolve(f);
    }
    var opts = RESIZE ? { resizeWidth: RESIZE[0], resizeHeight: RESIZE[1], resizeQuality: 'low' } : {};
    st.inflight++;
    return createImageBitmap(v, opts).then(function (b) {
      st.inflight--;
      st.capMs.push(performance.now() - t0);
      return b;
    }, function (e) {
      st.inflight--;
      throw e;
    });
  }

  // --- present, keyed on MEDIA TIME so a pause freezes the delay
  // instead of collapsing it -------------------------------------------
  function present(now) {
    var target = v.currentTime - (DELAY_MS / 1000) * (v.playbackRate || 1);
    var pick = -1;
    for (var i = 0; i < st.ring.length; i++) {
      if (st.ring[i].mediaTime <= target) pick = i;
      else break;
    }
    if (pick < 0) return;
    var e = st.ring[pick];
    if (refilling) {
      refilling = false;
      canvas.style.filter = '';
      st.refills++;
      st.flushes[st.flushes.length - 1].refillMs = Math.round(performance.now() - refillStart);
    }
    var t0 = performance.now();
    sizeCanvas();
    try {
      ctx.drawImage(e.frame, 0, 0, canvas.width, canvas.height);
      st.presMs.push(performance.now() - t0);
      st.presented++;
      // Skew: how far past DELAY the presented frame is, in wall ms.
      st.skewMs.push(Math.round(now - e.at - DELAY_MS));
    } catch (x) {
      st.errors.push('present ' + String(x && x.message));
    }
    for (var j = 0; j <= pick; j++) closeFrame(st.ring[j]);
    st.ring = st.ring.slice(pick + 1);
  }

  function onFrame(now, meta) {
    st.rvfc++;
    try {
      if (st.ring.length >= RING_MAX) {
        closeFrame(st.ring.shift());
        st.closedForSpace++;
      }
      // Frames may arrive faster than a bitmap resolves; keep mediaTime
      // order by inserting on resolve (bitmaps resolve in order in
      // practice, but never assume it).
      capture(meta).then(function (frame) {
        st.captured++;
        st.ring.push({ frame: frame, mediaTime: meta.mediaTime, at: now });
        st.ring.sort(function (a, b) { return a.mediaTime - b.mediaTime; });
      }, function (e) {
        st.capFail++;
        if (st.errors.length < 8) st.errors.push('capture ' + String(e && e.message));
      });
      present(now);
      if (st.rvfc % 10 === 0) st.ringLen.push(st.ring.length);
    } catch (e) {
      st.errors.push(String(e && e.message));
    }
    v.requestVideoFrameCallback(onFrame);
  }
  if (typeof v.requestVideoFrameCallback !== 'function') return { error: 'no rVFC' };
  v.requestVideoFrameCallback(onFrame);
  v.style.opacity = '0';

  // --- audio ---------------------------------------------------------
  // One MediaElementSource per element, forever: reuse across configs.
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    var ac = window.__TS_DELAY_AC;
    var g = window.__TS_DELAY_GRAPH;
    if (!ac) {
      ac = new AC();
      var src = ac.createMediaElementSource(v);
      var delay = ac.createDelay(5.0);
      var an = ac.createAnalyser();
      an.fftSize = 1024;
      var anSrc = ac.createAnalyser();
      anSrc.fftSize = 1024;
      src.connect(anSrc);
      src.connect(delay);
      delay.connect(an);
      an.connect(ac.destination);
      g = { src: src, delay: delay, an: an, anSrc: anSrc };
      window.__TS_DELAY_AC = ac;
      window.__TS_DELAY_GRAPH = g;
    }
    g.delay.delayTime.value = DELAY_MS / 1000;
    if (ac.state !== 'running') ac.resume();
    v.muted = false;
    v.volume = 1;
    // Pause freezes the delay line's audio too, or the tail plays on.
    v.addEventListener('pause', function () { ac.suspend(); });
    v.addEventListener('play', function () { ac.resume(); });
    var buf = new Float32Array(g.an.fftSize);
    var bufS = new Float32Array(g.anSrc.fftSize);
    st.rms = [];
    st.rmsSrc = [];
    st.rmsTimer = setInterval(function () {
      try {
        g.an.getFloatTimeDomainData(buf);
        g.anSrc.getFloatTimeDomainData(bufS);
        var s = 0, s2 = 0;
        for (var i = 0; i < buf.length; i++) { s += buf[i] * buf[i]; s2 += bufS[i] * bufS[i]; }
        st.rms.push(Math.round(Math.sqrt(s / buf.length) * 1000) / 1000);
        st.rmsSrc.push(Math.round(Math.sqrt(s2 / bufS.length) * 1000) / 1000);
      } catch (e) {}
    }, 250);
    st.audio = { ok: true, ctxState: ac.state, delay: g.delay.delayTime.value, reused: !!window.__TS_DELAY_GRAPH };
  } catch (e) {
    st.audio = { ok: false, error: String(e && e.message) };
  }

  window.__TS_DELAY_STOP = function () {
    clearInterval(st.rmsTimer);
    flush('stop');
    canvas.remove();
    v.style.opacity = '';
    var d = window.__TS_DELAY;
    window.__TS_DELAY = null;
    return d;
  };
  return { started: true, mode: MODE, delayMs: DELAY_MS, resize: RESIZE, vw: v.videoWidth, vh: v.videoHeight };
})();
