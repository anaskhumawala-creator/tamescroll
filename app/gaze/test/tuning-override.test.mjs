// THE LOCAL OVERRIDE LAYER, and why it is allowed to exist at all.
//
// The OTA channel moves a number for every phone at once and costs a git
// push plus a rules refresh. The overlay moves one number on THIS phone,
// now, so a dial can be tried against a live video instead of guessed
// at. That is a second writer into the same constants, so it goes
// through the SAME whitelist and the SAME clamps -- these tests are
// about refusal first, exactly like tuning.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ov from '../src/tuning-override.mjs';
import { applyTuning, tunableNames, currentValue, specRange } from '../src/tuning.mjs';
import * as personTrack from '../src/person-track.mjs';
import * as sceneGate from '../src/scene-gate.mjs';
import * as videoRegion from '../src/video-region.mjs';

const SHIPPED = {};
for (const k of tunableNames()) SHIPPED[k] = currentValue(k);
const restore = () => applyTuning(SHIPPED);

/** localStorage is the only thing this module touches, so the fake is
 * the whole environment it runs in. */
function fakeWin(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    localStorage: {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
    _map: map,
  };
}

test('every SPEC key can be read back, or the overlay would render a blank row', () => {
  // A getter that drifts from the whitelist is a dial whose stepper
  // starts from `null` and writes nonsense on the first press.
  for (const k of tunableNames()) {
    assert.equal(typeof currentValue(k), 'number', k + ' has no getter');
  }
});

test('an override outside the clamp lands on the range edge, in the store and in the module', () => {
  const w = fakeWin();
  const r = specRange('PTRACK_MIN_COAST_PASSES');
  const got = ov.setOverride(w, 'PTRACK_MIN_COAST_PASSES', 99);
  assert.equal(got, r.max);
  assert.equal(personTrack.PTRACK_MIN_COAST_PASSES, r.max);
  assert.deepEqual(ov.readOverrides(w), { PTRACK_MIN_COAST_PASSES: r.max });
  restore();
});

test('an unknown key is ignored: not stored, not applied, not counted', () => {
  const w = fakeWin({ 'tamescroll.tuning': JSON.stringify({ evil: 1, PATCH_MARGIN: 9, CUT_DELTA: 44 }) });
  assert.deepEqual(ov.readOverrides(w), { CUT_DELTA: 44 });
  assert.deepEqual(ov.applyOverrides(w), { CUT_DELTA: 44 });
  assert.equal(sceneGate.CUT_DELTA, 44);
  assert.equal(ov.overrideCount(w), 1);
  assert.equal(ov.setOverride(w, 'evil', 1), null);
  restore();
});

test('a non-number in the store is refused, and the rest of the store still applies', () => {
  const w = fakeWin({
    'tamescroll.tuning': JSON.stringify({ CUT_DELTA: 'drop tables', BLUR_IN_FRAME: 1 }),
  });
  const before = sceneGate.CUT_DELTA;
  assert.deepEqual(ov.applyOverrides(w), { BLUR_IN_FRAME: 1 });
  assert.equal(sceneGate.CUT_DELTA, before);
  assert.equal(videoRegion.BLUR_IN_FRAME, 1);
  restore();
});

test('no localStorage, or one that throws, and boot proceeds', () => {
  // A private window, a page with storage blocked, and a worker all
  // reach this. Every one of them must boot on the shipped constants
  // rather than not boot.
  const thrower = {
    localStorage: {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
      removeItem() { throw new Error('SecurityError'); },
    },
  };
  assert.deepEqual(ov.readOverrides(thrower), {});
  assert.deepEqual(ov.applyOverrides(thrower), {});
  assert.equal(ov.overrideCount(thrower), 0);
  assert.equal(ov.setOverride(thrower, 'CUT_DELTA', 44), 44, 'the dial still moves for this session');
  assert.deepEqual(ov.applyOverrides(null), {});
  assert.deepEqual(ov.applyOverrides({}), {});
  restore();
});

test('malformed JSON is a store that says nothing, not a boot that fails', () => {
  const w = fakeWin({ 'tamescroll.tuning': '{not json' });
  assert.deepEqual(ov.readOverrides(w), {});
  restore();
});

test('clearing puts every dial back where the OTA left it', () => {
  const w = fakeWin();
  const shipped = sceneGate.CUT_DELTA;
  ov.setOverride(w, 'CUT_DELTA', 70);
  assert.equal(sceneGate.CUT_DELTA, 70);
  ov.clearOverrides(w, SHIPPED);
  assert.equal(sceneGate.CUT_DELTA, shipped);
  assert.deepEqual(ov.readOverrides(w), {});
  assert.equal(w._map.has('tamescroll.tuning'), false);
  restore();
});

test('the report block is numbers under our own key names, and nothing else', () => {
  const w = fakeWin();
  ov.setOverride(w, 'CUT_DELTA', 70);
  ov.setOverride(w, 'BLUR_IN_FRAME', 1);
  const b = ov.overrideBlock(w);
  assert.equal(b.count, 2);
  for (const k of Object.keys(b.applied)) {
    assert.ok(tunableNames().indexOf(k) !== -1, k + ' is not a whitelisted name');
    assert.equal(typeof b.applied[k], 'number');
  }
  restore();
});
