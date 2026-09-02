// WHEN THE PERSON MODEL IS EARNING ITS 63-78% OF EVERY VERDICT PASS.
//
// MoveNet MultiPose is ~504ms of a ~794ms verdict on his daily phone and
// 3028ms of a 3872ms pass (p50) on the old Redmi -- and in BOTH
// measurements it admitted ZERO persons in every pass. The face path
// carries the whole player blur on his footage. The clock that costs is
// the dominant driver of exposure: holding everything else, exposure is
// 81.0s at 1.5s per verdict and 8.0s at 0.5s, while every threshold
// swept this month moves 1-3s.
//
// THIS SHIPS INERT. `PERSON_SKIP_EVERY` is 1, which makes wantPersons()
// return true on every pass -- byte-for-byte the behaviour of the build
// before it. It is a number on the OTA tuning channel, so the skip can
// be turned on, measured on his device and turned off again without him
// installing anything. That is deliberate: the skip buys cadence, and
// cadence buys exposure at the cost of PHANTOM (the corpus prices the
// same clock change at up to +116s), and phantom is what he calls
// "random blur marks here and there". A change whose cost lands on his
// oldest complaint should be reversible in seconds, not in a release.
//
// 1068-1070 shipped a skip and was reverted because he reported "it's
// not blurring the female". The defect was never the skip -- it was that
// a skipped pass's empty person list was counted as evidence the FRAME
// was empty, so emptyStreak climbed on passes that had looked at nothing
// and wipeIfEmpty erased a covered woman's patch. See `persons.skipped`
// in init-entry and the emptyFrame guard it feeds. A skipped pass must
// be readable as one all the way down; an empty list is not "nobody is
// there".

// Consecutive passes admitting nobody before the model stops being asked
// every pass.
export var PERSON_EMPTY_STREAK = 3;

// ...and then it is asked one pass in this many. ONE MEANS NEVER SKIP,
// which is the shipped default and the reason this file changes nothing
// until a number is deliberately pushed.
export var PERSON_SKIP_EVERY = 1;

export function setPersonSkipEvery(v) {
  PERSON_SKIP_EVERY = v;
}

var emptyRun = 0;
var skipsSince = 0;

export function wantPersons() {
  if (PERSON_SKIP_EVERY <= 1) return true;
  if (emptyRun < PERSON_EMPTY_STREAK) return true;
  return skipsSince >= PERSON_SKIP_EVERY - 1;
}

/**
 * True while the person model has admitted somebody within the last
 * PERSON_EMPTY_STREAK passes. A position-only pass (MoveNet, no faces)
 * can only produce observations from MoveNet, so where this is false
 * that pass costs a full inference and yields nothing.
 */
export function personsLive() {
  return emptyRun < PERSON_EMPTY_STREAK;
}

export function notePersons(persons, skipped) {
  if (skipped) {
    skipsSince++;
    return;
  }
  skipsSince = 0;
  // `persons.length` is the only honest reading of "did the model admit
  // anybody". noHumanShape is a FRAME statistic and is false on a pass
  // that admitted nobody but saw keypoint noise.
  if (persons && persons.length) emptyRun = 0;
  else emptyRun++;
}

// Tests and a fresh video both need the run to start from nothing --
// otherwise a backed-off state survives a navigation into footage the
// model can actually read.
export function resetPersonSkip() {
  emptyRun = 0;
  skipsSince = 0;
}
