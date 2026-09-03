// THE LOCAL OVERRIDE LAYER, and why it is allowed to exist at all.
//
// The OTA channel moves a number for every phone at once and costs a git
// push plus a rules refresh. The overlay moves one number on THIS phone,
// now, so a dial can be tried against a live video instead of guessed
// at. That is a second writer into the same constants, so it goes
// through the SAME whitelist and the SAME clamps -- these tests are
// about refusal first, exactly like tuning.test.mjs.
//
// O1 (phase-o), THE EXPOSURE THIS FILE NOW GUARDS: the store used to be
// `window.localStorage`, which belongs to the PAGE on m.youtube -- any
// script on YouTube's own origin could read and write
// `tamescroll.tuning` and weaken any dial the panel reaches, including
// GENDER_CLEAR_SCORE. RED PROOF (run this file against the pre-fix
// source and the FIRST test below fails): the old `readOverrides`
// read straight out of `g.localStorage` with no token of any kind, so
// a fake window carrying nothing but a weakened localStorage entry
// applied it. The fix moves the store behind `window.TsTune`, gated on
// the same per-document token PerfBridge already uses (phase-n N8) --
// a page can still WRITE localStorage all it wants; nothing here reads
// it any more.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ov from '../src/tuning-override.mjs';
import { applyTuning, tunableNames, currentValue, specRange } from '../src/tuning.mjs';
import * as personTrack from '../src/person-track.mjs';
import * as sceneGate from '../src/scene-gate.mjs';
import * as videoRegion from '../src/video-region.mjs';

const SHIPPED = {};
for (const k of tunableNames()) SHIPPED[k] = currentValue(k);
const restore = () => { ov.clearOverrides({}, SHIPPED); applyTuning(SHIPPED); ov.setToken(null); };

const TOKEN = 'tok-right';

/** A fake bridge shaped like MainActivity's TsTune: `get`/`set` both
 * check the token themselves, exactly like the real
 * `PerfBridge.ok`/`TsTune.ok` -- a wrong token gets "" back, never the
 * stored value, so this fake is also the acceptance test for "a bridge
 * call with the wrong token returns nothing". `store` is a closure so a
 * test can seed or inspect what would have persisted. */
function fakeBridge(token, store) {
  return {
    get(tok) { return tok === token ? (store.json || '') : ''; },
    set(tok, json) { if (tok === token) store.json = json || ''; },
  };
}

/** A window with a real bridge and nothing else -- the shape the fix
 * requires. */
function bridgedWin(seedJson) {
  const store = { json: seedJson || '' };
  return { TsTune: fakeBridge(TOKEN, store), _store: store };
}

test('THE EXPOSURE: a page-writable localStorage entry can no longer move a dial -- no bridge at all', () => {
  // Exactly what a hostile script on m.youtube could still do after the
  // fix: write whatever it likes to localStorage. There is no TsTune
  // here, so this window has no store this module will ever read.
  const weakened = { GENDER_CLEAR_SCORE: 0.05, PTRACK_MIN_COAST_PASSES: 99 };
  const w = {
    localStorage: {
      getItem: (k) => (k === 'tamescroll.tuning' ? JSON.stringify(weakened) : null),
      setItem() {}, removeItem() {},
    },
  };
  const before = currentValue('GENDER_CLEAR_SCORE');
  assert.deepEqual(ov.readOverrides(w), {}, 'localStorage must not be read at all');
  assert.deepEqual(ov.applyOverrides(w), {});
  assert.equal(currentValue('GENDER_CLEAR_SCORE'), before, 'a page-writable store moved a protection dial');
  restore();
});

test('THE EXPOSURE: the same page-writable localStorage entry cannot move a dial even WITH a bridge present, wrong token', () => {
  // A page that finds window.TsTune (it is a @JavascriptInterface, so it
  // is reachable) but never won the one-shot token race gets "" back
  // from get(), the same as no bridge at all.
  const store = { json: JSON.stringify({ GENDER_CLEAR_SCORE: 0.05 }) };
  const w = { TsTune: fakeBridge(TOKEN, store) };
  ov.setToken('a-different-token');
  const before = currentValue('GENDER_CLEAR_SCORE');
  assert.deepEqual(ov.readOverrides(w), {}, 'the wrong token must read as empty');
  assert.equal(currentValue('GENDER_CLEAR_SCORE'), before);
  restore();
});

