// THE OTA TUNING CHANNEL.
//
// The numbers ride the rules OTA so a threshold change costs a git push
// instead of a 56MB install. That convenience is only acceptable if a
// bad or hostile payload cannot reach a verdict, so these tests are
// about REFUSAL first and application second.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  applyTuning, applyTuningFromWindow, tunableNames, TUNE_REFUSED, TUNE_CLAMPED,
} from '../src/tuning.mjs';
import * as sceneGate from '../src/scene-gate.mjs';
import * as genderVerdict from '../src/gender-verdict.mjs';
import * as identityMemory from '../src/identity-memory.mjs';
import * as personSkip from '../src/person-skip.mjs';

// Every test restores the shipped values, because these modules hold
// module-global state and a leaked dial would silently rebase every
// later test in the run.
const SHIPPED = {
  CUT_DELTA: sceneGate.CUT_DELTA,
  GENDER_CLEAR_SCORE: genderVerdict.GENDER_CLEAR_SCORE,
  GENDER_CLEAR_SCORE_FEMALE: genderVerdict.GENDER_CLEAR_SCORE_FEMALE,
  NULL_MINT_NM_FLOOR: genderVerdict.NULL_MINT_NM_FLOOR,
  MEM_TRUST_MAN: identityMemory.MEM_TRUST_MAN,
  MEM_TRUST_WOMAN: identityMemory.MEM_TRUST_WOMAN,
  MEM_SIM: identityMemory.MEM_SIM,
  PERSON_SKIP_EVERY: personSkip.PERSON_SKIP_EVERY,
};
const restore = () => applyTuning(SHIPPED);

test('a number from the whitelist takes effect', () => {
  applyTuning({ CUT_DELTA: 44 });
  assert.equal(sceneGate.CUT_DELTA, 44);
  restore();
  assert.equal(sceneGate.CUT_DELTA, SHIPPED.CUT_DELTA);
});

test('a key we do not know is refused, and refusing it changes nothing', () => {
  const before = sceneGate.CUT_DELTA;
  const applied = applyTuning({ CUT_MIN_GAP_MS: 0, PATCH_MARGIN: 9, evil: 1 });
  assert.deepEqual(applied, {});
  assert.equal(TUNE_REFUSED, 3);
  assert.equal(sceneGate.CUT_DELTA, before);
  restore();
});

// THE FLOORS ARE THE POINT OF THE WHOLE FILE.
// Loop 38 measured a real woman reading `male raw 0.58-0.66` at the
// sizes his player produces, which is score 0.16-0.32. A clear bar at
// or under 0.35 clears her. So a push asking for 0.10 must NOT be
// obeyed, and must not be silently dropped either -- it is pulled to
// the edge that was measured safe.
test('a value past its exposure floor is clamped, never applied', () => {
  const applied = applyTuning({ GENDER_CLEAR_SCORE: 0.1 });
  assert.ok(genderVerdict.GENDER_CLEAR_SCORE > 0.35,
    'a clear bar at or under 0.35 clears misgendered women');
  assert.equal(applied.GENDER_CLEAR_SCORE, genderVerdict.GENDER_CLEAR_SCORE);
  assert.equal(TUNE_CLAMPED, 1);
  restore();
});

test('the nm floor cannot be pushed to where it refuses real faces', () => {
  applyTuning({ NULL_MINT_NM_FLOOR: 99 });
  // Ground truth, both arms: at 6 the floor refused 5 of 125 real
  // faces, four of them one woman whose lowest nm was 5.11.
  assert.ok(genderVerdict.NULL_MINT_NM_FLOOR < 6,
    'a floor at or above 6 refuses real faces measured in this repo');
  restore();
});

test('the cut threshold cannot be pushed back onto the motion floor', () => {
  applyTuning({ CUT_DELTA: 1 });
  assert.ok(sceneGate.CUT_DELTA > 28.2,
    'below the measured p90 of ordinary motion, every pan wipes a clear');
  restore();
});

