// GL PRESENTER — THE DELAY LINE'S DOM HALF ON WEBGL (idea #4, PRESENTER_GL,
// ships 0).
//
// Same contract as delay-presenter.mjs (attachDelay): hide the real
// <video>, hold a ring of frame copies, paint a canvas that is always
// DELAY_MS behind currentTime, draw the renderer's patch list INTO the
// presented frame. The difference is WHERE the ring lives. The 2D
// presenter's ring is `createImageBitmap(video)` copies -- an
// allocation per frame plus a 2D-canvas upload per present, measured
// on the Redmi as ~4 points of dropped frames (drops-v1097-decomp,
// DELAY_MS 0 vs 1500). Here each capture is `texImage2D(video)` into a
// pooled texture: the copy stays, the per-frame allocation and the 2D
// upload go. Presenting is a textured quad; the patches are a
// progressive-downsample + separable-Gaussian blur of the SAME frame,
// composited through a rounded-rectangle mask in the fragment shader --
// solid edges by construction (CLAMP_TO_EDGE, no transparent fade),
// same rectangles, same radius, same corners as the overlay divs.
//
// STILL NOT A `VideoFrame` RING. delay-core.mjs records why: holding
// decoder output buffers starved MediaCodec on the Redmi. A texture
// upload copies the frame out at capture, so no decoder buffer is held.
// UNMEASURED: whether `texImage2D(video)` is a GPU-to-GPU blit or a
// readback on Mali/Adreno WebView (the research doc's open question).
// That is what the PRESENTER_GL 1 arm of probe_drops_ab.py answers.
//
// FAIL SAFE, ONE WAY: a lost context, a texture upload that throws
// (a tainted stream, a driver refusing the video), or a program that
// will not link calls `opts.onLost(reason)` AFTER detaching itself, and
// the wiring re-attaches the 2D presenter for the rest of that video.
// Nothing here ever throws into the render loop.

import { ringBudget, pickPresent, presentTarget, refillStep, DELAY_MS } from './delay-core.mjs';
import { GATE_SIZE, CUT_DELTA, lumaGrid, meanAbsDelta } from './scene-gate.mjs';
import { setupDelayAudio, CANVAS_CLASS, COVER_FILTER, Z_INDEX } from './delay-presenter.mjs';

// OTA [0,1], ships 0. 1 = a WATCH player attaches this presenter instead
// of the 2D one on its NEXT attach (a navigation or a new player); an
// attached presenter is not swapped under a playing video. A device that
// cannot (no WebGL, no rVFC) or that loses the context falls back to the
// 2D presenter for that video, counted as presenterGlLost.
export var PRESENTER_GL = 0;
export function setPresenterGl(v) {
  PRESENTER_GL = v > 0 ? 1 : 0;
}

var ASSUMED_FPS = 30;
var FPS_SAMPLES_MAX = 30;
var FPS_SAMPLES_MIN = 10;
var FPS_RESIZE_THRESHOLD = 0.2;
var ERRORS_MAX = 8;
// Consecutive capture failures before the presenter gives the video
// back to the 2D path. One failure is a hiccup; three in a row is a
// stream this context cannot read (taint, driver), and every frame
// spent finding that out is a frame the viewer sees covered.
var CAPTURE_FAIL_MAX = 3;
// Gaussian taps per separable pass (sigma 3 texels, 13 taps, 2
// iterations = sigma ~4.24 texels at the blur level). The blur LEVEL is
// chosen so that 4.24 texels there is the requested radius in canvas
// pixels: level = round(log2(radius / 4.24)), clamped to [0, MAX_LEVEL].
var BLUR_SIGMA_TEXELS = 4.24;
var MAX_LEVEL = 4;

var VS =
  'attribute vec2 p;' +
  'uniform vec2 sc;' +
  'uniform vec2 of;' +
  'varying vec2 v;' +
  'void main(){' +
  '  vec2 q = p * sc + of;' +
  '  v = q * 0.5 + 0.5;' +
  '  gl_Position = vec4(q, 0.0, 1.0);' +
  '}';
