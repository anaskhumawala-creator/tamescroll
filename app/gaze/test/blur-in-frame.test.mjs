// BLUR_IN_FRAME (performance batch 2026-09-03, idea #5) and RENDER_EVERY:
// with a painter registered and the dial at 1, the renderer hands the
// painter the rectangles it would have placed -- video-normalized, with
// blur and corner radius normalized the same way -- and hides the divs.
// At 0, or with no painter, the overlay path is byte-for-byte 1097.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    isConnected: true,
    _rect: { left: 0, top: 0, width: 640, height: 360 },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
    getBoundingClientRect() { return this._rect; },
    getClientRects() { return [this._rect]; },
    closest(sel) { return sel === '#movie_player' ? this._player || null : null; },
  };
}
let rafId = 0;
const scheduled = new Map();
globalThis.requestAnimationFrame = (cb) => { const id = ++rafId; scheduled.set(id, cb); return id; };
globalThis.cancelAnimationFrame = (id) => scheduled.delete(id);
globalThis.document = { createElement: (t) => makeEl(t) };
globalThis.window = { getComputedStyle: () => ({ position: 'relative' }) };

const vr = await import('../src/video-region.mjs');

function patchesIn(player) {
  const clip = player.children.filter((c) => c.className === 'ts-gaze-vregion-clip');
  return clip.length ? clip[0].children.filter((c) => c.tagName === 'DIV') : [];
}
function playerWithVideo(rect) {
  const player = makeEl('div');
  const video = makeEl('video');
  video._player = player;
  video._rect = rect;
  player._rect = rect;
  player.appendChild(video);
  return { player, video };
}
function runFrames(n) {
  for (let i = 0; i < n; i++) {
    const cbs = Array.from(scheduled.values());
    scheduled.clear();
    cbs.forEach((cb) => cb(1000 + i * 16));
  }
}

test('dial 0 or no painter: overlays are placed exactly as before and the painter is never called', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const calls = [];
  vr.setBlurInFrame(0);
  vr.setPainter(video, (list) => calls.push(list));
  vr.setBoxes(video, [{ x1: 0.25, y1: 0.25, x2: 0.5, y2: 0.75 }]);
  runFrames(3);
  assert.equal(calls.length, 0);
  assert.equal(patchesIn(player)[0].style.display, '');
  vr.setBlurInFrame(1);
  vr.clearPainter(video);
  runFrames(2);
  assert.equal(calls.length, 0, 'no painter: overlays stay');
  assert.equal(patchesIn(player)[0].style.display, '');
  vr.setBlurInFrame(0);
  vr.clear(video);
});

test('dial 1 + painter: every frame hands the painter the normalized rects and hides the divs', () => {
  const { player, video } = playerWithVideo({ left: 100, top: 50, width: 640, height: 360 });
  const calls = [];
  vr.setBlurInFrame(1);
  vr.setPainter(video, (list) => calls.push(list));
  vr.setBoxes(video, [{ x1: 0.25, y1: 0.25, x2: 0.5, y2: 0.75 }]);
  runFrames(40); // lerp settles well inside 40 frames
  assert.ok(calls.length >= 40, 'one painter call per rendered frame');
  const last = calls[calls.length - 1];
  assert.equal(last.length, 1);
  const p = last[0];
  // normalized to the VIDEO rect, so the (100,50) offset cancels
  assert.ok(Math.abs(p.x - 0.25) < 0.01, 'x ' + p.x);
  assert.ok(Math.abs(p.y - 0.25) < 0.01, 'y ' + p.y);
  assert.ok(Math.abs(p.w - 0.25) < 0.01, 'w ' + p.w);
  assert.ok(Math.abs(p.h - 0.5) < 0.01, 'h ' + p.h);
  assert.ok(p.br > 0 && p.br < 0.2, 'blur radius normalized ' + p.br);
  assert.ok(Math.abs(p.rr - vr.LOOK.radiusPx / 640) < 1e-9, 'corner radius normalized');
  assert.equal(patchesIn(player)[0].style.display, 'none', 'the div stands down');
  const stats = vr.renderStatsForTest ? vr.renderStatsForTest() : null;
  if (stats) assert.ok(stats.painted >= 40);
  // dial back to 0: the very next frame places the div again
  vr.setBlurInFrame(0);
  runFrames(1);
  assert.equal(patchesIn(player)[0].style.display, '');
  vr.clearPainter(video);
  vr.clear(video);
});

test('RENDER_EVERY 2 renders every other rAF and still re-arms the loop', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const calls = [];
  vr.setBlurInFrame(1);
  vr.setPainter(video, (list) => calls.push(list));
  vr.setRenderEvery(2);
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const before = calls.length;
  runFrames(10);
  const painted = calls.length - before;
  assert.ok(painted >= 4 && painted <= 6, 'about half the frames painted, got ' + painted);
  assert.equal(scheduled.size, 1, 'the loop is still armed after skipped frames');
  vr.setRenderEvery(1);
  runFrames(10);
  assert.equal(calls.length - before - painted, 10, 'every frame again at 1');
  vr.setBlurInFrame(0);
  vr.clearPainter(video);
  vr.clear(video);
  assert.equal(patchesIn(player).length, 0);
});
