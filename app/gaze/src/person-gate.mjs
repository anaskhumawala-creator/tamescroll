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
// HOW FAR BELOW THE FACE THE SYNTHETIC BODY REACHES, in face-heights.
//
// SWEPT AND HELD AT 6.0. This was the last dimension of personFromFace
// nobody had measured, and the corpus says shortening it is free or
// better: at 3.5, man reads exposure 81.0 -> 80.0s, false cover 216.5 ->
// 216.0s, phantom 144.0 -> 133.5s; woman holds exposure at 85.0s and
// takes phantom 141.5 -> 132.0s. 2.5 costs exposure in both, so 3.5
// looked like the edge and looked like a clear win.
//
// IT IS NOT, AND ONLY LOOKING COULD SAY SO. The corpus scores where
// BlazeFace found a FACE, so it cannot see BODY exposure -- there is no
// face at knee height to score. Rendered (bench/down-render.mjs, and it
// had to be pointed at MID-SHOTS: in a true close-up both settings clamp
// to y2 = 1 and produce byte-identical pictures, which the first run did
// 25 times and proved nothing). On the RcGyVTAoXEU stage at t=580.5 the
// speaker's legs are FULLY SHARP below a 3.5 patch and covered to the
// knee by 6.0 -- real exposure, scored as an IMPROVEMENT.
//
// This is the same trap, on the same kind of subject, that refused the
// earlier blanket narrowing after body-arm rendered a podium speaker
// losing her dress. Do not re-sweep this against the score alone.
//
// So the large patch the owner sees is not over-reach: a person really
// is that big in frame, and the frames where 6.0 covers only scenery are
// worth 10.5s of phantom against somebody's legs.
export var PFF_BODY_DOWN = 6.0;

export var PFF_HALF_CAP = 0.35;
// R21. Minimum keypoint confidence ANYWHERE in the frame before an
// UNCORROBORATED face may be extrapolated into a body. See
// frameHasNoHumanShape below for the measurement that sets it.
export var PFF_FRAME_KP_FLOOR = 0.1;
// THE MARGIN STACK WAS FIVE CUSHIONS DEEP, AND THE OWNER SEES THE SUM.
//
// Owner 2026-08-26: "very messy and not smooth and very jettery ... looks
// very low quality ... the before gauntlet blur was the best." Measured,
// and he is right: the median drawn patch went from 0.24 x 0.41 of frame
// pre-gauntlet to 0.51 x 0.98, with patches pinned at the frame edge
// going 1% -> 64%. A near-full-height slab that breathes is what "low
// quality" means.
//
// Measured live on the kitchen two-shot, height p50 at each stage:
//   MoveNet model box            0.560
//   confident-keypoint hull      0.314   (NOT the inflator here)
//   track box                    0.817   (+46% over the model box)
//   drawn patch                  ~0.97
//
// So the person the model found occupies 0.56 and we draw 0.97. The
// difference is five independent cushions, each added by a different
// round with the same correct local argument that a bigger patch cannot
// expose anyone: KEYPOINT_MARGIN per keypoint, PATCH_MARGIN on the
// finished box, PTRACK_PAD and PTRACK_PAD_TOP at render, and the
// feather's f/2. Nobody ever added them up.
//
// Halved rather than deleted, because his other sentence is the bound:
// "slight shape visible is fine in some cases, it just shouldn't be
// super tight", and the standing bar is still to blur a covered person
// FULLY -- no legs, hands or head left out. This is the cushion on top
// of a full-body box that already includes every confident keypoint.
export var PATCH_MARGIN = 0.045; // was 0.08 -- see the stage measurements above
// How far above the head keypoints the patch's top edge is pinned, in
// head-widths. This is EVIDENCE, not cushion: it is the rule that hair
// must not escape the patch, and the clamp may never shave it.
export var HEAD_ANCHOR_UP = 1.6; // was 1.1 -- owner 2026-08-27, hair showing
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
// 9 -> 8 (gauntlet R25), and the reason is arithmetic, not taste.
//
// `nKp15` counts keypoints 0..EVIDENCE_KEYPOINT_MAX-1 = 13 of them, and
// that set is FIVE HEAD (nose, both eyes, both ears) plus EIGHT BODY
// (shoulders, elbows, wrists, hips). So a bar of 9 cannot be cleared
// without at least one HEAD keypoint over 0.15 — and this tier's entire
// stated premise, three paragraphs up, is a subject whose head keypoints
// are not there to count. Verified against this module, not argued: a
// slot with ALL EIGHT body keypoints AND all four leg keypoints at 0.90
// is refused at 9, and adding a single head keypoint admits it. The
// tier built for the head-invisible person was unreachable by exactly
// one keypoint for exactly that person.
//
// R18's own corpus re-run at 8, counting only slots the current gate
// rejects (score < PERSON_MIN_SCORE, confident < PERSON_MIN_KEYPOINTS)
// that nKp15 >= N AND maxKp >= PERSON_WEAK_MAXKP would admit, over 3789
// passes in 155 stored runs:
//
//   nKp15 >= 9  ->  0.036 extra slots/pass      (what ships today)
//   nKp15 >= 8  ->  0.055 extra slots/pass
//
// and the extra 0.019 does NOT land in the GHOST regimes. Title card
// (r22c-slide), news slate (r22e / z5WBceo0bIg) and every R21 typography
// run are 0 at both thresholds. The gain is in the dense-people footage:
// the R23 studio kitchen 6 -> 10 and 8 -> 11 slots per 30 passes, which
// is the footage with 3-4 men and a woman standing in it.
//
// What it does NOT do is recover R25's own failure: the woman at the
// frame edge there has nKp15 0 and maxKp 0.007-0.119, so no count-based
// tier reaches her at any threshold. See the refusal block below.
export var PERSON_WEAK_KP15 = 8;
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
var KEYPOINT_MARGIN = 0.05; // CAP on the per-keypoint cushion (was the flat value)
// Cushion as a share of the person's own box, and the floor under it for
// small distant subjects. 0.10 of a 0.56-tall person is 0.056 against the
// old flat 0.089; a 0.20-tall figure lands on the 0.03 floor, which after
// the aspect correction is 0.053 of frame height -- more relative
// protection than they had, on the population that needs it.
var KEYPOINT_MARGIN_FRAC = 0.10;
var KEYPOINT_MARGIN_MIN = 0.03;
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

