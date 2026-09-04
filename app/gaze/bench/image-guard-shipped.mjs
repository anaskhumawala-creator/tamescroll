// DID 1104 ACTUALLY CHANGE WHAT THE THUMBNAIL PATH DRAWS?
//
// The image null guard was live in `flaggedFaceIndices` and DEAD on the
// worker image path: worker-entry trimmed each read to
// {gender, score, age, childP, px}, and both of the guard's predicates
// fail OPEN on a missing field -- `isNullRead` trusts a read carrying no
// `raw`, `mayNotMint` refuses nothing without `shape.norm`. So the rule
// never threw, never logged, and never fired.
//
// This replays finding 52's OWN population -- 370 real thumbnails off 14
// searches, hq720 normalised to 640x360, banked through the full shipped
// chain -- against the SHIPPED verdict rule, twice:
//
//   1103  the read as the old worker reply delivered it   (guard dead)
//   1104  the read as `imageRead` delivers it             (guard live)
//
// Nothing here re-derives the rule. `flaggedFaceIndices` and `imageRead`
// are imported from src/, so if either changes this bench changes with
// it -- an instrument that re-implements a shipped rule is a check that
// cannot fail, and this repo has written three of those.
//
// JUNK vs REAL, and it is finding 52's definition, not a new one: a mark
// on a PERSON-FREE-SEARCH thumbnail where MoveNet admits nobody is junk;
// a mark on a thumbnail where MoveNet DID admit a person is real. The
// close-up trap is why the search matters as well as the oracle -- a
// makeup-tutorial close-up at 400px has too few keypoints to clear the
// person gate, so `nPersons === 0` alone would call a real woman junk.
//
//   node app/gaze/bench/image-guard-shipped.mjs [man|woman]
import fs from 'fs';
import { flaggedFaceIndices, countRefusedByNullGuard } from '../src/gender-verdict.mjs';
import { imageRead } from '../src/face-decode.mjs';

const G = process.argv[2] || 'man';
const BANK = 'Z:/tamescroll-corpus/bank/gpu-thumbs-detect.json';
const rows = JSON.parse(fs.readFileSync(BANK, 'utf8'));

// The bank carries each face flat (`raw`, `s`, `g`, `age`, `childP`,
// `nm`) because that is what the GPU harness banks. The shipped
// predicates read `score` and `shape.norm`. Convert here rather than
// loosening the predicates: an arm that has to relax the code it is
// testing is testing something else.
const asRead = (f) => ({
  gender: f.g,
  score: f.s,
  age: f.age,
  childP: f.childP,
  raw: f.raw,
  shape: { norm: f.nm },
});

// EXACTLY what worker-entry sent before 1104. Kept as a literal on
// purpose: it is the defect, so it must not be able to follow a fix.
const trim1103 = (r) => ({
  gender: r.gender,
  score: r.score,
  age: r.age,
  childP: r.childP,
  px: r.px,
});

let n1103 = 0;
let n1104 = 0;
let junk1103 = 0;
let junk1104 = 0;
let real1103 = 0;
let real1104 = 0;
let refused = 0;
let faces = 0;
const changed = [];
const uncoveredThumbs = [];

for (const t of rows) {
  const reads = (t.faces || []).map(asRead);
  if (!reads.length) continue;
  faces += reads.length;

  const a = flaggedFaceIndices(G, reads.map(trim1103));
  const b = flaggedFaceIndices(G, reads.map(imageRead));
  refused += countRefusedByNullGuard(reads.map(imageRead));

  // Finding 52's classes. `expect: 'none'` is a person-free SEARCH.
  const personFreeSearch = t.expect === 'none';
  const movenetSaysNobody = (t.nPersons || 0) === 0;
  const junk = personFreeSearch && movenetSaysNobody;

  n1103 += a.length;
  n1104 += b.length;
  if (junk) {
    junk1103 += a.length;
    junk1104 += b.length;
  } else {
    real1103 += a.length;
    real1104 += b.length;
  }

  // FINDING 52 SAID IT COULD NOT TELL THIS AND IT IS THE NUMBER THAT
  // DECIDES THE TRADE: a real mark lost is only an EXPOSURE if the
  // thumbnail ends up with nothing on it. If another mark still covers
  // the same image, the subject is still covered.
  if (a.length && !b.length && !junk) uncoveredThumbs.push({ vid: t.vid, q: t.q, nPersons: t.nPersons, n: a.length });

  if (a.length !== b.length) {
    for (const i of a) {
      if (b.indexOf(i) === -1) {
        changed.push({
          vid: t.vid,
          q: t.q,
          klass: junk ? 'JUNK' : 'real',
          nPersons: t.nPersons,
          maxKp: t.maxKp,
          f: t.faces[i],
        });
      }
    }
  }
}

