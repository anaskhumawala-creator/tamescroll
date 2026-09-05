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
// THE IMAGE BAR IS NOT THE VIDEO BAR (owner 2026-08-27: "sometimes these
// thumbnail blurs blur the male character as well").
//
// MEASURED on live YouTube search results, 2026-08-27, at the crop scale
// we actually ship (the padding sweep 0.7/0.85/1.0/1.2/1.45 found no
// scale better than 1.0, so a re-read cannot rescue these):
//
//   male-heavy corpus  : 30 face reads, EVERY ONE read `male`
//   female-heavy corpus: 17 face reads, EVERY ONE read `female`
//
// 47 of 47 directionally correct, which reproduces the R6 finding on a
// different surface. What the two corpora do NOT do is separate: male
// confidences ran 0.24-0.95 and female 0.27-0.97. The score is a
// CERTAINTY, not a discriminator, so a bar placed inside the overlap
// rejects true same-gender faces without rejecting opposite-gender ones.
//
// At 0.25 that cost was visible in the corpus: two men read `male` at
// 0.24 and 0.26 -- one of them BELOW the bar by a hundredth -- and both
// were covered. That is the owner's report, exactly.
//
// The one inversion seen anywhere in the sweep was a woman reading
// `male` at confidence 0.04, and only at a crop scale we do not ship.
// So the floor still has a job: it guards the near-coin-flip regime
// where inversions actually live. 0.12 sits between the two -- above
// every observed inversion, below every observed true read.
//
// Image-only, deliberately. GENDER_MIN_SCORE also feeds faceMeta's
// weak/certain split in the video tracker, which twenty-odd gauntlet
// rounds calibrated at 0.25; a thumbnail gets ONE look and no tracker to
// absorb a mistake, so the two surfaces get their own bars.
// RE-MEASURED 2026-08-28, AFTER THE CROP WAS FIXED.
//
// The corpus above was taken through a STRETCHED crop: cropAndResize
// squashes the detector's rectangle into 224x224, so faceres was reading
// a distorted face and its certainty collapsed. Live on m.youtube, one
// clear front-facing man 224px wide read `male` at 0.06 and was covered
// -- the owner's screenshot. With an aspect-preserving crop (detector.js
// `square`) the same page reads male at a 0.76 median.
//
// That separates what the old bar could not. Measured the same day, man
// mode, mobile UA:
//   men, male-heavy queries : median 0.76, individual reads 0.45-0.98
//   WOMEN misread as `male` : 0.16, 0.19, 0.20, 0.20, 0.25, 0.28
// The old 0.12 cleared every one of those women (a yoga thumbnail with
// the subject fully sharp -- exposure, the failure this app exists to
// prevent). 0.4 sits above every observed misread and below the male
// median: some men still get covered, which is the direction that costs
// a blur instead of an exposure.
export var GENDER_IMAGE_MIN_SCORE = 0.4;

