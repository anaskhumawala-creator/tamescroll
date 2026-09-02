// delay-presenter paintPatches: the frame is drawn THEN the patches on
// every present, a changed patch list repaints the held frame, an
// unchanged list costs nothing, and the blur source is padded so the
// clip edge stays solid.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeCtx() {
  const calls = [];
  return {
    calls,
    filter: 'none',
    drawImage() { calls.push({ op: 'draw', args: Array.prototype.slice.call(arguments), filter: this.filter }); },
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); this.filter = 'none'; },
    beginPath() { calls.push({ op: 'path' }); },
    moveTo() {},
    lineTo() {},
    arcTo() {},
    closePath() {},
    clip() { calls.push({ op: 'clip' }); },
  };
}
function makeEl(tag) {
  const listeners = {};
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    width: 0,
    height: 0,
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    contains(t) { return t === this || this.children.some((c) => c === t || (c.contains && c.contains(t))); },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn); },
    getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; },
  };
}
function makeVideo() {
  const v = makeEl('video');
  v.currentTime = 0;
  v.playbackRate = 1;
  v.videoWidth = 640;
  v.videoHeight = 360;
  v.requestVideoFrameCallback = (cb) => { v._rvfcCb = cb; };
  return v;
}
function driveFrame(video, mediaTime, atMs) { video._rvfcCb(atMs, { mediaTime }); }
const flush = () => new Promise((r) => setTimeout(r, 0));

globalThis.document = { hidden: false, createElement: (t) => makeEl(t), addEventListener() {}, removeEventListener() {} };
globalThis.createImageBitmap = (source, opts) => Promise.resolve({ width: (opts && opts.resizeWidth) || 640, height: (opts && opts.resizeHeight) || 360, close() {} });
globalThis.AudioContext = function () {
  this.state = 'running';
  this.createMediaElementSource = () => ({ connect() {} });
  this.createDelay = () => ({ delayTime: { value: 0 }, connect() {} });
  this.destination = {};
  this.suspend = () => Promise.resolve();
  this.resume = () => Promise.resolve();
};

const dp = await import('../src/delay-presenter.mjs');

async function presentedSetup() {
  const host = makeEl('div');
  const video = makeVideo();
  host.appendChild(video);
  const presenter = dp.attachDelay(video, host, { delayMs: 1000 });
  assert.ok(presenter);
  video.currentTime = 0;
  driveFrame(video, 0, 1000);
  await flush();
  video.currentTime = 1.0;
  driveFrame(video, 1.0, 1001);
  await flush();
  assert.equal(presenter.stats().presented, 1);
  const canvas = host.children.find((c) => c.className === 'ts-gaze-delay');
  return { host, video, presenter, canvas, ctx: canvas._ctx };
}

test('canPaint is true when the 2D context has a filter property', async () => {
  const { presenter } = await presentedSetup();
  assert.equal(presenter.canPaint(), true);
  presenter.detach();
});

test('a new patch list repaints the held frame: frame first, then one clipped blurred draw per patch, padded 2x the radius', async () => {
  const { presenter, ctx } = await presentedSetup();
  const before = ctx.calls.length;
  presenter.paintPatches([{ x: 0.25, y: 0.25, w: 0.25, h: 0.5, br: 24 / 640, rr: 8 / 640 }]);
  const ops = ctx.calls.slice(before);
  assert.equal(ops[0].op, 'draw', 'the frame is redrawn first');
  assert.equal(ops[0].args.length, 5, 'full-frame draw');
  const patchDraw = ops.filter((o) => o.op === 'draw')[1];
  assert.ok(patchDraw, 'one blurred draw for the patch');
  assert.equal(patchDraw.filter, 'blur(24px)');
  // canvas is 640x360: x 160, y 90, w 160, h 180, pad 48
  assert.deepEqual(patchDraw.args.slice(1), [112, 42, 256, 276, 112, 42, 256, 276]);
  assert.ok(ops.some((o) => o.op === 'clip'), 'drawn inside a clip');
  assert.equal(ops.filter((o) => o.op === 'save').length, ops.filter((o) => o.op === 'restore').length, 'save/restore balanced');
  assert.equal(presenter.stats().repaints, 1);
  assert.equal(presenter.stats().patchesDrawn, 1);
  presenter.detach();
});

test('an unchanged patch list draws nothing; an emptied list repaints the bare frame once', async () => {
  const { presenter, ctx } = await presentedSetup();
  const list = [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2, br: 0.05, rr: 0.0125 }];
  presenter.paintPatches(list);
  const n = ctx.calls.length;
  presenter.paintPatches(list.map((p) => ({ ...p, x: p.x + 0.0001 }))); // sub-pixel: same rounded key
  assert.equal(ctx.calls.length, n, 'no repaint for a sub-pixel move');
  presenter.paintPatches([]);
  assert.equal(presenter.stats().repaints, 2);
  assert.equal(presenter.stats().patchesDrawn, 0);
  presenter.paintPatches([]);
  assert.equal(presenter.stats().repaints, 2, 'empty to empty is free');
  presenter.detach();
});

test('a newly presented frame carries the current patches with it -- never a bare frame', async () => {
  const { presenter, video, ctx } = await presentedSetup();
  presenter.paintPatches([{ x: 0.5, y: 0.5, w: 0.25, h: 0.25, br: 0.04, rr: 0.0125 }]);
  const before = ctx.calls.length;
  video.currentTime = 2.0;
  driveFrame(video, 2.0, 2001);
  await flush();
  assert.equal(presenter.stats().presented, 2);
  const ops = ctx.calls.slice(before).filter((o) => o.op === 'draw');
  assert.equal(ops.length, 2, 'frame + patch on the new present');
  assert.equal(ops[1].filter, 'blur(26px)');
  presenter.detach();
});

test('paintPatches after detach is a no-op', async () => {
  const { presenter, ctx } = await presentedSetup();
  presenter.detach();
  const n = ctx.calls.length;
  presenter.paintPatches([{ x: 0, y: 0, w: 1, h: 1, br: 0.01, rr: 0 }]);
  assert.equal(ctx.calls.length, n);
});
