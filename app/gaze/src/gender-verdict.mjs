// Pure verdict logic for the gender stage (protection engine, handoff
// decision #3): the app filters the opposite gender by default. Blur-first
// fail-safe: anything not positively verified same-gender stays covered —
// unknown gender, low confidence, or no declared user gender all flag.
// Threshold registered in docs/detection-engine.md. Recalibrated
// 2026-08-24 for the faceres model swap: its score is 2*|sigmoid-0.5|
// (0=coin-flip, ~1=certain) and its DIRECTION was 7/7 correct on the
// live-thumbnail spike where mini-Xception misgendered outright — so the
// bar is a low certainty floor, not the old 0.85 softmax wall that
// blurred most same-gender faces (owner report).

export var GENDER_MIN_SCORE = 0.25;
// CLEARING is asymmetric (owner frame 2026-08-24: the daughter — a
// child — rendered SHARP while Linus was covered; faceres is trained on
// adults and can read a child's face as confidently wrong): a face may
// count as certainly-SAME-gender (the read that lifts blur) only at
// this much higher certainty. Flagging keeps the low bar — over-blur
// stays cheap, under-blur is the failure that matters.
export var GENDER_CLEAR_SCORE = 0.6;
// ...but 0.6 was calibrated on MALE faces, and faceres is not equally
// confident about the two genders. Measured in gauntlet R6 on a 3-person
// news panel (runs/r6-woman), same shot, same lighting, faces all
// 8-11% of frame height:
//   male reads   (19 samples): 0.87-0.97, median 0.94
//   female reads ( 5 samples): 0.22-0.67, median 0.54
// The model is directionally correct every time — it never called a man
// female or a woman male. Only its CERTAINTY differs, and it differs by
// roughly 0.4 across the whole distribution.
//
// So a single threshold is not a single bar. At 0.6 a man sails through
// instantly (man mode: cleared on the first read), while a woman sits
// astride it and her clear streak keeps resetting — she stayed covered
// for ~6 seconds of a static panel shot in woman mode, which is FALSE
// COVER of exactly the person the setting exists to leave alone. Every
// woman-mode user would see that on every video.
//
// Fixing it by lowering GENDER_CLEAR_SCORE globally would drag the male
// clear bar down with it for no reason and weaken the child/uncertainty
// fail-safe. Instead the bar is set per CLEARED gender, calibrated to
// that gender's own distribution. The safety argument for the lower
// female bar is that direction is reliable: a man reads male at 0.87+,
// so he cannot sneak through a female-clear gate at 0.45 — he would have
// to be misread as female first, which was not observed once.
export var GENDER_CLEAR_SCORE_FEMALE = 0.45;

/** Clear-side certainty bar for the gender being cleared. */
export function clearScoreFor(gender) {
  return gender === 'female' ? GENDER_CLEAR_SCORE_FEMALE : GENDER_CLEAR_SCORE;
}

// INSTANT clear: the bar above which ONE read is enough, so the tracker
// does not have to wait for CLEAR_STREAK_N consecutive reads.
//
// Measured in gauntlet R9 (runs/r9-man, a post-match interview between
// two men): every single gender read in the run was `male` at 0.71-0.99,
// perfect direction, perfect certainty — and three of ten frames still
// carried FALSE COVER, because a fresh track starts blurred and needs a
// SECOND consecutive read to clear. f000 id3 and f009 id7 both sat
// covered at `clearStreak 1, lastVerdict 'clear-certain'`: a man read as
// male at 0.97 was blurred because we had only asked once. Track churn
// mints new ids constantly in a handheld two-shot, so this is not a
// first-frame curiosity — it recurs all run.
//
// The streak exists because a read at the 0.6 bar is weak evidence. A
// read at 0.9 is not weak evidence, and treating them the same is what
// costs the frames. The faceres distribution measured in R6 backs this:
// male reads 0.87-0.97 median 0.94, and the model was never once
// observed calling a man female or a woman male — only its CERTAINTY
// varies, not its direction. So 0.9 is inside the male distribution and
// essentially unreachable by a female face.
//
// The child gate still applies independently (see GENDER_ADULT_AGE):
// instant or not, a face read as under 18 is never certain.
export var GENDER_INSTANT_CLEAR = 0.9;
// The female bar is deliberately set ABOVE every female read observed in
// R6 (0.22-0.67, median 0.54, n=5), which means it effectively never
// fires in woman mode. That is honest rather than symmetric: five
// samples is not a distribution, and guessing a female instant bar low
// enough to be useful would risk clearing a MISREAD MAN instantly, which
// is EXPOSURE — the worst class — in the direction we have least data
// for. Woman mode therefore keeps the two-read streak until a
// woman-direction run on female-heavy footage measures the real band.
// Registered as R10's calibration item.
export var GENDER_INSTANT_CLEAR_FEMALE = 0.7;