// THE INVERSE OF THE LETTERBOX, AND IT LIVES AT THE BOUNDARY ON PURPOSE.
//
// `detectPersons` resizes the frame to a SQUARE, so a 640x360 stream
// reaches MoveNet 1.78x taller than wide -- the identical defect fixed
// on the whole-frame face path in 1089 (findings 16a) and on the image
// crop path on 2026-08-28. At a flat threshold on the RAW model output,
// letterboxing instead admits 219 -> 269 persons over 241 frames
// (findings 16b) -- though **through the shipped gate that gain is a
// null** and only 8 frames in 225 change from "nobody admitted" to
// "somebody admitted" (findings 18). The map below is correct either
// way, and `detector.PERSON_LETTERBOX` ships off.
//
// WHY IT WAS NOT SIMPLY FIXED THERE AND THEN: MoveNet's outputs are
// normalized to ITS OWN INPUT, and that is safe today only because a
// squash is a uniform per-axis scale of the whole frame -- every
// coordinate is still 0..1 of the frame on both axes. Letterbox it and
// every coordinate is 0..1 of a PADDED canvas, so a y of 0.5 is the
// middle of the canvas, not the middle of the picture.
//
// `parsePersons` reads raw coordinates from `data` in more than a dozen
// places -- `kp`, the bbox at 51..54, the ear/eye/shoulder x deltas, the
// keypoint-union extent -- and un-distorting at each of them is a change
// that only has to be forgotten once to be wrong. So the buffer is
// rewritten ONCE, here, before anything reads it, and `parsePersons` is
// untouched and cannot miss a site.
//
// A NEW BUFFER, never in place: `detectPersons` hands over the tensor
// download, and the same download is what `lastSlotDiag` reports and
// what benches bank. Rewriting it under them would silently rebase every
// number any run has quoted off a raw slot.
//
// `fit` is `crop-geometry.fitBox(srcW, srcH, size)` -- the same function
// the draw uses, so the forward and inverse cannot drift apart.
export function unpadPersons(data, fit, size) {
  // A fit that fills the square is the identity, and that includes the
  // degenerate fallback fitBox returns for a 0x0 source. Returning the
  // input unchanged there means a caller cannot tell "no padding" from
  // "not letterboxed", which is correct: they are the same picture.
  if (!fit || !(size > 0) || !(fit.dw > 0) || !(fit.dh > 0)) return data;
  var ox = fit.dx / size;
  var oy = fit.dy / size;
  var sx = fit.dw / size;
  var sy = fit.dh / size;
  if (!(sx > 0) || !(sy > 0)) return data;
  if (ox === 0 && oy === 0 && sx === 1 && sy === 1) return data;

  var out = new Float32Array(data.length);
  out.set(data);
  // KEYPOINTS ARE NOT CLAMPED, AND THE FIRST VERSION OF THIS FUNCTION
  // CLAMPED THEM. That was an EXPOSURE, found by the phase-F critic.
  //
  // The reasoning it replaced was "a coordinate outside 0..1 landed in
  // the black bar, and clamping can only move a point ONTO the frame
  // edge, which for a box is the covering direction". True of a box, and
  // false of a keypoint -- because `parsePersons` consumes keypoints as
  // DIFFERENCES, not as positions: `headW` is |lEar.x - rEar.x|, else
  // |lEye.x - rEye.x| * 2.5, else |lSh.x - rSh.x| * 0.6, and
  // `headH = headW * ar` sets the patch's TOP edge through
  // HEAD_ANCHOR_UP. A difference of clamped values is monotonically
  // SMALLER, so clamping shrinks the head anchor and RAISES the top edge
  // -- the UNCOVERING direction. Measured on one synthetic slot with
  // only the clamp differing: headW 0.5133 -> 0.1600, top edge
  // 0.0000 -> 0.3209. That is hair and crown left sharp, which is the
  // exact class HEAD_ANCHOR_UP 1.1 -> 1.6 was raised for. `headW` is
  // also `sameHuman`'s merge tolerance, whose shrink direction R19
  // already scored as exposure.
  //
  // So the map is a FAITHFUL INVERSE for everything a difference is taken
  // of, and the clamp survives only on the four box floats -- where the
  // original argument does hold and where every consumer downstream
  // genuinely requires 0..1.
  //
  // "CONSUMED AS DIFFERENCES, NOT AS POSITIONS" IS TOO STRONG (phase-g
  // G12), and the correction does not change the decision. Keypoints
  // are ALSO read as absolute positions -- they are unioned into the
  // person's extent, and `headX`/`headY` are emitted from them -- so
  // leaving them unclamped can emit a coordinate slightly outside 0..1
  // (measured: -0.00067). Both consumers are monotone in the COVERING
  // direction there: a union with an out-of-frame point can only grow
  // the box, and a head anchor placed marginally high can only raise the
  // top edge of a patch. Clamping is the exposure in ONE direction and
  // inert in the other, so unclamped is right for both reasons -- but
  // the justification is "every consumer is monotone toward covering",
  // not "no consumer reads a position".
  var cl = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  for (var p = 0; p < 6; p++) {
    var o = p * 56;
    for (var i = 0; i < 17; i++) {
      out[o + i * 3] = (data[o + i * 3] - oy) / sy;
      out[o + i * 3 + 1] = (data[o + i * 3 + 1] - ox) / sx;
    }
    // The bounding box, in the model's own order: ymin, xmin, ymax, xmax.
    out[o + 51] = cl((data[o + 51] - oy) / sy);
    out[o + 52] = cl((data[o + 52] - ox) / sx);
    out[o + 53] = cl((data[o + 53] - oy) / sy);
    out[o + 54] = cl((data[o + 54] - ox) / sx);
    // 55 is the slot score and is not a coordinate. Touching it is the
    // shape of bug this whole function exists to make impossible.
  }
  return out;
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
      // R28 PROBE — the three rungs of the headW ladder, measured side
      // by side on the SAME slot whenever more than one is computable.
      // R27's critic priced the shoulder rung as ~56% too large against
      // anthropometry (biacromial breadth ~2.6 head breadths => ~0.38,
      // not 0.6) and it is the rung that arms exactly when a head turns
      // — i.e. when someone leans in front of someone else. A constant
      // is not changed on a textbook: this records the ratio against
      // the ear-derived rung on our own footage so it can be derived
      // from its own input. Raw confidences, not the hysteresed union:
      // the question is about the geometry the model reports, and the
      // union's decay would smear the pairing.
      // Cost: six reads and two subtractions per slot, no inference.
      hwE:
        data[o + L_EAR * 3 + 2] >= PERSON_KEYPOINT_MIN &&
        data[o + R_EAR * 3 + 2] >= PERSON_KEYPOINT_MIN
          ? Math.round(Math.abs(data[o + L_EAR * 3 + 1] - data[o + R_EAR * 3 + 1]) * 1000) / 1000
          : null,
      hwY:
        data[o + L_EYE * 3 + 2] >= PERSON_KEYPOINT_MIN &&
        data[o + R_EYE * 3 + 2] >= PERSON_KEYPOINT_MIN
          ? Math.round(Math.abs(data[o + L_EYE * 3 + 1] - data[o + R_EYE * 3 + 1]) * 1000) / 1000
          : null,
      hwS:
        data[o + L_SHOULDER * 3 + 2] >= PERSON_KEYPOINT_MIN &&
        data[o + R_SHOULDER * 3 + 2] >= PERSON_KEYPOINT_MIN
          ? Math.round(
              Math.abs(data[o + L_SHOULDER * 3 + 1] - data[o + R_SHOULDER * 3 + 1]) * 1000
            ) / 1000
          : null,
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
      // The same box UNROUNDED, and whether this slot was admitted.
      // `b` is a printed diagnostic at 2dp; `bb` is consumed by
      // boundBodyToSlot to size a real patch, where 2dp is ±3px on the
      // 656-wide source this rule was measured on. `adm` is stamped at
      // the push below, so a reader can tell a slot the gate REFUSED
      // from one it took — the whole rule depends on that distinction.
      bb: [data[o + 52], data[o + 51], data[o + 54], data[o + 53]],
      adm: 0,
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

    // THE EVIDENCE BOX, tracked alongside the patch (gauntlet R27).
    //
    // Everything below adds CUSHION to the patch: a per-keypoint margin,
    // a head anchor sized past the real crown, PATCH_MARGIN, and later
    // PTRACK_PAD/topPad at render. Measured on runs/r27a-man, that stack
    // is 0.081-0.143 of frame WIDTH on each side of a close-up subject —
    // and it is isotropic, so it grows just as hard toward a CLEARED
    // person standing next to the subject as it does into empty air. On
    // 5 of 10 frames it was the ENTIRE reason a cleared man's face was
    // inside a child's patch: his face did not intersect her model box
    // on any of them.
    //
    // `core` is the same union WITHOUT any cushion: the model's own box,
    // every confident keypoint at its measured position, and the head
    // anchor (which is not cushion — it is the rule that hair must not
    // escape). Nothing draws it. Its only job is to be the floor that
    // clampPatchOffFaces in person-track.mjs may never shrink past, so
    // that removing cushion can never remove EVIDENCE.
    var cx1 = x1;
    var cy1 = y1;
    var cx2 = x2;
    var cy2 = y2;

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
    // THE KEYPOINT CUSHION IS NOW PROPORTIONAL TO THE PERSON, NOT THE FRAME.
    //
    // KEYPOINT_MARGIN is an ABSOLUTE fraction of the frame, so every
    // person got the same cushion whatever their size -- and after the
    // aspect correction that is 0.089 of frame HEIGHT on each side,
    // 0.178 in total, added to a model box whose own median height is
    // 0.560. It is the single largest term in the slab the owner is
    // objecting to: bigger than PATCH_MARGIN, bigger than both render
    // pads, and it does not scale with anything.
    //
    // The error it cushions is a keypoint POSITION error, which scales
    // with the subject: a wrist on a close-up is mislocated by far more
    // pixels than a wrist on a distant figure. So the cushion is now a
    // fraction of the box's own size, floored so a small distant subject
    // keeps real protection and capped at the OLD value so nothing can
    // get a wider cushion than it had before. Strictly non-increasing:
    // no patch grows, so no PARTIAL and no EXPOSURE can open.
    // Keyed to the person's HEIGHT and converted per axis, so the cushion
    // is the same number of REAL PIXELS on both axes -- the property the
    // aspect correction was added for, now obtained by construction
    // instead of by multiplying a frame constant.
    var kmY = Math.min(
      KEYPOINT_MARGIN * ar,
      Math.max(KEYPOINT_MARGIN_MIN * ar, (y2 - y1) * KEYPOINT_MARGIN_FRAC)
    );
    var kmX = kmY / ar;
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
      if (ku.x - kmX < x1) x1 = ku.x - kmX;
      if (ku.x + kmX > x2) x2 = ku.x + kmX;
      // Same keypoint, no cushion — see `core` above.
      if (ku.y < cy1) cy1 = ku.y;
      if (ku.y > cy2) cy2 = ku.y;
      if (ku.x < cx1) cx1 = ku.x;
      if (ku.x > cx2) cx2 = ku.x;
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
    // THE HEAD GEOMETRY GETS THE SAME HYSTERESIS THE BOX ALREADY HAS.
    //
    // S5 put hysteresis on the union gate and left it off these fields,
    // and they are read by two things that both show it. `headX`/`headW`
    // set sameHuman's merge TOLERANCE (person-track.mjs:397), so the bar
    // itself square-waves; and since S8 `headH` sets the patch's top edge
    // through topPad. One ear crossing 0.3 changes the mean over
    // {nose, eye} into a mean over {nose, eye, ear} -- 0.3-0.5 headW of
    // headX movement with nobody moving -- and flips headW's rung from
    // shoulder-derived to ear-derived, tens of percent in one pass.
    //
    // Head indices 0..R_EAR and the shoulders are all inside
    // UNION_KEYPOINT_MAX, so the union loop above has ALREADY decided
    // their hysteresed membership; reuse it rather than run a second
    // rule that could disagree with the box.
    //
    // Deliberately NOT applied to `head`/`bothShoulders` above: those
    // drive ADMISSION, and holding a decayed ear in there would admit a
    // person the gate meant to refuse. This block is geometry only, and
    // geometry only ever sizes a patch we have already decided to draw.
    function heldIn(idx) {
      var row = unionNow[o];
      return !!(row && row[idx]);
    }
    var headGeo = [];
    for (var hg = 0; hg <= R_EAR; hg++) {
      if (heldIn(hg)) headGeo.push(kp(data, o, hg));
    }
    if (!headGeo.length) headGeo = head;
    if (head.length) {
      hx = 0;
      hy = 0;
      for (var i = 0; i < headGeo.length; i++) {
        hx += headGeo[i].x;
        hy += headGeo[i].y;
      }
      hx /= headGeo.length;
      hy /= headGeo.length;
      // Head WIDTH in normalized-x: ear span, else eye gap x2.5, else
      // 60% of shoulder span, else a floor.
      //
      // THE THREE RUNGS DISAGREE, AND R28 FINALLY MEASURED BY HOW MUCH.
      // R27's critic priced the shoulder rung against anthropometry
      // (biacromial breadth ~2.6 head breadths => ~0.38, not 0.6) and
      // R27 refused to change it blind. The R28 probe records all three
      // rungs on the SAME slot whenever more than one is computable; over
      // 220 paired records from two videos and four subjects (TED
      // speaker, adult man, adult woman, child), across 8 runs and both
      // gender directions:
      //
      //   hwS / hwE      p05 1.33  p25 1.80  p50 2.01  p75 2.13  p95 2.52
      //   hwY*2.5 / hwE  p25 1.15  p50 1.21  p75 1.25   (n = 332)
      //
      // and the p50 is stable per run at 1.94-2.08, so it is not one
      // subject's proportions. Our own footage therefore puts the
      // shoulder factor at 0.6 / 2.01 = 0.299 (anthropometry said ~0.38;
      // both agree 0.6 is about twice too large) and the eye factor at
      // 2.5 / 1.21 = 2.07.
      //
      // THE CONSTANTS ARE DELIBERATELY NOT CHANGED HERE, and this is the
      // reason so the next round does not re-litigate it: `headW` is not
      // only crop geometry. It is `sameHuman`'s merge TOLERANCE
      // (person-track.mjs), whose failure mode when it shrinks is two
      // tracks for one person and stacked patches -- and R19 scored the
      // other side of that bar as EXPOSURE. It also sets the patch's top
      // edge through topPad, where under-reading uncovers a crown. A
      // 2x change to a value with three consumers, justified by the needs
      // of one of them, is how a round trades its worst class for its
      // least-bad one.
      //
      // The consumer that actually needed a truthful head size is the
      // CROP, and it now gets one at the crop site: headCropRegion floors
      // its side against the person's raw box HEIGHT, which no rotation
      // and no rung disagreement can move. Anyone re-opening the
      // constants owes the other two consumers their own measurement
      // first.
      var le = kp(data, o, L_EAR);
      var re = kp(data, o, R_EAR);
      var ly = kp(data, o, L_EYE);
      var ry = kp(data, o, R_EYE);
      var headW = 0;
      if (heldIn(L_EAR) && heldIn(R_EAR)) {
        headW = Math.abs(le.x - re.x);
      } else if (heldIn(L_EYE) && heldIn(R_EYE)) {
        headW = Math.abs(ly.x - ry.x) * 2.5;
      } else if (heldIn(L_SHOULDER) && heldIn(R_SHOULDER)) {
        headW = Math.abs(ls.x - rs.x) * 0.6;
      }
      headW = Math.max(headW, 0.04);
      headWOut = headW;
      // Same physical distance is a LARGER number in normalized-y on a
      // wide frame: dy_norm = dx_norm * (W/H).
      var headH = headW * ar;
      headHOut = headH;
      // HAIR, not just the skull (owner 2026-08-27, seen on every blur).
      //
      // `hy` is the mean of the head keypoints -- eye level, near enough
      // -- and `headH` is the head's WIDTH carried into normalized-y. A
      // crown sits about 0.75 head-widths above the eyes, so 1.1 left
      // roughly a third of a head-width for everything on top of it:
      // enough for a short cut, not for the hair the owner is looking
      // at. 1.6 puts the same ~0.85 head-widths of hair room above the
      // crown that ANTHRO_HAIR gives the image path. It is applied to
      // the top edge ONLY, so no patch gets wider and no cleared face
      // beside the subject is newly covered by it.
      if (hy - headH * HEAD_ANCHOR_UP < y1) y1 = hy - headH * HEAD_ANCHOR_UP;
      if (hy + headH * 0.9 > y2) y2 = hy + headH * 0.9;
      if (hx - headW * 1.2 < x1) x1 = hx - headW * 1.2;
      if (hx + headW * 1.2 > x2) x2 = hx + headW * 1.2;
      // The head anchor is EVIDENCE, not cushion: it is the rule that a
      // crown and hair must not escape the patch, and MoveNet's own box
      // routinely stops at the hairline. So `core` gets it at the same
      // factors — the clamp must never be able to shave a head.
      if (hy - headH * HEAD_ANCHOR_UP < cy1) cy1 = hy - headH * HEAD_ANCHOR_UP;
      if (hy + headH * 0.9 > cy2) cy2 = hy + headH * 0.9;
      if (hx - headW * 1.2 < cx1) cx1 = hx - headW * 1.2;
      if (hx + headW * 1.2 > cx2) cx2 = hx + headW * 1.2;
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
      // The cushion-free evidence hull. Never drawn — see `core` above.
      core: {
        x1: Math.max(0, Math.min(cx1, cx2)),
        y1: Math.max(0, Math.min(cy1, cy2)),
        x2: Math.min(1, Math.max(cx1, cx2)),
        y2: Math.min(1, Math.max(cy1, cy2)),
      },
      hold: heldIdx === -1 ? 0 : (heldList[heldIdx].hold || 0) + 1,
    });
    // Claimed only now that the slot has actually survived every gate.
    if (heldIdx !== -1) heldTaken[heldIdx] = true;
    // Stamped HERE, not at the gate: three guards below the gate (the
    // anchor, the sprawl ratio, the head/shoulder test) can still drop a
    // slot, and a slot that was going to be admitted but was not is a
    // REJECTED slot for boundBodyToSlot's purposes.
    lastSlotDiag[p].adm = 1;
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
// R25 — THE EDGE-CROPPED PERSON, AND THE THREE FIXES THAT WERE MEASURED
// AND REFUSED. Written here so the next round does not re-propose them.
//
// The footage: g_2Wmzpx47I t=20-35, `man`. A second woman stands at
// frame left with only her right shoulder and upper arm in shot (x
// 0.00-0.12, no face, back to camera). She is sharp on 9 of 10 frames —
// EXPOSURE, the worst class — and her MoveNet slot is present on every
// pass carrying score 0.000-0.009, confident 0, nKp15 0, maxKp
// 0.007-0.119. The frame's other person scores 0.50 in the same pass.
//
//  1. TILING / A HIGHER-RESOLUTION PERSON PASS. Measured on this exact
//     frame through the bench hook (spikes/gauntlet/personaspect.py),
//     same model, same paused frame, three inputs: the shipped 256x256
//     SQUASH gives her maxKp 0.009; an ASPECT-PRESERVING letterbox gives
//     0.05; a LEFT-HALF tile — a genuine 2x zoom — gives maxKp 0.185 and
//     nKp15 2, against PERSON_MIN_KEYPOINTS 5. Zooming does not admit
//     her, it only makes the noise bigger, and it costs 2-3x the person
//     pass (p50 26ms measured) on a Helio G88. R7 measured the same
//     asymmetry the other way: zoomed logo letters scored 0.59 while
//     real distant faces zoomed to 0.
//  2. ADMITTING A ZERO-EVIDENCE SLOT BECAUSE IT TOUCHES A FRAME EDGE.
//     Priced over the corpus: `score<0.05 & confident==0 & nKp15==0 &
//     edge-touching & tall & narrow` buys 4 of this round's 9 exposure
//     frames and pays 9 news-slate frames plus 12-22 kitchen-counter
//     frames. It trades 9 EXPOSURE for 21-31 GHOST — both terminal.
//  3. CLOSING THE GAP BETWEEN A PATCH AND THE FRAME EDGE geometrically.
//     Refused in person-track.mjs, where the numbers are.
//
// What WOULD reach her is a per-pixel person SEGMENTATION (MediaPipe
// Selfie Segmentation or BodyPix, both Apache-2.0 code AND weights, so
// both are licence-clean): a shoulder at the frame edge needs no box
// score, no instance count and no anatomy. S9 benched that class of
// model at p50 18.9ms warm on desktop — tolerable on a verdict pass,
// NOT on the 120ms position pass. That is a milestone, not a round, and
// it is the owner's call.
//
// LATENT, and this is the one to watch: `frameHasNoHumanShape` below is
// a GHOST gate that becomes an EXPOSURE gate on this class of footage.
// Her slot's maxKp is under PFF_FRAME_KP_FLOOR on 13 of 15 passes, so on
// a frame whose ONLY human is edge-cropped it would refuse the face
// fallback as well. She is safe here only because the other woman's slot
// lifts the frame-wide maximum.
/** The frame-wide keypoint maximum `frameHasNoHumanShape` compares
 * against PFF_FRAME_KP_FLOOR. Exposed so a diagnostic can record WHAT
 * the gate refused on, not merely how often: on his phone MoveNet
 * admits nobody at all (twelve slots n:0, every window since 2026-08-31
 * loop 27), so this number alone decides whether a detected face
 * becomes a patch. The floor was calibrated on gauntlet footage; there
 * is no measurement of it on his hardware. */