var FS_COPY =
  'precision mediump float;' +
  'uniform sampler2D t;' +
  'uniform float flip;' +
  'varying vec2 v;' +
  'void main(){' +
  '  vec2 uv = v;' +
  '  if (flip > 0.5) uv.y = 1.0 - uv.y;' +
  '  gl_FragColor = texture2D(t, uv);' +
  '}';
var FS_BLUR =
  'precision mediump float;' +
  'uniform sampler2D t;' +
  'uniform vec2 dir;' +
  'varying vec2 v;' +
  'void main(){' +
  '  vec4 c = texture2D(t, v) * 0.1371;' +
  '  c += (texture2D(t, v + dir) + texture2D(t, v - dir)) * 0.1297;' +
  '  c += (texture2D(t, v + dir * 2.0) + texture2D(t, v - dir * 2.0)) * 0.1097;' +
  '  c += (texture2D(t, v + dir * 3.0) + texture2D(t, v - dir * 3.0)) * 0.0831;' +
  '  c += (texture2D(t, v + dir * 4.0) + texture2D(t, v - dir * 4.0)) * 0.0563;' +
  '  c += (texture2D(t, v + dir * 5.0) + texture2D(t, v - dir * 5.0)) * 0.0341;' +
  '  c += (texture2D(t, v + dir * 6.0) + texture2D(t, v - dir * 6.0)) * 0.0185;' +
  '  gl_FragColor = c;' +
  '}';
// The patch: sample the blurred frame, keep only the fragments inside a
// rounded rectangle given in canvas pixels, y down (the 2D presenter's
// convention: normalized rect x canvas size).
var FS_PATCH =
  'precision mediump float;' +
  'uniform sampler2D t;' +
  'uniform vec4 rect;' +
  'uniform float radius;' +
  'uniform float H;' +
  'varying vec2 v;' +
  'void main(){' +
  '  vec2 f = vec2(gl_FragCoord.x, H - gl_FragCoord.y);' +
  '  vec2 c = rect.xy + rect.zw * 0.5;' +
  '  vec2 hf = rect.zw * 0.5 - radius;' +
  '  vec2 d = abs(f - c) - hf;' +
  '  float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - radius;' +
  '  if (sd > 0.0) discard;' +
  '  gl_FragColor = texture2D(t, vec2(v.x, 1.0 - v.y));' +
  '}';

/**
 * Attach a WebGL delay presenter. Returns null when unsupported (no
 * rVFC, no WebGL context, a shader that will not compile) so the caller
 * attaches the 2D presenter instead. opts: { delayMs, onLost(reason) }.
 */