// CLEARING is asymmetric (owner frame 2026-08-24: the daughter — a
// child — rendered SHARP while Linus was covered; faceres is trained on
// adults and can read a child's face as confidently wrong): a face may
// count as certainly-SAME-gender (the read that lifts blur) only at
// this much higher certainty. Flagging keeps the low bar — over-blur
// stays cheap, under-blur is the failure that matters.
//
// 0.60 -> 0.45, AND 0.45 -> 0.35 BELOW, 2026-09-01. Both bars were set
// on faces read at NATIVE resolution. His player decodes 640x360 and
// faces reach faceres at px p50 38-62, where the same model is far less
// certain about the same person -- so a bar calibrated at px 200 is a
// bar almost nobody clears at px 45, and every man who fails it is
// covered. That is his standing complaint in one sentence: "the male
// should not be blurred".
//
// PRICED TWICE, BOTH WAYS.
//
// Per READ, on 10 videos of his own regime, 1,494 labelled reads: 0 of
// 701 must-cover reads in man mode cross from covered to clear, 0 of
// 793 in woman mode, and 197 of 793 men (24.8%) newly clear CORRECTLY.
// 95% upper bound on the exposure rate 0.43%.
//
// Over TIME, which is what a user sees, at his measured 1.45s verdict
// cadence with MoveNet admitting nobody (loops 35/36/37):
//
//   man mode      EXPOSURE  FALSECOVER  PHANTOM
//   shipped 1079     38.5s      292.0s   197.0s
//   this + clamp     45.0s      186.5s   172.5s
//   woman mode
//   shipped 1079     39.0s      291.0s   225.0s
//   this + clamp     39.0s      273.5s   216.0s
//
// THE +6.5s IS NOT THE BAR CLEARING A WOMAN. Every frame it uncovers
// was traced: two of them are a woman reading FEMALE 0.71-0.78, a score
// this constant cannot touch, because it gates only the same-gender
// branch. The mechanism is a shot change where her observation
// re-associates onto a stale CLEARED track left by a man in the
// previous shot. scene-gate.mjs wipes tracks on a cut for exactly that
// reason, and with the gate modelled on both sides the cost falls to
// +2.5s.
//
// The direction argument that justified the female bar still holds and
// is what bounds this: faceres is directionally correct even when it is
// uncertain -- across the whole corpus not one man was read female with
// conviction -- so lowering CERTAINTY does not let the opposite gender
// through, it lets the SAME gender through at the sizes his player
// actually produces.
// 0.40 WAS PROPOSED AND REFUSED, 2026-09-05. `bench/dial-sweep.mjs`
// found it free on the corpus -- exposure unchanged on both arms, false
// cover 117.5 -> 114.0s in man mode -- and it BREAKS THE INVARIANT in
// test/gender-verdict.test.mjs: the null band tops out at 2*(NULL_V_HI
// - 0.5) = 0.440, so at a bar of 0.40 an ABSTAINED read is one that
// would have cleared the owner. Man mode would silently start refusing
// reads that lift blur off him -- the exact opposite of what the corpus
// number looked like it was buying. The sweep reads the OTA clamp
// [0.36, 0.90] and cannot see that floor, so its grid is pinned at 0.45
// there; the clamp itself is now the wider of the two and should be
// tightened the next time it is touched.
export var GENDER_CLEAR_SCORE = 0.45;
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
//
// Moved 0.45 -> 0.35 with the male bar above, keeping the same ~0.10
// gap the R6 measurement set. Moving one and not the other would change
// the RELATIVE treatment of the two genders, which no measurement here
// asked for.
export var GENDER_CLEAR_SCORE_FEMALE = 0.35;
// R30 — THE SAFETY ARGUMENT DIRECTLY ABOVE DOES NOT SURVIVE THE CORPUS,
// AND THIS IS THE HIGHEST-VALUE WOMAN-DIRECTION CALIBRATION ITEM OPEN.
// The constant is NOT moved here: moving it blind, from a man-direction
// round, is how a woman-mode regression ships. It is registered.
//
// "he would have to be misread as female first, which was not observed
// once" was true of the window it was written from and is false of the
// corpus. Measured over 204 stored runs (R30 critic), grouping reads
// whose boxes mutually overlap at IoU >= 0.5 -- i.e. the same screen
// position across consecutive passes -- and asking how often a
// female-labelled read shares its position with a CONFIDENT male read:
//
//   female band      n     shares position with a male read >= 0.6
//   [0.80, 1]       380     7.1%
//   [0.70, 0.80)    132    11.4%
//   [0.60, 0.70)    226    26.5%
//   [0.45, 0.60)    427    31.4%   <- admitted by this constant
//
// So the band this bar opens, and ONLY this band, is one where nearly a
// third of reads sit where the model also says male confidently. In
// `woman` mode that band is a CLEAR, so a man read female at 0.45-0.60
// twice is EXPOSURE -- the worst class, in the direction with the least
// data, reachable in two reads.
//
// The two bars are also not symmetric in the way the note above claims.
// Corpus percentiles, 2927 non-abstained female reads and the male
// population beside them: female p25 0.21 / p50 0.42 / p75 0.64;
// male p25 0.50 / p50 0.75 / p75 0.90. The male bar 0.6 sits at male
// p25; the female bar 0.45 sits near female p28 -- close in rank, but
// the female distribution is shifted so far left that the same rank buys
// far weaker evidence.
//
// WHAT WOULD SETTLE IT, and it is a round of its own: run `woman` on
// female-heavy footage and re-derive the bar from the contradiction rate
// rather than from the read distribution.
// AND BOTH BARS ARE, IN PRACTICE, A FACE-SIZE BAR (gauntlet R26).
//
// The constants above are calibrated on certainty, but certainty is
// dominated by how many pixels of face the model was given. Over the
// whole stored corpus — 8,776 reads carrying both `px` and `score`
// across 173 runs — the share of reads reaching 0.6 by native face size:
//
//   64-80px  0.233 | 80-100  0.206 | 100-130 0.300 | 130-180 0.487
//   180-260  0.451 | 260-400 0.713 | 400+     0.591
//
// So a person under ~100px is not judged by a threshold, they are judged
// by their distance from the camera, and CLEAR_STREAK_N 2 CONSECUTIVE
// reads squares it: about one chance in twenty per pair at 74px. That is
// the whole of R26's FALSE COVER 10/10, and it is why the answer is a
// better read on a small face rather than a lower bar on a bad one —
// person-track's S6/R23 block refuses the lower bar twice, and R26's
// crop-scale sweep (see FACE_ENLARGE in detector.js) refuses the free
// version of the better read. What R26 DID ship is the tight crop
// (`cropAnchor`, person-gate), which raises `px` itself rather than
// arguing about the bar it feeds.

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
//
// R23 MOVED THIS FROM 0.9 TO 0.8, AND THE BAR IS NOW DERIVED FROM A
// DISTRIBUTION RATHER THAN ASSERTED. Rotation entry 5 (`4u3jS_cTHH0`,
// Laughter Chefs, 3-4 men + 1 woman in a studio kitchen, `man` mode)
// scored FALSE COVER on 9 of 10 frames -- the worst same-direction score
// in the log -- and a 60s continuous trace put a number on why: 89.7% of
// all track-samples sit `blurred`, and of those only 8.9% carry
// `lv:'clear-certain'`, in episodes whose p50 is 0.41s, i.e. EXACTLY one
// verdict interval. That population is a track that read certain-clear
// and is waiting for a partner read it may not live to receive: track
// lifetime p50 is 1.91s against cuts at 0.87/s.
//
// The two bands over 135 non-abstained reads from that window:
//
//   male score   n    childP range
//   [0.90, 1]    20   0.01 - 0.05
//   [0.85,0.90)   9   0.02 - 0.08
//   [0.80,0.85)   9   0.01 - 0.05
//   [0.75,0.80)  12   0.02 - 0.07
//   [0.70,0.75)   5   0.04 - 0.19   <- the child band starts here
//   [0.60,0.70)  12   0.04 - 0.17
//
// 0.8 is the LOWEST bar at which the band's maximum childP (0.08) still
// sits below the minimum childP ever measured on a known 8-year-old
// (0.15-0.72, median 0.42, gauntlet R18). 0.75 is REFUSED: [0.70,0.75)
// reaches childP 0.19, which is inside that child band, and S6's whole
// derivation is that the age gate and the certainty gate are not
// independent. This move keeps them independent -- it is a change
// strictly ABOVE the `certain` bar of 0.6, not a relaxation into the
// weak band S6 measured a child living in.
//
// ^^ R30: THE SENTENCE REFUSING 0.75 IS ARITHMETICALLY WRONG AND THE BAR
// IS STILL CORRECT AT 0.8 FOR A DIFFERENT REASON. Both halves matter,
// because the wrong sentence was about to be used to justify moving it.
//
// The error: `instant` is `score >= instantClearScoreFor(...)`, so a BAR
// of 0.75 admits [0.75, 1] and does NOT admit [0.70,0.75). The band the
// refusal cites is a band the bar excludes. Re-derived on 5x the data
// (639 non-abstained reads on this same video against the 135 above),
// [0.75,0.80) is n=30, childP 0.02-0.07, with ZERO reads above the R18
// child minimum. On the criterion as stated, 0.75 is admissible.
//
// The criterion itself is what fails. Corpus-wide over 204 runs, male
// reads passing the child gate: [0.90,1] n=1731 with FOURTEEN above the
// R18 child minimum (max childP 0.190); [0.85,0.90) n=622 with zero;
// [0.80,0.85) n=493 with zero; [0.75,0.80) n=489 with two. The set 0.8
// already admits contains more child-band reads than the set 0.75 would
// add. The criterion cannot separate the two bars at all.
//
// AND THE REASON TO LEAVE THE CONSTANT ALONE, which the original comment
// never stated: the score carries no accuracy signal anywhere above 0.6.
// Grouping reads by screen position (IoU >= 0.7 across consecutive
// passes) and asking how often a male read shares its position with a
// CONFIDENT female read: [0.90,1] 5.0% (n=1321); [0.80,0.90) 1.4%
// (n=622); [0.75,0.80) **0.0%** (n=317); [0.60,0.75) 1.3% (n=766). The
// band being refused is CLEANER than the band being admitted. Lowering
// the bar would not be more dangerous than 0.8 -- it would extend a
// mechanism whose accuracy justification the corpus does not support.
//
// So: do not move this constant on band arithmetic, in either
// direction. What would settle it is hand-labelling the ~66 high-score
// contradiction groups (they concentrate in `NWoT1ZVd1Lo` and
// `KAWvDsghyc8`) as one-person or two-person -- read boxes are
// person-scale, so a group could hold two people. If they are one
// person, the instant path is unjustified at EVERY bar and should be
// narrowed rather than widened.
//
// The opposite-gender margin on the same corpus: no `female`-labelled
// read anywhere in the window exceeds 0.59. Nothing was within 0.2 of
// the new bar in the wrong direction.
//
// The cost of being wrong is bounded and named: a woman misread `male`
// at >= 0.8 with childP < 0.25 clears on one read instead of two, so the
// exposure window is one verdict interval (~400ms) longer than it was.
// That is why the bar was not taken to 0.75 for the extra 12 reads.
// Effect on the population: instant-eligible male reads go 18% -> 34%.
export var GENDER_INSTANT_CLEAR = 0.8;
// The female bar is deliberately set ABOVE every female read observed in
// R6 (0.22-0.67, median 0.54, n=5), which means it effectively never
// fires in woman mode. That is honest rather than symmetric: five
// samples is not a distribution, and guessing a female instant bar low
// enough to be useful would risk clearing a MISREAD MAN instantly, which
// is EXPOSURE — the worst class — in the direction we have least data
// for. Woman mode therefore keeps the two-read streak until a
// woman-direction run on female-heavy footage measures the real band.
// Registered as R10's calibration item.
//
// ^^ R30: "EFFECTIVELY NEVER FIRES" IS FALSE, AND IT HAS BEEN FALSE FOR
// TWENTY ROUNDS. It was an n=5 claim and the corpus refutes it by 574
// reads. Over 2927 non-abstained female-labelled reads: p25 0.21, p50
// 0.42, p75 0.64, p90 0.84, max 0.99 -- 574 of them reach 0.70, across
// 12 videos and 77 runs. Restricted to `woman` mode: n=1345, of which
// 298 (22.2%) are >= 0.70 and 270 of those pass the child gate. Since
// `clearScoreFor('female')` is 0.45 every one of them is already
// `certain`, so `instant` IS being set on roughly a fifth of woman-mode
// same-gender reads, against R23's measured 34% in `man`.
//
// The constant is not moved. What changes is that no future round may
// argue "this is a man-only path, so the fix is asymmetric" -- woman
// mode has an instant path at about two-thirds the man-mode rate and has
// had one all along.
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
// THE HEADROOM ABOVE IS GONE, AND THE RANKING IS INVERTED ON THE ONE
// PAIR THAT WAS MEASURED NEXT (gauntlet R25). Recorded, not acted on —
// changing this constant trades an adult woman against an eight-year-old
// and that is the owner's call, not a round's.
//
// R25, g_2Wmzpx47I t=20-35, an adult woman (a 21-year-old professional
// footballer), 48 distinct live reads through the shipped crop path:
// childP 0.49-0.94, median ~0.79, age 10-22, and the age posterior is
// PEAKED, not diffuse (peak bin 9-14 carrying 0.20-0.48 of the mass,
// entropy 2.1-3.3 nats). That is five times the 0.18 this comment calls
// the adult ceiling. In `woman` mode it covered her on 10 of 10 frames
// with cs 0 / cm 0 throughout — she has no path to a clear at all,
// which is bar item 2 ("not a single frame where the wrong gender is
// blurred up") failing on the video's primary subject, permanently.
//
// The control, same build, same sweep, run against a KNOWN 12-year-old
// (NWoT1ZVd1Lo t=566, the child this project has covered since R10),
// over seven crop enlargements from 0.55x to 1.9x of the detected face:
// childP 0.146-0.194, age 28-35. The adult reads CHILD and the child
// reads ADULT, on the same model, on the same day. GENDER_CHILD_MASS
// separates them the wrong way round, and the classroom band this
// comment is calibrated on (boy 0.15-0.72, teacher 0.09-0.18) sits
// entirely inside the adult woman's range.
//
// So it is not a threshold that wants nudging: the age head's answer on
// these two faces is not ordered by age. Any move of this constant that
// frees her also frees the classroom boy, which is the exact trade R18
// refused. Sweep in spikes/gauntlet/agecrop.py if it is ever revisited.
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
// DELEGATES, because nothing in `src/` calls this and `flaggedFaceIndices`
// is what the image path actually runs (`init-entry.js:800`). It carried
// a byte-for-byte copy of that predicate and twenty tests, so for as long
// as it existed the tests were pinning a SECOND implementation that
// shipped to nobody -- and the two could drift apart silently, which is
// the crop-geometry defect that lived four days across three model swaps.
// Deleting it would throw away the tests; delegating keeps them pointed
// at the live rule.
export function faceVerdict(userGender, faces) {
  if (!faces || faces.length === 0) return 'clear';
  return flaggedFaceIndices(userGender, faces).length ? 'flag' : 'clear';
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
//
// 64 -> 40, AND THE OWNER RULED IT ON MEASUREMENT (2026-09-01). Every
// argument above is about which sizes had ever WORKED in this log; none
// of it isolated resolution, because nothing had ever fed the same face
// to the model twice at two sizes. That experiment now exists
// (app/gaze/bench/small-face.js, run on his phone): 28 real faces
// detected at >=150 native px, each re-read after being resampled down
// and handed over as the whole frame, which is exactly what the
// pipeline sees when a face is natively that big.
//
//   native px      32    40    48    56    64    72    88   112   160
//   agrees w/ full 1.00  1.00  1.00  1.00  1.00  1.00  1.00  1.00  1.00
//   CERTAIN+wrong     0     0     0     0     0     0     0     0     0
//   score p50      0.76  0.78  0.81  0.83  0.85  0.87  0.87  0.85  0.86
//
// 28 of 28 agree at every size down to 32px. So the collapse this floor
// was drawn around is not a resolution effect, and the men he keeps
// reporting as blurred were being refused for a reason that does not
// hold: on his phone, facePx p50 74 with a MIN of 53, so every read in
// that tail abstained and failed closed.
//
// THE FAILURE THIS GATE ACTUALLY PREVENTS IS REAL AND IS NOT ABOUT SIZE.
// 34 crops from thumbnails where BlazeFace found nothing read CERTAIN
// (score >= GENDER_MIN_SCORE) 38-53% of the time -- the confident null
// answer this comment predicted -- and that rate is FLAT in size: 11 of
// 34 at 160px against 18 of 34 at 32px. A size floor cannot catch it.
// `isNullRead` can and does: 30-33 of those same 34 land in its band.
//
// So 40 rather than 32: it keeps a margin under every measured read
// while staying above the point where a face is a handful of pixels,
// and it leaves the null band as the gate on the axis that matters.
export var FACE_MIN_NATIVE_PX = 40;

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

// THE DESCRIPTOR'S MAGNITUDE IS THE ONLY SIGNAL IN THIS PIPELINE THAT IS
// ABOUT THE CROP RATHER THAN ABOUT THE ANSWER.
//
// `isNullRead` decides on the sigmoid, which is the same number the
// verdict uses -- so a read it refuses is a read the verdict could not
// have used anyway, and it cannot tell a graphic from a person the model
// simply found hard. That distinction did not matter while a null read
// still produced a patch. It decides everything now that it can refuse
// one, and a critic found the exposure in the first version of this
// gate: a real woman in this repo's own ground-truth control arm
// (small-face-2026-09-01, reference read px 206 female) lands in the
// band at 32px and again at 48px -- which is the modal face size in his
// player. Refusing her birth leaves her sharp.
//
// `nm` is faceres' descriptor magnitude BEFORE L2-normalisation: how
// much the network extracted, not which way it leaned. It has ridden in
// every read ring since R22 and was never analysed. MEASURED:
//
//   his phone, live, 300 reads   nm p50 12.66 clearing / 2.88 null
//   corpus, 6,281 video reads    male in-band 3.87 / out-of-band 11.40
//                                female 11.78
//   corpus, by CROP quality      fc>=0.85 & px>=120  p50 11.99
//                                fc<=0.55 & px<=80   p50  4.23
//
// And it is NOT the sigmoid restated: inside a narrow v slice the
// correlation with |v-0.5| collapses to -0.21..+0.30.
//
// So the birth refusal is conditioned on BOTH. Every read the floor
// exempts goes back to minting a patch, i.e. to the behaviour that
// shipped before this gate existed -- the condition is monotone toward
// COVERING and cannot introduce an exposure the previous build did not
// already have.
//
// THE FLOOR NO LONGER REFUSES ANYTHING. It feeds two counters, and the
// reason it stopped is an EXPOSURE I shipped and a critic found.
//
// Refusing the BIRTH looked safe because a live track is still refreshed.
// A track DIES -- coast expiry (`coastExpired` 12 in one phone run) or a
// cut plus wipeIfEmpty -- and coming back needs a birth. The tag is a
// property of CONTENT, so it lands on the same subject every pass and the
// refusal is PERMANENT. Reproduced against the real tracker: 40 tagged
// passes after a death leave 0 tracks; one UNtagged pass covers her.
// person-track.mjs carries the table. Third build of this gate to ship an
// exposure, and the argument "monotone toward covering" was true of floor
// 5 against floor 6 and false of gate against no gate.
//
// RETRACTED, MINE: "6 would have refused a real woman five times." All
// five refused reads are ONE MAN (`RcGyVTAoXEU`, ref male at 231px, nm
// 5.11-5.85 across every size). The woman in the band (`X0Qyuw5ietg`,
// ref female at 206px) reads nm 9.93 and 11.48 and is not refused at 5,
// 6, 8 or 9 -- she first appears at floor 10. So the 6 -> 5 move bought
// her nothing and cost 12 in-band non-face reads. It still refuses a real
// face, which is an exposure in the mode where that person is covered,
// but the reason on record was fabricated.
//
// AND THE EVIDENCE IS THINNER THAN IT LOOKED. The gate is an AND, so only
// IN-BAND reads are eligible: 7 of 125 face reads, from TWO subjects, and
// 403 of 425 non-face reads from 22 thumbnail ids. In that region the
// arms OVERLAP -- real faces min 5.11, non-faces max 6.66 -- so the
// "factor of two apart" figure was computed over the whole arm, 118
// reads of which the gate can never touch.
//
//   floor | real FACE reads | faces wholly | in-band NON-FACE reads
//       4 |          0 of 7 |       0 of 2 |   361 of 403   89.6%
//       5 |          0 of 7 |       0 of 2 |   388 of 403   96.3%
//       6 |          5 of 7 |       1 of 2 |   400 of 403   99.3%
//
// WHAT SURVIVES, and it is why the tag stays: `nm` is faceres' descriptor
// magnitude before L2-normalisation -- how much the network extracted,
// not which way it leaned -- and it is NOT the sigmoid restated (inside a
// narrow v slice its correlation with |v-0.5| collapses to -0.21..+0.30).
// On his phone, live, 300 reads: nm p50 12.66 on reads that clear, 2.88
// on null reads. 89 of 300 reads carry no signal and each one mints a
// patch, which is his "random blur marks here and there" quantified.
//
// The next build is a BOUNDED refusal -- refuse at most one consecutive
// birth, so a transient graphic is refused and a real person is covered
// one pass later. `nullWouldDrop` against `nullMatched` is what says
// whether it is worth the state it needs.
export var NULL_MINT_NM_FLOOR = 5;

// THE SAME FLOOR, FOR THE THUMBNAIL PATH, ON ITS OWN DIAL.
//
// Both paths refuse a no-signal read and both used one number, which
// meant a revert of one was a revert of BOTH -- and they are not the
// same trade. The video path refuses a BIRTH, so a face inside an
// already-admitted person box is still covered and the cost is bounded.
// The image path has no second chance: a thumbnail with one mark on it
// goes to zero marks and the picture is sharp.
//
// MEASURED, on finding 52's own 370 thumbnails, replaying the SHIPPED
// rule (`bench/image-guard-shipped.mjs`):
//
//   marks 258 -> 198   junk 47 -> 16 (-66%)   real 211 -> 182 (-13.7%)
//   thumbnails that go from covered to COMPLETELY UNCOVERED:  16 of 370
//
// That last row is the exposure and finding 52 said it could not compute
// it. 4.3% of thumbnails. It is a protection trade, so it is his, and
// this dial is how he takes it back without also giving up the video
// path's guard.
export var GENDER_IMAGE_NM_FLOOR = 5;

/**
 * May this read create a patch? False for everything except a null read
 * whose crop also carried no descriptor signal.
 *
 * A MISSING norm never refuses. The image path strips `shape` before it
 * crosses the worker boundary, and an in-page fallback verdict may carry
 * an older shape; in both cases the honest answer is "no evidence to
 * refuse on", and this project's default when it has no evidence is to
 * cover.
 */
/**
 * Did this crop carry descriptor signal at all?
 *
 * The MIRROR of `mayNotMint`, and the asymmetry is deliberate. A missing
 * `norm` means "no evidence to refuse on", so `mayNotMint` answers false
 * and the read keeps its power to MINT -- this project covers when it
 * has no evidence. This predicate is asked in the opposite direction: it
 * gates whether a cleared face may pull a neighbour's patch edge back,
 * which REDUCES coverage. So a missing norm must answer false here too,
 * and both refusals point the same way.
 */
export function hasDescriptorSignal(face) {
  var nm = face && face.shape ? face.shape.norm : null;
  if (typeof nm !== 'number' || !isFinite(nm)) return false;
  return nm >= NULL_MINT_NM_FLOOR;
}

function imageHasNoSignal(face) {
  var nm = face && face.shape ? face.shape.norm : null;
  if (typeof nm !== 'number' || !isFinite(nm)) return false;
  return nm < GENDER_IMAGE_NM_FLOOR;
}

function mayNotMint(face) {
  var nm = face && face.shape ? face.shape.norm : null;
  if (typeof nm !== 'number' || !isFinite(nm)) return false;
  return nm < NULL_MINT_NM_FLOOR;
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
    // ADULT FIRST. This is the loop-37b ordering defect, and it became
    // load bearing the moment the null branch started deciding whether a
    // patch exists at all instead of merely how it behaves. A null read
    // has its age head pinned at the training prior (~36.9), which is
    // INSIDE NULL_AGE_LO..HI by construction -- so a child carrying no
    // signal reads as a null read, and refusing HER birth is exactly the
    // exposure that got the first attempt at this gate reverted whole.
    var adult = isAdultRead(f);
    if (adult && isNullRead(f)) {
      // `abstained` is NOT decoration. A cleared track absorbs an
      // uncertain read for CLEARED_TTL_MS, so folding the null into plain
      // `uncertain` handed it 5s of protection where the certain flag it
      // replaced took 2 reads to revoke — R12 measured 4800ms of sharp
      // against 400ms. person-track keys the revocation streak off this.
      //
      // `nullRead` is the SECOND consumer of the same fact, and it is a
      // different question from `abstained`. `abstained` says what this
      // read may do to a track that already exists; `nullRead` says
      // whether it may CREATE one. A null read is the model's prior, and
      // a prior is not evidence that anybody is there -- so it may keep
      // a patch alive and may never mint one.
      //
      // MEASURED, on the two control arms this repo banked
      // 2026-09-01, at the sizes his player actually produces (32-64px):
      // real men read score p05/p50 0.335/0.814, non-faces read
      // p50/p95 0.234/0.352, and his own 41 player reads read p50 0.23 --
      // his male population IS the non-face population to three decimals.
      out.push({ flagged: true, certain: false, abstained: true, nullRead: mayNotMint(f) });
      continue;
    }
    var same = f.gender === (opposite === 'female' ? 'male' : 'female');
    var directed = f.gender === 'male' || f.gender === 'female';
    // Child faces: gender untrusted in BOTH directions (see
    // GENDER_ADULT_AGE). Missing age (older callers) trusts the read.
    // `adult` is computed above, ahead of the null branch -- see the note
    // there for why the ordering is not cosmetic.
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
      // `childAbstain` NAMES THE ONE ABSTENTION THAT MAY NEVER BE
      // FORGIVEN. person-track's clear grace refuses every abstention
      // today, and its comment gives the reason exactly: "the age gate
      // returns a CHILD as an abstention, so any grace here would be a
      // grace for children." That reason is right and it is about THIS
      // branch only -- the null branch above is a face we could not
      // read, which is the same situation the grace already forgives.
      // Without this flag the two are indistinguishable downstream and
      // the child forces the unreadable adult to be refused too.
      out.push({ flagged: true, certain: false, abstained: true, childAbstain: true });
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
/**
 * Did the image null guard refuse this read a patch?
 *
 * ONE copy of the predicate, because the caller needs to COUNT what it
 * refused and a second hand-written copy of a three-term rule is the
 * crop-geometry defect that lived four days across three model swaps.
 * `flaggedFaceIndices` asks it to decide; the image path asks it again
 * only to report, and neither can drift from the other.
 *
 * ADULT FIRST -- the loop-37b ordering defect. A null read has its age
 * head pinned at the training prior (~36.9), which is inside
 * NULL_AGE_LO..HI by construction, so a CHILD carrying no signal reads
 * as a null read and refusing her patch is the exposure that got the
 * first version of the video-side gate reverted whole.
 */
export function refusedByNullGuard(face) {
  return !!face && isAdultRead(face) && isNullRead(face) && imageHasNoSignal(face);
}

/** How many of these reads the null guard refused a mark. Reporting only. */
export function countRefusedByNullGuard(faces) {
  var n = 0;
  for (var i = 0; i < (faces ? faces.length : 0); i++) {
    if (refusedByNullGuard(faces[i])) n++;
  }
  return n;
}

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
    // A READ THAT CARRIED NO SIGNAL MAY NOT MINT A PATCH HERE EITHER.
    //
    // The video path has refused this since 1079 (`faceMeta`:
    // `adult && isNullRead(f)` -> `nullRead: mayNotMint(f)`, and
    // person-track will not create a track from it). The thumbnail path
    // never got it, and the asymmetry is not academic: `score` is
    // `2|raw - 0.5|`, so a null read at raw ~0.62 folds to ~0.24, FAILS
    // the 0.4 bar, and is therefore FLAGGED. A patch is drawn on a crop
    // the model said nothing about -- which is phantom, on the feed,
    // and phantom is the complaint he has repeated most.
    //
    // ADULT FIRST, which is the loop-37b ordering defect: a null read
    // has its age head pinned at the training prior (~36.9), inside
    // NULL_AGE_LO..HI by construction, so a CHILD carrying no signal
    // reads as a null read. Refusing her patch is the exposure that got
    // the first version of the video-side gate reverted whole.
    //
    // MEASURED BEFORE IT WAS BUILT (`bench/image-null.mjs`), on the two
    // ground-truth arms this repo banked 2026-09-01 -- 85 corner crops
    // from thumbnails where BlazeFace found nothing, and 25 real faces,
    // each re-read at nine sizes:
    //
    //   non-face flags removed        461 of 501   (92.0%)
    //   REAL FACE flags removed         0 of  99
    //   opposite-gender uncovered       0 of 141
    //
    // The nm floor is what makes that second row zero: real faces read
    // nm >= 6.19 at every size, non-faces cluster near 2-4, and the
    // floor is 5. HONEST LIMIT: the non-face arm is crops where the
    // detector found NOTHING, force-read. In production gender only runs
    // on boxes BlazeFace produced, so 92% is the refusal rate on
    // face-free crops and not a prediction of how many of his patches
    // will disappear.
    //
    // REVERSIBLE WITHOUT AN INSTALL: `NULL_MINT_NM_FLOOR` is on the OTA
    // channel clamped [0, 5.5], and 0 refuses nothing at all.
    if (refusedByNullGuard(f)) continue;
    if (!same || !adult || !(f.score >= GENDER_IMAGE_MIN_SCORE)) out.push(i);
  }
  return out;
}

