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
import * as cadence from '../src/cadence.mjs';
import * as personTrack from '../src/person-track.mjs';

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
  VERDICT_MAX_INTERVAL_MS: cadence.VERDICT_MAX_INTERVAL_MS,
  PTRACK_MIN_COAST_PASSES: personTrack.PTRACK_MIN_COAST_PASSES,
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
    // AND THE MAP ABOVE IS HAND-MAINTAINED, so it can fall behind the
    // whitelist -- at which point this whole test silently stops
    // covering the new dial while still reporting green. That is the
    // same shape as every staleness defect in engine-findings 10l: a
    // derivative that does not declare what it was derived from. The
    // guard is cheap and it is the only thing standing between here and
    // a constant that reverts on every device the moment an OTA lands.
    assert.ok(Object.prototype.hasOwnProperty.call(SHIPPED, name),
      `${name} is tunable but missing from this test's SHIPPED map, so ` +
      'nothing checks that rules/tuning.json agrees with the code for it');
  }
});

// WHICH NUMBERS IS HIS PHONE ACTUALLY RUNNING?
//
// The channel's whole point is that a threshold moves without an
// install. Nothing recorded whether a pushed number REACHED a device,
// was CLAMPED to a range edge, or was REFUSED -- so a tuned phone and an
// untuned one produced identical reports, and every ring read since the
// channel shipped was unattributable to a set of constants. That is the
// same ambiguity that let the 1070 regression hide behind an absent
// counter.
test('the report says which tuned numbers took effect', async () => {
  const { buildReport, reportViolations } = await import('../src/diag-report.mjs');
  const r = buildReport({ ids: { tuning: {
    applied: { CUT_DELTA: 60, GENDER_CLEAR_SCORE: 0.45 }, refused: 2, clamped: 1 } } });
  assert.equal(r.engine.tuning.applied.CUT_DELTA, 60);
  assert.equal(r.engine.tuning.refused, 2);
  assert.equal(r.engine.tuning.clamped, 1);
  // A ZERO MUST SURVIVE THE TRIP. "refused 0" and "the block never got
  // hooked up" are different facts and the report has confused them
  // before.
  const z = buildReport({ ids: { tuning: { applied: {}, refused: 0, clamped: 0 } } });
  assert.equal(z.engine.tuning.refused, 0);
  assert.deepEqual(z.engine.tuning.applied, {});
  // And an absent block must not throw or invent numbers.
  const n = buildReport({});
  assert.deepEqual(n.engine.tuning.applied, {});
  assert.deepEqual(reportViolations(JSON.parse(JSON.stringify(r))), []);
});

test('nothing but a finite number can reach the tuning block', async () => {
  // CODE MUST NEVER TRAVEL ON THIS CHANNEL, and the report is the last
  // place a string could get laundered into an artifact he shares.
  const { buildReport, reportViolations } = await import('../src/diag-report.mjs');
  const r = buildReport({ ids: { tuning: { applied: {
    CUT_DELTA: '60', GENDER_CLEAR_SCORE: NaN, MEM_SIM: 0.6,
    evil: () => 1, worse: { toString() { return 'x'; } },
  }, refused: 'lots', clamped: null } } });
  assert.deepEqual(Object.keys(r.engine.tuning.applied), ['MEM_SIM']);
  // NULL, NOT 0. A non-number becomes absent rather than being coerced
  // to a plausible count -- "refused 0" is a fact about a healthy run and
  // must never be manufactured out of a malformed one. The 1070
  // regression hid behind exactly that confusion.
  assert.equal(r.engine.tuning.refused, null);
  assert.deepEqual(reportViolations(JSON.parse(JSON.stringify(r))), []);
});

test('a documentation key is not a refusal', () => {
  // TUNE_REFUSED has to mean "this build does not know that key", which
  // is what an old app fetching a newer tuning.json looks like. The
  // shipped file carries a `_comment`, and counting it put a floor of 1
  // under the counter -- so the one signal it exists to give would have
  // been invisible. Measured on a phone reading refused 1 with nothing
  // wrong.
  applyTuning({ _comment: 'why this channel exists', CUT_DELTA: 44 });
  assert.equal(TUNE_REFUSED, 0);
  assert.equal(sceneGate.CUT_DELTA, 44);
  // ...and a genuinely unknown key still counts.
  applyTuning({ _note: 'x', NOT_A_DIAL: 1, CUT_DELTA: 44 });
  assert.equal(TUNE_REFUSED, 1);
  restore();
});

test('the shipped file is clean through the real path', () => {
  // The end-to-end property: load rules/tuning.json exactly as the app
  // does and nothing may be refused or clamped. A refusal here means the
  // file and the build disagree, which is the silent-revert failure the
  // channel's other test guards from the opposite direction.
  const obj = JSON.parse(
    readFileSync(new URL('../../../rules/tuning.json', import.meta.url), 'utf8'));
  applyTuning(obj);
  assert.equal(TUNE_REFUSED, 0, 'the shipped tuning.json has a key this build refuses');
  assert.equal(TUNE_CLAMPED, 0, 'the shipped tuning.json has a value this build clamps');
  restore();
});

// THE COAST DIAL RE-DERIVES, IT DOES NOT WAIT FOR THE NEXT CADENCE
// CHANGE.
//
// `blurredCoastMs` is computed inside `setVerdictCadence`, so a setter
// that only assigned the constant would leave a pushed value INERT
// until the clock happened to move -- and on his phone the clock is
// pinned by the cap, so "happened to move" can be never. The behaviour
// this pins is the whole reason the dial is worth having.
test('a pushed coast value re-derives the window immediately', () => {
  // 2000 IS WHAT HIS DEVICE HANDS THE TRACKER -- effZoom is cap-pinned
  // there (critic C4). An earlier draft of this test used 1500, his
  // ACHIEVED gap, which is a different number and a regime his phone is
  // not in.
  personTrack.setVerdictCadence(2000);
  const before = personTrack.blurredCoastBudgetMs();
  assert.equal(before, 4000, 'precondition: the shipped cap binds at 2000ms');

  applyTuning({ PTRACK_MIN_COAST_PASSES: 1.33 });
  const after = personTrack.blurredCoastBudgetMs();
  assert.equal(after, 2660, 'the coast must move without another cadence call');

  // and back, because a dial that cannot be un-pushed is not a dial
  restore();
  assert.equal(personTrack.blurredCoastBudgetMs(), 4000);
});

test('the coast dial cannot be pushed below the shipped cap floor', () => {
  // THE CLAMP IS A PROTECTION DECISION. Exposure rises as the coast
  // shortens -- in his regime 23.5s at the shipped value against 40.5s
  // at passes 1.0 -- so the OTA channel must not reach past what the
  // corpus measured and the owner accepted.
  personTrack.setVerdictCadence(2000);
  applyTuning({ PTRACK_MIN_COAST_PASSES: 0.1 });
  assert.equal(personTrack.PTRACK_MIN_COAST_PASSES, 1.33, 'clamped to the floor');
  assert.equal(personTrack.blurredCoastBudgetMs(), 2660,
    'the floor still leaves a real coast; it refuses the 2000ms window '
    + 'that costs +17.0s of exposure, which is the point of the clamp');
  applyTuning({ PTRACK_MIN_COAST_PASSES: 99 });
  assert.equal(personTrack.PTRACK_MIN_COAST_PASSES, 3.0, 'clamped to the ceiling');
  restore();
});