const pct = (x, y) => (y ? ((100 * x) / y).toFixed(1) + '%' : '--');
const pad = (v, w) => String(v).padStart(w);

console.log("IMAGE NULL GUARD, SHIPPED RULE, ON FINDING 52'S OWN 370 THUMBNAILS");
console.log('user gender ' + G + '   thumbnails ' + rows.length + '   face reads ' + faces);
console.log('');
console.log('                    1103      1104     change');
const row = (label, a, b) =>
  console.log(label + pad(a, 6) + '    ' + pad(b, 6) + '    ' +
    pad((b - a >= 0 ? '+' : '') + (b - a), 5) + '  (' + pct(b - a, a) + ')');
row('marks total       ', n1103, n1104);
row('  JUNK marks      ', junk1103, junk1104);
row('  real marks      ', real1103, real1104);
console.log('');
console.log('guard refusals counted by the shipped predicate: ' + refused);

if (n1103 === n1104) {
  console.log('');
  console.log('!! NOTHING MOVED. Either the guard is still dead or this population');
  console.log('   carries no read inside NULL_V_LO..HI below the nm floor.');
}

// A BENCH THAT REPORTS A BOUND MUST NAME THE ROWS BEHIND IT -- finding
// 48 caught its own 388-vs-5 error exactly here.
console.log('');
console.log('THE MARKS THAT DISAPPEARED (' + changed.length + '), open these and judge them:');
for (const c of changed.slice(0, 25)) {
  console.log(
    '  ' + c.klass.padEnd(4) + ' ' + c.vid.padEnd(11) + ' ' + c.q.slice(0, 30).padEnd(30) +
    ' px ' + pad(c.f.px, 3) + ' conf ' + c.f.conf.toFixed(2) +
    '  ' + c.f.g.padEnd(6) + ' s' + c.f.s.toFixed(2) + ' raw ' + c.f.raw.toFixed(2) +
    ' nm ' + c.f.nm.toFixed(2) +
    '  nPersons ' + c.nPersons + ' maxKp ' + c.maxKp
  );
}
if (changed.length > 25) console.log('  ... ' + (changed.length - 25) + ' more');

const junkGone = changed.filter((c) => c.klass === 'JUNK').length;
console.log('');
console.log('of the marks removed: ' + junkGone + ' junk, ' + (changed.length - junkGone) +
  ' real  (finding 52 predicted 32 junk / 24 real at floor 5)');

// THE EXPOSURE COLUMN, which is the one that is his to rule on.
console.log('');
console.log('THUMBNAILS THAT GO FROM COVERED TO COMPLETELY UNCOVERED: ' + uncoveredThumbs.length);
console.log('(a real mark lost matters only if nothing else covers that image --');
console.log(' finding 52 said it could not tell; this is the answer)');
for (const u of uncoveredThumbs.slice(0, 20)) {
  console.log('  ' + u.vid.padEnd(11) + ' ' + u.q.slice(0, 32).padEnd(32) +
    ' marks ' + u.n + ' -> 0   nPersons ' + u.nPersons);
}
if (uncoveredThumbs.length > 20) console.log('  ... ' + (uncoveredThumbs.length - 20) + ' more');