export function frameMaxKp(slotDiag) {
  if (!slotDiag || !slotDiag.length) return null;
  var m = 0;
  for (var i = 0; i < slotDiag.length; i++) {
    var k = slotDiag[i] && slotDiag[i].maxKp;
    if (typeof k === 'number' && k > m) m = k;
  }
  return m;
}

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
    y2: Math.min(1, cy + h * PFF_BODY_DOWN),
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
    // EVIDENCE HULL for a body nobody measured (R27 critic F2). Without
    // it `coreFresh` is false for the whole life of every synthetic
    // track, so the directional margin is structurally OFF for exactly
    // the patches most likely to sit on a cleared neighbour — this
    // file's own measurement is that 7 of 86 synthetic bodies claim the
    // entire frame.
    //
    // NOT the bare face box, which would let an edge travel to the chin
    // and leave a shoulder sharp. The evidence for a face-derived person
    // is the face plus the half-face of neck and shoulder that any human
    // has under it, which is the same shape personFromFace already draws,
    // only without its outward reach.
    core: {
      x1: Math.max(0, face.x1 - (face.x2 - face.x1) * 0.5),
      y1: Math.max(0, face.y1 - (face.y2 - face.y1) * 0.4),
      x2: Math.min(1, face.x2 + (face.x2 - face.x1) * 0.5),
      y2: Math.min(1, face.y2 + (face.y2 - face.y1) * 0.5),
    },
  };
}

