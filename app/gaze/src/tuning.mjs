// THE NUMBERS TRAVEL OVER THE AIR; THE CODE DOES NOT.
//
// Every threshold round cost the owner a 56MB install, and four of them
// landed in one night. He said it plainly -- "I'm tired of installing
// new versions" -- and he had already asked the right question: "why
// can't you OTA certain things?"
//
// This is the answer, and it is deliberately the SMALLEST possible
// version of it. `rules/tuning.json` rides the existing rules OTA:
// hashed in rules/manifest.json, fetched from the repo, SHA-256 verified
// and sanity-gated by ota.rs exactly like every rule file, cached in
// app data, invisible on failure. Nothing new is trusted and no new
// network path exists.
//
// WHAT MAY TRAVEL: numbers, from a fixed whitelist, each CLAMPED to a
// range declared here in code. What may not: anything else. A key we do
// not know is refused; a value that is not finite is refused; a value
// outside its range is CLAMPED rather than applied, so the worst a bad
// push can do is move a dial to the edge of a range this file already
// considered safe. Executable JS is not on this channel and must never
// be -- it runs inside YouTube's page, and the same store-policy split
// that keeps scriptlets in the binary applies here.
//
// EVERY RANGE BELOW IS A PROTECTION DECISION, so each one says what
// happens at its edges rather than being a round number.
import * as sceneGate from './scene-gate.mjs';
import * as genderVerdict from './gender-verdict.mjs';
import * as identityMemory from './identity-memory.mjs';

export var TUNED = null;      // what actually took effect, for the report
export var TUNE_REFUSED = 0;  // keys refused outright
export var TUNE_CLAMPED = 0;  // values pulled back to a range edge

// name -> [min, max, apply]
//
// The floors are not decoration. Each one is the point past which the
// dial stops being a tuning knob and becomes an exposure.
var SPEC = {
  // Below the measured p90 of ordinary camera motion (28.2 on his own
  // footage) this fires on motion and wipes cleared people; above the
  // p95 where real cuts begin (54.9) it starts missing real cuts, and a
  // missed cut is a patch associated onto the wrong person.
  CUT_DELTA: [30, 90, function (v) { sceneGate.setCutDelta(v); }],

  // The bar a SAME-GENDER read must clear to earn a clear. Loop 38
  // measured a real woman reading `male raw 0.58-0.66` at the sizes his
  // player produces -- score 0.16-0.32 -- so anything at or under 0.35
  // starts clearing misgendered women. That is the exposure floor and
  // it is why this range does not reach it.
  GENDER_CLEAR_SCORE: [0.36, 0.90, function (v) { genderVerdict.setClearScore(v); }],
  GENDER_CLEAR_SCORE_FEMALE: [0.30, 0.90, function (v) { genderVerdict.setClearScoreFemale(v); }],

  // Descriptor magnitude below which a read carries no signal. 0 is the
  // control and refuses nothing; at 6 the ground-truth arm refused 5 of
  // 125 REAL FACES, four of them the same woman, whose lowest nm was
  // 5.11. So 6 is the exposure edge and the range stops before it.
  NULL_MINT_NM_FLOOR: [0, 5.5, function (v) { genderVerdict.setNmFloor(v); }],

  // How many earned clears an identity needs before memory may act, and
  // how alike two faces must be to count as the same person. A trust of
  // 0 would let one lucky read clear a person forever; a similarity
  // under 0.5 starts merging different people, which clears one from
  // another's evidence.
  MEM_TRUST_MAN: [1, 5, function (v) { identityMemory.setTrustMan(v); }],
  MEM_TRUST_WOMAN: [1, 5, function (v) { identityMemory.setTrustWoman(v); }],
  MEM_SIM: [0.5, 0.9, function (v) { identityMemory.setSim(v); }],
};

export function tunableNames() { return Object.keys(SPEC); }

/**
 * Apply an OTA tuning object. Returns what took effect.
 * Never throws: a malformed payload must leave the shipped constants
 * exactly as they are, because the shipped constants are the ones that
 * were measured.
 */
export function applyTuning(raw) {
  var applied = {};
  TUNE_REFUSED = 0;
  TUNE_CLAMPED = 0;
  if (!raw || typeof raw !== 'object') { TUNED = null; return applied; }
  for (var key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    var spec = SPEC[key];
    if (!spec) { TUNE_REFUSED++; continue; }
    var v = raw[key];
    if (typeof v !== 'number' || !isFinite(v)) { TUNE_REFUSED++; continue; }
    var lo = spec[0], hi = spec[1];
    var c = v < lo ? lo : (v > hi ? hi : v);
    if (c !== v) TUNE_CLAMPED++;
    try { spec[2](c); applied[key] = c; } catch (e) { TUNE_REFUSED++; }
  }
  TUNED = applied;
  return applied;
}

/** Read the payload the app injected, if any. Safe on every failure. */
export function applyTuningFromWindow(w) {
  try {
    var g = w || (typeof window !== 'undefined' ? window : null);
    if (!g) return null;
    var t = g.__TS_GAZE_TUNING__;
    if (!t) return null;
    if (typeof t === 'string') t = JSON.parse(t);
    return applyTuning(t);
  } catch (e) { return null; }
}
