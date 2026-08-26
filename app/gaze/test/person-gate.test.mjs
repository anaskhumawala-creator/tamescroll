// MoveNet output parsing + person-crop geometry (person-primary
// pipeline, redesign 2026-08-24; evidence gate + aspect-correct head
// anchor 2026-08-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePersons,
  personCropRegion,
  personFromFace,
  PERSON_MIN_SCORE,
  PERSON_HOLD_MAX,
  PERSON_WEAK_KP15,
  PERSON_WEAK_MAXKP,
  PFF_CLOSEUP_H,
  PFF_HALF_CAP,
  PFF_FRAME_KP_FLOOR,
  frameHasNoHumanShape,
} from '../src/person-gate.mjs';

// Keypoint layout: 17 x [y, x, score] then y1,x1,y2,x2,score.
function setKp(data, slot, idx, y, x, s) {
  const o = slot * 56 + idx * 3;
  data[o] = y;
  data[o + 1] = x;
  data[o + 2] = s;
}
function setBox(data, slot, y1, x1, y2, x2, score) {
  const o = slot * 56;
  data[o + 51] = y1;
  data[o + 52] = x1;
  data[o + 53] = y2;
  data[o + 54] = x2;
  data[o + 55] = score;
}
// A believable upper body: nose, both eyes, both ears, both shoulders.
function upperBody(data, slot, cx, cy, headW) {
  setKp(data, slot, 0, cy, cx, 0.9); // nose
  setKp(data, slot, 1, cy - 0.01, cx - headW * 0.2, 0.9); // left eye
  setKp(data, slot, 2, cy - 0.01, cx + headW * 0.2, 0.9); // right eye
  setKp(data, slot, 3, cy, cx - headW / 2, 0.9); // left ear
  setKp(data, slot, 4, cy, cx + headW / 2, 0.9); // right ear
  setKp(data, slot, 5, cy + 0.15, cx - headW, 0.9); // left shoulder
  setKp(data, slot, 6, cy + 0.15, cx + headW, 0.9); // right shoulder
}

test('parsePersons: keeps a real person, drops a low-scoring slot', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.2, 0.6, 0.4, 0.5);
  upperBody(data, 0, 0.3, 0.2, 0.05);
  setBox(data, 1, 0, 0, 0, 0, 0.05);
  const out = parsePersons(data);
  assert.equal(out.length, 1);
  assert.ok(out[0].confidence >= PERSON_MIN_SCORE);
});

test('parsePersons: a slot with too few keypoints is NOT a person (phantom gate)', () => {
  // Score passes, but only two scattered keypoints — the hand/desk
  // close-up case that produced frame-sized phantom patches.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  setKp(data, 0, 9, 0.5, 0.5, 0.8); // a wrist
  setKp(data, 0, 10, 0.6, 0.7, 0.7); // another wrist
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: keypoints without a head OR both shoulders are rejected', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  // Six confident lower/arm keypoints, no head, only ONE shoulder.
  setKp(data, 0, 5, 0.4, 0.3, 0.8);
  for (let i = 7; i <= 11; i++) setKp(data, 0, i, 0.5 + i * 0.01, 0.4, 0.8);
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: leg keypoints DO extend the patch (cover them fully)', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.2, 0.4, 0.5, 0.6, 0.6);
  upperBody(data, 0, 0.5, 0.25, 0.05);
  setKp(data, 0, 15, 0.9, 0.5, 0.9); // ankle below the model box
  const p = parsePersons(data)[0];
  assert.ok(p.y2 > 0.9, 'the patch must reach the feet, got ' + p.y2);
});

test('parsePersons: legs do NOT count as person evidence', () => {
  // Score passes and five confident LEG keypoints exist, but nothing
  // above the waist: still not a person.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.1, 0.1, 0.9, 0.9, 0.6);
  for (let i = 13; i <= 16; i++) setKp(data, 0, i, 0.7 + i * 0.01, 0.5, 0.9);
  setKp(data, 0, 9, 0.6, 0.4, 0.9);
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: wrists DO extend the patch (hands must be covered)', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.2, 0.4, 0.8, 0.6, 0.5);
  upperBody(data, 0, 0.5, 0.25, 0.05);
  setKp(data, 0, 10, 0.5, 0.75, 0.9); // right wrist, outside the box
  const p = parsePersons(data)[0];
  assert.ok(p.x2 > 0.75);
});