// THE COMPOSITE FRAME (gauntlet R29).
//
// personFromFace's whole model is "a face implies ~7.4 face-heights of
// body under it". That is right for one camera looking at one scene and
// catastrophically wrong for a face that lives inside a SUB-WINDOW of a
// composite — a TV news panel, a video-call grid, a split screen. There
// the person is bounded by a hard rectangular border a few face-heights
// down, and nothing in the face alone can say so.
//
// MEASURED, runs/r29-{man,woman} (QEG4pI2cRE8 t=475, Zee News panel,
// native 656x480, five men in five picture-in-picture boxes, locked-off
// shot, nobody moves for 15s):
//
//   MoveNet admits 3 of the 5 men. BlazeFace finds all five faces. The
//   two unowned faces fall through faceInsideIndex, personFromFace mints
//   a whole standing body from each -- 0.42 x 0.544 of frame for a man
//   who occupies 0.28 x 0.33 -- those bodies reach down into the boxes
//   BELOW them, dedupeMerged (71 fires in 15s on a shot where nothing
//   moves) unions them with the real tracks there, and one slab covers
//   three men and half the graphics. FALSE COVER on 10 of 10 frames in
//   `man` mode, two to four men per frame.
//
// The bound is already in the artifact and nobody was reading it. Both
// unowned men have a MoveNet slot sitting exactly on them:
//
//   slot2  score 0.139 confident 3 nKp15 7  box [0.10,0.18,0.29,0.43]
//   slot4  score 0.000 confident 0 nKp15 0  box [0.44,0.19,0.55,0.42]
//
// slot2 is man A and his box is his PiP window almost exactly; he misses
// PERSON_WEAK_KP15 by ONE keypoint. Neither slot is admissible as a
// PERSON — R25 priced admitting zero-evidence slots on geometry alone at
// 9 EXPOSURE bought for 21-31 GHOST paid, and that refusal stands. But
// admission is not what this needs. The FACE is already the evidence
// that a person is there; the slot box is only being asked how far down
// they go, and it is a strictly better answer than an extrapolation.
//
// WHY THIS CANNOT INTRODUCE A GHOST, and it is structural rather than
// statistical: the rule only ever runs where personFromFace was about to
// mint a body anyway, and it is taken ONLY when the result is SMALLER.
// The SET of patches is identical before and after; only their geometry
// moves, and only inward. Same argument, same convention, as R28's
// headCropRegion.
//
// WHAT IT CAN DO IS EXPOSE A BODY, and that is the risk that had to be
// priced. Swapping a 7.4-face-height extrapolation for a 2.5-face-height
// box leaves legs sharp if the legs were really there. Swept over the
// whole corpus -- 737 synthetic bodies in 195 stored runs, 352 of them
// invertible (a body clipped by the frame edge no longer carries the `h`
// it was built from, so it cannot be reversed) -- a REJECTED slot box
// contains the face on 25 of them, and the guards below leave 14. Twelve
// of those fourteen are this round's own footage. The rule is narrow by
// measurement, not by intention: two samples in 195 runs sit outside the
// regime it was built for (r23after-cook, s11-gate), and both are
// counter-height studio kitchen shots where the visible person really
// does stop at a worktop. That residual is stated, not hidden.
//
// The guards, and what each one is actually refusing:
//
//  * REJECTED SLOTS ONLY (`adm`). If the slot was admitted, the face
//    belongs to a person the tracker already has, and handing them the
//    same box is a merge, not a bound. Unfiltered, the same sweep finds
//    220 candidates instead of 25 — an order of magnitude of exactly the
//    wrong cases.
//  * >= SLOT_BOUND_FACE_INSIDE of the FACE's area inside the slot box.
//    R28's F3 found the corner-overlap version of this guard admitting a
//    face 95% outside its crop; a bound taken from a box the face barely
//    touches is a bound taken from a stranger.
//  * slot box at least SLOT_BOUND_MIN_FACE_HEIGHTS tall. Below head-and-
//    shoulders it is not a bound on a body, it is noise that happens to
//    sit on a face. Every r29 candidate measures 2.53-3.13.
//  * the face CENTRE in the slot box's top SLOT_BOUND_FACE_TOP_FRAC. A
//    head sits at the top of the body it belongs to; a box whose face is
//    at its bottom is some other person's torso. Free anatomy.
//  * SMALLER IN AREA than the body it replaces, after margins. This is
//    the one that makes the GHOST argument structural.
//
// The slot box gets PATCH_MARGIN, exactly like a slot the gate DID
// admit, is clipped to the body it is bounding (see the F2 note at the
// clip itself), and is then unioned with the body's own `core` so a box
// that stops at a chin can never shave the neck and shoulder
// personFromFace already knew about.
//
// WHY A SLOT WITH NO KEYPOINTS IS STILL A USABLE BOX, and this is the
// round's real discovery rather than a tolerated compromise. Twelve of
// the 33 r29 fires come from slots at score 0.000-0.029 with `confident`
// 0 and `nKp15` 0-3 — the exact population R25 priced and refused for
// ADMISSION. An evidence gate here looks obligatory and would throw away
// half the fix. It is wrong, because MoveNet's box-regression head and
// its keypoint head are SEPARATE OUTPUTS, and on a small sub-window
// subject the box head still localises after the keypoint head has
// collapsed. Man B's box over ten frames, at score 0.000-0.029
// throughout:
//
//   [0.46,0.19,0.56,0.42] [0.44,0.20,0.54,0.41] [0.44,0.19,0.55,0.42]
//   [0.43,0.19,0.56,0.42] [0.42,0.20,0.56,0.41] [0.45,0.20,0.56,0.41]
//
// stable to +-0.02 over 15 seconds. That is a measurement, not noise,
// and it is why this rule works on a composite without needing to know
// it is looking at one. DO NOT add a keypoint floor here; admission and
// bounding are different questions and R25's refusal is about the first.
//
// KNOWN AND LEFT ALONE: `core` is 1.4h per side against the body's
// PFF_HALF_CAP 0.35, so above h ~0.25 the union can be wider than the
// capped body. Pre-existing in personFromFace's own `core`; this rule
// only surfaces it, and the clip above bounds it to the body on every
// axis, so it cannot escape the patch that would have been drawn anyway.
export var SLOT_BOUND_FACE_INSIDE = 0.8;
export var SLOT_BOUND_MIN_FACE_HEIGHTS = 2.0;
export var SLOT_BOUND_FACE_TOP_FRAC = 0.5;