test('identity memory cannot be told to trust a single read', () => {
  applyTuning({ MEM_TRUST_MAN: 0, MEM_TRUST_WOMAN: 0, MEM_SIM: 0.01 });
  assert.ok(identityMemory.MEM_TRUST_MAN >= 1);
  assert.ok(identityMemory.MEM_TRUST_WOMAN >= 1);
  assert.ok(identityMemory.MEM_SIM >= 0.5,
    'below 0.5 two different people match, so one clears from the other');
  restore();
});

test('a malformed payload leaves every shipped constant alone', () => {
  for (const bad of [null, undefined, 'nope', 42, [], { CUT_DELTA: 'fast' },
    { CUT_DELTA: NaN }, { CUT_DELTA: Infinity }]) {
    applyTuning(bad);
    assert.equal(sceneGate.CUT_DELTA, SHIPPED.CUT_DELTA, `payload ${JSON.stringify(bad)}`);
  }
  restore();
});

test('applyTuningFromWindow never throws, whatever the page holds', () => {
  for (const w of [{}, { __TS_GAZE_TUNING__: '{bad json' },
    { __TS_GAZE_TUNING__: '{"CUT_DELTA":44}' },
    { __TS_GAZE_TUNING__: { CUT_DELTA: 41 } },
    { get __TS_GAZE_TUNING__() { throw new Error('hostile'); } }]) {
    assert.doesNotThrow(() => applyTuningFromWindow(w));
  }
  restore();
});

// The channel is only useful if the file the app ships and the file the
// OTA serves are the same shape, and only SAFE if the shipped file asks
// for nothing the whitelist would refuse.
test('rules/tuning.json is valid JSON and every key in it is tunable', () => {
  const raw = readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8');
  const obj = JSON.parse(raw);
  const names = tunableNames();
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    assert.ok(names.includes(k), `rules/tuning.json ships an untunable key: ${k}`);
    assert.equal(typeof obj[k], 'number', `${k} must be a number`);
  }
  const applied = applyTuning(obj);
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    assert.equal(applied[k], obj[k],
      `${k} was clamped, so the file we ship disagrees with the code`);
  }
  restore();
});

// CODE MUST NEVER TRAVEL ON THIS CHANNEL. It runs inside YouTube's page,
// and that is the same store-policy split that keeps scriptlets in the
// binary. A future key whose value is a string is how that rule gets
// broken quietly, so the spec is pinned to numbers here.
test('only numbers can ever be applied', () => {
  const applied = applyTuning({ CUT_DELTA: '50', GENDER_CLEAR_SCORE: () => 1 });
  assert.deepEqual(applied, {});
  restore();
});

// Tuning must be in place BEFORE anything can be judged, or the first
// verdicts of a page run on different constants than the rest.
test('tuning is applied at boot, ahead of the first verdict', () => {
  const src = readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');
  const tune = src.indexOf('applyTuningFromWindow(window)');
  const first = src.indexOf('faceMeta(');
  assert.ok(tune > 0, 'boot never applies tuning');
  assert.ok(first < 0 || tune < first, 'a verdict can be made before tuning lands');
});

// SHIPPING THE CHANNEL MUST CHANGE NOTHING.
//
// The owner installed four builds in one night and asked for something
// battle-tested. This is what makes the channel itself a zero-risk
// install: the tuning.json compiled into the app carries exactly the
// constants the code already had, so a device that never reaches the
// network, and a device that fetches successfully, behave identically.
// Behaviour only moves when someone deliberately pushes a different
// number -- and then it moves by the size of that one number.
//
// It also guards the reverse mistake: changing a constant in source and
// forgetting the file, which would silently revert it on every device
// the moment the OTA landed.
test('the shipped tuning.json equals the shipped constants exactly', () => {
  const obj = JSON.parse(
    readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'));
  for (const [k, v] of Object.entries(SHIPPED)) {
    assert.equal(obj[k], v,
      `rules/tuning.json ${k}=${obj[k]} disagrees with the code's ${v}; ` +
      'shipping this would change behaviour the moment the OTA landed');
  }
  // And nothing tunable may be missing from it, or that dial silently
  // stops being reachable over the air.
  for (const name of tunableNames()) {
    assert.ok(Object.prototype.hasOwnProperty.call(obj, name),
      `${name} is tunable but absent from rules/tuning.json`);
  }
});