test('a bridge with the RIGHT token applies, and stores the clamped value', () => {
  const w = bridgedWin();
  ov.setToken(TOKEN);
  const r = specRange('PTRACK_MIN_COAST_PASSES');
  const got = ov.setOverride(w, 'PTRACK_MIN_COAST_PASSES', 99);
  assert.equal(got, r.max);
  assert.equal(personTrack.PTRACK_MIN_COAST_PASSES, r.max);
  assert.deepEqual(ov.readOverrides(w), { PTRACK_MIN_COAST_PASSES: r.max });
  assert.equal(JSON.parse(w._store.json).PTRACK_MIN_COAST_PASSES, r.max, 'the bridge never saw the write');
  restore();
});

test('no bridge and no token: the edit still applies live, for this document, and persists nothing', () => {
  const w = {};
  ov.setToken(null);
  assert.equal(ov.bridgeAvailable(w), false);
  const before = sceneGate.CUT_DELTA;
  const got = ov.setOverride(w, 'CUT_DELTA', 44);
  assert.equal(got, 44, 'the dial must still move for this session');
  assert.equal(sceneGate.CUT_DELTA, 44);
  assert.deepEqual(ov.overrideBlock(w).applied, { CUT_DELTA: 44 }, 'ACTIVE must carry the memory-only edit');
  restore();
  assert.equal(sceneGate.CUT_DELTA, before);
});

test('every SPEC key can be read back, or the overlay would render a blank row', () => {
  for (const k of tunableNames()) {
    assert.equal(typeof currentValue(k), 'number', k + ' has no getter');
  }
});

test('an unknown key is ignored: not stored, not applied, not counted', () => {
  const w = bridgedWin(JSON.stringify({ evil: 1, PATCH_MARGIN: 9, CUT_DELTA: 44 }));
  ov.setToken(TOKEN);
  assert.deepEqual(ov.readOverrides(w), { CUT_DELTA: 44 });
  assert.deepEqual(ov.applyOverrides(w), { CUT_DELTA: 44 });
  assert.equal(sceneGate.CUT_DELTA, 44);
  assert.equal(ov.overrideCount(w), 1);
  assert.equal(ov.setOverride(w, 'evil', 1), null);
  restore();
});

test('a non-number in the store is refused, and the rest of the store still applies', () => {
  const w = bridgedWin(JSON.stringify({ CUT_DELTA: 'drop tables', BLUR_IN_FRAME: 1 }));
  ov.setToken(TOKEN);
  const before = sceneGate.CUT_DELTA;
  assert.deepEqual(ov.applyOverrides(w), { BLUR_IN_FRAME: 1 });
  assert.equal(sceneGate.CUT_DELTA, before);
  assert.equal(videoRegion.BLUR_IN_FRAME, 1);
  restore();
});

test('a bridge whose get/set throw, and boot proceeds', () => {
  // A bridge that exists but explodes reads as "no overrides", never a
  // failed boot -- same class as the old private-window/blocked-storage
  // case, moved to the new door.
  const thrower = {
    TsTune: {
      get() { throw new Error('boom'); },
      set() { throw new Error('boom'); },
    },
  };
  ov.setToken(TOKEN);
  assert.deepEqual(ov.readOverrides(thrower), {});
  assert.deepEqual(ov.applyOverrides(thrower), {});
  assert.equal(ov.setOverride(thrower, 'CUT_DELTA', 44), 44, 'the dial still moves for this session');
  assert.deepEqual(ov.applyOverrides(null), {});
  assert.deepEqual(ov.applyOverrides({}), {});
  restore();
});

test('malformed JSON from the bridge is a store that says nothing, not a boot that fails', () => {
  const w = bridgedWin('{not json');
  ov.setToken(TOKEN);
  assert.deepEqual(ov.readOverrides(w), {});
  restore();
});

test('clearing puts every dial back where the OTA left it', () => {
  const w = bridgedWin();
  ov.setToken(TOKEN);
  const shipped = sceneGate.CUT_DELTA;
  ov.setOverride(w, 'CUT_DELTA', 70);
  assert.equal(sceneGate.CUT_DELTA, 70);
  ov.clearOverrides(w, SHIPPED);
  assert.equal(sceneGate.CUT_DELTA, shipped);
  assert.deepEqual(ov.readOverrides(w), {});
  assert.equal(w._store.json, '');
  restore();
});

test('the report block is the CLAMPED active value, not the raw store, under our own key names', () => {
  const w = bridgedWin();
  ov.setToken(TOKEN);
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
