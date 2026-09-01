import test from 'node:test';
import assert from 'node:assert';
import {
  createIdentityMemory,
  askIdentity,
  trustNeeded,
  MEM_SIM,
  MEM_TRUST_MAN,
  MEM_TRUST_WOMAN,
} from '../src/identity-memory.mjs';

// A descriptor pair whose cosine is built FROM MEM_SIM, so these tests
// move with the constant instead of pinning a number that silently
// stops meaning "a match" when it changes. The repo has been bitten by
// a test that compared boxes at IoU 0.835 against a threshold of 0.2.
function pair(sim) {
  const a = Float32Array.from([1, 0]);
  const b = Float32Array.from([sim, Math.sqrt(Math.max(0, 1 - sim * sim))]);
  return [a, b];
}
const CLEAR = { readClear: true, certainOpposite: false, leansOwn: true, hasSignal: true };
const WEAK = { readClear: false, certainOpposite: false, leansOwn: true, hasSignal: true };

test('a brand-new identity is never trusted by the pass that creates it', () => {
  const mem = createIdentityMemory();
  assert.equal(askIdentity(mem, pair(1)[0], { ...CLEAR, need: 1 }), false);
});

test('trust takes `need` earned clears, and then it acts', () => {
  const mem = createIdentityMemory();
  const [a] = pair(1);
  assert.equal(askIdentity(mem, a, { ...CLEAR, need: 2 }), false); // creates
  assert.equal(askIdentity(mem, a, { ...CLEAR, need: 2 }), false); // clearN 1
  assert.equal(askIdentity(mem, a, { ...WEAK, need: 2 }), true);   // clearN 2
});

test('a certain-opposite read REVOKES the memory and returns false', () => {
  const mem = createIdentityMemory();
  const [a] = pair(1);
  for (let i = 0; i < 4; i++) askIdentity(mem, a, { ...CLEAR, need: 1 });
  assert.equal(askIdentity(mem, a, { ...WEAK, need: 1 }), true);
  assert.equal(
    askIdentity(mem, a, { readClear: false, certainOpposite: true, leansOwn: true, hasSignal: true, need: 1 }),
    false
  );
  // and it stays revoked -- a one-way ratchet is the only way this
  // module can uncover somebody permanently.
  assert.equal(askIdentity(mem, a, { ...WEAK, need: 1 }), false);
});

test('the lean guard refuses a read pointing the other way', () => {
  const mem = createIdentityMemory();
  const [a] = pair(1);
  for (let i = 0; i < 3; i++) askIdentity(mem, a, { ...CLEAR, need: 1 });
  assert.equal(askIdentity(mem, a, { ...WEAK, leansOwn: false, need: 1 }), false);
  assert.equal(askIdentity(mem, a, { ...WEAK, need: 1 }), true);
});

test('a descriptor below MEM_SIM is a different identity and inherits nothing', () => {
  const mem = createIdentityMemory();
  const [a, b] = pair(MEM_SIM - 0.1);
  for (let i = 0; i < 4; i++) askIdentity(mem, a, { ...CLEAR, need: 1 });
  assert.ok(askIdentity(mem, a, { ...WEAK, need: 1 }), 'precondition: a is trusted');
  assert.equal(askIdentity(mem, b, { ...WEAK, need: 1 }), false);
});

test('a read with no descriptor signal banks no evidence', () => {
  const mem = createIdentityMemory();
  const [a] = pair(1);
  for (let i = 0; i < 6; i++) askIdentity(mem, a, { ...CLEAR, hasSignal: false, need: 1 });
  assert.equal(askIdentity(mem, a, { ...WEAK, need: 1 }), false);
});

test('no descriptor at all is inert, never a clear', () => {
  const mem = createIdentityMemory();
  assert.equal(askIdentity(mem, null, { ...CLEAR, need: 1 }), false);
  assert.equal(askIdentity(null, pair(1)[0], { ...CLEAR, need: 1 }), false);
});

test('trust is asymmetric the same way the clear bar is', () => {
  assert.equal(trustNeeded('man'), MEM_TRUST_MAN);
  assert.equal(trustNeeded('woman'), MEM_TRUST_WOMAN);
  assert.ok(MEM_TRUST_MAN > MEM_TRUST_WOMAN,
    'clearing a man takes more evidence than clearing a woman -- see GENDER_CLEAR_SCORE');
});

// STRUCTURAL, and it exists because this repo has shipped a decision
// module whose caller dropped a field -- `abstained` was unreachable
// for two releases with a green suite, because the unit tests hand
// observations straight to updatePersonTracks and never cross the
// builder. These assert the WIRING, which no behaviour test above can
// see.
import fs from 'node:fs';
const entry = fs.readFileSync(new URL('../src/init-entry.js', import.meta.url), 'utf8');

test('init-entry actually calls the memory and counts when it fires', () => {
  assert.match(entry, /askIdentity\(identityMem,/,
    'the observation builder must consult the memory');
  assert.match(entry, /bumpLife\('memClear'\)/,
    "a counter nobody has seen fire is a claim -- memClear is how a real run proves this alive");
});

test('the memory is per-video and dies with the stream', () => {
  const n = (entry.match(/identityMem = createIdentityMemory\(\)/g) || []).length;
  assert.ok(n >= 1, 'loadstart must rebuild it: an identity cleared in one stream says nothing about the next');
});

test('the memory may only ever move an observation toward CLEAR', () => {
  // Slice to the marker rather than a fixed character count -- a fixed
  // window has twice stopped covering the block it was written for as
  // comments grew.
  const i = entry.indexOf('askIdentity(identityMem,');
  const block = entry.slice(i, entry.indexOf('bumpLife(\'memClear\')', i));
  assert.ok(!/flagged = true/.test(block),
    'it must be incapable of covering somebody it did not cover before');
  assert.match(block, /flagged = false/);
});

test('a read carrying no descriptor signal goes INERT, not abstained', () => {
  const i = entry.indexOf('mine.abstained && !hasDescriptorSignal');
  assert.ok(i > 0, 'the signal-less branch must exist');
  const block = entry.slice(i, i + 600);
  assert.match(block, /positionOnly = true/);
  assert.match(block, /abstained = false/,
    'an abstain REVOKES an earned clear -- that is the whole defect');
  assert.match(block, /bumpLife\('noSignalInert'\)/);
  // Inert is not dropped. A dropped observation lets a blurred track
  // coast to death and uncovers somebody (loop 37b).
  assert.ok(!/continue|return null/.test(block),
    'the observation must still be pushed, or a covered person goes sharp');
});
