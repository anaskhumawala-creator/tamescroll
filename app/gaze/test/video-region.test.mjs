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

// Overlays live inside a `ts-gaze-vregion-clip` layer (inset:0,
// overflow:hidden) rather than directly under the player, so that a
// patch cannot paint outside the player no matter how stale any rect we
// cached has become. The tests ask the same question through it.
function patchesIn(player) {
  const clip = player.children.filter((c) => c.className === 'ts-gaze-vregion-clip');
  return clip.length ? clip[0].children.filter((c) => c.tagName === 'DIV') : [];
}

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

test('canRegionVideo: the m.youtube feed preview is refused, so it keeps whole blur', () => {
  // The preview and the watch player are the SAME #movie_player element.
  // Region overlays there sit at z-index 20 inside a subtree that
  // scrolls, so they ride under the fixed top bar and outlive the
  // preview -- the owner's phone screenshot. Whole blur is a filter on
  // the video itself and cannot paint over chrome.
  const { video } = playerWithVideo({ left: 0, top: 0, width: 320, height: 180 });
  const realClosest = video.closest;
  video.closest = (sel) =>
    sel === '.ytmVideoPreviewHost, ytm-video-preview' ? {} : realClosest.call(video, sel);
  assert.equal(vr.canRegionVideo(video), false);
});

test('setBoxes: creates one overlay per box inside the player host', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  const ok = vr.setBoxes(video, [
    { x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 },
    { x1: 0.5, y1: 0.5, x2: 0.7, y2: 0.7 },
  ]);
  assert.equal(ok, true);
  assert.equal(patchesIn(player).length, 2);
  // ...and exactly one clip layer holds them.
  assert.equal(player.children.filter((c) => c.className === 'ts-gaze-vregion-clip').length, 1);
  vr.clear(video);
});

test('setBoxes: reuses overlays when the count is unchanged', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const first = patchesIn(player)[0];
  vr.setBoxes(video, [{ x1: 0.4, y1: 0.4, x2: 0.6, y2: 0.6 }]); // moved, same count
  const after = patchesIn(player);
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
  assert.equal(patchesIn(player).length, 2);
  vr.clear(video);
});

test('clear: removes every overlay and stops the rAF loop', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const before = scheduled.size;
  vr.clear(video);
  assert.equal(patchesIn(player).length, 0);
  assert.ok(scheduled.size <= before); // the pending frame was cancelled
});