test('parsePersons: head anchor uses the frame aspect for its vertical margin', () => {
  const data = new Float32Array(6 * 56);
  // Torso box that crops the head off at y=0.3.
  setBox(data, 0, 0.3, 0.4, 0.8, 0.6, 0.9);
  upperBody(data, 0, 0.5, 0.26, 0.08); // ear span 0.08 -> headW 0.08
  const wide = parsePersons(data, undefined, 16 / 9)[0];
  const square = parsePersons(data, undefined, 1)[0];
  // headH = headW * aspect, so a 16:9 frame reserves MORE normalized-y.
  assert.ok(wide.y1 < square.y1);
  assert.ok(wide.y1 <= 0.26 - 0.08 * (16 / 9) * 1.1 + 1e-6);
  // Sides still cover the head width.
  assert.ok(wide.x1 <= 0.5 - 0.08 * 1.2 + 1e-6);
  assert.ok(wide.x2 >= 0.5 + 0.08 * 1.2 - 1e-6);
  assert.equal(typeof wide.headX, 'number');
});

test('personFromFace: face -> head+upper-torso region, not a full-frame patch', () => {
  const region = personFromFace({ x1: 0.4, y1: 0.1, x2: 0.5, y2: 0.24, confidence: 0.9 });
  const area = (region.x2 - region.x1) * (region.y2 - region.y1);
  assert.ok(area < 0.55, 'crowd patch must not swallow the frame, got ' + area);
  assert.ok(region.y2 > 0.6, 'should reach well below the face for the body');
  assert.equal(region.fromFace, true);
  assert.ok(Math.abs(region.headX - 0.45) < 1e-6);
});

test('personCropRegion: pads the person box, clamped to the frame', () => {
  const region = personCropRegion({ x1: 0.3, y1: 0.1, x2: 0.6, y2: 0.7 });
  assert.ok(region.x1 < 0.3 && region.x2 > 0.6);
  assert.ok(region.y1 < 0.1 && region.y2 > 0.7);
  const edge = personCropRegion({ x1: 0.0, y1: 0.0, x2: 0.5, y2: 1.0 });
  assert.equal(edge.x1, 0);
  assert.equal(edge.y1, 0);
  assert.equal(edge.y2, 1);
});

test('parsePersons: a full-height subject keeps a full-height patch', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.05, 0.4, 0.98, 0.6, 0.8);
  upperBody(data, 0, 0.5, 0.12, 0.05);
  setKp(data, 0, 11, 0.55, 0.45, 0.9);
  setKp(data, 0, 12, 0.55, 0.55, 0.9);
  const p = parsePersons(data, undefined, 16 / 9)[0];
  assert.ok(p.y2 > 0.95, 'covered people are covered to the feet, got ' + p.y2);
});

test('parsePersons: a low-scoring slot with a strong skeleton is still a person', () => {
  // Gauntlet R5, runs/r5c-man slot probe: on every zero-person wide
  // pass, slot 0 returned 0.24-0.35 with 10-11 of 13 confident keypoints
  // and a 0.30 box - the speaker in full view, discarded by the score
  // floor alone, while the audience went undetected and he was the only
  // one we could have covered. Noise slots scored ~0 with 0-4 keypoints.
  const strong = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    strong[k * 3] = 0.3 + k * 0.02;   // y
    strong[k * 3 + 1] = 0.4;          // x
    strong[k * 3 + 2] = 0.8;          // confident
  }
  strong[51] = 0.3; strong[52] = 0.3; strong[53] = 0.6; strong[54] = 0.5;
  strong[55] = 0.24;                  // below PERSON_MIN_SCORE 0.35
  assert.equal(parsePersons(strong).length, 1, 'strong skeleton must survive a low score');

  // Same low score, noise-level skeleton: still rejected.
  const noise = new Float32Array(6 * 56);
  for (let k = 0; k < 3; k++) {
    noise[k * 3 + 2] = 0.8;
  }
  noise[51] = 0.3; noise[52] = 0.3; noise[53] = 0.6; noise[54] = 0.5;
  noise[55] = 0.24;
  assert.equal(parsePersons(noise).length, 0, 'a weak skeleton at a low score stays out');
});

