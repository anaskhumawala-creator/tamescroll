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

var OPPOSITE = { man: 'female', woman: 'male' };

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
    if (!same || !(f.score >= GENDER_MIN_SCORE)) return 'flag';
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
    if (!same || !(f.score >= GENDER_MIN_SCORE)) out.push(i);
  }
  return out;
}
