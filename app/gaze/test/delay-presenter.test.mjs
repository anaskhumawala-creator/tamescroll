// Delay presenter — DOM half of the delay line (plan Task 7). Pure DOM/
// WebAudio stubs in the style of test/video-region.test.mjs: enough
// surface for attachDelay to run under node, driven by hand (rVFC ticks,
// DOM events, document.hidden) rather than real timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM stub -----------------------------------------------------
function makeEl(tag) {
  var listeners = {};
  var el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    width: 0,
    height: 0,
    appendChild(c) {
      c.parentNode = this;
      this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      c.parentNode = null;
      return c;
    },
    contains(target) {
      if (target === this) return true;
      for (var i = 0; i < this.children.length; i++) {
        if (this.children[i] === target || (this.children[i].contains && this.children[i].contains(target))) {
          return true;
        }
      }
      return false;
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    fire(type, evt) {
      (listeners[type] || []).slice().forEach((fn) => fn(evt || { type: type }));
    },
    listenerCount(type) {
      return (listeners[type] || []).length;
    },
    getContext() {
      if (!this._ctx) {
        var calls = [];
        this._ctx = {
          calls: calls,
          drawImage() {
            calls.push(Array.prototype.slice.call(arguments));
          },
        };
      }
      return this._ctx;
    },
  };
  return el;
}

function makeVideo() {
  var v = makeEl('video');
  v.currentTime = 0;
  v.playbackRate = 1;
  v.videoWidth = 640;
  v.videoHeight = 360;
  v._rvfcCb = null;
  v.requestVideoFrameCallback = function (cb) {
    v._rvfcCb = cb;
  };
  return v;
}

function driveFrame(video, mediaTime, atMs) {
  var cb = video._rvfcCb;
  assert.ok(cb, 'no rVFC callback registered to drive');
  cb(atMs, { mediaTime: mediaTime });
}

function makeDocumentStub() {
  var listeners = {};
  return {
    hidden: false,
    createElement(tag) {
      return makeEl(tag);
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((f) => f !== fn);
    },
    fire(type) {
      (listeners[type] || []).slice().forEach((fn) => fn({ type: type }));
    },
    listenerCount(type) {
      return (listeners[type] || []).length;
    },
  };
}

// --- global createImageBitmap: real DOM contract is a Promise --------------
function makeBitmapFactory() {
  var log = { created: 0, closed: 0 };
  function createImageBitmap(source, opts) {
    log.created++;
    var w = (opts && opts.resizeWidth) || (source && source.width) || 640;
    var h = (opts && opts.resizeHeight) || (source && source.height) || 360;
    var b = { width: w, height: h, closed: false };
    b.close = function () {
      if (!b.closed) {
        b.closed = true;
        log.closed++;
      }
    };
    return Promise.resolve(b);
  }
  return { log: log, createImageBitmap: createImageBitmap };
}

// --- global AudioContext ----------------------------------------------------
function makeAudioContextClass(calls) {
  return function AudioContextStub() {
    var self = this;
    self.state = 'running';
    self.createMediaElementSource = function () {
      calls.push('createMediaElementSource');
      return { connect() {} };
    };
    self.createDelay = function (max) {
      calls.push('createDelay:' + max);
      return { delayTime: { value: 0 }, connect() {} };
    };
    self.suspend = function () {
      calls.push('suspend');
      self.state = 'suspended';
      return Promise.resolve();
    };
    self.resume = function () {
      calls.push('resume');
      self.state = 'running';
      return Promise.resolve();
    };
  };
}

function flushAsync() {
  // The capture -> push -> present chain is Promise-based (real
  // createImageBitmap always returns a Promise); a macrotask boundary
  // drains every microtask hop in that chain regardless of its depth.
  return new Promise((resolve) => setTimeout(resolve, 0));
}

globalThis.document = makeDocumentStub();
globalThis.createImageBitmap = makeBitmapFactory().createImageBitmap;
globalThis.AudioContext = makeAudioContextClass([]);

const dp = await import('../src/delay-presenter.mjs');