test('parsePersons: a low-scoring slot that claims most of the frame is noise', () => {
  // r5d f003: strong-skeleton admission also let in a slot whose
  // keypoints were scattered across the stage, unioning to 79% of the
  // frame and rendering as a near-full-frame blur. A person that large
  // is MoveNet's easiest case and would never score 0.14.
  const sprawl = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    sprawl[k * 3] = k % 2 ? 0.05 : 0.95;      // y alternating top/bottom
    sprawl[k * 3 + 1] = k % 3 ? 0.02 : 0.96;  // x alternating left/right
    sprawl[k * 3 + 2] = 0.8;
  }
  // MoveNet's own box is small; the keypoints disagree with it wildly.
  sprawl[51] = 0.40; sprawl[52] = 0.40; sprawl[53] = 0.60; sprawl[54] = 0.55;
  sprawl[55] = 0.14;
  assert.equal(parsePersons(sprawl).length, 0, 'sprawling low-score slot must be rejected');

  // A big, COHERENT low-score person (wide shot, keypoints inside the
  // model box) must still get in — that is the whole point of the tier.
  const coherent = new Float32Array(6 * 56);
  for (let k = 0; k < 13; k++) {
    coherent[k * 3] = 0.35 + (k / 13) * 0.5;
    coherent[k * 3 + 1] = 0.45 + (k % 2) * 0.05;
    coherent[k * 3 + 2] = 0.8;
  }
  coherent[51] = 0.30; coherent[52] = 0.40; coherent[53] = 0.90; coherent[54] = 0.55;
  coherent[55] = 0.14;
  assert.equal(parsePersons(coherent).length, 1, 'coherent low-score person is kept');
});

// The keypoint cushion is a DISTANCE, and normalized coordinates are not
// isotropic — it shipped unscaled in y, so a raised hand and the crown of
// a head got 1.78x less real cushion than an outstretched arm. Asserted as
// a SYMMETRY (square frame => square cushion) plus a direction, so the
// test survives a change to KEYPOINT_MARGIN or PATCH_MARGIN.
test('keypoint margin is isotropic in real pixels, not in normalized units', () => {
  // Square box, torso well inside it, and one wrist exactly on the
  // top-left corner: that wrist is then the ONLY keypoint that can push
  // the union outward, so the extension it produces IS the margin.
  const build = () => {
    const data = new Float32Array(6 * 56);
    setBox(data, 0, 0.3, 0.3, 0.7, 0.7, 0.9);
    upperBody(data, 0, 0.5, 0.45, 0.05);
    setKp(data, 0, 9, 0.3, 0.3, 0.9);
    return data;
  };
  const ext = (ar) => {
    const [p] = parsePersons(build(), 0.1, ar);
    assert.ok(p, 'setup: the slot must be accepted as a person');
    return { dx: 0.3 - p.x1, dy: 0.3 - p.y1 };
  };

  const square = ext(1);
  assert.ok(
    Math.abs(square.dy - square.dx) < 1e-6,
    `on a square frame the cushion must be square: dx ${square.dx}, dy ${square.dy}`,
  );

  const wide = ext(16 / 9);
  assert.ok(wide.dx > 0 && wide.dy > 0, 'the union must extend past the keypoint in both axes');
  assert.ok(
    // Not the full 1.78: PATCH_MARGIN is applied afterwards as a
    // fraction of the (now taller) box, which dilutes the ratio to ~1.49.
    wide.dy / wide.dx > 1.4,
    `on 16:9 the vertical cushion must grow with the aspect ratio, got ${(wide.dy / wide.dx).toFixed(3)}`,
  );
  assert.ok(
    wide.dy > square.dy,
    'the fix must ADD vertical cushion on a wide frame, not redistribute it',
  );
});