test('setBoxes: empty boxes clears instead of drawing', () => {
  const { player, video } = playerWithVideo({ left: 0, top: 0, width: 640, height: 360 });
  vr.setBoxes(video, [{ x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.3 }]);
  const ok = vr.setBoxes(video, []);
  assert.equal(ok, false);
  assert.equal(patchesIn(player).length, 0);
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
  assert.equal(patchesIn(a.player).length, 0);
  assert.equal(patchesIn(b.player).length, 0);
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


test('the edge is hard, and hard means exactly the requested box', () => {
  // Owner 2026-08-28, closing a dial he had already moved three times:
  // "I'm fine with fully hard rectangle with rounded corners/edges since
  // it looks higher quality." The ramp is off.
  //
  // What this pins is not the taste, it is the two safety properties the
  // soft edge used to carry. With no ramp the element must be EXACTLY
  // the box the pipeline asked for -- not smaller, which is the exposure
  // direction, and not grown by a ramp that is no longer drawn -- and no
  // mask may be written, or a stale mask would eat the corners of a
  // patch nothing is feathering.
  const phone = vr.featherFor({ left: 0, top: 0, width: 460, height: 490 });
  const big = vr.featherFor({ left: 0, top: 0, width: 1600, height: 900 });
  assert.equal(phone, 0);
  assert.equal(big, 0);
  const rect = { left: 100, top: 50, width: 400, height: 300 };
  assert.deepEqual(vr.drawnRect(rect, vr.featherFor(rect)), rect);
  assert.equal(vr.maskFor(rect, vr.featherFor(rect)), '');
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


// Radius scales with the patch (owner 2026-08-27: the in-video blur reads
// as low quality next to a thumbnail's). A thumbnail gets a radius worth
// an eighth of itself; a 24px radius on a 500px patch is a twentieth, and
// body-sized structure survives that.
test('blurRadiusFor: a big patch gets a proportionally big radius', () => {
  const r = vr.blurRadiusFor({ width: 900, height: 500 }, 24);
  assert.ok(r > 24, `expected more than the preset, got ${r}`);
  assert.equal(r, 45);
});

test('blurRadiusFor: the launcher preset is a floor, never a cap', () => {
  // A small patch must never blur LESS than the strength the user picked.
  assert.equal(vr.blurRadiusFor({ width: 80, height: 60 }, 24), 24);
  assert.equal(vr.blurRadiusFor({ width: 80, height: 60 }, 42), 42);
});

test('blurRadiusFor: bounded, and degenerate rects fall back to the preset', () => {
  assert.equal(vr.blurRadiusFor({ width: 4000, height: 3000 }, 24), 72);
  assert.equal(vr.blurRadiusFor({ width: 0, height: 0 }, 24), 24);
});

test('a patch never paints outside the picture', () => {
  // Owner 2026-08-28, phone: a scrolled watch page where the blur ran
  // from inside the sticky player down over the recommendation below it.
  // Overlays are children of the PLAYER and nothing clipped them, so a
  // patch taller than the visible video painted onto the page.
  const bounds = { left: 0, top: 0, right: 400, bottom: 300 };
  const over = vr.clipToBounds({ left: 100, top: 200, width: 200, height: 400 }, bounds);
  assert.deepEqual(over, { left: 100, top: 200, width: 200, height: 100 });
  // Clipping removes pixels that are OUTSIDE the video, so it can never
  // uncover a subject: the part that survives is unchanged.
  const inside = { left: 10, top: 10, width: 50, height: 60 };
  assert.deepEqual(vr.clipToBounds(inside, bounds), inside);
  // Off the picture entirely: nothing to draw, and the caller hides it
  // rather than painting a sliver on the page.
  assert.equal(vr.clipToBounds({ left: 500, top: 10, width: 40, height: 40 }, bounds), null);
  assert.equal(vr.clipToBounds({ left: 10, top: 320, width: 40, height: 40 }, bounds), null);
});

// THE LOOK CONTRACT. These are not assertions about arithmetic; they are
// a lock on four numbers the owner settled on his own hardware after
// nine "low quality" reports across four dates. The audit
// (docs/research/pain-points-2026-08-28.md #1) found one dial moved four
// times in three days -- every time correct for the build it was tuned
// against, and wrong after the next accuracy round changed the geometry
// under it. A round that needs one of these has to change this test too,
// which makes it a decision instead of something he finds on his phone.
test('the look contract is what he settled, in his words', () => {
  // "I'm fine with fully hard rectangle with rounded corners/edges since
  // it looks higher quality" -- 2026-08-28.
  assert.equal(vr.LOOK.featherFrac, 0, 'the edge is HARD; he settled this after four moves');
  // "just handle the corners correctly and not scale it wierdly i think
  // that's already dialled in" -- 2026-08-28.
  assert.equal(vr.LOOK.radiusPx, 8, 'corners are dialled in; do not re-tune');
  // "the invedio blur looks very unpolished unlike the thumbnail blur"
  // -- 2026-08-27. A thumbnail's radius is ~1/8 of its short side.
  assert.equal(vr.LOOK.blurFrac, 0.09);
  assert.equal(vr.LOOK.blurMaxPx, 72);
});

test('the contract is what the renderer actually uses', () => {
  // A frozen constant nothing reads is theatre. featherFor and
  // blurRadiusFor are the two functions that draw with them.
  assert.equal(vr.featherFor({ width: 400, height: 300 }), 0);
  assert.equal(vr.blurRadiusFor({ width: 1000, height: 900 }, 24), vr.LOOK.blurMaxPx);
  assert.equal(
    vr.blurRadiusFor({ width: 400, height: 300 }, 1),
    Math.round(300 * vr.LOOK.blurFrac)
  );
});
