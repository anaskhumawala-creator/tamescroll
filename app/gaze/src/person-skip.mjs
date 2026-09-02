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
// SHIPPED ON, 2026-09-02 (latency-restructure Task 2). `PERSON_SKIP_EVERY`
// was 1 (never skip) from 2026-08-31 to 2026-09-02 while the ghost gate
// that made a skip dangerous still existed. It is a COUNTER now, not a
// refusal (owner ruling 2026-09-01, "she needs to be blurred" --
// faceEvidence = faces.length in init-entry, and a refused face still
// mints a patch through the composite-frame fallback exactly like a
// kept one). With that precondition gone, the skip pays for itself: on
// the arm64 Redmi MoveNet is ~511ms of every pass and admits nobody in
// 100% of them (his regime). It is still a number on the OTA tuning
// channel -- reversible to 1 in seconds, not a release -- because its
// cost is PHANTOM, the corpus prices the same clock change at up to
// +116s of it, and phantom is what he calls "random blur marks here and
// there".
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

// ...and then it is asked one pass in this many. ONE MEANS NEVER SKIP.
// Shipped at 4 (the OTA ceiling, tuning.mjs): the model still runs
// every ~6s of wall clock in his regime, which is the slowest it can go
// and still notice a person walking into frame before a shot ends.
export var PERSON_SKIP_EVERY = 4;

export function setPersonSkipEvery(v) {
  PERSON_SKIP_EVERY = v;
}

// MODULE-GLOBAL, NOT PER-VIDEO (phase-i critic I15). init-entry.js's
// position-skip gate is `isPlayer && !wasVerdict && !personsLive()`,
// with no `feedPreview()` check of its own -- so this state authors
// every isPlayer video on the page, not only the one the owner is
// watching. Today that is not a live defect: `isPlayer` is
// dom.hasPlayerAncestor, which tests for the single `#movie_player` id,
// and a valid DOM can hold at most one element with that id -- so
// exactly one <video> can ever read isPlayer true at a time on
// m.youtube, whose feed previews reuse THAT SAME element rather than
// minting a second one (see the "A FEED PREVIEW DURING A SCROLL" note
// in init-entry.js). If a build ever attaches two independently
// player-tagged videos concurrently, key this by video element the way
// delay-presenter.mjs keys its graph on the element.
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