// The synthetic body's width used to be derived from `face.x2 - face.x1`,
// which detectFaceBoxes makes IDENTICAL to the height in normalized units
// (it squarifies with one scalar in model space). Equal normalized extents
// are not equal pixel distances, so the body's real width silently tracked
// the frame's aspect ratio: measured at 3.91 face-heights per side on 16:9
// but only 1.24 on a 9:16 vertical video -- shoulders sharp, which is
// EXPOSURE, on the shape YouTube serves most. These pin BOTH halves: the
// 16:9 output must not move, and the pixel width must be aspect-invariant.
test('personFromFace: 16:9 geometry is unchanged by the aspect correction', () => {
  // A square-in-normalized-units face box, which is the only kind
  // detectFaceBoxes emits.
  const face = { x1: 0.4, y1: 0.3, x2: 0.5, y2: 0.4, confidence: 0.9 };
  const p = personFromFace(face, 16 / 9);
  const h = (face.y2 - face.y1) / 1.4;
  // The historical constant was 2.2 * (x2-x1)/1.4, and (x2-x1) === (y2-y1).
  const legacyHalf = 2.2 * h;
  const half = (p.x2 - p.x1) / 2;
  assert.ok(
    Math.abs(half - legacyHalf) < 1e-3,
    `16:9 must be bit-compatible with the measured R8 podium geometry: got ${half}, wanted ${legacyHalf}`,
  );
});

test('personFromFace: real body width is the same on any frame aspect', () => {
  // Small and centred, so no edge clamping muddies the comparison.
  const face = { x1: 0.48, y1: 0.3, x2: 0.52, y2: 0.34, confidence: 0.9 };
  // Normalized width x frame aspect = width in units of frame HEIGHT,
  // which is the aspect-independent quantity.
  const physical = (ar) => {
    const p = personFromFace(face, ar);
    return (p.x2 - p.x1) * ar;
  };
  const wide = physical(16 / 9);
  for (const ar of [4 / 3, 1, 9 / 16, 2.39]) {
    assert.ok(
      Math.abs(physical(ar) - wide) < 1e-3,
      `a ${ar.toFixed(2)} frame must cover the same real width as 16:9: ${physical(ar)} vs ${wide}`,
    );
  }
});

test('personFromFace: vertical video is no longer three times too narrow', () => {
  const face = { x1: 0.4, y1: 0.3, x2: 0.5, y2: 0.4, confidence: 0.9 };
  const h = (face.y2 - face.y1) / 1.4;
  const p = personFromFace(face, 9 / 16);
  // The old code would have given 2.2*h here regardless of aspect; correct
  // behaviour is 1.78x WIDER in normalized-x on a 9:16 frame.
  assert.ok(
    (p.x2 - p.x1) / 2 > 2.2 * h * 1.7,
    'the synthetic body must widen in normalized-x as the frame narrows',
  );
});

// --- admission hysteresis (gauntlet R17) ---------------------------
// Measured cause: on a static two-shot of two men, both slots sit ON
// PERSON_MIN_SCORE and the per-pass noise is larger than their distance
// from it, so the admitted set flickered 2/1/0 across 30 passes on a
// frame whose content never changed. Every flicker re-mints a track, and
// a new track starts BLURRED — which is the owner watching himself get
// covered. These pin the fix in both directions: it must hold a real
// person through a dip, and it must not hold anything else.

