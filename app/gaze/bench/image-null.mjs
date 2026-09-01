// THE THUMBNAIL PATH HAS NO NULL-READ GUARD, AND THE VIDEO PATH HAS HAD
// ONE SINCE 1079.
//
// `faceMeta` (video) refuses to MINT on a read that carried no signal:
// `adult && isNullRead(f)` sets `nullRead: mayNotMint(f)`, and
// person-track will not create a track from it. The reasoning is in that
// file: faceres does not fail loudly, it returns its PRIOR, and a prior
// is not evidence that anybody is there.
//
// `flaggedFaceIndices` (thumbnails -- and NOT `faceVerdict`, which
// nothing in src/ calls) tests only
// `same-gender && adult && score >= GENDER_IMAGE_MIN_SCORE`. So on a
// thumbnail a null read is FLAGGED -- because `score = 2|raw - 0.5|`
// folds a null at raw ~0.62 to ~0.24, which fails the 0.4 bar. **A patch
// is drawn on a crop the model said nothing about.** That is phantom, on
// the feed, which is the complaint he has repeated most ("random blur
// marks here and there").
//
// Only the very top of the band escapes: the bar clears at raw >= 0.70,
// and the band ends at 0.72, so 0.020 of a 0.190-wide band.
//
// THIS FILE MEASURES BOTH HALVES BEFORE ANYTHING IS BUILT, on ground
// truth this repo already banked and NOT on the corpus:
//
//   BENEFIT  non-face crops (85 corner crops from thumbnails where
//            BlazeFace found nothing) that are flagged today and would
//            stop being flagged. Each one is a patch on nothing.
//   COST     real faces (25, re-read at nine sizes) that are flagged
//            today and would stop being flagged. Each one is a face the
//            guard uncovers -- EXPOSURE if it is opposite-gender, which
//            is the only reason the nm floor exists.
//
// Run: node bench/image-null.mjs [gender]
import fs from 'fs';
import {
  flaggedFaceIndices, isNullRead, NULL_MINT_NM_FLOOR, GENDER_IMAGE_MIN_SCORE,
} from '../src/gender-verdict.mjs';

const G = process.argv[2] || 'man';
const P = new URL('../../../spikes/gauntlet/', import.meta.url);
const face = JSON.parse(fs.readFileSync(new URL('nmtruth-face.json', P), 'utf8'));
const nonface = JSON.parse(fs.readFileSync(new URL('nmtruth-nonface.json', P), 'utf8'));

// The banked series call it `child` and carry nm at the top level; the
// shipped predicates read `childP` and `shape.norm`. Convert rather than
// loosening the predicates -- an arm that has to relax the code it is
// testing is testing something else.
const asFace = (s) => ({
  gender: s.gender,
  score: s.score,
  raw: s.raw,
  age: s.age,
  childP: s.child,
  shape: { norm: s.nm },
});

// The proposed guard, stated once so both arms use the same words.
const wouldRefuse = (f) => {
  const adult = !(typeof f.childP === 'number' && f.childP >= 0.25)
    && (typeof f.age !== 'number' || f.age >= 18);
  const nm = f.shape && f.shape.norm;
  return adult && isNullRead(f)
    && typeof nm === 'number' && isFinite(nm) && nm < NULL_MINT_NM_FLOOR;
};

const SIZES = [32, 40, 48, 56, 64, 80, 100, 120, 160];

function arm(rows, label) {
  const out = [];
  for (const px of SIZES) {
    let n = 0, flagged = 0, refused = 0, refusedOfFlagged = 0;
    for (const r of rows) {
      for (const s of r.series) {
        if (s.px !== px) continue;
        n++;
        const f = asFace(s);
        const isFlag = flaggedFaceIndices(G, [f]).length > 0;
        if (isFlag) flagged++;
        if (wouldRefuse(f)) {
          refused++;
          if (isFlag) refusedOfFlagged++;
        }
      }
    }
    if (n) out.push({ px, n, flagged, refused, refusedOfFlagged });
  }
  console.log(`\n${label}`);
  console.log('  px    n   flagged today   guard refuses   of those, FLAGGED');
  for (const r of out) {
    console.log('  ' + String(r.px).padEnd(5) + String(r.n).padStart(3)
      + String(r.flagged).padStart(14) + String(r.refused).padStart(16)
      + String(r.refusedOfFlagged).padStart(20));
  }
  return out;
}

console.log(`gender=${G}   GENDER_IMAGE_MIN_SCORE ${GENDER_IMAGE_MIN_SCORE}   `
  + `NULL_MINT_NM_FLOOR ${NULL_MINT_NM_FLOOR}`);
console.log(`face rows ${face.rows.length}   non-face rows ${nonface.nullRows.length}`);

const nf = arm(nonface.nullRows, 'NON-FACE (a flag here is a patch on nothing = PHANTOM)');
const fa = arm(face.rows, 'REAL FACES (a refusal here UNCOVERS a face = the cost)');

const sum = (a, k) => a.reduce((x, r) => x + r[k], 0);
console.log('\nTOTALS across all sizes');
console.log(`  non-face: ${sum(nf, 'refusedOfFlagged')} of ${sum(nf, 'flagged')} `
  + `flags removed (${(100 * sum(nf, 'refusedOfFlagged') / Math.max(1, sum(nf, 'flagged'))).toFixed(1)}%)`);
console.log(`  real face: ${sum(fa, 'refusedOfFlagged')} of ${sum(fa, 'flagged')} `
  + `flags removed -- every one of these is a face going sharp`);

// THE ONE THAT DECIDES IT. A refusal only costs EXPOSURE when the face
// is opposite-gender; a same-gender face was going to be cleared anyway.
let oppRefused = 0, oppTotal = 0;
for (const r of face.rows) {
  const refG = r.ref && r.ref.gender;
  const opp = G === 'man' ? 'female' : 'male';
  for (const s of r.series) {
    const f = asFace(s);
    if (refG === opp) {
      oppTotal++;
      if (wouldRefuse(f) && flaggedFaceIndices(G, [f]).length > 0) oppRefused++;
    }
  }
}
console.log(`\n  OPPOSITE-GENDER faces (by their own native-resolution reference read):`);
console.log(`  ${oppRefused} of ${oppTotal} reads would be uncovered by the guard.`);
console.log('  This is the exposure number, and it is the only one that can veto.');
