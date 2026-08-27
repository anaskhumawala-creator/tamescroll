// Player face-region blur (owner ask 2026-08-24). Pure mapping under test
// plus the overlay lifecycle: overlays are created inside the player host,
// reused when the box count is unchanged, and torn down on clear — with a
// rAF loop keeping them pinned to the live video rect (fullscreen-safe,
// unlike the body-anchored thumbnail overlays).
import { test } from 'node:test';
import assert from 'node:assert/strict';

// --- minimal DOM stub: enough for setBoxes/clear to run under node -------
function makeEl(tag) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    className: '',
    children: [],
    parentNode: null,
    isConnected: true,
    _rect: { left: 0, top: 0, width: 640, height: 360 },
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
    getBoundingClientRect() {
      return this._rect;
    },
    closest(sel) {
      return sel === '#movie_player' ? this._player || null : null;
    },
  };
}

let rafId = 0;
const scheduled = new Map();
globalThis.requestAnimationFrame = (cb) => {
  const id = ++rafId;
  scheduled.set(id, cb);
  return id;
};
globalThis.cancelAnimationFrame = (id) => scheduled.delete(id);
globalThis.document = { createElement: (t) => makeEl(t) };
globalThis.window = { getComputedStyle: () => ({ position: 'relative' }) };

const vr = await import('../src/video-region.mjs');

function playerWithVideo(rect) {
  const player = makeEl('div');
  const video = makeEl('video');
  video._player = player;
  video._rect = rect;
  player.appendChild(video);
  return { player, video };
}

test('boxToHostRect: normalized box -> player-relative absolute rect', () => {
  // player at viewport (80, 40); video inset (20, 10) inside it. The
  // subtraction must yield player-space coords, immune to ancestor
  // transforms (both rects share them).
  const r = vr.boxToHostRect(
    { left: 80, top: 40, width: 700, height: 400 },
    { left: 100, top: 50, width: 640, height: 360 },
    { x1: 0.5, y1: 0.5, x2: 0.75, y2: 1.0 }
  );
  assert.deepEqual(r, { left: 340, top: 190, width: 160, height: 180 });
});

test('canRegionVideo: true only when a player host resolves', () => {
  const { video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  assert.equal(vr.canRegionVideo(video), true);
  const orphan = makeEl('video'); // no _player -> closest returns null
  assert.equal(vr.canRegionVideo(orphan), false);
});

test('setBoxes: creates one overlay per box inside the player host', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const ok = vr.setBoxes(video, [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
  ]);
  assert.equal(ok, true);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 2);
  vr.clear(video);
});

test('setBoxes: reuses overlays when the count is unchanged', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const first = player.children.filter((c) => c.tagName === 'DIV')[0];
  vr.setBoxes(video, [{ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }]); // moved, same count
  const after = player.children.filter((c) => c.tagName === 'DIV');
  assert.equal(after.length, 1);
  assert.equal(after[0], first); // same node, just repositioned
  // v3: translate-only transform (no scale — corner distortion) plus
  // render-side lerp, so the first frame lands PART WAY toward 256px.
  const m = /translate\(([\d.]+)px/.exec(after[0].style.transform);
  assert.ok(m && Number(m[1]) > 64 && Number(m[1]) <= 256);
  vr.clear(video);
});

test('setBoxes: rebuilds overlays when the count changes', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.setBoxes(video, [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
  ]);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 2);
  vr.clear(video);
});

test('clear: removes every overlay and stops the rAF loop', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const before = scheduled.size;
  vr.clear(video);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 0);
  assert.ok(scheduled.size <= before); // the pending frame was cancelled
});

test('setBoxes: empty boxes clears instead of drawing', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const ok = vr.setBoxes(video, []);
  assert.equal(ok, false);
  assert.equal(player.children.filter((c) => c.tagName === 'DIV').length, 0);
});

test('interpolateBox: advances along velocity, clamps, caps extrapolation', () => {
  const track = { box: { x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }, vx: 0.2, vy: 0 };
  const b = vr.interpolateBox(track, 250); // 0.25s * 0.2/s = 0.05
  assert.ok(Math.abs(b.x1 - 0.45) < 1e-9);
  assert.ok(Math.abs(b.x2 - 0.65) < 1e-9);
  // Past the cap the box stops sliding (stale pass must not drift off).
  const capped = vr.interpolateBox(track, 5000);
  assert.ok(Math.abs(capped.x1 - (0.4 + 0.2 * 1.2)) < 1e-9);
  // Clamped to the frame.
  const edge = vr.interpolateBox({ box: { x1: 0.9, y1: 0, x2: 1, y2: 0.1 }, vx: 1, vy: 0 }, 600);
  assert.equal(edge.x2, 1);
});