// A chest-up close-up: head and shoulders confident, no eyes (the ears
// carry the head anchor), so `confident` is 5 — BELOW
// PERSON_STRONG_KEYPOINTS, which is what the real footage looks like and
// what keeps the strong-skeleton tier out of these assertions. Box and
// scores are r17-man f008's slot 0.
function closeUpMan(score, cx) {
  const data = new Float32Array(6 * 56);
  const x = typeof cx === 'number' ? cx : 0.3;
  setBox(data, 0, 0.21, x - 0.2, 1.0, x + 0.18, score);
  setKp(data, 0, 0, 0.3, x, 0.9); // nose
  setKp(data, 0, 3, 0.3, x - 0.025, 0.9); // left ear
  setKp(data, 0, 4, 0.3, x + 0.025, 0.9); // right ear
  setKp(data, 0, 5, 0.45, x - 0.05, 0.9); // left shoulder
  setKp(data, 0, 6, 0.45, x + 0.05, 0.9); // right shoulder
  return data;
}

test('hysteresis: a person who dips under the floor is held, not dropped', () => {
  const strong = parsePersons(closeUpMan(0.4), undefined, 16 / 9);
  assert.equal(strong.length, 1, 'baseline pass must admit him');
  // Same man, same place, score noise takes him to 0.34 — under 0.35.
  assert.equal(
    parsePersons(closeUpMan(0.34), undefined, 16 / 9).length,
    0,
    'without the previous pass he is dropped — that is the bug'
  );
  const held = parsePersons(closeUpMan(0.34), undefined, 16 / 9, strong);
  assert.equal(held.length, 1, 'with the previous pass he survives');
  assert.equal(held[0].hold, 1, 'and is marked as held, not freshly admitted');
});

test('hysteresis: a hold expires after PERSON_HOLD_MAX consecutive passes', () => {
  let prev = parsePersons(closeUpMan(0.4), undefined, 16 / 9);
  const ages = [];
  for (let i = 0; i < PERSON_HOLD_MAX + 3; i++) {
    prev = parsePersons(closeUpMan(0.3), undefined, 16 / 9, prev);
    ages.push(prev.length ? prev[0].hold : null);
    if (!prev.length) break;
  }
  assert.equal(ages[ages.length - 1], null, 'the hold must end');
  assert.equal(ages[ages.length - 2], PERSON_HOLD_MAX, 'and only at the cap');
});

test('hysteresis: it never resurrects a person who moved away', () => {
  const prev = parsePersons(closeUpMan(0.4), undefined, 16 / 9);
  // Same weak score, far side of the frame — no overlap with where the
  // held person was, so this is a different (unproven) candidate.
  assert.equal(parsePersons(closeUpMan(0.3, 0.8), undefined, 16 / 9, prev).length, 0);
});

test('hysteresis: a noise-band slot is never held', () => {
  // R13 measured pure-noise slots at score 0.00-0.13 WITH 6-9 confident
  // keypoints. PERSON_HOLD_SCORE sits above that band on purpose; if
  // someone lowers it into the band, this fails.
  const prev = parsePersons(closeUpMan(0.4), undefined, 16 / 9);
  assert.equal(parsePersons(closeUpMan(0.13), undefined, 16 / 9, prev).length, 0);
});

test('hysteresis: one held person cannot hold two slots open', () => {
  const prev = parsePersons(closeUpMan(0.4), undefined, 16 / 9);
  const twin = closeUpMan(0.3);
  // A duplicate detection on the same box is not a second person.
  for (let k = 0; k < 56; k++) twin[56 + k] = twin[k];
  assert.equal(parsePersons(twin, undefined, 16 / 9, prev).length, 1);
});

test('hysteresis: an unheld pass does not change the ordinary gate', () => {
  // No `held` argument at all — every existing caller and every earlier
  // assertion must behave exactly as before.
  assert.equal(parsePersons(closeUpMan(0.4), undefined, 16 / 9).length, 1);
  assert.equal(parsePersons(closeUpMan(0.34), undefined, 16 / 9).length, 0);
  assert.equal(parsePersons(closeUpMan(0.34), undefined, 16 / 9, []).length, 0);
});

// --- WEAK TIER: the back-turned subject (R18) -----------------------
// Numbers taken from runs/r18b-woman, the 2nd-grade classroom: the
// children's slots read score ~0.09, `confident` 0-1, nKp15 9-11,
// maxKp 0.26-0.39, and were rejected by four gates at once.