/**
 * The raw model boxes of the slots parsePersons REFUSED on the last
 * pass. Must be read synchronously next to that pass — see the R21 note
 * on `noHumanShape` in detector.js: lastSlotDiag is module state and one
 * detector instance serves every video element on the page.
 */
export function rejectedSlotBoxes(slotDiag) {
  var out = [];
  if (!slotDiag || !slotDiag.length) return out;
  for (var i = 0; i < slotDiag.length; i++) {
    var d = slotDiag[i];
    if (!d || d.adm) continue;
    var b = d.bb;
    if (!b || b.length !== 4) continue;
    if (!(b[2] > b[0]) || !(b[3] > b[1])) continue;
    out.push({ x1: b[0], y1: b[1], x2: b[2], y2: b[3] });
  }
  return out;
}

/**
 * Shrink a synthetic body onto a rejected MoveNet slot that measured the
 * same person. Returns the body unchanged whenever no slot qualifies —
 * which is the overwhelmingly common case. See the block above.
 */
export function boundBodyToSlot(body, face, boxes) {
  if (!body || !face || !boxes || !boxes.length) return body;
  var fw = face.x2 - face.x1;
  var fh = face.y2 - face.y1;
  if (!(fw > 0) || !(fh > 0)) return body;
  // De-inflate FACE_ENLARGE, the same 1.4 personFromFace uses, so
  // SLOT_BOUND_MIN_FACE_HEIGHTS is measured in the same unit as every
  // other face-height constant in this file.
  var h = fh / 1.4;
  var cy = (face.y1 + face.y2) / 2;
  var bodyArea = (body.x2 - body.x1) * (body.y2 - body.y1);
  if (!(bodyArea > 0)) return body;
  var c = body.core || { x1: face.x1, y1: face.y1, x2: face.x2, y2: face.y2 };
  var best = null;
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    if (!b || !(b.x2 > b.x1) || !(b.y2 > b.y1)) continue;
    var ix = Math.min(face.x2, b.x2) - Math.max(face.x1, b.x1);
    var iy = Math.min(face.y2, b.y2) - Math.max(face.y1, b.y1);
    if (!(ix > 0) || !(iy > 0)) continue;
    if (ix * iy < fw * fh * SLOT_BOUND_FACE_INSIDE) continue;
    var bh = b.y2 - b.y1;
    if (bh < h * SLOT_BOUND_MIN_FACE_HEIGHTS) continue;
    if (cy > b.y1 + bh * SLOT_BOUND_FACE_TOP_FRAC) continue;
    var mw = (b.x2 - b.x1) * PATCH_MARGIN;
    var mh = bh * PATCH_MARGIN;
    // INTERSECT WITH THE BODY FIRST, and the reason is the R29 critic's
    // F2. The first build gated on AREA alone, and area is not
    // containment: replayed over every corpus run carrying `ff` and
    // `slots`, 14 of 51 fires were NOT subsets of the body they
    // replaced — width ratio up to 1.29, height up to 1.17, one case
    // growing DOWNWARD past the body's own foot. So the sentence this
    // rule's whole GHOST argument rests on — "the patch SET is unchanged
    // and only shrinks" — was false, and would have been the sentence a
    // later round trusted. It costs the target case NOTHING: 0 of the 33
    // r29 fires are non-subsets, so the clip is inert on the footage the
    // rule exists for and honest everywhere else.
    var sx1 = Math.max(b.x1 - mw, body.x1);
    var sy1 = Math.max(b.y1 - mh, body.y1);
    var sx2 = Math.min(b.x2 + mw, body.x2);
    var sy2 = Math.min(b.y2 + mh, body.y2);
    if (!(sx2 > sx1) || !(sy2 > sy1)) continue;
    var n = {
      x1: Math.max(0, Math.min(sx1, c.x1)),
      y1: Math.max(0, Math.min(sy1, c.y1)),
      x2: Math.min(1, Math.max(sx2, c.x2)),
      y2: Math.min(1, Math.max(sy2, c.y2)),
    };
    var a = (n.x2 - n.x1) * (n.y2 - n.y1);
    if (!(a < bodyArea)) continue;
    // LARGEST qualifying, not smallest. Every candidate reaching this
    // line has already cleared all four guards, so choosing the minimum
    // maximises the cut for no gain — and on r24-child-man f3 the four
    // candidates measure 3.03 / 4.15 / 5.87 / 5.93 face-heights and the
    // first draft took 3.03. Same cost, strictly the EXPOSURE-safe side.
    if (best === null || a > best.a) best = { a: a, n: n };
  }
  if (!best) return body;
  var outp = {};
  for (var k in body) {
    if (Object.prototype.hasOwnProperty.call(body, k)) outp[k] = body[k];
  }
  outp.x1 = best.n.x1;
  outp.y1 = best.n.y1;
  outp.x2 = best.n.x2;
  outp.y2 = best.n.y2;
  // NOT `raw`. cropAnchor prefers `raw` over `faceBox`, and R26 measured
  // that anchoring the crop on anything wider than the face costs both
  // attribution and resolution. The bound decides what is DRAWN; the
  // face still decides what is READ.
  outp.boundToSlot = true;
  return outp;
}