export function attachDelayGl(video, host, opts) {
  opts = opts || {};
  if (!video || !host) return null;
  if (typeof video.requestVideoFrameCallback !== 'function') return null;
  if (typeof host.contains === 'function' && !host.contains(video)) return null;
  if (typeof document === 'undefined' || !document.createElement) return null;

  var delayMs = opts.delayMs > 0 ? opts.delayMs : DELAY_MS;
  var onLost = typeof opts.onLost === 'function' ? opts.onLost : null;

  var stats = {
    captured: 0,
    presented: 0,
    refills: 0,
    flushes: 0,
    capFailed: 0,
    ring: 0,
    late: 0,
    delayCollapsed: 0,
    repaints: 0,
    patchesDrawn: 0,
    blurLevel: 0,
    gl: 1,
    lost: '',
    errors: [],
  };
  function noteError(label, e) {
    if (stats.errors.length >= ERRORS_MAX) return;
    stats.errors.push(label + ': ' + (e && e.message ? e.message : String(e)));
  }

  var canvas = null;
  var gl = null;
  try {
    canvas = document.createElement('canvas');
  } catch (e) {
    noteError('canvas', e);
    return null;
  }
  var glOpts = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, desynchronized: true };
  try {
    gl = canvas.getContext ? canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts) : null;
  } catch (e) {
    noteError('gl', e);
    gl = null;
  }
  if (!gl) return null;

  // --- programs --------------------------------------------------------
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error('shader: ' + log);
    }
    return s;
  }
  function program(fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error('link: ' + log);
    }
    return {
      p: p,
      sc: gl.getUniformLocation(p, 'sc'),
      of: gl.getUniformLocation(p, 'of'),
      t: gl.getUniformLocation(p, 't'),
      flip: gl.getUniformLocation(p, 'flip'),
      dir: gl.getUniformLocation(p, 'dir'),
      rect: gl.getUniformLocation(p, 'rect'),
      radius: gl.getUniformLocation(p, 'radius'),
      H: gl.getUniformLocation(p, 'H'),
    };
  }
  var progCopy = null;
  var progBlur = null;
  var progPatch = null;
  var quad = null;
  var fbo = null;
  try {
    progCopy = program(FS_COPY);
    progBlur = program(FS_BLUR);
    progPatch = program(FS_PATCH);
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    fbo = gl.createFramebuffer();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // Phase-n N4: prove the framebuffer path COMPLETES before this
    // presenter is allowed to own a frame. Every blur pass renders into
    // an RGBA texture through `fbo`; a context whose FBO is incomplete
    // draws nothing there, and with BLUR_IN_FRAME 1 the divs would
    // already be hidden. One 4x4 texture, one status read, once, before
    // the canvas is appended -- refused here, the 2D presenter attaches.
    var probeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, probeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, probeTex, 0);
    var fboStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteTexture(probeTex);
    if (fboStatus !== gl.FRAMEBUFFER_COMPLETE) {
      noteError('fbo', new Error('framebuffer incomplete: ' + fboStatus));
      return null;
    }
  } catch (e) {
    noteError('program', e);
    return null;
  }

  try {
    canvas.className = CANVAS_CLASS;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.zIndex = String(Z_INDEX);
    canvas.style.pointerEvents = 'none';
    host.appendChild(canvas);
  } catch (e) {
    noteError('canvas', e);
    return null;
  }
  try {
    video.style.opacity = '0';
  } catch (e) {
    noteError('opacity', e);
  }

  // --- textures ----------------------------------------------------------
  function newTexture(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w > 0 && h > 0) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return { tex: t, w: w, h: h };
  }
  var pool = []; // free ring textures, reused so a capture allocates nothing
  var ring = []; // [{ tex, w, h, mediaTime, at }]
  var staging = null; // full-size upload target when the budget downscales
  var levels = []; // blur chain: levels[k] = { tex, w, h } at 1/2^k of the frame
  var blurScratch = null; // ping-pong partner at the blur level
  var gate = null; // 16x16 target for locateCut
  var lastPresented = null;
  var blurredFor = null; // { entry, level } the blur chain currently holds

  function takeTexture(w, h) {
    var t = pool.pop();
    if (t && (t.w !== w || t.h !== h)) {
      gl.deleteTexture(t.tex);
      t = null;
    }
    return t || newTexture(w, h);
  }
  function freeTexture(entry) {
    if (!entry) return;
    if (pool.length < 4) pool.push({ tex: entry.tex, w: entry.w, h: entry.h });
    else gl.deleteTexture(entry.tex);
  }
  function target(t) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    gl.viewport(0, 0, t.w, t.h);
  }
  function drawQuad(prog, srcTex, flip, sx, sy, ox, oy) {
    gl.useProgram(prog.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(prog.t, 0);
    gl.uniform2f(prog.sc, sx, sy);
    gl.uniform2f(prog.of, ox, oy);
    if (prog.flip) gl.uniform1f(prog.flip, flip ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function copyInto(dst, srcTex) {
    target(dst);
    drawQuad(progCopy, srcTex, false, 1, 1, 0, 0);
  }

  // --- fps / budget (same policy as the 2D presenter) ------------------
  var fpsSamples = [];
  var lastCaptureMediaTime = null;
  var sizedForFps = ASSUMED_FPS;
  function noteFrameInterval(mediaTime) {
    if (lastCaptureMediaTime != null) {
      var dt = mediaTime - lastCaptureMediaTime;
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
    if (Math.abs(fps - sizedForFps) / sizedForFps > FPS_RESIZE_THRESHOLD) sizedForFps = fps;
    return ringBudget(w, h, sizedForFps, delayMs);
  }

  var refillState = 'refilling';
  var externalCover = false;
  var presentedMediaTimeVal = null;
  var detached = false;
  var listeners = [];
  var consecutiveCapFail = 0;

  function addListener(t, type, fn) {
    try {
      t.addEventListener(type, fn);
      listeners.push({ target: t, type: type, fn: fn });
    } catch (e) {
      noteError('listen:' + type, e);
    }
  }
  function applyCover() {
    try {
      canvas.style.filter = refillState === 'refilling' || externalCover ? COVER_FILTER : '';
    } catch (e) {
      noteError('applyCover', e);
    }
  }
  applyCover();

  function flush() {
    try {
      for (var i = 0; i < ring.length; i++) freeTexture(ring[i]);
    } catch (e) {
      noteError('flush', e);
    }
    ring = [];
    lastPresented = null;
    blurredFor = null;
    stats.ring = 0;
    stats.flushes++;
    presentedMediaTimeVal = null;
    refillState = refillStep(refillState, 'flush');
    fpsSamples = [];
    lastCaptureMediaTime = null;
    applyCover();
  }

  // --- the blur chain ----------------------------------------------------
  function levelFor(k, w, h) {
    var lw = Math.max(1, w >> k);
    var lh = Math.max(1, h >> k);
    var L = levels[k];
    if (!L || L.w !== lw || L.h !== lh) {
      if (L) gl.deleteTexture(L.tex);
      L = levels[k] = newTexture(lw, lh);
    }
    return L;
  }
  function ensureBlurred(entry, radiusPx) {
    var k = Math.round(Math.log(Math.max(1, radiusPx) / BLUR_SIGMA_TEXELS) / Math.LN2);
    if (!(k >= 0)) k = 0;
    if (k > MAX_LEVEL) k = MAX_LEVEL;
    if (blurredFor && blurredFor.entry === entry && blurredFor.level === k) return levels[k];
    var src = entry.tex;
    var L = null;
    for (var i = 1; i <= k; i++) {
      L = levelFor(i, entry.w, entry.h);
      copyInto(L, src);
      src = L.tex;
    }
    if (k === 0) {
      L = levelFor(0, entry.w, entry.h);
      copyInto(L, entry.tex);
    }
    if (!blurScratch || blurScratch.w !== L.w || blurScratch.h !== L.h) {
      if (blurScratch) gl.deleteTexture(blurScratch.tex);
      blurScratch = newTexture(L.w, L.h);
    }
    gl.useProgram(progBlur.p);
    for (var pass = 0; pass < 2; pass++) {
      target(blurScratch);
      gl.uniform2f(progBlur.dir, 1 / L.w, 0);
      drawQuad(progBlur, L.tex, false, 1, 1, 0, 0);
      target(L);
      gl.uniform2f(progBlur.dir, 0, 1 / L.h);
      drawQuad(progBlur, blurScratch.tex, false, 1, 1, 0, 0);
    }
    blurredFor = { entry: entry, level: k };
    stats.blurLevel = k;
    return L;
  }

  // --- patches (renderer contract: video-normalized rects, br/rr / width) -
  var patches = [];
  var patchesKey = '';
  function drawPatches(entry) {
    if (!patches.length || !entry) {
      stats.patchesDrawn = 0;
      return;
    }
    var W = canvas.width;
    var H = canvas.height;
    var maxB = 1;
    for (var j = 0; j < patches.length; j++) maxB = Math.max(maxB, Math.round(patches[j].br * W));
    var L = ensureBlurred(entry, maxB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(progPatch.p);
    gl.uniform1f(progPatch.H, H);
    var n = 0;
    for (var i = 0; i < patches.length; i++) {
      var q = patches[i];
      var x = Math.round(q.x * W);
      var y = Math.round(q.y * H);
      var w = Math.round(q.w * W);
      var h = Math.round(q.h * H);
      if (!(w > 0) || !(h > 0)) continue;
      var r = Math.max(0, Math.min(Math.round(q.rr * W), w / 2, h / 2));
      gl.uniform4f(progPatch.rect, x, y, w, h);
      gl.uniform1f(progPatch.radius, r);
      // Sub-quad covering the rect in clip space (y up): scale/offset of
      // the unit quad so the fragment shader only visits the rectangle.
      var sx = w / W;
      var sy = h / H;
      var ox = ((x + w / 2) / W) * 2 - 1;
      var oy = 1 - ((y + h / 2) / H) * 2;
      drawQuad(progPatch, L.tex, true, sx, sy, ox, oy);
      n++;
    }
    stats.patchesDrawn = n;
  }
  function present(entry) {
    if (canvas.width !== entry.w || canvas.height !== entry.h) {
      canvas.width = entry.w;
      canvas.height = entry.h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, entry.w, entry.h);
    drawQuad(progCopy, entry.tex, true, 1, 1, 0, 0);
    drawPatches(entry);
  }
  function canPaint() {
    return !detached;
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
    if (!lastPresented) return;
    try {
      present(lastPresented);
      stats.repaints++;
    } catch (e) {
      noteError('repaint', e);
    }
  }

  // --- give up: detach, then tell the wiring ------------------------------
  function fail(reason) {
    if (detached) return;
    stats.lost = reason;
    detach();
    if (onLost) {
      try {
        onLost(reason);
      } catch (e) {
        /* the wiring's problem, not the render loop's */
      }
    }
  }

  function presentTick(budget) {
    if (detached) return;
    var tgt;
    try {
      tgt = presentTarget(video.currentTime, delayMs, video.playbackRate || 1);
    } catch (e) {
      noteError('presentTarget', e);
      return;
    }
    var pick = pickPresent(ring, tgt);
    var collapsed = false;
    if (pick < 0) {
      if (ring.length > 0 && budget && ring.length >= budget.frames && ring[0].mediaTime > tgt) {
        pick = 0;
        collapsed = true;
      } else {
        stats.late++;
        return;
      }
    }
    var entry = ring[pick];
    if (entry === lastPresented && !collapsed) {
      for (var k = 0; k < pick; k++) freeTexture(ring[k]);
      if (pick > 0) ring = ring.slice(pick);
      stats.ring = ring.length;
      return;
    }
    lastPresented = entry;
    try {
      present(entry);
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
    for (var i = 0; i < pick; i++) freeTexture(ring[i]);
    ring = ring.slice(pick);
    stats.ring = ring.length;
  }

  function capture(budget, mediaTime, atMs) {
    var vw = video.videoWidth || budget.w;
    var vh = video.videoHeight || budget.h;
    var entry;
    if (budget.scale === 1) {
      entry = takeTexture(vw, vh);
      gl.bindTexture(gl.TEXTURE_2D, entry.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } else {
      if (!staging || staging.w !== vw || staging.h !== vh) {
        if (staging) gl.deleteTexture(staging.tex);
        staging = newTexture(vw, vh);
      }
      gl.bindTexture(gl.TEXTURE_2D, staging.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
      entry = takeTexture(budget.w, budget.h);
      copyInto(entry, staging.tex);
    }
    entry.mediaTime = mediaTime;
    entry.at = atMs;
    stats.captured++;
    ring.push(entry);
    while (ring.length > budget.frames) freeTexture(ring.shift());
    stats.ring = ring.length;
  }

  function onVideoFrame(now, meta) {
    if (detached) return;
    var mediaTime = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime;
    noteFrameInterval(mediaTime);
    var budget = currentBudget();
    try {
      capture(budget, mediaTime, now);
      consecutiveCapFail = 0;
    } catch (e) {
      stats.capFailed++;
      noteError('capture', e);
      if (++consecutiveCapFail >= CAPTURE_FAIL_MAX) {
        fail('capture');
        return;
      }
    }
    try {
      presentTick(budget);
    } catch (e) {
      noteError('tick', e);
    }
    try {
      video.requestVideoFrameCallback(onVideoFrame);
    } catch (e) {
      noteError('rvfc', e);
    }
  }

  function onDiscontinuity() {
    flush();
  }
  addListener(video, 'seeking', onDiscontinuity);
  addListener(video, 'loadstart', onDiscontinuity);
  addListener(video, 'resize', onDiscontinuity);
  addListener(video, 'ratechange', onDiscontinuity);
  if (typeof document.addEventListener === 'function') {
    addListener(document, 'visibilitychange', function () {
      if (document.hidden) flush();
    });
  }
  addListener(canvas, 'webglcontextlost', function () {
    fail('contextlost');
  });

  var audioGraph = setupDelayAudio(video, delayMs, noteError);

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
      for (var j = 0; j < ring.length; j++) gl.deleteTexture(ring[j].tex);
      for (var k = 0; k < pool.length; k++) gl.deleteTexture(pool[k].tex);
      for (var m = 0; m < levels.length; m++) if (levels[m]) gl.deleteTexture(levels[m].tex);
      if (blurScratch) gl.deleteTexture(blurScratch.tex);
      if (staging) gl.deleteTexture(staging.tex);
      if (gate) gl.deleteTexture(gate.tex);
      gl.deleteFramebuffer(fbo);
      gl.deleteBuffer(quad);
      gl.deleteProgram(progCopy.p);
      gl.deleteProgram(progBlur.p);
      gl.deleteProgram(progPatch.p);
    } catch (e) {
      noteError('detach-gl', e);
    }
    ring = [];
    pool = [];
    levels = [];
    lastPresented = null;
    blurredFor = null;
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
      blurLevel: stats.blurLevel,
      gl: 1,
      lost: stats.lost,
      errors: stats.errors.slice(),
    };
  }

  // Read a texture back as RGBA bytes, rows top-down. Texture row 0 is
  // the frame's top row (no UNPACK_FLIP_Y), and readPixels walks the
  // framebuffer from row 0, so the bytes come back in ImageData order.
  function readBack(t) {
    var buf = new Uint8Array(t.w * t.h * 4);
    target(t);
    gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return buf;
  }

  /** Newest ring frame as a fresh ImageBitmap (the caller closes it).
   *  One readPixels per verdict pass, ~1/s -- not per frame. */
  function requestVerdictFrame() {
    if (detached || !ring.length) return Promise.resolve(null);
    var newest = ring[ring.length - 1];
    try {
      if (typeof ImageData !== 'function' || typeof createImageBitmap !== 'function') return Promise.resolve(null);
      var bytes = readBack(newest);
      var img = new ImageData(new Uint8ClampedArray(bytes.buffer), newest.w, newest.h);
      return Promise.resolve(createImageBitmap(img)).then(
        function (bmp) {
          return { bitmap: bmp, mediaTime: newest.mediaTime, atMs: newest.at };
        },
        function (e) {
          noteError('verdict-bitmap', e);
          return null;
        }
      );
    } catch (e) {
      noteError('verdict-read', e);
      return Promise.resolve(null);
    }
  }

  // Same rule as the 2D presenter's locateCut: the largest single-frame
  // 16x16 luma delta in (from, to] keys the cut; null when the ring
  // cannot answer. Each frame is drawn into a 16x16 texture and read
  // back -- 1KB per frame, only when the gate fires.
  function frameLuma(entry) {
    if (!gate) gate = newTexture(GATE_SIZE, GATE_SIZE);
    copyInto(gate, entry.tex);
    return lumaGrid(readBack(gate), GATE_SIZE * GATE_SIZE);
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