/** A back-turned child: plenty of skeleton, none of it over 0.3. */
function backTurned(data, slot, cx, cy, headW, peak) {
  const s = typeof peak === 'number' ? peak : 0.28;
  // Head set present but weak — this is what facing away looks like.
  setKp(data, slot, 0, cy, cx, s - 0.06);
  setKp(data, slot, 1, cy - 0.01, cx - headW * 0.2, s - 0.1);
  setKp(data, slot, 2, cy - 0.01, cx + headW * 0.2, s - 0.1);
  setKp(data, slot, 3, cy, cx - headW / 2, s - 0.08);
  setKp(data, slot, 4, cy, cx + headW / 2, s);
  setKp(data, slot, 5, cy + 0.15, cx - headW, s - 0.05);
  setKp(data, slot, 6, cy + 0.15, cx + headW, s - 0.05);
  setKp(data, slot, 7, cy + 0.25, cx - headW * 1.1, s - 0.09);
  setKp(data, slot, 8, cy + 0.25, cx + headW * 1.1, s - 0.09);
  setKp(data, slot, 9, cy + 0.33, cx - headW, s - 0.11);
  setKp(data, slot, 10, cy + 0.33, cx + headW, s - 0.11);
  setKp(data, slot, 11, cy + 0.4, cx - headW * 0.7, s - 0.07);
  setKp(data, slot, 12, cy + 0.4, cx + headW * 0.7, s - 0.07);
}

test('parsePersons: a back-turned subject with 13 weak keypoints IS a person', () => {
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.6, 0.15, 1, 0.36, 0.09);
  backTurned(data, 0, 0.25, 0.66, 0.05);
  const out = parsePersons(data);
  assert.equal(out.length, 1, 'the child MoveNet saw at nKp15 13 must be admitted');
});

test('parsePersons: the weak tier does not admit a noise slot', () => {
  // R18's genuine noise band: score 0, nKp15 0, maxKp 0.02.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.25, 0.9, 0.95, 0.99, 0);
  for (let i = 0; i < 13; i++) setKp(data, 0, i, 0.5, 0.95, 0.02);
  assert.equal(parsePersons(data).length, 0);
});

test('parsePersons: weak tier needs BOTH axes, not either one', () => {
  // Enough keypoints, but none of them over PERSON_WEAK_MAXKP.
  const few = new Float32Array(6 * 56);
  setBox(few, 0, 0.6, 0.15, 1, 0.36, 0.09);
  backTurned(few, 0, 0.25, 0.66, 0.05, PERSON_WEAK_MAXKP - 0.05);
  assert.equal(parsePersons(few).length, 0, 'maxKp below the floor must not admit');

  // One strong joint, but almost no skeleton behind it.
  const thin = new Float32Array(6 * 56);
  setBox(thin, 0, 0.6, 0.15, 1, 0.36, 0.09);
  setKp(thin, 0, 4, 0.66, 0.27, 0.5);
  setKp(thin, 0, 9, 0.9, 0.2, 0.2);
  assert.equal(parsePersons(thin).length, 0, 'one joint is not a person');
});

test('parsePersons: a weak-tier patch is the MODEL box, not a keypoint union', () => {
  // This is the property that makes the weak tier safe to admit at all,
  // and it is worth pinning because it is not obvious from the diff.
  // The box union only takes keypoints over PERSON_KEYPOINT_MIN, so a
  // slot whose entire skeleton sits at 0.2-0.29 contributes NOTHING to
  // the geometry — the patch is MoveNet's own box plus PATCH_MARGIN and
  // nothing else. The r5d failure the sprawl guard was built for
  // (keypoints flung to opposite corners inflating a small box into a
  // near-full-frame blur) therefore cannot happen on this tier: the
  // keypoints that would do the flinging are all below the threshold
  // that grows the box. Same input as the r5d garbage slot, with weak
  // keypoints instead of confident ones.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.45, 0.45, 0.55, 0.55, 0.09);
  for (let i = 0; i < 13; i++) {
    setKp(data, 0, i, i % 2 ? 0.02 : 0.98, i % 3 ? 0.02 : 0.98, 0.27);
  }
  const out = parsePersons(data);
  assert.equal(out.length, 1);
  // 0.1 box + 8% margin each side, nowhere near the scattered keypoints.
  assert.ok(out[0].x2 - out[0].x1 < 0.2, 'scattered weak keypoints must not grow the box');
  assert.ok(out[0].y2 - out[0].y1 < 0.2);
});