// OTA tuning setters. src/tuning.mjs owns the range and the clamp for
// each of these; nothing else may write them.
export function setClearScore(v) { GENDER_CLEAR_SCORE = v; }
export function setClearScoreFemale(v) { GENDER_CLEAR_SCORE_FEMALE = v; }
export function setNmFloor(v) { NULL_MINT_NM_FLOOR = v; }
export function setImageNmFloor(v) { GENDER_IMAGE_NM_FLOOR = v; }

// ---------------------------------------------------------------------
// TRACK-MEAN: average a person's gender reads instead of trusting the
// latest one.
//
// WHY IT IS WORTH A DIAL. Offline, over the 2,159 labelled reads on his
// own corpus regrouped by identity, averaging a track's raw sigmoids
// takes false cover on men from 18.2% to 5.9% at matched exposure and
// AUC from 0.9855 to 0.9964 -- a bigger win than grey, than mirror, and
// than every head retrain this repo has tried, for ZERO extra inference.
// faceres reads the same face at 0.31, 0.88, 0.44, 0.79 across four
// passes; the mean of those is the answer and every single one of them
// is noise.
//
// WHY IT IS OFF BY DEFAULT. That regrouping used the LABELS to decide
// which reads belong to one person. The shipped tracker uses IoU, and it
// mis-associates -- every mis-associated read pollutes a mean that then
// persists for the life of the track, where a single bad read today is
// forgotten on the next pass. The offline arm breaks even at roughly 10%
// mis-association and nobody has measured the real rate. This ships at 0
// so the measurement can be made with the REAL association, on the real
// tracker, by flipping one dial.
//
// THE PRIOR IS NOT DECORATION. `m0` pseudo-observations at 0.5 are what
// stop the first read of a track becoming the whole mean. Without it a
// track's first read carries the same weight it does today AND becomes
// permanent, which measured as a 9.1% exposure leak: one weak
// same-direction read on a new subject clears her for the life of the
// track. At m0 = 1 the first read is halved toward the coin flip and it
// takes two agreeing reads to reach where one read sits today.
//
// MEASURED AND REFUSED, 2026-09-05, on two independent instruments.
// NOT on the OTA channel and it must not be put there: it is a REFUSED
// arm kept as an instrument, and a tunable is a promise that a pushed
// number is safe. `bench/track-mean-ab.mjs` runs it end to end through
// the shipped tracker at matched exposure, and it loses on both arms:
//
//   man   : false cover 117.5s -> 175.5s  (at 16.0s exposure vs 13.5s)
//   woman : false cover 181.0s -> 307.5s  (exposure matched exactly)
//
// The cause is measured too, in a clean worktree, against the hand
// clusters: the shipped IoU association is 27.9% MIS-ASSOCIATED per
// read (95% CI over identities [19.3%, 39.1%]), nearly three times the
// ~10% the offline arm breaks even at. 43 of 107 tracks mix identities
// and one carries nine distinct people over 43 reads. AUC falls
// monotonically as the window grows -- 0.9843 single read, 0.9806 at
// K=2, 0.9594 at K=all -- while the ORACLE grouping's rises, which is
// the whole story in one line: the grouping degrades with exactly the
// window length that makes averaging valuable, and the curves cross
// below K=2.
//
// It gets worse, not better, with track age (31.2% at age 15+ against
// 20.0% at birth): a long-lived track here is not an established
// identity, it is a track that has been absorbing whoever stands in
// that part of the frame. `demoteTracks` keeps the id across a scene
// cut, so a mean rides straight through a shot change; resetting on the
// cut moves K=all from 44.9% to 31.9% and still loses.
//
// AND THE OFFLINE HEADLINE WAS OVERSTATED BEFORE ANY OF THAT. The
// 18.2% -> 5.9% that motivated this was ACAUSAL (it averaged a person's
// whole run, including frames the tracker has not seen yet) and fitted
// a bar to 51 numbers. The causal trailing mean an app can actually
// compute buys 5.4 points, saturating at K=4 -- which the read noise's
// own autocorrelation predicts, since it decorrelates by lag 4.
export var GENDER_TRACK_MEAN = 0;
export var GENDER_TRACK_MEAN_M0 = 1;