/** Certainty bar above which a SINGLE same-gender read clears a track. */
export function instantClearScoreFor(gender) {
  return gender === 'female' ? GENDER_INSTANT_CLEAR_FEMALE : GENDER_INSTANT_CLEAR;
}
// faceres age head (age_pred/Softmax, expected value over 0-99): below
// this age the gender read is UNTRUSTED entirely — adult-trained gender
// models are unreliable on children, and a child misread as same-gender
// must never clear. certain=false ⇒ unknown ⇒ covered, as everywhere.
export var GENDER_ADULT_AGE = 18;
// The mean is the WRONG STATISTIC and the round that finally measured it
// says so plainly (gauntlet R18, runs/r18d-woman). faceres' age head is a
// 100-bin softmax and detector.js reduces it to an expected value; on a
// child, mass splits between a young mode and the model's adult training
// prior and the mean lands between them, in the twenties. So the gate
// asks the mass directly: how much probability sits under
// GENDER_ADULT_AGE.
//
// Calibrated on the only footage in the corpus with a KNOWN child and a
// KNOWN adult in the same frame — a 2nd-grade classroom, one boy at the
// whiteboard and his teacher:
//   boy (~8 years old), 16 directed reads: childP 0.15-0.72, median 0.42
//   teacher (adult woman), 23 directed reads: childP 0.09-0.18, MAX 0.18
// At 0.25 the child gate fires on 13 of the boy's 16 reads against 4 of
// 16 for the mean, and on ZERO of the teacher's 23, with 0.07 of
// headroom above her worst read.
//
// This is not a tightening for its own sake. Two of the boy's reads —
// `male / 0.79 / age 19` and `male / 0.81 / age 22` — are ADJACENT in the
// log and each clears the certainty bar, which is exactly CLEAR_STREAK_N
// consecutive certain-clear reads. In MAN mode the old gate renders an
// eight-year-old sharp. Their childP is 0.56 and 0.49.
//
// Kept as an OR with the mean rather than a replacement: the mean already
// catches the unambiguous young reads (age 7, 9, 15) and a gate on child
// protection should widen, never narrow. A read with no childP (older
// callers, the image path) falls back to the mean exactly as before.
export var GENDER_CHILD_MASS = 0.25;

var OPPOSITE = { man: 'female', woman: 'male' };

/**
 * Is this read trustworthy as an ADULT read? False for a child, in which
 * case the gender answer is untrusted in BOTH directions. Missing age
 * (older callers) trusts the read, unchanged.
 */
function isAdultRead(f) {
  if (typeof f.childP === 'number' && f.childP >= GENDER_CHILD_MASS) return false;
  return typeof f.age !== 'number' || f.age >= GENDER_ADULT_AGE;
}

/**
 * userGender: "man" | "woman" | anything else (treated as unset).
 * faces: [{ gender: 'male'|'female'|'unknown', score: 0..1 }]
 * Returns 'clear' | 'flag'.
 */
export function faceVerdict(userGender, faces) {
  if (!faces || faces.length === 0) return 'clear';
  var opposite = OPPOSITE[userGender];
  if (!opposite) return 'flag'; // no declared gender: any face covers (v1)
  for (var i = 0; i < faces.length; i++) {
    var f = faces[i];
    var same = f.gender === (opposite === 'female' ? 'male' : 'female');
    // Child gate, same as the video path (review A10: the image path
    // cleared children with no age check — same defect class). The
    // score bar stays at GENDER_MIN_SCORE for images: raising it to the
    // video's 0.6 would re-blur the 0.3-0.6 same-gender adults the
    // owner already reported, and images have no tracker to absorb it.
    var adult = isAdultRead(f);
    if (!same || !adult || !(f.score >= GENDER_MIN_SCORE)) return 'flag';
  }
  return 'clear';
}