test('parsePersons: a weak-tier person carries no head anchor', () => {
  // Geometry still requires PERSON_KEYPOINT_MIN, so headX stays null and
  // the crop's own-face disambiguation treats them like any other
  // faceless person rather than trusting a 0.2-confidence ear.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.6, 0.15, 1, 0.36, 0.09);
  backTurned(data, 0, 0.25, 0.66, 0.05);
  const out = parsePersons(data);
  assert.equal(out.length, 1);
  assert.equal(out[0].headX, null);
});

test('parsePersons: nKp15 is counted over the upper body only', () => {
  // Thirteen weak LEG keypoints must not manufacture a person: the
  // evidence window is 0-12, and legs are the hallucinated ones.
  const data = new Float32Array(6 * 56);
  setBox(data, 0, 0.6, 0.15, 1, 0.36, 0.09);
  for (let i = 13; i < 17; i++) setKp(data, 0, i, 0.9, 0.25, 0.4);
  assert.ok(PERSON_WEAK_KP15 > 4);
  assert.equal(parsePersons(data).length, 0);
});

// --- personFromFace close-up cap (R20) ------------------------------

/**
 * `h` here is the DE-INFLATED face height personFromFace works in; the
 * detector's box is FACE_ENLARGE-inflated by 1.4, so build the box at
 * 1.4h. The first draft of these tests skipped that and failed, which is
 * the whole reason the factor is spelled out in both places.
 */
function faceBox(cx, cy, h) {
  const s = h * 1.4;
  return { x1: cx - s / 2, y1: cy - s / 2, x2: cx + s / 2, y2: cy + s / 2, confidence: 0.9 };
}

test('personFromFace: a close-up face no longer claims the whole frame', () => {
  // runs/r19*-man f007 and runs/r20-woman f006: BlazeFace returns one
  // face at h 0.563-0.594 inflated (0.402-0.424 de-inflated), MoveNet
  // returns nobody, and the synthetic body
  // came back as the entire frame. In `man` mode that blurred the whole
  // video of a lone man; over a news title card it was a whole-frame
  // GHOST.
  const p = personFromFace(faceBox(0.5, 0.58, 0.402), 16 / 9);
  const width = p.x2 - p.x1;
  assert.ok(width <= 2 * PFF_HALF_CAP + 1e-9, 'width ' + width + ' must respect the cap');
  assert.ok(width < 0.95, 'must not be the whole frame');
  // Still centred on the face, and still generous: the widest MoveNet box
  // ever measured for a face this large is 0.65.
  assert.ok(width > 0.65, 'must still over-cover the measured person');
  assert.ok(p.x1 < 0.5 && p.x2 > 0.5);
});

test('personFromFace: the cap is vertical-free — a close-up still reaches both edges', () => {
  // The clamp to [0,1] in y is CORRECT for a close-up and must not be
  // touched: the head reaches the top of frame and the chest fills to the
  // bottom. Capping it would open EXPOSURE at the hair and chin.
  const h = 0.402;
  const p = personFromFace(faceBox(0.5, 0.58, h), 16 / 9);
  // Uncapped, bit-for-bit: y1 is cy - 1.4h and y2 clamps at the frame.
  assert.ok(Math.abs(p.y1 - (0.58 - h * 1.4)) < 1e-9);
  assert.equal(p.y2, 1);
});