// THE CROP IS NOT THE PATCH (gauntlet R26).
//
// A person object carries two different boxes for two different jobs and
// until this round both jobs used the widest one. The PATCH has to cover
// a whole human with their hands and hair outside the model's box, so it
// is deliberately inflated: model box, unioned with every confident
// keypoint plus KEYPOINT_MARGIN, unioned with the head anchor, then
// PATCH_MARGIN on top. The CROP has exactly one job — put this person's
// FACE in front of BlazeFace at the largest scale available — and every
// pixel of that inflation makes it worse at it, twice over.
//
// MEASURED, r26-woman (8R1hy3uHds0 t=540, ~10 people, 180 slot records):
//
//   MoveNet raw slot box        p50 0.110 wide
//   + KEYPOINT_MARGIN           p50 0.173
//   + PATCH_MARGIN              p50 0.201      <- what the crop used
//   adjacent-person head gap    p50 0.145 (278px)
//
// So the crop was 1.82x the person before padding, against neighbours
// standing 1.4 crop-widths apart: it contained them by arithmetic. The
// reads probe agrees — faces-per-crop over the window was
// {1:23, 2:34, 3:20, 4:3}, i.e. 57 of 80 reads saw two or more people.
//
// Two costs, and the second is the one that scores:
//
//  1. ATTRIBUTION. ownFaceIndex judges "is this face mine?" at
//     `max(0.18, fw)` in CROP units, so a wider crop is a wider bar in
//     frame terms — the sprawl relaxes the test that exists to contain
//     it. Six of forty attr rows had two faces inside their own bar,
//     winner-vs-runner-up margins 0.044-0.106 crop units.
//  2. RESOLUTION. detectFaceBoxes stretches the crop to 256 (detector.js),
//     so a 0.201-wide crop puts a 70px face at ~14% of the model input
//     against BlazeFace's ~5% evaluation floor — a coarse box, and
//     `nativePx` then lands at 64-83, right on FACE_MIN_NATIVE_PX. The
//     gender read that decides FALSE COVER is taken from that box.
//
// So the crop anchors on the TIGHTEST honest evidence of where the
// person is: the raw model box for a MoveNet slot, the face itself for a
// synthetic body (which is the only thing personFromFace actually knew).
// Nothing drawn changes — `obs.box` is still the inflated patch — so
// EXPOSURE, PARTIAL, GHOST and DRIFT are all unreachable from this diff
// by construction. It can only change verdicts, and it is CHEAPER: same
// inference count, same 256 input, a smaller createImageBitmap resize.
//
// The one way it can bite is a person whose own face falls OUTSIDE the
// tight anchor — they lose the read, go faceFound:false and stay
// covered. That is the FALSE COVER direction, so it is measured rather
// than assumed: over this window every owned face sat at
// |fc_x - 0.5| <= 0.190 against the tight crop's 0.5 half-width, while
// neighbours sat at p50 0.320. A MoveNet box that fails to contain its
// own subject's head is not a case this can rescue anyway — the head
// anchor that would widen it is derived from the same keypoints.
export var FACE_CROP_HALF_WIDTHS = 1.5; // synthetic-body crop = 3x the face box