/**
 * Per-face verdicts for region blur (owner report 2026-08-24: a
 * confident same-gender face was blurred because ONE other face in the
 * thumbnail failed the bar — all-or-nothing flagging wastes exactly the
 * selectivity region patches exist for). Returns the INDICES of faces
 * that must stay covered; empty array means everything cleared. Each
 * face is judged alone by the same fail-safe rule as faceVerdict:
 * opposite gender, unknown, or low score ⇒ covered. No declared user
 * gender ⇒ every face covered.
 * faces: [{ gender, score }] parallel to the caller's box array.
 */
/**
 * Per-face {flagged, certain} for the video tracker (owner ask
 * 2026-08-24: "remember the person you checked — don't repeatedly blur
 * a male"). `certain` = the gender stage returned a real direction at
 * or above the bar; the tracker uses it to tell "confidently opposite
 * gender — flag NOW" apart from "couldn't read the face this frame" —
 * only the former may override a track's accumulated same-gender
 * history. faces: [{ gender, score }].
 */
// THE NULL OUTPUT, AND HOW TO REFUSE IT.
//
// faceres does not fail loudly when it has no signal — it returns its
// PRIOR, and the prior is a constant. Measured across three rounds and
// two independent videos: the raw sigmoid lands in a band barely 0.03
// wide while the age head simultaneously returns its own training mean
// (~36). Two heads emitting priors at once is zero information.
//
// Why that is not harmless: score = 2*|v - 0.5|, so a null at v ~ 0.63
// folds to ~0.27 — and GENDER_MIN_SCORE is 0.25. In WOMAN mode the null
// label `male` is therefore an OPPOSITE-gender read that clears the
// certainty bar, i.e. a CERTAIN FLAG built on nothing. Measured on
// runs/r12-woman2: every one of the four in-band reads scored 0.25-0.30,
// so all four were certain flags. On R11's TED footage 20 of 22 `male`
// reads in a frame containing two women and no men were exactly this.
//
// Why a SIZE gate cannot do this job (FACE_MIN_NATIVE_PX is the earlier
// attempt): the same four null reads came from faces of 68, 69, 90 and
// 239 native px — all comfortably above the 64px floor, which is itself
// diluted by the FACE_ENLARGE 1.4 the box already carries. Size never
// fired once in any measured run. A null-signature test also catches the
// two cases size cannot see at all: a face in deep shadow, and a
// BlazeFace false positive on something that is not a face.
//
// The band is deliberately JOINT. The 1-D gap is thin — nearest real
// male read measured at v = 0.759 against a null ceiling of 0.652 — so
// thresholding v alone would be reckless. Real male reads in this log
// carry ages 19-35; the null sits at 36-37.
//
// R12's critic argued the v-axis is dead weight and age is doing all the
// work. COUNTED on runs/r12-woman2, 21 unique reads: the v-band holds 9,
// the age-band holds 11, and only 4 are in BOTH. Drop the age test and 5
// real reads (ages 19, 25, 27, 28, 32) become nulls; drop the v test and
// 7 do, including reads at v 0.938/0.947 scoring 0.88/0.89 — the most
// confident male reads in the run. Both axes are load-bearing; neither
// alone is safe. Do not simplify this to one dimension.
//
// STILL UNDECIDED, and the honest limit of the box: two reads sit inside
// the v-band and outside the age-band (v 0.664/age 32 and v 0.717/age 27)
// and go on to flag CERTAIN. Nothing in the log says whether they are
// real men or nulls that drifted a few age-points. A self-calibrating
// test against the model's own no-information output would decide it;
// a fitted rectangle cannot.
//
// SAFETY, and this is why it is shippable without a frame-by-frame
// argument: abstaining can only ever REMOVE flag evidence, never add
// clear evidence. `unknown` is not a third verdict — faceMeta turns an
// undirected read into {flagged:true, certain:false}, the same honest
// state a person with no visible face gets, so the subject stays
// COVERED. What changes is that a read built on nothing may no longer
// condemn a woman, revoke an earned clear, or be written into identity
// memory. In MAN mode it is inert by construction: a null folds to ~0.27,
// far below GENDER_CLEAR_SCORE 0.6, so it could never clear anyone
// anyway. There is no configuration of this that exposes somebody.
// MINIMUM NATIVE FACE PIXELS BEFORE WE ASK faceres ANYTHING.
// faceres is a 224px VGGFace2-family network; the literature floor for
// gender/attribute heads of that class is ~64-100px of face, R10 measured
// the collapse at 33px, and R6's own working footage sat at 58-79px. So 64
// is above every read that has ever worked in this log and below the band
// that produced only noise.
//
// THIS CONSTANT LIVES IN A MODULE FOR A MEASURED REASON, not for tidiness.
// It was a function-local `var FACE_MIN_NATIVE_PX = 64;` inside the boot
// closure in init-entry.js, and esbuild's MINIFIER emitted the declaration
// with NO INITIALIZER — `var IY;` — while the unminified build of the same
// source emitted it correctly. `nativePx < undefined` is false for every
// input, so the gate has never fired in any shipped bundle. R15 caught it
// by reading the emitted bundle after the artifact showed 19 of 55 reads
// below the supposed floor, several of them scoring high enough to CLEAR.
// Module-scope exports here are provably emitted with their values in the
// same bundle (`YE=18` for GENDER_ADULT_AGE), so this is the shape that
// survives. The effective value is also published on the cfg probe, so a
// constant that goes dead again shows up in the next round's artifact
// instead of hiding for six rounds.
export var FACE_MIN_NATIVE_PX = 64;