test('personFromFace: a small face is bit-for-bit unchanged by the cap', () => {
  // R8 measured this constant as too NARROW on a podium subject whose
  // face was ~0.09 of frame height inflated (0.064 de-inflated), and R19
  // refused a narrowing for that reason. Nothing below PFF_CLOSEUP_H may
  // move.
  const h = 0.064;
  const p = personFromFace(faceBox(0.5, 0.4, h), 16 / 9);
  const expectedHalf = (3.911 * h) / (16 / 9);
  assert.ok(Math.abs(p.x1 - (0.5 - expectedHalf)) < 1e-9);
  assert.ok(Math.abs(p.x2 - (0.5 + expectedHalf)) < 1e-9);
  assert.ok(h < PFF_CLOSEUP_H);
});

test('personFromFace: the widest band below the cap threshold is untouched', () => {
  // h 0.12-0.18 de-inflated is the band whose widest observed MoveNet box
  // is 0.92 — wider than the cap — so the cap must not reach into it,
  // even though the raw arithmetic would start binding at h 0.159.
  const h = 0.175;
  const p = personFromFace(faceBox(0.5, 0.4, h), 16 / 9);
  const expectedHalf = (3.911 * h) / (16 / 9);
  assert.ok(Math.abs(p.x2 - p.x1 - 2 * expectedHalf) < 1e-9);
});

// --- R21: the uncorroborated-face gate ----------------------------
// Numbers below are the corpus measurement recorded on
// frameHasNoHumanShape: the text slide read maxKp 0.05 on all six
// slots, and the two nearest real cases that must keep their coverage
// read 0.12 (forearms-only workbench) and 0.13 (dim audience).

const slots = (...maxKps) => maxKps.map((maxKp) => ({ maxKp }));

test('frameHasNoHumanShape: the text slide that produced R21 GHOST is caught', () => {
  assert.equal(frameHasNoHumanShape(slots(0.05, 0.05, 0.05, 0.05, 0.05, 0.05)), true);
});

test('frameHasNoHumanShape: the forearms-only frame keeps its coverage', () => {
  // r20b-woman t=304.7. Two people present as hands and forearms; R20
  // scored the uncovered version EXPOSURE under "not leaving the hands".
  assert.equal(frameHasNoHumanShape(slots(0.12, 0.09, 0.07, 0.05, 0.04, 0.02)), false);
});

test('frameHasNoHumanShape: the dim audience frame keeps its coverage', () => {
  // r21-man t=201.7, where the synthetic body is the ONLY thing covering
  // a woman. A floor at 0.15 would have taken this frame.
  assert.equal(frameHasNoHumanShape(slots(0.13, 0.3, 0.3, 0.12, 0.15, 0.28)), false);
});

test('frameHasNoHumanShape: one confident slot is enough, wherever it sits', () => {
  assert.equal(frameHasNoHumanShape(slots(0.01, 0.01, 0.01, 0.01, 0.01, 0.9)), false);
});

test('frameHasNoHumanShape: no diagnostics fails OPEN, toward coverage', () => {
  // The person model may not have loaded yet. Absence of evidence is not
  // evidence of absence, and the safe direction is to keep covering.
  assert.equal(frameHasNoHumanShape([]), false);
  assert.equal(frameHasNoHumanShape(null), false);
  assert.equal(frameHasNoHumanShape(undefined), false);
});

test('frameHasNoHumanShape: a malformed slot never reads as evidence', () => {
  // A probe must not be able to change a verdict by throwing or by
  // arriving half-built (this cost two releases).
  assert.equal(frameHasNoHumanShape([{}, null, { maxKp: null }]), true);
  assert.equal(frameHasNoHumanShape([{ maxKp: 'x' }, { maxKp: 0.9 }]), false);
});

test('frameHasNoHumanShape: the floor sits in the empty band the corpus left', () => {
  assert.ok(PFF_FRAME_KP_FLOOR > 0.05, 'above the slide false positives');
  assert.ok(PFF_FRAME_KP_FLOOR < 0.12, 'below the nearest real case');
});