/**
 * The tightest box that still honestly locates this person, for cropping
 * ONLY. Never use it to draw: it is the evidence box, not the patch.
 */
export function cropAnchor(p) {
  var r = p && p.raw;
  if (r && r.length === 4 && r[2] > r[0] && r[3] > r[1]) {
    return { x1: r[0], y1: r[1], x2: r[2], y2: r[3] };
  }
  var f = p && p.faceBox;
  if (f && f.x2 > f.x1 && f.y2 > f.y1) {
    var cx = (f.x1 + f.x2) / 2;
    var cy = (f.y1 + f.y2) / 2;
    var hw = ((f.x2 - f.x1) / 2) * FACE_CROP_HALF_WIDTHS * 2;
    var hh = ((f.y2 - f.y1) / 2) * FACE_CROP_HALF_WIDTHS * 2;
    return {
      x1: Math.max(0, cx - hw),
      y1: Math.max(0, cy - hh),
      x2: Math.min(1, cx + hw),
      y2: Math.min(1, cy + hh),
    };
  }
  // No evidence box (hand-built person, a test, a future source): the
  // patch is all there is, and today's behaviour is the safe answer.
  return { x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2 };
}

/**
 * The crop region a person's face/gender pass runs on. Multi-SCALE is
 * the pass that actually adds information — a distant person's face
 * fills the model input here instead of being a handful of pixels in
 * the full frame.
 */
export var HEAD_CROP_HALF_WIDTHS = 1.5; // head crop = 3 head-widths, square in NATIVE px

/**
 * The head-anchored crop, or null when this person has no head anchor.
 *
 * WHY THE BODY BOX CANNOT BE THE FACE CROP FOR A STANDING PERSON (R28).
 *
 * R26 tightened `cropAnchor` from the inflated patch to the raw MoveNet
 * box and measured the win on a classroom of small SEATED boxes. It did
 * nothing for the regime this round scored, because the raw box of a
 * person STANDING UP is still 7-8 head-heights tall, and two multiplies
 * downstream turn that into an unreadable face:
 *
 *   cropPersonPixels scales by 224 / max(sw, sh)  (init-entry.js)
 *   detectFaceBoxes  resizes that to a SQUARE 256 (detector.js:426)
 *
 * MEASURED, runs/r28a-woman (eVFzbxmKNUw t=270, one woman on a stage):
 * her raw box on the wide shots is ~0.20 x 0.85 of frame = 384 x 918
 * native px. The first multiply makes it 94 x 224; the second stretches
 * x by 2.72 and y by 1.14. Her ~86px native face reaches BlazeFace as
 * roughly a 57 x 24 smear, and the detector returns NOTHING:
 * `personNoFace` fired 29 times in the 6.1s those wide shots lasted,
 * `readClearCertain` fired ZERO times, and in `woman` mode she was
 * therefore FALSE COVERED on every one of those frames. The instant the
 * shot cut to chest-up the same pipeline read her 4-6 times per frame.
 *
 * So the face pass gets a HEAD-shaped region. Nothing drawn changes --
 * `obs.box` is still the patch built by parsePersons -- so EXPOSURE,
 * PARTIAL, GHOST and DRIFT are unreachable from this diff by
 * construction, exactly as R26 argued for its own crop change. It is
 * also CHEAPER: same inference count, same 256 input, a much smaller
 * createImageBitmap resize.
 *
 * The multiple is 3x, the same `FACE_CROP_HALF_WIDTHS` convention the
 * synthetic-body crop has used since R26, and it is bounded on both
 * sides: headW carries a 0.04 floor in parsePersons, so the crop can
 * never collapse below 0.12 of frame width even when the eye rung
 * under-reads a turned head.
 *
 * Null, not a guess, when there is no head anchor: a back-turned person
 * has no head keypoints at all, and the caller keeps today's body crop
 * for them rather than inventing a head position.
 */