function setup(opts) {
  globalThis.document = makeDocumentStub();
  var bitmaps = makeBitmapFactory();
  globalThis.createImageBitmap = bitmaps.createImageBitmap;
  var audioCalls = [];
  globalThis.AudioContext = makeAudioContextClass(audioCalls);
  var host = makeEl('div');
  var video = makeVideo();
  host.appendChild(video);
  var presenter = dp.attachDelay(video, host, opts || {});
  return { host, video, presenter, bitmaps, audioCalls, document: globalThis.document };
}

// --- attachDelay guard -------------------------------------------------

test('attachDelay returns null when requestVideoFrameCallback is missing', () => {
  var host = makeEl('div');
  var video = makeVideo();
  delete video.requestVideoFrameCallback;
  host.appendChild(video);
  assert.equal(dp.attachDelay(video, host, {}), null);
});

test('attachDelay returns null when host does not contain video', () => {
  var host = makeEl('div');
  var video = makeVideo(); // never appended to host
  assert.equal(dp.attachDelay(video, host, {}), null);
});

// --- behaviour 1: canvas mounted, video hidden, detach reverses both ---

test('attachDelay mounts a ts-gaze-delay canvas over the video and hides it; detach reverses both', () => {
  var { host, video, presenter } = setup();
  assert.notEqual(presenter, null);
  var canvas = host.children.find((c) => c.className === 'ts-gaze-delay');
  assert.ok(canvas, 'canvas not appended to host');
  assert.equal(canvas.style.position, 'absolute');
  assert.equal(canvas.style.inset, '0');
  assert.equal(canvas.style.zIndex, '15');
  assert.equal(canvas.style.pointerEvents, 'none');
  assert.equal(video.style.opacity, '0');

  presenter.detach();
  assert.ok(!host.children.includes(canvas), 'canvas not removed on detach');
  assert.equal(video.style.opacity, '');
});

test('detach removes the canvas and restores opacity even after frames have been presented', async () => {
  var { host, video, presenter } = setup({ delayMs: 1000 });
  video.currentTime = 0;
  driveFrame(video, 0, 1000); // currentTime still 0 here -> target -1, nothing old
  await flushAsync(); // enough to present yet; this capture is only banked for later.
  assert.equal(presenter.stats().late, 1, 'sanity: the first capture must miss its own pick');

  video.currentTime = 1.0; // past the 1000ms delay: presentTarget(1.0, 1000, 1) = 0, so
  driveFrame(video, 1.0, 1001); // the mediaTime-0 frame captured above is now old enough.
  await flushAsync();
  assert.equal(presenter.stats().presented, 1, 'sanity: a frame must actually be presented');

  var canvas = host.children.find((c) => c.className === 'ts-gaze-delay');
  assert.ok(canvas);
  assert.ok(canvas._ctx.calls.length > 0, 'no drawImage call was ever recorded on the canvas');
  assert.notEqual(presenter.presentedMediaTime(), null, 'presentedMediaTime must be set before detach');

  presenter.detach();
  assert.ok(!host.children.includes(canvas), 'canvas not removed on detach');
  assert.equal(video.style.opacity, '');
  assert.equal(presenter.presentedMediaTime(), null);
});

// --- behaviour 2: ring capture, budgeted eviction, present the pick ----

test('captures via createImageBitmap into a ring and presents the newest entry at or before target', async () => {
  var { video, presenter, bitmaps } = setup({ delayMs: 1000 }); // budget: 45 frames @ 640x360x30fps

  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), null, 'nothing old enough to present yet');
  assert.equal(presenter.stats().late, 1);

  video.currentTime = 0.5;
  driveFrame(video, 0.5, 1500);
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), null);

  video.currentTime = 1.0;
  driveFrame(video, 1.0, 2000); // target = 1.0 - 1.0 = 0.0 -> presents mediaTime 0
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), 0);
  assert.equal(presenter.stats().presented, 1);
  assert.equal(presenter.stats().refills, 1, 'first successful pick ends the initial refill');
  assert.equal(presenter.stats().ring, 3, 'everything BEFORE the presented entry is evicted; the presented one stays until something newer is picked');
  assert.equal(bitmaps.log.closed, 0, 'nothing older than the presented entry existed yet');

  video.currentTime = 1.5;
  driveFrame(video, 1.5, 2500); // target = 0.5 -> presents mediaTime 0.5
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), 0.5);
  assert.equal(presenter.stats().presented, 2);
  assert.equal(presenter.stats().refills, 1, 'no second refill once live');
});

