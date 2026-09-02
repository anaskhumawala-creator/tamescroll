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
import * as personSkip from './person-skip.mjs';
import * as cadence from './cadence.mjs';
import * as personTrack from './person-track.mjs';

export var TUNED = null;      // what actually took effect, for the report
export var TUNE_REFUSED = 0;  // keys refused outright
export var TUNE_CLAMPED = 0;  // values pulled back to a range edge

// name -> [min, max, apply]
//
// The floors are not decoration. Each one is the point past which the
// dial stops being a tuning knob and becomes an exposure.
var SPEC = {
  // The floor is the measured p90 of ordinary camera motion on his own
  // footage (28.2) -- under it the gate fires on a slow pan and every
  // false cut costs a cleared man his clear.
  //
  // The ceiling is where the gate stops being a gate: at 90 it fires on
  // TWO of 2,160 banked corpus frames. 75 still fires on 12.
  //
  // IT IS NOT SET BY CUT RECALL, AND THAT IS A DELIBERATE CHOICE BETWEEN
  // TWO INSTRUMENTS THAT DISAGREE (engine-findings 10j). Against a
  // hard-cut ground truth the gate catches 92.8% of real cuts at 60 and
  // 50.0% at 75, which reads like a cliff. The LABELLED CORPUS measures
  // the outcome that recall is a proxy for, and says the opposite: man
  // exposure falls monotonically 82.5s -> 55.5s from 35 to 90, and false
  // cover with it. Both hold, because a missed cut costs exposure only
  // when a stale CLEARED track absorbs a DIFFERENT person's observation
  // -- recall prices the cut, the corpus prices the conjunction, and the
  // conjunction is rare. Where a proxy and a direct measurement of the
  // thing it proxies disagree, the direct one decides.
  //
  // So the real cost of pushing up is PHANTOM (+3.5s at 75 over 60), and
  // phantom is his loudest complaint. That is why 60 SHIPS and 75 is
  // merely reachable.
  CUT_DELTA: [30, 75, function (v) { sceneGate.setCutDelta(v); }],

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

  // One pass in this many runs the person model once it has admitted
  // nobody PERSON_EMPTY_STREAK times running. ONE IS OFF -- the shipped
  // value, and the reason a build carrying this changes nothing.
  //
  // It is on the channel rather than in the binary because its cost is
  // PHANTOM. Skipping buys pass time, pass time buys cadence, and the
  // corpus prices that same clock change at up to +116s of phantom
  // against -72.5s of exposure. Phantom is what he calls "random blur
  // marks here and there", so this must be reversible in seconds.
  //
  // The ceiling is 4, not higher: at 4 the model still runs every ~6s of
  // wall clock in his regime, which is the slowest it can go and still
  // notice a person walking into frame before a shot ends.
  PERSON_SKIP_EVERY: [1, 4, function (v) { personSkip.setPersonSkipEvery(v); }],

  // THE COAST WINDOW, and it is the biggest lever in the system -- the
  // one that does NOT spend a millisecond of GPU. The `cap` in
  // setVerdictCadence binds at every value his device reaches, so this
  // constant IS the coast. Corpus, both gender arms, in his real regime
  // (k=3 arrival, 2000ms told): 2 -> 1.33 costs +4.0 to +4.5s of
  // exposure and buys 149.5-185.0s of phantom (-26%) plus 7.5-18.5s of
  // false cover. See person-track.setCoastPasses and engine-findings 15.
  //
  // THE FLOOR PROTECTS ONLY ABOVE told 1504, AND SAYING OTHERWISE WAS
  // THE PHASE-D EXPOSURE ROW (D1). The protected quantity is the coast
  // in MILLISECONDS and this clamp is expressed in PASSES, so the
  // guarantee is a function of the cadence in force:
  //
  //   coast = min(max(PTRACK_MAX_COAST_MS 2000, passes * told),
  //               max(900, 2.5 * told))
  //
  // The `passes` term only reaches the answer while `passes * told` is
  // above 2000, which at 1.33 needs told > 1504. Read off the live
  // module, not the formula:
  //
  //   told   shipped 2   floor 1.33   raw 1.0
  //   1200        2400         2000       2000   <- floor buys NOTHING
  //   1500        3000         2000       2000   <- floor buys NOTHING
  //   1600        3200         2128       2000
  //   2000        4000         2660       2000   <- his device
  //
  // At his 2000 the floor is real: 1.0 reaches 2000ms and costs +16.0s
  // (man) / +10.0s (woman) of exposure against the shipped value, and
  // 1.33 holds the coast at 2660ms. Below 1504 the CAP binds instead,
  // and the floor is decoration.
  //
  // A UNIFORM ms GUARANTEE CANNOT EXIST HERE, which is why this is
  // documented rather than clamped harder: holding the coast at 2660ms
  // at told 1200 would need passes 2.22, ABOVE the shipped 2 -- so the
  // clamp would have to refuse the value the app already runs.
  //
  // *** THE DANGEROUS PUSH IS THE JOINT ONE. *** VERDICT_MAX_INTERVAL_MS
  // is on THIS channel, clamped [1200, 4000], and engine-findings 13a
  // recommends moving it down. One tuning.json carrying
  // {"VERDICT_MAX_INTERVAL_MS": 1200, "PTRACK_MIN_COAST_PASSES": 1.33}
  // has both values inside both clamps and lands the coast at 2000ms.
  // Priced on the corpus at told 1500, k=3: man 38.0s exposure against
  // the shipped 25.5s, woman 36.5s against 30.0s. Push ONE of these two
  // at a time, and re-read his rings between.
  //
  // The ceiling is 3.0, and the top of that range is a no-op: past
  // passes 2.5 at his told the `2.5 * told` term wins, so 2.5 and 3.0
  // produce the identical coast (5000ms) and the identical corpus row.
  //
  // IT IS AN EXPOSURE TRADE, so it ships at the measured value and moves
  // only when he says so.
  PTRACK_MIN_COAST_PASSES: [1.33, 3.0, function (v) { personTrack.setCoastPasses(v); }],

  // THE VERDICT CLOCK. RESTATED 2026-09-02: the "81.0s of exposure at
  // 1.5s per verdict against 8.0s at 0.5s" this comment used to quote is
  // 24.5s against 5.5s, and even that diagonal moves the coast alongside
  // the clock (engine-findings 13a, critic C1). What the clock alone
  // buys is EXPOSURE; phantom moves the other way.
  //
  // Measured on his Redmi, the cadence is set by THIS CONSTANT and not by
  // pass cost: a verdict costs 1250ms, effZoom wants 5000, and
  // min(2000, 5000) pins it at 2000 in every arm. See cadence.mjs for the
  // decomposition and the duty table.
  //
  // The floor is a DUTY decision, not a round number. At 1200 with no
  // person-skip the pass (1250ms) is longer than its own interval, which
  // cannot back up -- verdictBusy forbids it -- but leaves the page
  // almost nothing, which is his "just the loading icon" complaint.
  // BELOW ~1500 IS ONLY SAFE WITH PERSON_SKIP_EVERY ABOVE 1, and those
  // two must be pushed together.
  VERDICT_MAX_INTERVAL_MS: [1200, 4000, function (v) { cadence.setVerdictMaxInterval(v); }],
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
    // A LEADING UNDERSCORE IS DOCUMENTATION, NOT A REFUSAL.
    // rules/tuning.json carries a `_comment` explaining the channel, and
    // counting it made TUNE_REFUSED read 1 on every healthy device --
    // so a REAL refusal (a key this build does not know, which is what
    // an old app fetching a new tuning.json looks like) would have been
    // invisible against a floor of 1. Measured on a phone before it was
    // fixed: refused 1, applied 8, nothing actually wrong.
    if (key.charAt(0) === '_') continue;
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
