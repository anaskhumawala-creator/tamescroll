// MoveNet person parsing + crop geometry (redesign 2026-08-24; geometry
// rewritten 2026-08-25 after the accuracy review).
//
// The person is the unit of blur. parsePersons reads the model output;
// personCropRegion gives each person the region their face/gender pass
// crops.
//
// Geometry rules learned the hard way (owner frames + review):
//  - Union only keypoints 0-12 (head, shoulders, elbows, wrists, hips).
//    Ankles/knees are routinely HALLUCINATED in head-and-shoulders shots
//    and dragged the patch to the frame floor.
//  - Head size is measured across X but must be applied in Y through the
//    frame aspect, or the head margin comes out ~1.8x too small on 16:9
//    (which is what PTRACK_PAD_TOP was compensating for).
//  - A slot only counts as a PERSON with real evidence: box score, a
//    minimum number of confident keypoints, and an actual head or both
//    shoulders. MoveNet always emits 6 slots; on hand/desk close-ups the
//    empty ones come back with scattered keypoints, and a low floor
//    turned those into frame-sized phantom patches that never expired.
//
// Pure module: no DOM, no tf. Boxes are {x1,y1,x2,y2} normalized 0..1.

// 0.25 -> 0.35 2026-08-25: the old floor sat BELOW the observed
// real-person band (0.28-0.62), so it admitted noise slots by design.
export var PERSON_MIN_SCORE = 0.35;
// Second tier of the score gate: a slot this weak still counts as a
// person if its skeleton is strong. 0.12 sits below every real-person
// score measured on a wide stage shot (lowest observed 0.14 with 10
// confident keypoints) and above the ~0-0.02 that empty slots return.
export var PERSON_LOW_SCORE = 0.12;
// R14 tried lowering this 7 -> 5 and REVERTED it after measuring. Do not
// retry without new evidence; the reasoning is here so the diff alone
// cannot lose it.
//
// The case looked strong. A composite broadcast layout (news debate, five
// talking-head windows each ~0.28 of frame height) put a population of
// slots just under the bar: score 0.13-0.21, 5-6 confident keypoints,
// nKp15 5-8, box heights 0.11-0.21 — panel-window sized, every one a real
// panelist, and MoveNet reported `persons: 0` on three of ten frames
// containing five visible people. R13's noise-slot warning did not apply,
// because those slots scored ~0.00-0.01 and are excluded by
// PERSON_LOW_SCORE, which was not being moved.
//
// The THEORY was that admitting real skeletal boxes would suppress the
// unbounded synthetic bodies personFromFace paints for faces with no
// person under them, and so cut the round's dominant failure (patches
// over empty studio background). Measured, side by side, same footage:
// persons per frame barely moved, patch heights got WORSE not better
// (0.39-0.76 of frame height before, 0.35-0.87 after), coastExpired rose
// 6 -> 9, and the man who was exposed in the reference frame was still
// exposed. It bought nothing and added churn.
//
// The lesson worth keeping: recall at the person gate is NOT the lever on
// synthetic-body sprawl. The two mechanisms stack rather than substitute.
export var PERSON_STRONG_KEYPOINTS = 7;
// How much bigger than MoveNet's own box a low-scoring slot's keypoint
// union may get before it is treated as scattered noise. A real person's
// keypoints sit inside their box, so the union barely grows it; the r5d
// garbage slot's keypoints spanned the stage and blew it up many times
// over. Deliberately generous - this rejects sprawl, not big people.
export var LOW_TIER_MAX_SPRAWL = 3;
// Face height (of frame) at or above which personFromFace's horizontal
// extrapolation is capped, and the cap itself in normalized-x half-width.
// Both measured; see the block inside personFromFace.
export var PFF_CLOSEUP_H = 0.18;
export var PFF_HALF_CAP = 0.35;
// R21. Minimum keypoint confidence ANYWHERE in the frame before an
// UNCORROBORATED face may be extrapolated into a body. See
// frameHasNoHumanShape below for the measurement that sets it.
export var PFF_FRAME_KP_FLOOR = 0.1;
export var PATCH_MARGIN = 0.08; // outward margin on a finished person patch
export var PERSON_GATE_PAD = 0.15; // person box padded by this fraction of its size for the crop
export var PERSON_KEYPOINT_MIN = 0.3;
// Evidence gate: this many confident keypoints AND a head/shoulder
// anchor before a slot is a person at all.
export var PERSON_MIN_KEYPOINTS = 5;