test('the ring never exceeds the ringBudget frame count, and a permanently-unreachable target still gets served once the ring is full', async () => {
  var { video, presenter, bitmaps } = setup({ delayMs: 1000 }); // budget.frames = 45 at ~30fps
  video.currentTime = 0; // held fixed: presentTarget stays negative, so a normal pick can
  // never succeed on media-time grounds alone. Before I9 that meant the ring filled to
  // its cap and sat there forever with 0 presentations -- permanently covered. The I9
  // collapse fallback means it must not: once the ring is full and its oldest entry is
  // still newer than target, the oldest gets served anyway rather than never.
  for (var i = 0; i < 60; i++) {
    driveFrame(video, i / 30, 1000 + i); // ~30fps mediaTime cadence, matches ASSUMED_FPS
    // -- kept off the fps-resize threshold on purpose; that path has its own test.
    await flushAsync();
    assert.ok(presenter.stats().ring <= 45, 'ring exceeded its budget at frame ' + i);
  }
  assert.equal(bitmaps.log.created, 60);
  // Every bitmap not currently held in the ring was closed -- true whether it left via
  // the ring's own size cap (onCapturedFrame) or a presentTick collapse pick.
  assert.equal(bitmaps.log.closed, 60 - presenter.stats().ring);
  // I9: the ring being permanently unable to reach `target` must not mean nothing is
  // ever shown -- once it fills, the collapse fallback serves the oldest entry instead
  // of freezing covered for the rest of the session.
  assert.ok(presenter.stats().presented > 0, 'collapse fallback never presented anything');
  assert.ok(presenter.stats().delayCollapsed > 0, 'delayCollapsed never counted the fallback');
});

// --- behaviour 2b: I9 -- the ring budget follows the MEASURED capture fps ---

test('a 60fps stream grows the ring budget past the 30fps-assumed cap once fps is measured', async () => {
  var { video, presenter } = setup({ delayMs: 1000 });
  // At the ASSUMED_FPS=30 default, ringBudget(1000ms) is 45 frames. If the ring stayed
  // sized for that no matter what the stream really runs at, capturing more than 45
  // frames of a genuinely 60fps stream (whose own 1500ms window needs 90) would evict
  // the oldest ones -- exactly the under-provisioned-ring failure I9 exists to fix.
  video.currentTime = 0; // held fixed like the cap test above: nothing is ever picked,
  // so ring size is governed ENTIRELY by the budget cap, which is what this measures.
  var t = 0;
  for (var i = 0; i < 50; i++) {
    driveFrame(video, t, 1000 + i);
    t += 1 / 60; // a 60fps mediaTime cadence
    await flushAsync();
  }
  // 50 captures of a stream the presenter has correctly measured at ~60fps must all
  // still fit (budget.frames grows to 90) -- staying at the old 45 would evict 5.
  assert.equal(presenter.stats().ring, 50, 'ring capped at the stale 30fps budget instead of growing for the measured 60fps stream');
});

// --- behaviour 3: discontinuities flush + cover; uncover on next pick --

