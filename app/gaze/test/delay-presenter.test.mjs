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
  driveFrame(video, 0, 1000);
  await flushAsync();
  var canvas = host.children.find((c) => c.className === 'ts-gaze-delay');
  assert.ok(canvas);
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
  assert.equal(presenter.stats().ring, 2, 'the presented entry and everything before it is evicted');
  assert.equal(bitmaps.log.closed, 1);

  video.currentTime = 1.5;
  driveFrame(video, 1.5, 2500); // target = 0.5 -> presents mediaTime 0.5
  await flushAsync();
  assert.equal(presenter.presentedMediaTime(), 0.5);
  assert.equal(presenter.stats().presented, 2);
  assert.equal(presenter.stats().refills, 1, 'no second refill once live');
});

test('the ring never exceeds the ringBudget frame count', async () => {
  var { video, presenter, bitmaps } = setup({ delayMs: 1000 }); // budget.frames = 45
  video.currentTime = 0; // held fixed: presentTarget stays negative, so nothing is ever
  // picked for presentation -- only the ring's own size cap can shrink it.
  for (var i = 0; i < 60; i++) {
    driveFrame(video, i * 0.1, 1000 + i);
    await flushAsync();
    assert.ok(presenter.stats().ring <= 45, 'ring exceeded its budget at frame ' + i);
  }
  assert.equal(presenter.stats().ring, 45);
  assert.equal(bitmaps.log.created, 60);
  assert.equal(bitmaps.log.closed, 15, 'the 15 oldest evicted by the cap were closed');
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