// --- ADMISSION HYSTERESIS (gauntlet R17) ---------------------------
// Measured, runs/r17-man: a Sky Sports pitchside TWO-SHOT — exactly two
// adult men, each filling ~half the frame width and its full height,
// static camera, 30 consecutive MoveNet passes. Both men are present on
// 30/30 passes. The gate admitted BOTH on 5, ONE on 24, NEITHER on 1.
//
// The reason is not recall and not the gender read (every read in that
// run was `male` at 0.54-0.99). Both men sit ON the 0.35 floor — slot
// scores 0.30-0.45 and 0.12-0.44 — and the per-pass score noise is
// LARGER than their distance from it. The `confident` count for the same
// man swings 8 -> 3 -> 2 between consecutive passes while nKp15 holds at
// 5-11, because a chest-up close-up simply has no hips, elbows or wrists
// in frame to count.
//
// What that costs on screen is not a missing patch — it is CHURN. Each
// time a person drops out of `persons`, the full-frame face pass paints
// a synthetic body for them instead, the observation changes shape, the
// greedy IoU association re-pairs, and the track is re-minted. `life`
// over that window: birthClaimed +2, coastExpired +1, on a STATIC shot.
// A new track starts BLURRED, so on f008 one of the two men wore a
// half-frame patch in MAN mode — the owner watching himself get blurred,
// which is the failure class he complains about most.
//
// So a slot that WAS a person on the previous pass is re-admitted at a
// lower bar while it is still where it was. Four conditions, all
// required, because any one alone is a licence for a phantom:
//   * score >= PERSON_HOLD_SCORE — far above the ~0.00-0.02 that empty
//     slots return, and above the 0.00-0.13 noise band R13 measured on
//     TED close-ups (that band is what makes lowering PERSON_LOW_SCORE
//     unsafe; it is nowhere near 0.22).
//   * confident >= PERSON_HOLD_KEYPOINTS — relaxed from 5 because the
//     close-up framing above is exactly what suppresses the count, but
//     the head-or-both-shoulders anchor below still applies unchanged.
//   * IoU >= PERSON_HOLD_IOU against a slot admitted LAST pass, matched
//     on the RAW MODEL BOX (the returned box carries keypoint union and
//     margins, which move for reasons the model did not). MoveNet's slot
//     ORDER permutes between passes — visible in the same run — so the
//     index is not identity and geometry has to be.
//   * hold < PERSON_HOLD_MAX consecutive PASSES, so nothing can be held
//     forever. Passes, not milliseconds, and deliberately: what is being
//     bounded is a run of consecutive detector misses, which is a count.
//     The wall time it buys therefore differs by device — the person
//     pass runs at the sampler cadence (floor 120ms desktop, ~250ms+ on
//     a G88), so 8 passes is ~1s here and ~2-3s on the phone. That is
//     the right direction: the slower the device, the longer a real
//     person deserves to survive one dropped detection. A person who
//     genuinely LEAVES is dropped by the IoU test long before the cap
//     either way; the cap only bounds the pathological case where noise
//     lands on their last position.
// Cost: <=6 slots x <=6 held boxes = 36 IoU computations per pass, no
// inference, no tensor. Unmeasurable next to a 30ms person pass.
// --- WEAK TIER: the BACK-TURNED subject (gauntlet R18) --------------
// Measured, runs/r18-woman and r18b-woman: a 2nd-grade classroom, one
// adult teacher and ~12 seated children filling the near bottom-left of
// a fixed wide shot, most of them facing AWAY toward the whiteboard.
// The pipeline covered the teacher and left every child sharp on 10 of
// 10 frames — EXPOSURE, the worst class, on children.
//
// MoveNet was NOT blind to them. Over 180 slots, the children's band
// reads score 0.00-0.23 (median 0.09), `confident` 0-9 (median 1) and
// nKp15 0-13 (median 9), on boxes 0.21-0.43 of frame height sitting on
// the frame floor exactly where the children are. Genuine noise slots in
// the same run read score 0.00, confident 0, nKp15 0, maxKp 0.02. So the
// two populations are cleanly separable — just not by either quantity
// the gate was using.
//
// WHY THE EXISTING TIERS CANNOT REACH THEM. `confident` counts keypoints
// over PERSON_KEYPOINT_MIN 0.3, and a person facing away has no nose, no
// eyes and no ears to count: the whole head set (hk) sits at a median of
// 0.26 and the weaker shoulder (sk) at 0.13. That fails PERSON_LOW_SCORE
// (0.09 < 0.12), fails PERSON_STRONG_KEYPOINTS (1 < 7), fails
// PERSON_MIN_KEYPOINTS (1 < 5) and fails the head-or-both-shoulders
// anchor. Four independent gates, all keyed on the same 0.3 threshold,
// and turning any one of them down globally moves ALL of them.
//
// So this is a separate tier keyed on the two axes that DO separate:
// nKp15 (how much skeleton is there at all) and maxKp (how sure MoveNet
// is about its best joint). Deliberately NOT keyed on box score, because
// the score is the quantity that fails worst here — the teacher, in full
// view and correctly admitted, never scores above 0.32 in this footage.
//
// CALIBRATED AGAINST THE WHOLE CORPUS, not this round's footage: 4086
// slots across 56 runs, counting only slots the CURRENT gate rejects.
// nKp15 >= 9 AND maxKp >= 0.25 admits 0.00 extra slots per pass on all
// 33 low-density runs (every R9-R14 close-up, the R12 TED audience, the
// R13 talking heads whose noise band is what makes PERSON_LOW_SCORE
// unsafe to move) and 2.3-2.7 per pass on exactly the two dense runs,
// R16's auditorium and R18's classroom. It fires where the people are.
//
// The 0.17-0.37/pass it adds on R15 and R17 was inspected slot by slot
// and is REAL PEOPLE, not phantoms: in R17 it is the same two pitchside
// men whose flicker that round's hysteresis was built to paper over
// (boxes 0.47,0.05-0.98,1 and 0.07,0.17-0.46,1, maxKp 0.66-0.88), and in
// R15 it is Linus and his daughter. That is the tier working, and it is
// why this is not R14's reverted PERSON_STRONG_KEYPOINTS 7 -> 5: that
// change moved a GLOBAL threshold and fired everywhere; this one is
// orthogonal and fires only where the existing axes have collapsed.
export var PERSON_WEAK_KP15 = 9;
export var PERSON_WEAK_MAXKP = 0.25;
// The anchor a weak-tier slot must clear, in place of
// PERSON_KEYPOINT_MIN. 0.20 rather than 0.15: 77 of the 78 R18
// candidates clear 0.20 and all 78 clear 0.15, so 0.15 buys one slot for
// a materially wider door. 57 of the 78 clear the ORDINARY 0.3 anchor
// already — the anchor is not what was rejecting most of them, the
// counts were — so this relaxation is the small half of the change.
// Geometry is untouched: headX/headY and the head margin still require
// PERSON_KEYPOINT_MIN, so a weak-tier person simply has no head anchor,
// exactly like the faceless persons the pipeline already handles.
export var PERSON_WEAK_ANCHOR = 0.2;

export var PERSON_HOLD_SCORE = 0.22;
export var PERSON_HOLD_IOU = 0.4;
export var PERSON_HOLD_KEYPOINTS = 3;
export var PERSON_HOLD_MAX = 8;

// Margin around every keypoint. 0.03 -> 0.05 (owner 2026-08-25: cover
// them fully): a wrist keypoint sits at the wrist, and the HAND carries
// on past it.
var KEYPOINT_MARGIN = 0.05;
// All 17 keypoints extend the patch: a covered person must not have
// their legs or hands sticking out of it (owner 2026-08-25). Leg
// keypoints are the noisiest, which is why the EVIDENCE gate below is
// counted over the upper body only (0-12) — a slot still has to prove
// it is a person before its ankles get a vote on the geometry.
var UNION_KEYPOINT_MAX = 17;
var EVIDENCE_KEYPOINT_MAX = 13;

var NOSE = 0;
var L_EAR = 3;
var R_EAR = 4;
var L_EYE = 1;
var R_EYE = 2;
var L_SHOULDER = 5;
var R_SHOULDER = 6;

function kp(data, o, i) {
  return { y: data[o + i * 3], x: data[o + i * 3 + 1], s: data[o + i * 3 + 2] };
}

/**
 * Raw MoveNet MultiPose output -> person boxes. data: the flat [1,6,56]
 * tensor download (6 slots x [17 keypoints x (y,x,score) = 51, then
 * ymin,xmin,ymax,xmax, box score]). aspect = videoWidth/videoHeight,
 * used to convert head width into the right vertical margin.
 */
/**
 * Raw per-slot diagnostics from the LAST parsePersons call, before any
 * gate ran: `[{score, confident, h}]` for all six MoveNet slots.
 *
 * This exists to answer one question that reorders every other fix
 * (gauntlet R5): when a wide shot reports zero persons, did MoveNet miss
 * the subject, or did our own score floor throw a real detection away?
 * PERSON_MIN_SCORE was raised 0.25 -> 0.35 while the observed real-person
 * band starts at 0.28, so the two answers imply completely different
 * work — one is a free threshold change, the other is a costly
 * multi-scale pass. Guessing between them is how a round gets wasted.
 *
 * Mutated in place rather than reassigned so importers keep the live
 * array, and written before any `continue` so a gated-out slot still
 * shows up. Diagnostics must never be able to throw inside the pipeline
 * (that cost two releases), so this is plain array writes and nothing
 * else — no probe object, no optional chaining, no page-global.
 */
