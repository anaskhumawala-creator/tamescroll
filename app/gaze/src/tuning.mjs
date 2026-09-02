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
import * as delayCore from './delay-core.mjs';

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
  // nobody PERSON_EMPTY_STREAK times running. ONE IS OFF. Shipped at 4
  // (latency-restructure Task 2, 2026-09-02) now that the ghost gate
  // that made a skip dangerous is a counter and not a refusal (owner
  // ruling 2026-09-01, "she needs to be blurred") -- a refused face
  // still mints a patch through the composite-frame fallback, so a
  // skipped pass can no longer erase anyone.
  //
  // It is on the channel rather than only in the binary because its
  // cost is PHANTOM. Skipping buys pass time, pass time buys cadence,
  // and the corpus prices that same clock change at up to +116s of
  // phantom against -72.5s of exposure. Phantom is what he calls
  // "random blur marks here and there", so this must be reversible in
  // seconds, and 1 is one push away if his rings show it costing more
  // than it should.
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

  // THE ASSOCIATION THRESHOLD. Below this overlap an observation is not
  // the same person and a new track is born. Moved 0.20 -> 0.15 on
  // 2026-09-02 (findings 10o, and the reasoning is on the constant
  // itself in person-track.mjs).
  //
  // EXPOSURE IS MONOTONE IN THIS DIAL ACROSS THE WHOLE RANGE, and the
  // note here used to describe only the half below the shipped value --
  // which is how 0.15 came to be chosen without anyone reading what
  // tightening would do (phase-E critic, E5). Under 1091's optimal
  // assignment, man mode:
  //
  //   0.30  17.0 / 160.0 / 581.0        0.15  22.5 / 136.5 / 547.5  SHIP
  //   0.25  19.5 / 147.0 / 563.0        0.10  24.5 / 137.5 / 543.0
  //   0.20  21.5 / 139.5 / 566.5        0.05  28.0 / 135.0 / 528.0
  //
  // woman moves the same way (20.0 at 0.30 to 28.5 at 0.05). The
  // mechanism for the loose end is the one loop 39 traced this corpus's
  // largest exposure to: a looser threshold can associate a woman's
  // observation onto a man's CLEARED track.
  //
  // SO THE SHIPPED VALUE IS THE BEST PHANTOM POINT ON THE REACHABLE
  // LADDER AND CLOSE TO THE WORST EXPOSURE POINT. That is a protection
  // trade and it is HIS. Both directions travel over OTA without an
  // install: 0.20 buys back 1.0s (man) / 2.5s (woman) of exposure for
  // 19.0s / 31.0s of phantom, and 0.30 buys back 5.5s / 5.5s for 33.5s /
  // 74.5s. The floor of 0.10 bounds the loose end (0.05 costs +5.5s and
  // buys no false cover); the ceiling of 0.35 lets it be tightened past
  // where it has ever run if his rings show re-association going wrong
  // on his own footage, which the corpus cannot see.
  //
  // Raw: spikes/gauntlet/iou-under-optimal.txt
  PTRACK_IOU_MIN: [0.10, 0.35, function (v) { personTrack.setIouMin(v); }],

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

  // THE MULTIPLIER ON THE LAST PASS'S OWN COST, not the cap above it:
  // effZoom = min(VERDICT_MAX_INTERVAL_MS, max(ZOOM_INTERVAL_MS,
  // lastVerdictMs * VERDICT_DUTY)). Shipped at 2, down from a 4 that
  // was never on this channel. 4x was calibrated for a device that was
  // CAP-limited (the duty table in cadence.mjs pins both arms at 2000
  // regardless of pass cost), so nothing downstream of cost could move
  // the clock while that held. After the person-skip and position-pass
  // restructure the Redmi's verdict is cheap enough that 2x lands
  // inside the cap instead of being clamped away by it, and the coast
  // window (derived from the cadence in setVerdictCadence) shrinks with
  // it, which is where the phantom reduction comes from.
  //
  // The floor is 1.5, not 1.0: below it the GPU spends more of every
  // second running verdicts than it has free, which is the same duty
  // problem VERDICT_MAX_INTERVAL_MS's own floor exists to avoid --
  // engine-findings 10i measured the GPU that skipping the person pass
  // freed going to the render loop, not to more verdicts than the page
  // can afford. The ceiling of 4 is the value this constant shipped at
  // before it was ever tunable, so the range brackets rather than
  // exceeds what has already run in production.
  VERDICT_DUTY: [1.5, 4, function (v) { cadence.setVerdictDuty(v); }],

  // GENDER ONLY FOR TRACKS THAT NEED A READ (latency-restructure Task 4,
  // 2026-09-02). A crop + gender read costs ~536ms of faceres on the
  // arm64 Redmi; a track whose verdict is SETTLED -- a flag-certain
  // blur, or a cleared track re-confirmed within this window -- gains
  // nothing from paying for another one. This is the window: how long a
  // settled track's last read may stand before it is treated as stale
  // again. See person-track.trackNeedsRead.
  //
  // Red-proved at 0: `nowMs - readAt >= 0` is true for every track that
  // has ever been read, so a push of 0 makes EVERY verdict pass read
  // EVERY picked person, byte-identical to the pre-Task-4 arm --
  // bench/gender-skip-arm.mjs pins this against the control triple.
  //
  // The floor is 1000, not 0: below one verdict interval the window
  // closes before a second verdict can even land at his cadence
  // (VERDICT_MAX_INTERVAL_MS floors at 1200), so the skip could never
  // fire and the dial would be decoration. The ceiling is 4000, twice
  // the shipped VERDICT_MAX_INTERVAL_MS default -- past that a settled
  // track goes two verdict intervals without a single re-confirming
  // read, which is longer than CLEARED_TTL_MS already allows a clear to
  // stand unrefreshed.
  GENDER_REFRESH_MS: [1000, 4000, function (v) { personTrack.setGenderRefreshMs(v); }],
  // DELAY LINE (Stage B, plan 2026-09-02). How far behind the judged
  // frame the presented picture runs. 0 = presenter OFF, the reactive
  // pipeline exactly as 1091 ran it; 1000 is what the Redmi spike sized
  // the ring for (spikes/delay-line/FINDINGS.md); 2500 is the most the
  // ring budget (delay-core RING_BYTES_MAX) holds at 720p30 with room
  // to spare. Read at attach time per video, so a pushed value reaches
  // the NEXT video attached, not one mid-play -- deliberately: a ring
  // resized under a playing video is a flush and a full-cover refill.
  DELAY_MS: [0, 2500, function (v) { delayCore.setDelayMs(v); }],
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