export var NULL_V_LO = 0.53;
export var NULL_V_HI = 0.72;
export var NULL_AGE_LO = 34;
export var NULL_AGE_HI = 42;

export function isNullRead(face) {
  if (!face || face.gender !== 'male') return false;
  // Older callers (and the abstention path) carry no raw sigmoid; with
  // nothing to test, trust the read rather than inventing a refusal.
  if (typeof face.raw !== 'number' || typeof face.age !== 'number') return false;
  return (
    face.raw >= NULL_V_LO &&
    face.raw <= NULL_V_HI &&
    face.age >= NULL_AGE_LO &&
    face.age <= NULL_AGE_HI
  );
}

export function faceMeta(userGender, faces) {
  var opposite = OPPOSITE[userGender];
  var out = [];
  for (var i = 0; i < (faces ? faces.length : 0); i++) {
    if (!opposite) {
      out.push({ flagged: true, certain: false });
      continue;
    }
    var f = faces[i];
    // Refuse the model's prior before it can become evidence. This lands
    // on exactly the state an unreadable face already gets: covered, but
    // powerless to condemn, revoke a clear, or enter identity memory.
    if (isNullRead(f)) {
      // `abstained` is NOT decoration. A cleared track absorbs an
      // uncertain read for CLEARED_TTL_MS, so folding the null into plain
      // `uncertain` handed it 5s of protection where the certain flag it
      // replaced took 2 reads to revoke — R12 measured 4800ms of sharp
      // against 400ms. person-track keys the revocation streak off this.
      out.push({ flagged: true, certain: false, abstained: true });
      continue;
    }
    var same = f.gender === (opposite === 'female' ? 'male' : 'female');
    var directed = f.gender === 'male' || f.gender === 'female';
    // Child faces: gender untrusted in BOTH directions (see
    // GENDER_ADULT_AGE). Missing age (older callers) trusts the read.
    var adult = isAdultRead(f);
    // A CHILD READ IS AN ABSTENTION, not merely an uncertain flag
    // (gauntlet R18). Both branches below already refuse to CLEAR on a
    // child, and that half was right. The half that was wrong is what a
    // child read did to a track that was ALREADY cleared: it arrived as
    // {flagged:true, certain:false}, which person-track's cleared branch
    // absorbs for CLEARED_TTL_MS = 5000 and which zeroes flagStreak so it
    // can never revoke anything.
    //
    // The comment on that branch asserts a child can never reach it
    // because the age gate blocks EARNING a clear. True for earning,
    // false for INHERITING — a track cleared on an adult that a child
    // walks into, or that re-associates onto a child after a miss. And
    // because a child read is untrusted by construction, it is the
    // maximum-duration absorption case the pipeline can produce.
    //
    // This is the identical shape R12 fixed for null reads: a read we
    // demonstrably cannot trust must not buy MORE protection than the
    // read it replaced. A child read is the one class the code openly
    // declares untrustworthy, and it was the only one not routed there.
    // Two consecutive child reads now demote a cleared track instead.
    if (directed && !adult) {
      out.push({ flagged: true, certain: false, abstained: true });
      continue;
    }
    var certain;
    if (same) {
      // The clear direction pays the high bar (GENDER_CLEAR_SCORE) and
      // must be an adult read.
      certain = directed && adult && f.score >= clearScoreFor(f.gender);
      out.push({
        flagged: !certain,
        certain: certain,
        // One read this confident is enough on its own — see
        // GENDER_INSTANT_CLEAR. Always a strict superset of `certain`.
        instant: certain && f.score >= instantClearScoreFor(f.gender),
        // WEAK SAME-DIRECTION EVIDENCE. Not enough to clear on its own —
        // that is what `certain` is for — but not nothing either, and
        // until S6 it was discarded entirely: a track reading `male` at
        // 0.3-0.55 twenty times in a row accumulated exactly zero clear
        // credit (person-track's uncertain branch only DECAYS), so the
        // man stayed covered for the whole shot.
        //
        // Measured, gauntlet S6, runs/s6-cook-man (5-person studio wide
        // shot, `man` mode, 76 unique reads): certainty tracks FACE SIZE,
        // not correctness. Every read at native px >= 241 scored
        // 0.84-0.95; every read at px 85-174 scored 0.03-0.58, i.e. below
        // GENDER_CLEAR_SCORE. Only ONE of four-to-five tracks per frame
        // ever produced a certain read, and blur-first covered the rest —
        // 16 FALSE COVER instances across 10 frames, all three men in the
        // shot, on the owner's OWN direction.
        //
        // The safety argument is DIRECTION, and it is the same one R6
        // measured and this round reproduced: faceres degrades in
        // CERTAINTY as the face shrinks, not in direction. In this run
        // the 36 non-abstained male reads and the 22 female reads split
        // 3:2 against three men and two women in frame. So the tracker
        // requires GENDER_WEAK_STREAK_N CONSECUTIVE same-direction weak
        // reads and resets on ANY opposite-direction read at any
        // certainty — a woman whose face reads `female` even once inside
        // the window can never accumulate the streak.
        //
        // Deliberately a SUPERSET of `certain`: a certain read must not
        // reset the weak streak it would otherwise satisfy.
        weak: directed && adult && f.score >= GENDER_MIN_SCORE,
      });
    } else {
      certain = directed && adult && f.score >= GENDER_MIN_SCORE;
      out.push({ flagged: true, certain: certain });
    }
  }
  return out;
}

// The image/thumbnail path deliberately does NOT abstain, and this is the
// reasoning rather than an oversight (R12's critic read it as one).
// Abstention exists to stop a no-information read acting as EVIDENCE: it
// must not condemn, revoke an earned clear, or enter identity memory.
// A feed image has none of those — no track, no state machine, no memory.
// Its only question is flagged-or-not, and a null already lands on
// `flagged` here (it is labelled opposite-gender and cannot clear the
// same-gender bar). Abstaining would produce the identical output, and
// the only way to make it produce a DIFFERENT one is to stop flagging —
// which is an exposure. Nothing to fix; do not "fix the class" here.
export function flaggedFaceIndices(userGender, faces) {
  if (!faces || faces.length === 0) return [];
  var opposite = OPPOSITE[userGender];
  var out = [];
  for (var i = 0; i < faces.length; i++) {
    if (!opposite) {
      out.push(i);
      continue;
    }
    var f = faces[i];
    var same = f.gender === (opposite === 'female' ? 'male' : 'female');
    var adult = isAdultRead(f);
    if (!same || !adult || !(f.score >= GENDER_MIN_SCORE)) out.push(i);
  }
  return out;
}