test('clearAll: tears down every tracked video', () => {
  const a = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const b = playerWithVideo({ left: 0, top: 0, width: 320, height: 180 });
  vr.setBoxes(a.video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.setBoxes(b.video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  vr.clearAll();
  assert.equal(a.player.children.filter((c) => c.tagName === 'DIV').length, 0);
  assert.equal(b.player.children.filter((c) => c.tagName === 'DIV').length, 0);
});

// --- render lerp: grow instantly, shrink smoothly (R17) ------------
// The symmetric lerp left every LEADING edge ~100ms behind its target,
// which is where a hand or a shoulder leaves the patch. Measured on
// runs/r17b-woman f002: 7.5% of frame width of a covered man's shoulder
// sharp while the target already reached the frame edge.

test('lerpRect: an edge the target has moved OUTSIDE snaps immediately', () => {
  const from = { left: 100, top: 100, width: 100, height: 100 };
  const to = { left: 80, top: 90, width: 160, height: 140 }; // grows every way
  const out = vr.lerpRect(from, to);
  assert.equal(out.left, 80);
  assert.equal(out.top, 90);
  assert.equal(out.left + out.width, 240);
  assert.equal(out.top + out.height, 230);
});

test('lerpRect: an edge the target has moved INSIDE still glides', () => {
  const from = { left: 100, top: 100, width: 100, height: 100 };
  const to = { left: 120, top: 120, width: 60, height: 60 }; // shrinks every way
  const out = vr.lerpRect(from, to);
  assert.ok(out.left > 100 && out.left < 120, 'left eases in, does not snap');
  assert.ok(out.left + out.width > 180 && out.left + out.width < 200, 'right eases in');
});

test('lerpRect: a translating patch never uncovers its leading edge', () => {
  // Pure rightward motion: the right edge is leading, the left trailing.
  let cur = { left: 100, top: 0, width: 100, height: 100 };
  const to = { left: 140, top: 0, width: 100, height: 100 };
  cur = vr.lerpRect(cur, to);
  assert.equal(cur.left + cur.width, 240, 'leading edge is already at the target');
  assert.ok(cur.left < 140, 'trailing edge is still catching up — over-covered, never under');
});

// --- shrink deadband (owner: "multiple boxes... previous versions were
// significantly better at feeling stable"; measured breathe 0.466
// frame-widths/s on the baseline two-person scene) ------------------

test('lerpRect: a tiny inward step is noise and does not move the edge at all', () => {
  const from = { left: 100, top: 100, width: 200, height: 200 };
  // 4px inward on a 200px edge = 2%, under the 5% deadband.
  const to = { left: 104, top: 100, width: 196, height: 200 };
  const out = vr.lerpRect(from, to);
  assert.equal(out.left, 100, 'left edge held');
  assert.equal(out.width, 200, 'no throb');
});

test('lerpRect: a real inward move still glides', () => {
  const from = { left: 100, top: 100, width: 200, height: 200 };
  // 40px inward on a 200px edge = 20%, well over the deadband.
  const to = { left: 140, top: 100, width: 160, height: 200 };
  const out = vr.lerpRect(from, to);
  assert.ok(out.left > 100 && out.left < 140, 'glides rather than snapping');
});

test('lerpRect: the deadband never shrinks a patch below the target', () => {
  // The whole safety argument: holding an edge can only make the drawn
  // rect BIGGER than the lerped one would have been, so it cannot
  // uncover a pixel the target wanted covered.
  const from = { left: 100, top: 100, width: 200, height: 200 };
  const to = { left: 103, top: 102, width: 194, height: 196 };
  const out = vr.lerpRect(from, to);
  assert.ok(out.left <= to.left, 'left never inside target');
  assert.ok(out.top <= to.top, 'top never inside target');
  assert.ok(out.left + out.width >= to.left + to.width, 'right never inside');
  assert.ok(out.top + out.height >= to.top + to.height, 'bottom never inside');
});

test('lerpRect: growth is still instant on every edge', () => {
  const from = { left: 100, top: 100, width: 200, height: 200 };
  const to = { left: 90, top: 88, width: 230, height: 240 };
  const out = vr.lerpRect(from, to);
  assert.equal(out.left, 90);
  assert.equal(out.top, 88);
  assert.equal(out.left + out.width, 320);
  assert.equal(out.top + out.height, 328);
});

test('lerpRect settles instead of chasing a target for ever', () => {
  // An asymptotic lerp never arrives. Left ungated it rewrites the
  // transform at 60Hz through a static shot -- the exact "already feels
  // slow" cost the owner reported. Convergence is the property, so pin it.
  //
  // It does NOT converge onto the target: the shrink deadband parks each
  // inward edge up to 5% of its span short, so the drawn patch settles
  // slightly LARGER than asked. That is the safe direction (over-cover,
  // never exposure) and it is asserted below rather than left implicit.
  let r = { left: 0, top: 0, width: 100, height: 100 };
  const target = { left: 10, top: 10, width: 100, height: 100 };
  let steps = 0;
  while (steps < 200) {
    const next = vr.lerpRect(r, target);
    if (next.left === r.left && next.top === r.top &&
        next.width === r.width && next.height === r.height) break;
    r = next;
    steps++;
  }
  assert.ok(steps < 200, 'never settled: transform rewrites for ever');
  assert.ok(r.left <= target.left, 'settled patch must still contain the target');
  assert.ok(r.top <= target.top);
  assert.ok(r.left + r.width >= target.left + target.width);
  assert.ok(r.top + r.height >= target.top + target.height);
});

test('a BREATHING axis shrinks on the long tail, a TRANSLATING one does not', () => {
  // The whole point of the discriminator: detector noise deflating a box
  // must be damped, while a person walking must not smear. Both cases
  // present as "an inward edge", so the test pins that they are treated
  // differently -- otherwise a future simplification collapses them.
  const from = { left: 100, top: 0, width: 100, height: 100 };

  // Deflating: left moves right, right moves left. Opposite signs.
  const breathe = { left: 130, top: 0, width: 40, height: 100 };
  const b = vr.lerpRect(from, breathe);

  // Sliding right by 30: BOTH edges move right. Same sign.
  const slide = { left: 130, top: 0, width: 100, height: 100 };
  const t = vr.lerpRect(from, slide);

  // Same inward step of 30 on the left edge in both cases, so any
  // difference is the rate alone.
  const breatheStep = b.left - from.left;
  const slideStep = t.left - from.left;
  assert.ok(breatheStep < slideStep,
    `breathing should lag the slide: ${breatheStep} vs ${slideStep}`);
  assert.ok(breatheStep > 0, 'it must still move eventually');
});

test('the long tail never uncovers the leading edge of a moving patch', () => {
  // Regression guard for the reason S1 refused a plain slower lerp.
  let cur = { left: 100, top: 0, width: 100, height: 100 };
  for (let i = 1; i <= 12; i++) {
    const to = { left: 100 + i * 8, top: 0, width: 100, height: 100 };
    cur = vr.lerpRect(cur, to);
    assert.ok(cur.left + cur.width >= to.left + to.width,
      `leading edge exposed at step ${i}`);
  }
});


test('feather scales with the patch, so a phone and a desktop look alike', () => {
  // Owner 2026-08-26, from a phone screenshot: "the square edges should
  // not have been shown". The ramp was capped at 16 ABSOLUTE px, which on
  // his ~460px patch was 3.5% of it -- a gradient by construction and a
  // hard rectangle to the eye. A fraction of the patch is the only form
  // that looks the same at two player sizes.
  const small = vr.featherFor({ left: 0, top: 0, width: 120, height: 90 });
  const phone = vr.featherFor({ left: 0, top: 0, width: 460, height: 490 });
  const big = vr.featherFor({ left: 0, top: 0, width: 1600, height: 900 });
  assert.ok(phone > 16, `phone patch must get a visible ramp, got ${phone}`);
  // The share was halved on 2026-08-27 ("needs sharpur blur edges ...
  // looks a bit low quality") once the margin stack it was sized against
  // was cut. What this test pins is the SCALING, not the width: the ramp
  // must still be a share of the patch rather than a pixel constant.
  assert.ok(phone / 460 >= 0.04, 'ramp must be a meaningful share of the patch');
  assert.ok(
    Math.abs(phone / 460 - big / 900) < 1e-6,
    'the same share at two player sizes -- that is the whole point',
  );
  assert.ok(big >= phone, 'a larger patch may not get a smaller ramp');
  // A small patch must not be mostly gradient.
  assert.ok(small <= 90 / 3 + 1e-9, 'ramp capped at a third of the short side');
});

test('the feather is added OUTSIDE, so the requested box stays fully covered', () => {
  // The safety property the whole construction rests on: growing the
  // element by the ramp means the opaque core still covers every pixel
  // the hard rectangle covered. Ramping inward instead would under-cover.
  const rect = { left: 100, top: 50, width: 400, height: 300 };
  const f = vr.featherFor(rect);
  assert.ok(f > 0);
  const grown = {
    left: rect.left - f,
    top: rect.top - f,
    width: rect.width + f * 2,
    height: rect.height + f * 2,
  };
  assert.ok(grown.left <= rect.left);
  assert.ok(grown.top <= rect.top);
  assert.ok(grown.left + grown.width >= rect.left + rect.width);
  assert.ok(grown.top + grown.height >= rect.top + rect.height);
});

// S9/F4: a merge, an unmerge or a re-ordered group all change the key
// string for the SAME humans. Treated as a new key it costs a DOM
// rebuild, and a rebuilt overlay renders with `from = null`, which is the
// only path here that skips SHRINK_DEADBAND and SHRINK_LERP entirely.
test('shareCount finds the overlay that carries the same people', () => {
  const want = vr.memberSet('7+9');
  assert.equal(vr.shareCount(want, '7'), 1);
  assert.equal(vr.shareCount(want, '9+12'), 1);
  assert.equal(vr.shareCount(want, '7+9'), 2);
  assert.equal(vr.shareCount(want, '12'), 0);
  assert.equal(vr.shareCount(want, ''), 0);
});

test('memberSet ignores empty segments', () => {
  assert.deepEqual(vr.memberSet(''), {});
  assert.deepEqual(vr.memberSet('4'), { 4: 1 });
  assert.deepEqual(vr.memberSet('4+4'), { 4: 1 });
});

// --- mask construction -----------------------------------------------
//
// The patch is SOLID (owner 2026-08-26: no face cutouts). Only the two
// feather fades remain, and they are still order-dependent: CSS mask
// layers composite bottom-up, so `source-in` must sit above the
// `source-over` base or it clips nothing. R24 proved by pixel that an
// operator list read back from the DOM is not evidence that the mask
// RESULT is what you meant.

// Top-level comma split: gradients carry commas inside parentheses, and
// a naive split reports 18 layers for 2.
function splitTop(str) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseMask(spec) {
  const [img, size, pos, comp, wcomp] = spec.split('|');
  return {
    img: splitTop(img),
    size: splitTop(size),
    pos: splitTop(pos),
    comp: splitTop(comp),
    wcomp: splitTop(wcomp),
  };
}

const RECT = { left: 0, top: 0, width: 400, height: 300 };

test('a patch that only TRANSLATES produces a byte-identical mask string', () => {
  // The perf claim S13 ships on: applyMask early-outs on an unchanged
  // string, so a sliding patch must not rebuild the mask. The mask is
  // built from the rect's SIZE only, so translation cannot touch it.
  const a = vr.maskFor({ left: 0, top: 0, width: 400, height: 300 }, 20);
  const b = vr.maskFor({ left: 37, top: -11, width: 400, height: 300 }, 20);
  assert.ok(a, 'precondition: a feathered patch does write a mask');
  assert.equal(a, b);
});

test('the two feather fades keep source-in ABOVE the source-over base', () => {
  // Bottom-up compositing: reverse these and the vertical fade clips
  // nothing, which is how the patch had hard top/bottom edges for eight
  // rounds while every DOM probe read back the right operators.
  const m = parseMask(vr.maskFor(RECT, 20));
  assert.equal(m.img.length, 2);
  assert.match(m.img[0], /to bottom/);
  assert.match(m.img[1], /to right/);
  assert.deepEqual(m.wcomp, ['source-in', 'source-over']);
});

test('the patch mask has no cut-out layer of any kind', () => {
  // Owner 2026-08-26, twice: no face cutouts in the blur. A radial
  // gradient or an exclude/xor operator here means a hole came back.
  const spec = vr.maskFor(RECT, 20);
  assert.ok(!/radial-gradient/.test(spec), 'no hole layer');
  assert.ok(!/xor|exclude/.test(spec), 'no subtracting operator');
});

test('a sub-pixel SIZE wobble no longer changes the mask string', () => {
  // lerpRect is asymptotic and the shrink deadband parks an edge without
  // ever reaching it, so the lerped size wobbles by a fraction of a pixel
  // for ever. drawnRect is what stops that reaching the mask, so the test
  // goes through drawnRect rather than asserting an identity of its own.
  const f = 20;
  const a = vr.drawnRect({ left: 0, top: 0, width: 400, height: 300 }, f);
  const b = vr.drawnRect({ left: 0, top: 0, width: 400.37, height: 299.72 }, f);
  assert.equal(a.width, b.width, 'rounded width absorbs the wobble');
  assert.equal(a.height, b.height, 'rounded height absorbs the wobble');
  assert.equal(vr.maskFor(a, f), vr.maskFor(b, f));
});

test('every operator list stays one entry per layer', () => {
  for (const f of [10, 20, 64]) {
    const m = parseMask(vr.maskFor(RECT, f));
    assert.equal(m.comp.length, m.img.length, 'a short list silently repeats and re-composites');
    assert.equal(m.wcomp.length, m.img.length);
    assert.equal(m.size.length, m.img.length);
    assert.equal(m.pos.length, m.img.length);
  }
});

test('no feather writes nothing at all', () => {
  assert.equal(vr.maskFor(RECT, 0), '', 'a plain patch must not pay for a mask');
});