export function headCropRegion(p) {
  if (!p) return null;
  var hx = p.headX;
  var hy = p.headY;
  var hw = p.headW;
  var hh = p.headH;
  if (typeof hx !== 'number' || typeof hy !== 'number') return null;
  if (!(hw > 0) || !(hh > 0)) return null;
  var ar = hh / hw; // headH is headW * aspect by construction

  // THE RUNGS ARE HORIZONTAL PROJECTIONS, SO YAW SHRINKS THEM (R28
  // critic F1). Ear span and eye gap both measure ACROSS the face, so a
  // head turned to 70 degrees reports about a third of its true breadth
  // while the head itself has not changed size; below that the 0.04
  // floor in parsePersons takes over and the crop can end up SMALLER
  // than the head it is meant to deliver. Measured on this round's own
  // probe (runs/r28*, 94 slot records carrying both rungs), the shoulder
  // rung reads 2.03x the ear rung at p50 -- the two disagree by a factor
  // of two even on a mostly-frontal subject, which is the same
  // instability seen from the other side.
  //
  // So the crop side has a floor that no rotation can touch: the
  // person's own raw box HEIGHT. A standing adult is ~7.5 head-heights,
  // so 3 head-heights of crop is 0.4 of the body box, and taking the
  // larger of the two can only ever ENLARGE a crop that a collapsed rung
  // made too small. It never shrinks one, so it cannot re-introduce the
  // stretch this function exists to remove.
  var ay = hh * HEAD_CROP_HALF_WIDTHS;
  var r = p.raw;
  if (r && r.length === 4 && r[3] > r[1]) {
    var bodyFloor = (r[3] - r[1]) * 0.2; // half of 0.4 body-heights
    if (bodyFloor > ay) ay = bodyFloor;
  }
  var ax = ay / ar;

  // SLIDE, THEN CLAMP (R28 critic F2). Clamping an edge at the frame
  // border used to halve one axis and hand the detector back exactly the
  // anisotropy this crop exists to remove -- and it fires on nearly
  // every close-up, because the head sits well inside 1.5 head-heights
  // of the top of frame. Sliding the window keeps it square whenever a
  // square of that size fits in the frame at all.
  var x1 = hx - ax;
  var x2 = hx + ax;
  var y1 = hy - ay;
  var y2 = hy + ay;
  if (x1 < 0) { x2 -= x1; x1 = 0; }
  if (x2 > 1) { x1 -= x2 - 1; x2 = 1; }
  if (y1 < 0) { y2 -= y1; y1 = 0; }
  if (y2 > 1) { y1 -= y2 - 1; y2 = 1; }
  return {
    x1: Math.max(0, x1),
    y1: Math.max(0, y1),
    x2: Math.min(1, x2),
    y2: Math.min(1, y2),
  };
}

export function personCropRegion(p) {
  var body = padded(cropAnchor(p), PERSON_GATE_PAD);
  var head = headCropRegion(p);
  // ONLY when it actually buys resolution. On a close-up the body box is
  // already head-sized, and there the head anchor is the RISKIER of the
  // two: `headW` comes off whichever rung is confident (ear span, eye
  // gap x2.5, shoulder span x0.6), and the rungs disagree by tens of
  // percent on a turning head -- a tighter box built on the wrong rung
  // can clip the face it exists to deliver. Taking the smaller of the
  // two areas keeps the tight crop where it is a large win and keeps
  // today's behaviour where it would be a coin flip.
  if (!head) return body;
  var ha = (head.x2 - head.x1) * (head.y2 - head.y1);
  var ba = (body.x2 - body.x1) * (body.y2 - body.y1);
  if (!(ha > 0) || !(ba > 0) || ha >= ba) return body;
  return head;
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

// FACE-IN-PERSON: THE ONE RULE THAT DECIDES WHICH EXTENT SOURCE A FACE
// GETS, and until phase-g G1 it lived inside a closure in init-entry
// where no bench could reach it.
//
// `extent-reach.mjs` re-implemented it -- unpadded, and with no
// one-face-per-person rule -- and reported that 16.8% of corpus faces
// fall through to `personFromFace`. Through the shipped rule the figure
// is materially larger, because a second face inside one person's box
// does NOT get that box: it gets its own synthetic body. That is the
// same class of defect G5 caught one finding earlier (a bench modelling
// a shipped mapping instead of calling it), so the function moved here
// rather than being copied a third time.
//
// The 10% pad on each axis is load-bearing: MoveNet's box is drawn
// round the KEYPOINTS, so a head that leans past the shoulder line sits
// slightly outside the person it plainly belongs to.
export function faceInsideIndex(face, persons) {
  var cx = (face.x1 + face.x2) / 2;
  var cy = (face.y1 + face.y2) / 2;
  for (var i = 0; i < persons.length; i++) {
    var p = persons[i];
    var pw = (p.x2 - p.x1) * 0.1;
    var ph = (p.y2 - p.y1) * 0.1;
    if (cx >= p.x1 - pw && cx <= p.x2 + pw && cy >= p.y1 - ph && cy <= p.y2 + ph) return i;
  }
  return -1;
}

// LARGEST FACE FIRST. The face most likely to BE a person is the one
// that gets to claim that person's measured box; every other face
// inside it falls through to a synthetic body, and mergeTracks unions
// the genuine overlaps so an over-claim costs one merged patch rather
// than a stack. `init-entry` calls this -- it is not a second copy.
export function faceOrderBySize(faces) {
  var order = [];
  for (var oi = 0; oi < faces.length; oi++) order.push(oi);
  order.sort(function (a, b) {
    return (
      (faces[b].x2 - faces[b].x1) * (faces[b].y2 - faces[b].y1) -
      (faces[a].x2 - faces[a].x1) * (faces[a].y2 - faces[a].y1)
    );
  });
  return order;
}

// WHICH FACES FALL THROUGH TO personFromFace, by the shipped rule.
//
// Built for `bench/extent-reach.mjs`, which had its own private version
// -- unpadded, and with no one-face-per-person rule -- and reported the
// synthetic share as 16.8% where the shipped rule says 27.5%. It is
// assembled from the same two pieces the app runs (`faceOrderBySize`
// then `faceInsideIndex` with a `claimed` set), so it cannot drift from
// the app without one of those two moving.
export function synthFaceIndices(faces, persons) {
  var order = faceOrderBySize(faces);
  var claimed = {};
  var synth = [];
  for (var oj = 0; oj < order.length; oj++) {
    var fi = order[oj];
    var owner = faceInsideIndex(faces[fi], persons);
    if (owner !== -1 && !claimed[owner]) { claimed[owner] = 1; continue; }
    synth.push(fi);
  }
  return synth;
}
