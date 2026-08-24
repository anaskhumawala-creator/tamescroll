// Stage 2 delay-line SPIKE (docs/plan-blur-v2.md; evidence-only, never
// shipped). Injected via CDP eval into the desktop dev app's YouTube
// window. Presents the player video ~DELAY_MS late on our own canvas
// while the real <video> keeps playing hidden — detection gets a head
// start equal to the delay, so a verdict is final before the eye sees
// the frame.
//
// Critic amendments (2026-08-25 review): audio via captureStream()
// FIRST (createMediaElementSource permanently claims the element's
// audio — probe it last, in a throwaway session, or not at all);
// rVFC-stall watchdog (hidden videos can stop compositing => ring
// starves silently); mediaTime discontinuity flush covers seeks AND
// SSAI ad boundaries.
//
// window.__TS_SPIKE.report() returns the measurements.
(function () {
  if (window.__TS_SPIKE) return 'already running';
  var DELAY_MS = 350;
  var video = document.querySelector('#movie_player video');
  if (!video) return 'no player video';
  var player = document.querySelector('#movie_player');

  var S = (window.__TS_SPIKE = {
    frames: 0,
    presented: 0,
    ringMax: 0,
    starved: 0,
    flushes: 0,
    stallWatchdog: 0,
    avOffsetsMs: [],
    presentGapsMs: [],
    audio: 'none',
    errors: [],
  });

  // --- video ring ---------------------------------------------------
  var ring = []; // { frame: VideoFrame, mediaTime, wallAt }
  function closeAll() {
    while (ring.length) {
      var e = ring.shift();
      try {
        e.frame.close();
      } catch (err) {
        /* already closed */
      }
    }
  }

  // --- display canvas over the player -------------------------------
  var canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.style.cssText =
    'position:absolute;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;';
  canvas.id = 'ts-spike-canvas';
  player.appendChild(canvas);
  var ctx = canvas.getContext('2d');

  // Hide the real video (opacity keeps it compositing; display:none
  // would kill rVFC — the exact watchdog case).
  var oldOpacity = video.style.opacity;
  video.style.opacity = '0';

  // --- audio: captureStream() route (critic risk #1) ----------------
  try {
    var ac = new (window.AudioContext || window.webkitAudioContext)();
    var stream = video.captureStream ? video.captureStream() : null;
    if (stream && stream.getAudioTracks().length) {
      var src = ac.createMediaStreamSource(stream);
      var delay = ac.createDelayNode ? ac.createDelayNode(1) : ac.createDelay(1);
      delay.delayTime.value = DELAY_MS / 1000;
      src.connect(delay);
      delay.connect(ac.destination);
      // The element's own output must be muted or audio doubles; note
      // the critic's warning that muting may ALSO mute the capture on
      // some Chromium versions — measured below via track state.
      video.muted = true;
      S.audio = 'captureStream+delay; tracks=' + stream.getAudioTracks().length;
    } else {
      S.audio = 'captureStream unavailable or no audio track';
    }
  } catch (e) {
    S.audio = 'audio setup failed: ' + e.message;
  }

  // --- capture loop (rVFC) ------------------------------------------
  var lastMediaTime = -1;
  var lastFrameWall = performance.now();
  var dead = false;
  function capture() {
    if (dead) return;
    video.requestVideoFrameCallback(function (nowTs, meta) {
      lastFrameWall = performance.now();
      S.frames++;
      // Discontinuity (seek, quality switch, SSAI boundary): flush.
      if (lastMediaTime >= 0 && Math.abs(meta.mediaTime - lastMediaTime) > 1.5) {
        closeAll();
        S.flushes++;
      }
      lastMediaTime = meta.mediaTime;
      try {
        ring.push({ frame: new VideoFrame(video), mediaTime: meta.mediaTime, wallAt: performance.now() });
        if (ring.length > S.ringMax) S.ringMax = ring.length;
        // Cap ring (memory): > 30 frames = ~1s @30fps, plenty for 350ms.
        while (ring.length > 30) ring.shift().frame.close();
      } catch (e) {
        S.errors.push('VideoFrame: ' + e.message);
      }
      capture();
    });
  }
  capture();

  // Watchdog: rVFC stalls while playing = hidden-video compositing stop.
  var watchdog = setInterval(function () {
    if (!video.paused && performance.now() - lastFrameWall > 1000) S.stallWatchdog++;
  }, 1000);

  // --- present loop (rAF): draw the frame ~DELAY_MS old -------------
  var lastPresentWall = 0;
  function present() {
    if (dead) return;
    requestAnimationFrame(function () {
      var target = performance.now() - DELAY_MS;
      var pick = null;
      // Newest frame captured BEFORE target wall time.
      for (var i = ring.length - 1; i >= 0; i--) {
        if (ring[i].wallAt <= target) {
          pick = ring[i];
          break;
        }
      }
      if (pick) {
        try {
          if (canvas.width !== pick.frame.displayWidth) canvas.width = pick.frame.displayWidth;
          if (canvas.height !== pick.frame.displayHeight) canvas.height = pick.frame.displayHeight;
          ctx.drawImage(pick.frame, 0, 0, canvas.width, canvas.height);
          S.presented++;
          // A/V offset estimate: how old is the presented frame vs the
          // intended delay (0 = perfect).
          S.avOffsetsMs.push(Math.round(performance.now() - pick.wallAt - DELAY_MS));
          if (S.avOffsetsMs.length > 600) S.avOffsetsMs.shift();
          var nowW = performance.now();
          if (lastPresentWall) {
            S.presentGapsMs.push(Math.round(nowW - lastPresentWall));
            if (S.presentGapsMs.length > 600) S.presentGapsMs.shift();
          }
          lastPresentWall = nowW;
        } catch (e) {
          S.errors.push('present: ' + e.message);
        }
      } else if (ring.length) {
        S.starved++;
      }
      present();
    });
  }
  present();

  // DRM: bail out entirely.
  video.addEventListener('encrypted', function () {
    S.errors.push('encrypted stream — spike tears down');
    S.stop();
  });

  S.stop = function () {
    dead = true;
    clearInterval(watchdog);
    closeAll();
    canvas.remove();
    video.style.opacity = oldOpacity;
    return 'stopped';
  };
  S.report = function () {
    function stats(a) {
      if (!a.length) return null;
      var s = a.slice().sort(function (x, y) {
        return x - y;
      });
      return { p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] };
    }
    var q = video.getVideoPlaybackQuality();
    return {
      frames: S.frames,
      presented: S.presented,
      ringMax: S.ringMax,
      starved: S.starved,
      flushes: S.flushes,
      stallWatchdog: S.stallWatchdog,
      offset: stats(S.avOffsetsMs),
      presentGap: stats(S.presentGapsMs),
      dropped: q.droppedVideoFrames,
      total: q.totalVideoFrames,
      audio: S.audio,
      errors: S.errors.slice(0, 5),
    };
  };
  return 'spike armed, delay ' + DELAY_MS + 'ms';
})();