export var lastSlotDiag = [];

/** IoU of two normalized boxes. Local so this module stays dependency-free. */
function boxIou(a, b) {
  var ix = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  var iy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (!(ix > 0) || !(iy > 0)) return 0;
  var inter = ix * iy;
  var ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
  return ua > 0 ? inter / ua : 0;
}

// Hysteresis floor for the keypoint union: once a keypoint is IN, it
// stays in until its score drops below this. See the note at the union
// loop -- the gap is what stops a threshold crossing becoming a square
// wave in patch size.
export var PERSON_KEYPOINT_EXIT = 0.22;

// Which keypoints are currently held in the union, PER SLOT.
//
// Deliberately NOT module state. detectPersons' own comment says why:
// one detector module instance serves every video element on the page,
// so module-level continuity leaks across streams -- this file has been
// bitten by that twice (lastSlotDiag, __TS_GAZE_IDS). The admission
// hysteresis already solved it by threading the previous pass in as
// `held`, so this rides the same channel: read off `held.unionHeld`,
// written onto the returned array. Per-video by construction, and it
// dies with the stream instead of outliving it.
function heldUnion(held, slot, k) {
  var m = held && held.unionHeld;
  var row = m && m[slot];
  return !!(row && row[k]);
}

export function parsePersons(data, minScore, aspect, held) {
  var floor = typeof minScore === 'number' ? minScore : PERSON_MIN_SCORE;
  var ar = typeof aspect === 'number' && aspect > 0 ? aspect : 16 / 9;
  var out = [];
  // Collected as the union runs, handed back on the result so the NEXT
  // pass for THIS video can apply the exit threshold. See heldUnion.
  var unionNow = [];
  // Previous pass's admitted persons, for the hysteresis above. Each may
  // be claimed by at most ONE slot this pass, or a single lingering
  // person could hold two noise slots open at once.
  var heldList = held && held.length ? held : null;
  var heldTaken = heldList ? new Array(heldList.length).fill(false) : null;
  lastSlotDiag.length = 0;
  for (var p = 0; p < 6; p++) {
    var o = p * 56;
    var score = data[o + 55];

    // --- evidence gate ---------------------------------------------
    // Count only the keypoints we actually use (0-12). Legs contribute
    // nothing to the patch and are the noisiest slots (owner 2026-08-25:
    // "you don't even have to use all keypoints — do accordingly").
    // Counted for EVERY slot, including ones the score floor is about to
    // reject, because "was it the floor or the model?" is exactly the
    // question lastSlotDiag exists to answer. Six slots x 13 comparisons
    // is free next to one inference.
    // R14 adds maxKp and nKp15 alongside the count, and they are the
    // whole point of this round. `confident` is a count at ONE threshold,
    // so a slot reading 0 is ambiguous between two completely different
    // worlds: MoveNet saw NOTHING (0.02 everywhere), or MoveNet saw a
    // wrist at 0.28 and PERSON_KEYPOINT_MIN threw it away. Those worlds
    // want opposite fixes — the first needs a second model, the second
    // needs a rescue tier that costs nothing — and three extra
    // comparisons inside a loop that already runs decide which.
    // MoveNet's model card says it emits all 17 keypoints even when
    // occluded, with low confidence rather than absence, so the question
    // is real and not rhetorical.
    var confident = 0;
    var maxKp = 0;
    var nKp15 = 0;
    // WHICH keypoints fired, not just how many (R22). `confident` is a
    // COUNT, and a count cannot tell a contiguous anatomical set from a
    // scattered one — which is the difference between a person MoveNet
    // half-saw and letterforms exciting the eye/ear detectors. Measured
    // on r22-woman, the cleanest side-by-side this corpus has (a real man
    // in close-up against a wall of large typography, both in every
    // frame): the typography slots reach hk 0.68, the same as the real
    // man's best, while their `sk` sits at 0.00-0.04 against his
    // 0.62-0.89. Eyes and ears are small high-contrast blob-and-counter
    // features and that is exactly what letterforms are made of;
    // shoulders are a large low-frequency silhouette with no typographic
    // analogue. One integer, one OR inside a loop that already runs.
    var kbits = 0;
    // R18 adds the ANCHOR's own evidence to the diagnostic, and it is a
    // different question from `confident`. The gate below rejects a slot
    // outright unless it has a head keypoint OR both shoulders above
    // PERSON_KEYPOINT_MIN. On a back-turned subject that is exactly the
    // set MoveNet is least sure about — nose, eyes and ears are behind
    // the skull — so a slot can carry nine keypoints at 0.15-0.29 and
    // still be discarded by the anchor and not by the count. `confident`
    // and `maxKp` cannot distinguish that case from a slot whose only
    // evidence is a stray wrist, and the two want opposite fixes.
    // hk = best of the five head keypoints, sk = the WEAKER shoulder
    // (both are required, so the weaker one is the binding number).
    var hk = 0;
    // THE HULL OF THE CONFIDENT KEYPOINTS, for the diagnostic only
    // (gauntlet R20). The emitted person box is `model box UNION confident
    // keypoints UNION head margin`, and `lastSlotDiag` recorded only the
    // MODEL box — so no artifact has ever been able to say whether an
    // over-wide patch was MoveNet's own box regression or our union
    // widening it. R20's critic could settle that on exactly one frame,
    // by back-calculating, and only because that frame happened to be
    // arithmetically invertible inside the 2dp rounding.
    // It matters because the two answers have opposite fixes: a sprawling
    // MODEL box can only be attacked by intersecting it with something
    // we trust, and a sprawling UNION is ours to bound. Four extra
    // numbers in a loop that already runs, no inference, no tensor.
    var kx1 = 1;
    var ky1 = 1;
    var kx2 = 0;
    var ky2 = 0;
    for (var c = 0; c < EVIDENCE_KEYPOINT_MAX; c++) {
      var ks = data[o + c * 3 + 2];
      if (ks >= PERSON_KEYPOINT_MIN) {
        confident++;
        kbits |= 1 << c;
        var ky = data[o + c * 3];
        var kxx = data[o + c * 3 + 1];
        if (kxx < kx1) kx1 = kxx;
        if (kxx > kx2) kx2 = kxx;
        if (ky < ky1) ky1 = ky;
        if (ky > ky2) ky2 = ky;
      }
      if (ks >= 0.15) nKp15++;
      if (ks > maxKp) maxKp = ks;
      if (c <= R_EAR && ks > hk) hk = ks;
    }
    var sk = Math.min(data[o + L_SHOULDER * 3 + 2], data[o + R_SHOULDER * 3 + 2]);
    lastSlotDiag.push({
      // 3dp, not 2 (R17): the whole question this round asked was
      // whether a slot was just UNDER PERSON_MIN_SCORE or just over, and
      // at 2dp a printed `0.35` covers 0.345-0.3549 — i.e. the artifact
      // could not answer the question it was built to answer.
      score: Math.round(score * 1000) / 1000,
      confident: confident,
      // 3dp for the same reason `score` is (R22): PFF_FRAME_KP_FLOOR is
      // decided by 0.11 typography against 0.120 real forearms, and at
      // 2dp a raw 0.1198 and a raw 0.1204 print identically — the probe
      // could not resolve the constant it exists to calibrate.
      maxKp: Math.round(maxKp * 1000) / 1000,
      nKp15: nKp15,
      // Bitmask of the confident keypoint indices (see `kbits` above).
      kb: kbits,
      hk: Math.round(hk * 100) / 100,
      sk: Math.round(sk * 100) / 100,
      // Keypoint hull, or null when no keypoint is confident (which is
      // itself the answer: the box is then the model's alone).
      k: confident
        ? [
            Math.round(kx1 * 1000) / 1000,
            Math.round(ky1 * 1000) / 1000,
            Math.round(kx2 * 1000) / 1000,
            Math.round(ky2 * 1000) / 1000,
          ]
        : null,
      h: Math.round((data[o + 53] - data[o + 51]) * 100) / 100,
      // The MODEL box, before any gate. R15's critic could not tell
      // whether f005's four rejected h=1.00 slots were localised on the
      // real man (in which case face-corroborated admission fixes the
      // frame) or were the sprawl noise LOW_TIER_MAX_SPRAWL exists to
      // reject (in which case admitting one paints a full-frame patch).
      // A height alone cannot answer that; four numbers can.
      b: [
        Math.round(data[o + 52] * 100) / 100,
        Math.round(data[o + 51] * 100) / 100,
        Math.round(data[o + 54] * 100) / 100,
        Math.round(data[o + 53] * 100) / 100,
      ],
    });

    // TWO-TIER FLOOR, measured in gauntlet R5 (runs/r5c-man slot probe).
    // On every zero-person wide pass, slot 0 came back at 0.14-0.35 with
    // 10-11 of 13 confident keypoints and a plausible 0.30 box height —
    // the speaker, standing in full view, discarded by the score floor
    // alone. Meanwhile genuine noise slots scored ~0 with 0-4 confident
    // keypoints. Keypoint count separates person from noise cleanly at
    // this scale; the score does not, because MoveNet's confidence falls
    // off with subject size and a stage-wide shot is exactly where it is
    // lowest and where we need it most.
    //
    // So a slot gets in either by scoring well OUTRIGHT, or by carrying
    // strong skeletal evidence. The second tier is deliberately stricter
    // on keypoints than the ordinary gate (7 vs PERSON_MIN_KEYPOINTS 5)
    // so it buys small-subject recall without reopening the phantom-class
    // failures that raising this floor to 0.35 was meant to close.
    var strong = score >= PERSON_LOW_SCORE && confident >= PERSON_STRONG_KEYPOINTS;
    // See the PERSON_WEAK_* block. Score is deliberately not part of it.
    var weak = nKp15 >= PERSON_WEAK_KP15 && maxKp >= PERSON_WEAK_MAXKP;
    // HYSTERESIS: was this exact box a person on the previous pass? See
    // the PERSON_HOLD_* block for the measurement. Evaluated only when
    // the ordinary gates have already refused, so it can never make the
    // gate stricter, and matched on the raw model box because the
    // returned box carries margins the model did not choose.
    var heldIdx = -1;
    if (
      heldList &&
      !(score >= floor) &&
      !strong &&
      score >= PERSON_HOLD_SCORE &&
      confident >= PERSON_HOLD_KEYPOINTS
    ) {
      var rawBox = [data[o + 52], data[o + 51], data[o + 54], data[o + 53]];
      var bestOv = PERSON_HOLD_IOU;
      for (var hi = 0; hi < heldList.length; hi++) {
        if (heldTaken[hi]) continue;
        var hp = heldList[hi];
        if (!hp || !hp.raw) continue;
        if ((hp.hold || 0) >= PERSON_HOLD_MAX) continue;
        var ov = boxIou(rawBox, hp.raw);
        if (ov >= bestOv) {
          bestOv = ov;
          heldIdx = hi;
        }
      }
    }
    if (heldIdx === -1) {
      if (!(score >= floor) && !strong && !weak) continue;
      // PERSON_MIN_KEYPOINTS is a count at 0.3 and is therefore the same
      // gate the weak tier exists to get past; applying it here would
      // make the tier unreachable. nKp15 >= PERSON_WEAK_KP15 is the
      // weak tier's own evidence requirement and it is stricter in
      // count (9 vs 5), just measured at a threshold a back-turned head
      // can actually reach.
      if (!weak && confident < PERSON_MIN_KEYPOINTS) continue;
    }
    // Which anchor threshold this slot must clear. Only a slot that got
    // in on the weak tier ALONE is relaxed; anything the ordinary gates
    // admitted keeps the 0.3 anchor it has always had.
    var weakOnly = heldIdx === -1 && weak && !strong && !(score >= floor);
    var anchorMin = weakOnly ? PERSON_WEAK_ANCHOR : PERSON_KEYPOINT_MIN;
    // NOTE: the claim on `heldTaken` is NOT made here. Two gates below
    // (the head/shoulder anchor and the low-tier sprawl guard) can still
    // reject this slot, and marking the entry taken before them lets a
    // slot that goes on to fail consume the entry the REAL person's slot
    // needed. MoveNet's slot order permutes between passes, so which slot
    // reaches the entry first is not stable — the hysteresis would then
    // fail intermittently on exactly the frames it exists for, and no
    // fixed-order unit test would see it. The claim is made at the push.
    var head = [];
    for (var h = 0; h <= R_EAR; h++) {
      var k = kp(data, o, h);
      if (k.s >= PERSON_KEYPOINT_MIN) head.push(k);
    }
    var ls = kp(data, o, L_SHOULDER);
    var rs = kp(data, o, R_SHOULDER);
    var bothShoulders = ls.s >= PERSON_KEYPOINT_MIN && rs.s >= PERSON_KEYPOINT_MIN;
    // ADMISSION anchor, evaluated at anchorMin. `head` and
    // `bothShoulders` above stay at PERSON_KEYPOINT_MIN because they
    // drive GEOMETRY (headX/headY, the head margin, headW's ear/eye
    // fallbacks) and a 0.2-confidence ear is not a measurement worth
    // sizing a patch from. A weak-tier person therefore ends up with
    // headX null, which is the same state a faceless person already has
    // and which the crop's own-face disambiguation already handles.
    var anchored =
      head.length > 0 ||
      bothShoulders ||
      (weakOnly &&
        (Math.max(
          data[o + NOSE * 3 + 2],
          data[o + L_EYE * 3 + 2],
          data[o + R_EYE * 3 + 2],
          data[o + L_EAR * 3 + 2],
          data[o + R_EAR * 3 + 2]
        ) >= anchorMin ||
          Math.min(ls.s, rs.s) >= anchorMin));
    if (!anchored) continue;

    // --- box: the WHOLE person, head to feet ------------------------
    // A hip clamp lived here for one commit and was wrong. The owner's
    // "patches cover the whole video" complaint was never about covered
    // people being covered too generously — it was about the WRONG
    // people being covered at all. Owner 2026-08-25, explicitly: blur
    // them fully, "not leave anything, the legs or the hands or the
    // head". So the patch is the model's full box unioned with EVERY
    // confident keypoint, legs included, plus a margin.
    var y1 = data[o + 51];
    var x1 = data[o + 52];
    var y2 = data[o + 53];
    var x2 = data[o + 54];

    // KEYPOINT_MARGIN is a distance, and normalized coordinates are not
    // isotropic: the same physical cushion is a BIGGER number in y on a
    // wide frame (dy_norm = dx_norm * W/H). Shipped unscaled in both
    // axes, so on 16:9 the vertical cushion was 1.78x smaller in real
    // pixels than the horizontal one — 54px against 96px at 1080p. The
    // keypoints that define the extreme y edges are exactly a raised
    // HAND and the top of a HEAD, which is the pair that kept escaping
    // the patch; sideways-extended arms were always fine, and that
    // asymmetry in the reports is what this explains. The head anchor
    // below already does this correctly and states the rule — the union
    // simply never got it.
    var kmY = KEYPOINT_MARGIN * ar;
    for (var u = 0; u < UNION_KEYPOINT_MAX; u++) {
      var ku = kp(data, o, u);
      // HYSTERESIS ON THE UNION GATE.
      //
      // A hard threshold on a noisy score is a SQUARE WAVE, and a square
      // wave in box size is exactly what "the blur keeps pulsing" is. A
      // hallucinated ankle crossing 0.3 on a chest-up shot moves y2 from
      // ~0.60 to ~0.99 in ONE pass -- after the margins, a drawn height
      // step near 0.46 with no motion behind it. A wrist crossing with
      // the arm 0.12 outside the box is ~0.22 of drawn width.
      //
      // So a keypoint ENTERS the union at PERSON_KEYPOINT_MIN and only
      // LEAVES below PERSON_KEYPOINT_EXIT. Holding one in can only ever
      // keep the box LARGER, so no accuracy class can regress: not
      // EXPOSURE, not PARTIAL, and a slightly wider patch on a person we
      // are already covering is not FALSE COVER either.
      //
      // Per-slot, because slots are MoveNet's own person indices; the
      // state is wiped whenever the detector is re-created.
      var inU = ku.s >= PERSON_KEYPOINT_MIN ||
        (heldUnion(held, o, u) && ku.s >= PERSON_KEYPOINT_EXIT);
      if (!unionNow[o]) unionNow[o] = [];
      unionNow[o][u] = inU;
      if (!inU) continue;
      if (ku.y - kmY < y1) y1 = ku.y - kmY;
      if (ku.y + kmY > y2) y2 = ku.y + kmY;
      if (ku.x - KEYPOINT_MARGIN < x1) x1 = ku.x - KEYPOINT_MARGIN;
      if (ku.x + KEYPOINT_MARGIN > x2) x2 = ku.x + KEYPOINT_MARGIN;
    }

    // --- head anchor: the part that must never escape the patch -----
    var hx = null;
    var hy = null;
    // Published, not just consumed (gauntlet R19). This number was
    // computed to widen the box and then thrown away, and it is the only
    // scale in the pass at which "are these two boxes one human?" is a
    // well-posed question -- see sameHuman in person-track.mjs.
    var headWOut = null;
    var headHOut = null;
    if (head.length) {
      hx = 0;
      hy = 0;
      for (var i = 0; i < head.length; i++) {
        hx += head[i].x;
        hy += head[i].y;
      }
      hx /= head.length;
      hy /= head.length;
      // Head WIDTH in normalized-x: ear span, else eye gap x2.5, else
      // 60% of shoulder span, else a floor.
      var le = kp(data, o, L_EAR);
      var re = kp(data, o, R_EAR);
      var ly = kp(data, o, L_EYE);
      var ry = kp(data, o, R_EYE);
      var headW = 0;
      if (le.s >= PERSON_KEYPOINT_MIN && re.s >= PERSON_KEYPOINT_MIN) {
        headW = Math.abs(le.x - re.x);
      } else if (ly.s >= PERSON_KEYPOINT_MIN && ry.s >= PERSON_KEYPOINT_MIN) {
        headW = Math.abs(ly.x - ry.x) * 2.5;
      } else if (bothShoulders) {
        headW = Math.abs(ls.x - rs.x) * 0.6;
      }
      headW = Math.max(headW, 0.04);
      headWOut = headW;
      // Same physical distance is a LARGER number in normalized-y on a
      // wide frame: dy_norm = dx_norm * (W/H).
      var headH = headW * ar;
      headHOut = headH;
      if (hy - headH * 1.1 < y1) y1 = hy - headH * 1.1;
      if (hy + headH * 0.9 > y2) y2 = hy + headH * 0.9;
      if (hx - headW * 1.2 < x1) x1 = hx - headW * 1.2;
      if (hx + headW * 1.2 > x2) x2 = hx + headW * 1.2;
    }

    // Final outward margin. Over-covering a person who is meant to be
    // covered costs nothing; under-covering them is the failure the
    // owner counts.
    var mw = (x2 - x1) * PATCH_MARGIN;
    var mh = (y2 - y1) * PATCH_MARGIN;

    // COHERENCE GUARD, low tier only. Measured r5d f003: admitting
    // strong-skeleton slots also admitted a garbage one whose keypoints
    // were scattered across the whole stage, unioning into a box of
    // 0.005-0.797 x 0.0-1.0 while the real speaker was 12% of the frame.
    // It rendered as a near-full-frame blur.
    //
    // The tell is NOT that the box is big — a legitimate close-up fills
    // the frame too, and a plain area cap rejected those, driving FALSE
    // COVER up in r5e. The tell is that the keypoints disagree with the
    // model's OWN box: on a real person they sit inside it, so the union
    // barely grows it. On a noise slot they are flung to opposite
    // corners and the union explodes. Ratio, not size.
    if (!(score >= floor)) {
      var mArea = Math.max(1e-6, (data[o + 53] - data[o + 51]) * (data[o + 54] - data[o + 52]));
      if ((x2 - x1) * (y2 - y1) > mArea * LOW_TIER_MAX_SPRAWL) continue;
    }

    out.push({
      y1: Math.max(0, y1 - mh),
      x1: Math.max(0, x1 - mw),
      y2: Math.min(1, y2 + mh),
      x2: Math.min(1, x2 + mw),
      confidence: score,
      // Head anchor in FRAME coordinates (null when no head keypoint is
      // confident, e.g. a person facing away). The face/gender pass uses
      // it to tell THIS person's face from a neighbour's leaking into
      // the same crop — measured 2026-08-25: side-by-side subjects put
      // 2-3 faces in one crop, and "any flagged face flags the person"
      // meant a correctly-read man beside a covered child could never
      // clear (owner: "linus is not clearing at all").
      headX: hx,
      headY: hy,
      // Head width in normalized-x (null with no confident head
      // keypoint). NOT the body width: two people standing shoulder to
      // shoulder always have heads closer together than half a body
      // width, so a body-denominated separation test can never tell them
      // apart -- it was deleting one of three people on every pass.
      headW: headWOut,
      // The same head on the OTHER axis. headW is normalized-x, so it
      // cannot be compared against a y quantity without the aspect
      // factor; carrying headH avoids threading `ar` into the tracker.
      headH: headHOut,
      // The RAW model box and the hysteresis age, fed straight back in
      // as `held` on the next pass. Kept on the person rather than in
      // module state so parsePersons stays pure and the caller decides
      // when continuity ends (cut, seek, loadstart, stream change).
      raw: [data[o + 52], data[o + 51], data[o + 54], data[o + 53]],
      hold: heldIdx === -1 ? 0 : (heldList[heldIdx].hold || 0) + 1,
    });
    // Claimed only now that the slot has actually survived every gate.
    if (heldIdx !== -1) heldTaken[heldIdx] = true;
  }
  out.unionHeld = unionNow;
  return out;
}