test('seeking/loadstart/resize/ratechange each flush the ring and cover; the next pick uncovers', async () => {
  var { host, video, presenter } = setup({ delayMs: 1000 });
  var canvas = host.children.find((c) => c.className === 'ts-gaze-delay');
  var t = 0;

  function fillAndPresentOnce() {
    // two captures 1s apart are enough for the second to present the first.
    driveFrame(video, t, 1000 * t + 1000);
    t += 1;
    video.currentTime = t;
    driveFrame(video, t, 1000 * t + 1000);
    t += 0.001; // keep future mediaTimes strictly increasing across iterations
  }

  fillAndPresentOnce();
  await flushAsync();
  assert.notEqual(presenter.presentedMediaTime(), null, 'sanity: something presented before the flush');
  assert.equal(canvas.style.filter, '', 'sanity: uncovered while live');

  var types = ['seeking', 'loadstart', 'resize', 'ratechange'];
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    var flushesBefore = presenter.stats().flushes;
    video.fire(type);
    assert.equal(presenter.stats().flushes, flushesBefore + 1, type + ' did not flush');
    assert.equal(presenter.stats().ring, 0, type + ' left ring entries behind');
    assert.equal(presenter.presentedMediaTime(), null, type + ' did not clear the last presented time');
    assert.notEqual(canvas.style.filter, '', type + ' did not cover the canvas');

    fillAndPresentOnce();
    fillAndPresentOnce();
    await flushAsync();
  }
  assert.notEqual(presenter.presentedMediaTime(), null, 'refill recovered after the last discontinuity');
  assert.equal(canvas.style.filter, '', 'uncovered again once a pick lands');
});

test('cover(true) holds the canvas covered independent of refill state, OR-ed with the internal cover', async () => {
  var { host, video, presenter } = setup({ delayMs: 1000 });
  var canvas = host.children.find((c) => c.className === 'ts-gaze-delay');

  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  video.currentTime = 1.0;
  driveFrame(video, 1.0, 2000);
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), 0, 'sanity: presenter is live');
  assert.equal(canvas.style.filter, '', 'live and no external cover: uncovered');

  presenter.cover(true);
  assert.notEqual(canvas.style.filter, '', 'external cover applies even while live');

  video.currentTime = 1.5;
  driveFrame(video, 1.5, 2500);
  await flushAsync();
  assert.notEqual(canvas.style.filter, '', 'a successful pick does not clear an external cover');

  presenter.cover(false);
  assert.equal(canvas.style.filter, '', 'clearing external cover uncovers once live');
});

// --- behaviour 4: audio graph, once per element -------------------------

test('sets up one AudioContext + delay graph per video element, keyed to pause/play', async () => {
  var { video, presenter, audioCalls } = setup({ delayMs: 1000 });
  assert.ok(video.__tsDelayGraph, 'graph not stored on the element');
  assert.deepEqual(audioCalls.slice(0, 2), ['createMediaElementSource', 'createDelay:5']);
  assert.equal(video.__tsDelayGraph.delay.delayTime.value, 1); // 1000ms / 1000

  video.fire('pause');
  assert.ok(audioCalls.includes('suspend'));
  video.fire('play');
  assert.ok(audioCalls.includes('resume'));

  var callsBeforeDetach = audioCalls.length;
  presenter.detach();
  assert.equal(video.__tsDelayGraph.delay.delayTime.value, 0);
  assert.ok(audioCalls.length > callsBeforeDetach, 'detach resumes the (permanent) graph');
  assert.equal(audioCalls[audioCalls.length - 1], 'resume');
});

test('re-attaching the same video element reuses its audio graph (no second createMediaElementSource)', () => {
  var host1 = makeEl('div');
  var video = makeVideo();
  host1.appendChild(video);
  globalThis.document = makeDocumentStub();
  var bitmaps = makeBitmapFactory();
  globalThis.createImageBitmap = bitmaps.createImageBitmap;
  var audioCalls = [];
  globalThis.AudioContext = makeAudioContextClass(audioCalls);

  var p1 = dp.attachDelay(video, host1, {});
  p1.detach();
  var host2 = makeEl('div');
  host2.appendChild(video);
  var p2 = dp.attachDelay(video, host2, {});
  assert.notEqual(p2, null);
  assert.equal(audioCalls.filter((c) => c === 'createMediaElementSource').length, 1);
});

// --- behaviour 5: requestVerdictFrame clones the newest ring bitmap ----

