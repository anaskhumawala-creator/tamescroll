// AN IDENTITY OUTLIVES THE TRACK THAT CARRIES IT.
//
// Measured on the 18-window corpus in the owner's own regime (loop 40,
// app/gaze/bench/churn.mjs): over the 482 frames in which a face this
// corpus labels MAN is covered, the track doing the covering changes
// 260 times across 163 distinct ids, and the median run of a single id
// is ONE FRAME. Every new track is born blurred, so a clear that a man
// earned dies with the id that earned it and the next id starts over.
//
// That is why nothing else moved. On the same corpus:
//   * the gender model reads his men right 99.6% of the time and 87.1%
//     clear the shipped bar (raw v p50 0.864)
//   * 72.6% of those faces survive every verdict gate
//   * 68% of the time a man is covered, a clear-certain read on his
//     face had ALREADY landed -- 0-3s earlier, with no scene cut
//   * a SEVENFOLD change in patch area moved false cover by 1.0s
//   * CLEAR_STREAK_N 2 -> 1 recovered 11s of 241s
// The clear was never delayed or refused. It was thrown away with the
// track, and re-earning it needs two passes on an id that does not
// survive one.
//
// ---------------------------------------------------------------
// R13 DELETED IDENTITY MEMORY. READ THIS BEFORE CHANGING ANYTHING.
// ---------------------------------------------------------------
// init-entry.js carries the full post-mortem. Three mechanisms killed
// it, and this module is built to be incapable of all three:
//
//   R13                                   here
//   MAX over a bank that only grows.      Nearest prototype, and a
//   Max of k draws rises with k by        matched entry is UPDATED
//   construction: the best-match FLOOR    (EMA 0.9/0.1) rather than
//   climbed 0.00 -> 0.68 as the bank      appended, so the population
//   filled, independently of who was      does not grow with time on
//   on screen.                            screen.
//
//   The bank saturated at MEM_MAX 8       Entries are capped and the
//   within ~15s of two people being       cap is on IDENTITIES, not on
//   on screen.                            exemplars.
//
//   It remembered BLURRED, so a full      It remembers ONLY CLEAR, and
//   bank re-covered almost any face --    a clear is monotone toward
//   the owner's "why does it keep         UNCOVERING the user's own
//   blurring me".                         gender. It can never cover
//                                         anyone it did not cover
//                                         before.
//
// The last row is the load-bearing one. R13's memory could make a
// wrong call in the EXPOSURE direction on any face; this one can only
// ever lift a patch off somebody, and only off somebody whose identity
// has already earned clear-certain reads on its own.
//
// The descriptor's separability is genuinely poor (docs/detection-
// engine.md: 17% of DIFFERENT-person pairs score >=0.9 against a
// same-person p05 of 0.28), so the safety here does NOT rest on the
// match being right. It rests on three guards that hold even when the
// match is wrong -- trust, revocation, and lean -- and on the fact that
// the only error a wrong match can produce is one the shipped clear
// path can already produce on its own.
//
// AUDITED, not argued (app/gaze/bench/mem-audit.mjs, 3,465 reads):
// the memory fires 359 times in man mode and 187 in woman mode. It
// fires on someone who should be covered ONCE, and that one is a 36px
// face the gender model itself misreads as male at raw 0.73 -- below
// FACE_MIN_NATIVE_PX, so the shipped path abstains and never produces
// the clear read at all. Reachable wrong firings: ZERO in both modes.

// Cosine against a stored prototype. The threshold is deliberately the
// same 0.60 the repo already uses for descriptor similarity; raising it
// to 0.65 was measured and destroys three quarters of the win, because
// same-person similarity at this operating point is genuinely low.
export var MEM_SIM = 0.6;

// HOW MANY EARNED CLEARS BEFORE AN IDENTITY MAY BE TRUSTED, and it is
// asymmetric for the same reason GENDER_CLEAR_SCORE is: clearing a man
// takes more certainty than clearing a woman, because the male read
// distribution sits further from the boundary. Measured both ways on
// the corpus, with exposure UNCHANGED in both modes:
//
//   user gender   trust after   false cover
//   man           1 clear       207.5s  but exposure 82.0 -> 86.0
//   man           2 clears      218.0s  exposure 82.0 (unchanged)
//   woman         1 clear       217.0s  exposure 85.0 (unchanged)
//   woman         2 clears      247.0s  exposure 85.0 (unchanged)
//
// So each mode takes the cheapest setting that costs no exposure.
export var MEM_TRUST_MAN = 2;
export var MEM_TRUST_WOMAN = 1;

// Identities, not exemplars. Two people on screen for a minute produce
// two entries here, where R13's bank produced eight in fifteen seconds.
export var MEM_MAX = 16;
var EMA = 0.1;

export function createIdentityMemory() {
  return { entries: [] };
}

function cos(a, b) {
  var s = 0;
  for (var i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

export function trustNeeded(userGender) {
  return userGender === 'man' ? MEM_TRUST_MAN : MEM_TRUST_WOMAN;
}

/**
 * Update the memory with this read and ask whether it may lift a patch.
 *
 * @param mem   from createIdentityMemory()
 * @param desc  L2-normalised faceres descriptor, or null
 * @param ev    { readClear, certainOpposite, leansOwn, hasSignal, need }
 * @returns true only if a REMEMBERED identity may clear now.
 */
export function askIdentity(mem, desc, ev) {
  if (!mem || !desc || !desc.length) return false;
  var need = typeof ev.need === 'number' ? ev.need : MEM_TRUST_MAN;

  var best = null, bs = MEM_SIM;
  for (var i = 0; i < mem.entries.length; i++) {
    var c = cos(desc, mem.entries[i].proto);
    if (c > bs) { bs = c; best = mem.entries[i]; }
  }
  if (!best) {
    // A NEW IDENTITY IS NEVER TRUSTED ON THE PASS THAT CREATES IT --
    // it is recorded with clearN 0 and has to earn its clears like any
    // other. Returning early here instead would make the first sighting
    // of everybody special.
    best = { proto: descCopy(desc), clearN: 0 };
    mem.entries.push(best);
    if (mem.entries.length > MEM_MAX) mem.entries.shift();
  } else {
    for (var k = 0; k < best.proto.length && k < desc.length; k++)
      best.proto[k] = best.proto[k] * (1 - EMA) + desc[k] * EMA;
  }

  // REVOCATION FIRST, and it applies whether or not the memory is about
  // to act. Without it the memory is a one-way ratchet: a wrong match
  // would uncover somebody permanently, which is the only way this
  // module can cause real harm.
  if (ev.certainOpposite) { best.clearN = 0; return false; }

  var trusted = best.clearN >= need;

  // THE LEAN GUARD. The current read does not have to be certain --
  // requiring that is `strict`, measured, and it recovers almost
  // nothing (236.5s against 218.0s) because a certain read clears on
  // its own anyway. It just may not point the other way.
  var mayAct = trusted && ev.leansOwn;

  // Bank the evidence AFTER deciding, so an identity can never be
  // trusted by the very read it is being asked about.
  if (ev.readClear && ev.hasSignal) best.clearN++;

  return mayAct;
}

function descCopy(d) {
  var out = new Float32Array(d.length);
  for (var i = 0; i < d.length; i++) out[i] = d[i];
  return out;
}