/**
 * A face box (normalized, already FACE_ENLARGE-inflated by the detector)
 * -> a person-shaped region: head plus upper torso, no more. Used for
 * people the pose model cannot report — MoveNet MultiPose caps at SIX
 * persons, so in a crowd every face beyond that is covered through this
 * path (owner 2026-08-25: "make sure it works with 10+ people").
 * Deliberately modest: the old +6.0 face-heights turned one false face
 * detection into a full-frame patch.
 */
// TRIED AND REMOVED IN THE SAME ROUND: a relative-size floor on the
// fallback (drop a face-derived person under a tenth of the tallest face
// in the pass). It was calibrated against `reads.px` — the face found
// INSIDE a crop and mapped back to video — which is NOT the full-frame
// face that builds a synthetic body. On its own input, measured with the
// `ff` probe added this round, the two populations do not exist: a pass
// returns either ONE big face (a close-up) or a set of similar small
// faces (a wide shot), so every ratio is either 1.0 or ~0.5 and the rule
// fired zero times. The ghosts it was built for were stale tracks
// coasting across a scene cut — see PTRACK_CUT_COAST_MS in person-track.
// Do not rebuild it from `reads.px`; use `ff` if it is ever revisited.
/**
 * True when MoveNet produced no keypoint evidence ANYWHERE in the frame.
 *
 * R21 scored three GHOST frames: a patch sitting on a text-only slide,
 * over the word "Authenticity". No human in the frame at all, which is
 * the owner's third bar item verbatim. The mechanism is not a threshold
 * anyone had tuned - it is that BlazeFace returns a face on typography
 * (R7 measured logo letters zooming to 0.59 while real distant faces
 * zoomed to 0, and R20's critic found a face at confidence 0.80 on a
 * man's HAND), that face falls inside no person box, personFromFace
 * turns it into a whole body, and the read on it abstains, so blur-first
 * covers it. Every stage behaved as designed.
 *
 * The face path is NOT removable and no confidence threshold separates
 * the two cases:
 *  - it exists because of a measured EXPOSURE (a child in close-up,
 *    MoveNet 0 persons, rendered fully sharp);
 *  - R7 settled that BlazeFace-128 alone cannot tell a face-like graphic
 *    from a small face.
 * So the discriminator has to come from the OTHER model. MoveNet emits
 * all 17 keypoints always, with low confidence rather than absence, so
 * "how sure is it about its single best keypoint, over all six slots" is
 * a free frame-level readout of whether anything human-SHAPED is present
 * - and it is orthogonal to the face detector that just failed.
 *
 * MEASURED over the whole corpus, 47 runs carrying the ff+slots probes,
 * 1109 face-bearing passes, split by whether MoveNet admitted anyone:
 *
 *   corroborated (np > 0), n=961 : maxKp p05 0.57, p50 0.75, MIN 0.49
 *   uncorroborated (np == 0), n=148 : p05 0.05, p25 0.38, p50 0.56
 *
 * The uncorroborated tail is where both regimes live, and it separates
 * cleanly. Sorted, the bottom of that tail is NINE passes at maxKp 0.050
 * with nKp15 0 on all six slots - every one of them this round's slide -
 * and then a gap to 0.120. Nothing in the corpus lands between.
 *
 * The two nearest neighbours ABOVE the gap are both cases that must keep
 * their coverage, which is what fixes the constant at 0.1 rather than
 * higher:
 *  - r20b-woman t=304.7, maxKp 0.120: the overhead workbench, two people
 *    present as forearms only. R20 scored the uncovered version of that
 *    frame as EXPOSURE under "not leaving the hands".
 *  - r21-man t=201.7-203.2, maxKp 0.130-0.330: a dim audience shot where
 *    the only thing covering a woman IS a synthetic body.
 * A floor of 0.15 would take both. 0.1 sits in an empty band with the
 * false positives 0.05 below it and the real cases 0.02 above.
 *
 * R21's CRITIC ARGUED FOR 0.17 AND IS REFUSED, with the reason kept here
 * so the next round does not re-litigate it. Its labelled split was
 * failures {0.05, 0.05, 0.05, 0.14, 0.14, 0.16, 0.26} against needed
 * {0.23, 0.28, ...}, which makes 0.17 look free. But three of those
 * "failures" are the 0.12-0.16 band, and it labelled them hands-on-desk
 * and arm-and-shirt. Opening r20b-woman f002 settles it: an overhead
 * workbench with TWO people's hands and forearms filling the lower
 * third. A patch there is not GHOST — GHOST is "a patch over no person
 * at all", and a hand is part of a person. Under the owner's bar, "for
 * women, blur them fully — not leaving the legs or the hands or the
 * head", refusing that mint is EXPOSURE, which is the worst class. The
 * critic's "zero needed coverage lost" holds only if real limbs count as
 * failures. 0.1 keeps them covered and still takes the whole typography
 * cluster. What 0.17 would additionally buy is one news title card at
 * 0.26 — and that one is not reachable this way anyway: see the R21 log,
 * where news graphics measure maxKp 0.10-0.52 against a real close-up's
 * 0.14-0.76.
 *
 * R22 RE-DERIVED THIS AT THREE DECIMALS AND THE ANSWER IS THAT THE
 * CONSTANT CANNOT BE IMPROVED. Everything above was measured at 2dp, and
 * R21's own correction noted that "0.05 vs 0.120" might be a rounding
 * artifact at exactly the boundary that decides GHOST-versus-EXPOSURE.
 * The probe now records 3dp and both boundary windows were re-captured
 * on the same build:
 *
 *   r22c-slide-man (TED text slide, no human, np==0, 18 passes)
 *     maxKp over slots: 0.045 0.047 0.048 0.049 0.049 0.050 0.050
 *                       0.054 0.054 0.054 0.063 0.063 0.074 x5
 *                       0.108 x2                      -> MAX 0.108
 *   r22d-bench-woman (overhead workbench, two people as forearms only,
 *                     np==0, 8 passes)
 *     maxKp over slots: 0.109 0.133 0.140 0.161 0.163 0.168 0.195 0.225
 *                                                     -> MIN 0.109
 *
 * So the "empty band" is real but it is 0.001 wide. The ONLY floor that
 * blocks all typography AND keeps all forearms lies in (0.108, 0.109].
 * That is not a threshold, it is a coincidence, and calibrating on it is
 * how R7's zero-score rule was got wrong. THE FLOOR STAYS AT 0.1, on the
 * EXPOSURE-safe side, and the honest cost is stated rather than hidden:
 * the two typography passes at 0.108 are above it and are NOT blocked.
 * Do not re-open this by moving the number; the leak is structural.
 *
 * TWO RULES MEASURED AND REFUSED IN R22, recorded so they are not
 * proposed a fourth time:
 *
 *  (a) "refuse to mint from a face too small to gender-read"
 *      (nativePx < FACE_MIN_NATIVE_PX). It looks decisive on the news
 *      panel: every ghost face there is 32-48px while the real men in
 *      the same window read 91-389px. It is REFUSED because the corpus
 *      contains the counter-case. Sweeping every run's ff probe, there
 *      are 17 uncorroborated sub-64px faces in the whole corpus; twelve
 *      are the Zee News title card, and the other FIVE are
 *      PYgPUAR9jNw t=2701 at 58-62px - a graduation crowd, thirteen to
 *      fifteen real faces on one frame with MoveNet admitting nobody.
 *      Refusing that mint uncovers a crowd of real people, which is
 *      EXPOSURE. A cut at ~55px would separate the two, and it would be
 *      a constant fitted to a 10px gap in 17 samples from two videos.
 *
 *  (b) "admit a slot only if its weaker shoulder clears a floor" (`sk`).
 *      The separation is genuinely large where it applies - on
 *      r22-woman, typography slots sit at sk 0.00-0.04 against the real
 *      man's 0.62-0.89, a gap of 0.58 with no overlap - but a hard floor
 *      is an EXPOSURE machine elsewhere: over all runs carrying slot
 *      data, 12.1% of real-person slots at score >= 0.20 read sk < 0.30,
 *      and the r21d title-card ghosts it is aimed at read sk 0.09-0.16,
 *      above where the typography sits anyway. `sk` is a corroborator
 *      for the large-graphics case only. It is already recorded.
 *
 * Deliberately frame-level and deliberately narrow: it only ever fires
 * when the person pass admitted NOBODY (the caller checks that), so a
 * frame with any admitted person keeps the close-up fallback intact for
 * everyone else in it. Empty diagnostics return false - if the person
 * model has not loaded there is no evidence of absence, and the
 * fail-open direction is coverage.
 */