test('requestVerdictFrame clones the newest ring bitmap and leaves the ring entry intact', async () => {
  var { video, presenter, bitmaps } = setup({ delayMs: 1000 });
  video.currentTime = 0; // held fixed: nothing gets presented/evicted
  driveFrame(video, 0, 1000);
  await flushAsync();
  driveFrame(video, 0.5, 1500);
  await flushAsync();
  assert.equal(presenter.stats().ring, 2);

  var createdBefore = bitmaps.log.created;
  var out = await presenter.requestVerdictFrame();
  assert.ok(out);
  assert.equal(out.mediaTime, 0.5, 'newest ring entry, not the oldest');
  assert.equal(out.atMs, 1500);
  assert.equal(bitmaps.log.created, createdBefore + 1, 'a clone was made, not a reference handed out');
  assert.equal(presenter.stats().ring, 2, 'the ring keeps its own copy');
  assert.equal(bitmaps.log.closed, 0, 'the original ring bitmaps are untouched');
});

// THE CUT IS KEYED AT THE FRAME THAT SHOWED IT (1096f). The scene gate
// samples the LIVE video, which is the newest rVFC frame the ring just
// captured; pushing the cut at `video.currentTime` instead keyed it
// 10-100ms AFTER that frame's mediaTime, so a verdict pass on the cut
// frame itself (keyed at the frame's time) sat on the wrong side of the
// cut. Redmi, events-v1096e: verdict at 65.532, cut keyed 65.542, the
// rule-3'' walk stopped at the "cut" and covered a certain man for 19
// frames; demotion passes keyed 11-56ms BEFORE their cut back-projected
// blur onto the last frames of the previous shot (88.188, 140.374).
test('newestMediaTime is the newest captured frame, null when the ring is empty', async () => {
  var { video, presenter } = setup({ delayMs: 1000 });
  assert.equal(presenter.newestMediaTime(), null);
  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  await flushAsync();
  driveFrame(video, 0.5, 1500);
  await flushAsync();
  assert.equal(presenter.newestMediaTime(), 0.5);
});

test('requestVerdictFrame resolves null when the ring is empty', async () => {
  var { presenter } = setup({ delayMs: 1000 });
  var out = await presenter.requestVerdictFrame();
  assert.equal(out, null);
});

// --- behaviour 6: document.hidden -> flush ------------------------------

test('document becoming hidden flushes the ring', async () => {
  var { video, presenter, document } = setup({ delayMs: 1000 });
  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  await flushAsync();
  assert.equal(presenter.stats().ring, 1);

  document.hidden = false;
  document.fire('visibilitychange');
  assert.equal(presenter.stats().ring, 1, 'not hidden: no flush');

  document.hidden = true;
  document.fire('visibilitychange');
  assert.equal(presenter.stats().ring, 0);
  assert.equal(presenter.stats().flushes, 1);
});

test('the canvas is stretched to the host, not left at the frame size', () => {
  var { host, presenter } = setup({ delayMs: 1000 });
  var canvas = host.children[host.children.length - 1];
  assert.equal(canvas.style.width, '100%');
  assert.equal(canvas.style.height, '100%');
  // Letterboxed players (landscape, fullscreen) lay the video out narrower
  // than the host; the canvas must contain-fit like the video it replaces
  // or the picture stretches and the patches land beside the faces.
  assert.equal(canvas.style.objectFit, 'contain');
  presenter.detach();
});

