// Pure verdict logic for the gender stage (protection engine, handoff
// decision #3): the app filters the opposite gender by default. Blur-first
// fail-safe: anything not positively verified same-gender stays covered —
// unknown gender, low confidence, or no declared user gender all flag.
// Threshold registered in docs/detection-engine.md (calibrated against
// the 2026-08-23 portrait set: the Oarriaga model's wrong-gender scores
// reached 0.79, so anything below 0.85 can clear the opposite gender —
// fail-open in the dangerous direction. 0.85 trades over-blur for that
// never happening on the observed set).

export var GENDER_MIN_SCORE = 0.85;

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