export function frameHasNoHumanShape(slotDiag) {
  if (!slotDiag || !slotDiag.length) return false;
  var best = 0;
  for (var i = 0; i < slotDiag.length; i++) {
    var d = slotDiag[i];
    var m = d && d.maxKp;
    if (typeof m === 'number' && m > best) best = m;
  }
  return best < PFF_FRAME_KP_FLOOR;
}

export function personFromFace(face, aspect) {
  var cx = (face.x1 + face.x2) / 2;
  var cy = (face.y1 + face.y2) / 2;
  var h = (face.y2 - face.y1) / 1.4; // de-inflate FACE_ENLARGE
  // THE `w` THAT USED TO BE HERE WAS NOT A WIDTH. detectFaceBoxes
  // squarifies the face with a single `half` scalar in MODEL space and
  // then divides BOTH axes by INPUT_SIZE (detector.js ~:318-325), so
  // every face box satisfies `x2-x1 === y2-y1` in NORMALIZED units. But
  // model space is a 256x256 resize of the frame, so equal normalized
  // extents are NOT equal pixel distances: on 16:9 the box is 1.78x
  // wider than tall in pixels. `w` was therefore the face HEIGHT wearing
  // a width's name, and every constant multiplied by it inherited a
  // hidden factor of the aspect ratio.
  //
  // Measured signature, runs/r14-woman, 49 patches: 28 of them sit in
  // 0.553-0.561 width/height — a band 0.008 wide. That is not footage,
  // it is arithmetic; an unclamped synthetic body has a FIXED aspect by
  // construction, and its value pins the bug.
  //
  // Why this is EXPOSURE and not just untidiness: the error scales with
  // the frame's aspect. Per side, as a multiple of face pixel-height H,
  // the old x-extension came out at 3.91H on 16:9, 2.93H on 4:3 and
  // **1.24H on a 9:16 vertical video** — three times too narrow on
  // exactly the shape YouTube serves most often now. Shoulders sharp.
  //
  // The fix is to derive x from the faithful axis and divide by the
  // aspect, which is what parsePersons already does for its own margins
  // (`headH = headW * ar`) and what nobody threaded in here.
  var ar = typeof aspect === 'number' && aspect > 0 ? aspect : 16 / 9;
  // 3.911 = the old 2.2 x 16/9, chosen DELIBERATELY so 16:9 output is
  // bit-for-bit what it was. R14's critic proposed 2.4 from anthropometry
  // (shoulders are ~2.5-3 face-widths, so 2.4H per side is already
  // generous) and it is almost certainly closer to right — but 2.2 was
  // not an anthropometric guess, it was measured in R8 on a naval
  // officer at a podium whose sleeve was sharp to x~0.79, and that run
  // put the REQUIREMENT at 2.5 half-units = 4.44H, above even today's
  // 3.91H. Cutting to 2.4H is a 39% width reduction against a constant
  // that is already below its own measured requirement, and the class it
  // would re-open is EXPOSURE. So: correct the anisotropy now, keep the
  // magnitude, and let a round that can re-capture the R8 podium footage
  // do the narrowing with evidence.
  var halfX = (3.911 * h) / ar;
  // CLOSE-UP CAP (gauntlet R20). 3.911 is a constant number of
  // face-widths per side, and that is only the right SHAPE of rule while
  // the whole body is in frame. Measured across the corpus — 1246 faces
  // that fall inside an admitted MoveNet box, 56 runs — MoveNet's own
  // half-width for the same person, expressed in face-widths, is not
  // constant at all. It falls monotonically as the face grows:
  //
  //   face h *      n    MoveNet width p50/p90/max   half-width in
  //                                                   face-widths, p90
  //   0.00-0.05     39   0.280 / 0.430 / 0.430        11.63
  //   0.05-0.08    298   0.250 / 0.410 / 0.650         5.89
  //   0.08-0.12    396   0.280 / 0.420 / 0.560         3.48
  //   0.12-0.18    322   0.390 / 0.500 / 0.920         3.04
  //   0.18-0.28    173   0.470 / 0.550 / 0.650         2.12
  //   0.28-1.00     18   0.585 / 0.590 / 0.590         1.87
  //
  //   * de-inflated, i.e. the `h` this function actually uses, not the
  //     detector's FACE_ENLARGE-inflated box. Getting that wrong is a
  //     factor of 1.4 and the unit tests below caught exactly that on the
  //     first draft of this cap — which is the fourth hidden-unit bug in
  //     this one function's neighbourhood, after the aspect factor in
  //     `w`, the aspect factor in `headW`, and PTRACK_PAD_TOP.
  //
  // The reason is not subtle once the numbers are in front of you: in a
  // close-up the shoulders are CROPPED BY THE FRAME, so the visible
  // person really is narrower measured in face-widths. A wide shot has
  // the whole body plus outstretched arms and the ratio is large.
  //
  // THIS RECONCILES TWO MEASUREMENTS THAT LOOKED LIKE A CONTRADICTION.
  // R8 measured this constant as too NARROW (a naval officer at a podium,
  // sleeve sharp past the patch, requirement 4.44 face-heights) and R14's
  // critic proposed narrowing it to 2.4 on anthropometry; R19 refused
  // that narrowing for exactly the R8 reason and was right to. Both are
  // correct — at OPPOSITE ENDS OF A SCALE DEPENDENCE. R8's officer sits
  // in the 0.06-0.10 band where 3.911 is below the p90 requirement of
  // 4.96. The failures R19 and R20 hit sit at h 0.485-0.79, where the
  // same constant is 3x the measured person and the result is arithmetic
  // rather than statistical: at h >= 0.23 the half-width exceeds the
  // frame, so EVERY face that large produces a whole-frame body. Across
  // every run carrying the `obs` probe, 7 of 86 synthetic bodies (8%)
  // claim the entire frame, and each one traces to a face of h 0.485 to
  // 0.79. That is R19's last full-frame FALSE COVER (its f007, a lone man
  // in close-up, whole video blurred in his own direction) and its
  // whole-frame GHOST over a news title card, both from this one line.
  //
  // So: cap the HALF-WIDTH, and only in the band where the corpus says
  // the extrapolation exceeds the measured person. Deliberately NOT a
  // narrower multiplier — that is what R19 refused and the refusal still
  // stands for small faces, which are untouched here by construction.
  //
  //   * Applies only at h >= PFF_CLOSEUP_H 0.18. Below that nothing
  //     changes at all: the 0.00-0.12 bands are where the extrapolation
  //     is already NARROWER than MoveNet's own p90 (0.198-0.446 against
  //     0.410-0.430) and where R8's podium subject lives, and the
  //     0.12-0.18 band is the one whose widest observed MoveNet box is
  //     0.920 — wider than the cap — so the cap is kept out of it
  //     deliberately rather than by accident. The arithmetic alone would
  //     have started binding at h 0.159; the extra gate to 0.18 is that
  //     band's protection.
  //   * PFF_HALF_CAP 0.35 gives a 0.70-wide body, and the WIDEST MoveNet
  //     box ever observed in the two bands where the cap binds is 0.650
  //     and 0.590. So even against the maximum, not the p90, the capped
  //     body still over-covers the measured person. It cannot introduce
  //     EXPOSURE relative to what a successful MoveNet pass would have
  //     drawn for the same person.
  //
  // Only the horizontal is capped. Vertically the clamp is CORRECT for a
  // close-up: `cy - 1.4h` and `cy + 6.0h` run off both edges of the frame
  // because in a close-up the head really does reach the top and the
  // chest really does fill to the bottom. There is no comparable
  // measurement saying the vertical over-reaches, and inventing one would
  // open EXPOSURE at the one edge where hair and chins live.
  if (h >= PFF_CLOSEUP_H && halfX > PFF_HALF_CAP) halfX = PFF_HALF_CAP;
  // HEADROOM, measured in gauntlet R8 (runs/r8b-woman, a naval officer
  // in a peaked cap at a podium): y1 was `cy - h*1.0`, and since the
  // de-inflated face box only reaches `cy - h/2`, that is HALF a
  // face-height of cover above the face. Hair, hats and any upward tilt
  // fall outside it. The patch top sat at y 0.21-0.26 on nine
  // consecutive frames while the head began at y~0.05 — the top of his
  // head was sharp in EVERY frame of the run, which is EXPOSURE, the
  // worst class, and it is systematic rather than a hard case.
  // 1.4 puts 0.9 face-heights above the face box, which clears a peaked
  // cap. Going further starts eating the frame above short subjects for
  // no measured gain.
  //
  // WIDTH: 1.8 half-widths (3.6 face-widths) cut the shoulders off the
  // same subject — the patch ended at x 0.686 with his shoulder board
  // and sleeve sharp out to x~0.79, scored PARTIAL on nine frames.
  // Measured requirement there was 2.5 half-widths; 2.2 is the
  // compromise, because this podium framing is unusually tight and in a
  // crowd every extra half-width is a neighbour swallowed. mergeTracks
  // unions genuine overlaps, so a slight over-reach costs one patch, not
  // a stack of them.
  return {
    x1: Math.max(0, cx - halfX),
    y1: Math.max(0, cy - h * 1.4),
    x2: Math.min(1, cx + halfX),
    y2: Math.min(1, cy + h * 6.0),
    confidence: face.confidence,
    headX: cx,
    headY: cy,
    // The face's width on the FAITHFUL axis. The detector's box is
    // square in NORMALIZED units, so its x extent carries a hidden
    // factor of the frame aspect (see the `w` note above); h/ar is the
    // real head width in normalized-x, which is what sameHuman needs.
    headW: h / ar,
    headH: h,
    fromFace: true,
    // THE FACE THIS BODY WAS EXTRAPOLATED FROM, kept in frame
    // coordinates. Without it the pipeline throws away a face box it
    // already has and runs a SECOND detector pass over the synthetic
    // body's crop to re-find it — and that second pass is sub-spec by
    // construction: the body is 7.8 x 7.4 face-heights, personCropRegion
    // pads 15%, and detectFaceBoxes stretches the result to 256, so the
    // face lands at ~2% of the model input against BlazeFace's published
    // ~5% evaluation floor, no matter how large the person is in frame.
    // When that re-detect fails the track gets `faceFound:false`, sits
    // blurred on no evidence, and has spent one of three verdict slots.
    faceBox: { x1: face.x1, y1: face.y1, x2: face.x2, y2: face.y2 },
  };
}

/**
 * The crop region a person's face/gender pass runs on. Multi-SCALE is
 * the pass that actually adds information — a distant person's face
 * fills the model input here instead of being a handful of pixels in
 * the full frame.
 */
export function personCropRegion(p) {
  return padded(p, PERSON_GATE_PAD);
}

function padded(p, pad) {
  var w = p.x2 - p.x1;
  var h = p.y2 - p.y1;
  return {
    x1: Math.max(0, p.x1 - w * pad),
    y1: Math.max(0, p.y1 - h * pad),
    x2: Math.min(1, p.x2 + w * pad),
    y2: Math.min(1, p.y2 + h * pad),
  };
}