/** Is the dial on? Clamped [0,1] by tuning.mjs; >= 0.5 is on. */
export function trackMeanOn() {
  return GENDER_TRACK_MEAN >= 0.5;
}

/**
 * The shrunk mean. `sum`/`n` are the track's accumulated raw sigmoids;
 * the prior adds GENDER_TRACK_MEAN_M0 pseudo-reads at 0.5.
 *
 * Returns null when there is nothing to average, so a caller cannot
 * mistake the bare prior (0.5, which is the null read's own value) for
 * evidence.
 */
export function trackMeanRaw(sum, n) {
  if (!(n > 0) || typeof sum !== 'number' || !isFinite(sum)) return null;
  var m0 = GENDER_TRACK_MEAN_M0;
  return (sum + 0.5 * m0) / (n + m0);
}

/**
 * Re-derive a verdict from a track's mean raw sigmoid.
 *
 * ONE COPY OF THE BARS. This does NOT re-implement the clear bar, the
 * weak bar, the child gate or the null band -- it synthesises the face
 * the mean describes and hands it to faceMeta, which is the same
 * function the single-read path calls. A second hand-written copy of
 * that ladder is the crop-geometry defect, and this file's own history
 * says every field a builder drops makes its consumer unreachable.
 *
 * `face` supplies AGE and DESCRIPTOR MAGNITUDE from the CURRENT read,
 * deliberately: the mean is evidence about this person's GENDER across
 * passes, while whether the face in front of the camera right now is a
 * child, or carries any descriptor signal at all, is a fact about this
 * frame. Averaging those would let one adult pass forgive a child read.
 */
export function metaFromMean(userGender, mean, face) {
  if (typeof mean !== 'number' || !isFinite(mean)) return null;
  var syn = {
    gender: mean > 0.5 ? 'male' : 'female',
    // The same transform face-decode applies to a real read, so the
    // synthetic score lands on the same scale the bars were calibrated
    // on. Capped at 0.99 there; capped here.
    score: Math.min(0.99, 2 * Math.abs(mean - 0.5)),
    age: face ? face.age : undefined,
    childP: face ? face.childP : undefined,
    raw: mean,
    shape: face ? face.shape : null,
  };
  return faceMeta(userGender, [syn])[0];
}

// BENCH-ONLY, like person-track's `setAssign`. See the refusal above.
export function setTrackMean(v) { GENDER_TRACK_MEAN = v; }

// BENCH-ONLY, and deliberately NOT on the OTA channel. m0 is the shape
// of an estimator, not an exposure dial, and the tuning whitelist exists
// so a pushed number cannot change what the code does -- only how far.
export function _setTrackMeanM0(v) { GENDER_TRACK_MEAN_M0 = v; }