test('re-picking the frame already on the canvas draws nothing and is not late', async () => {
  var { video, presenter, bitmaps } = setup({ delayMs: 1000 });
  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  video.currentTime = 0.5;
  driveFrame(video, 0.5, 1500);
  await flushAsync();
  video.currentTime = 1.0;
  driveFrame(video, 1.0, 2000); // target 0.0 -> presents mediaTime 0
  await flushAsync();
  assert.equal(presenter.stats().presented, 1);
  var lateBefore = presenter.stats().late;
  // rVFC skipped a frame: the next tick's target (0.02) still maps to the
  // mediaTime-0 entry. Before the fix that entry was already evicted and
  // the tick counted itself late with nothing new on the canvas.
  video.currentTime = 1.02;
  driveFrame(video, 1.02, 2020);
  await flushAsync();
  assert.equal(presenter.stats().presented, 1, 'same entry: no second draw');
  assert.equal(presenter.stats().late, lateBefore, 'same entry: not late');
  assert.equal(presenter.presentedMediaTime(), 0);
  assert.equal(bitmaps.log.closed, 0, 'the entry on the canvas is not closed');
  video.currentTime = 1.5;
  driveFrame(video, 1.5, 2500); // target 0.5 -> a newer entry, drawn
  await flushAsync();
  assert.equal(presenter.stats().presented, 2);
  assert.equal(presenter.presentedMediaTime(), 0.5);
  assert.equal(bitmaps.log.closed, 1, 'now the mediaTime-0 entry is behind the presented one and goes');
  presenter.detach();
});

// --- locateCut (phase-m M4) --------------------------------------------
// Bitmaps carry a flat luma; a canvas stub reports the luma of whatever
// was drawn into it last, so frame-to-frame deltas are exact.
function setupLuma() {
  var ctx = setup();
  var doc = ctx.document;
  var baseCreate = doc.createElement;
  doc.createElement = function (tag) {
    var el = baseCreate.call(doc, tag);
    if (tag === 'canvas') {
      var drawn = 0;
      el.getContext = function () {
        return {
          drawImage(src) {
            drawn = src && typeof src.luma === 'number' ? src.luma : 0;
          },
          getImageData(x, y, w, h) {
            var data = new Uint8ClampedArray(w * h * 4);
            for (var i = 0; i < w * h; i++) {
              data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = drawn;
              data[i * 4 + 3] = 255;
            }
            return { data: data };
          },
        };
      };
    }
    return el;
  };
  return ctx;
}

async function fill(ctx, frames) {
  // frames: [[mediaTime, luma], ...] in capture order
  for (var i = 0; i < frames.length; i++) {
    var v = ctx.video;
    v.luma = frames[i][1];
    driveFrame(v, frames[i][0], 1000 + i * 33);
    await flushAsync();
  }
}

test('locateCut keys the cut at the first frame of the new shot, not at the gate sample', async () => {
  var ctx = setupLuma();
  // createImageBitmap copies the video's luma onto the bitmap
  var base = globalThis.createImageBitmap;
  globalThis.createImageBitmap = function (src, opts) {
    return base(src, opts).then(function (b) {
      b.luma = src && typeof src.luma === 'number' ? src.luma : 0;
      return b;
    });
  };
  try {
    // old shot at luma 40 through 10.033, new shot at 200 from 10.066 on;
    // the gate sampled at 10.000 (prev) and 10.100 (this).
    await fill(ctx, [[9.933, 40], [9.966, 40], [10.0, 40], [10.033, 40], [10.066, 200], [10.1, 200]]);
    assert.equal(ctx.presenter.locateCut(10.0, 10.1), 10.066);
    // A frame at exactly the far edge is inside the window; the near edge is not.
    assert.equal(ctx.presenter.locateCut(10.066, 10.1), null, 'no jump inside (10.066, 10.1]');
    assert.equal(ctx.presenter.locateCut(9.9, 10.033), null, 'a flat window is not a cut');
    // Below half the gate threshold the ring declines and the caller keeps its own reading.
    assert.equal(ctx.presenter.locateCut(10.0, 10.1, 1000), null);
    // Not a number in: null out.
    assert.equal(ctx.presenter.locateCut(null, 10.1), null);
  } finally {
    globalThis.createImageBitmap = base;
    ctx.presenter.detach();
  }
});

test('locateCut is null on a detached presenter or a canvas that cannot read pixels', async () => {
  var ctx = setup();
  await fill(ctx, [[1.0, 0], [1.033, 0], [1.066, 0]]);
  // the default stub canvas has drawImage but no getImageData
  assert.equal(ctx.presenter.locateCut(1.0, 1.066), null);
  ctx.presenter.detach();
  assert.equal(ctx.presenter.locateCut(1.0, 1.066), null);
});
