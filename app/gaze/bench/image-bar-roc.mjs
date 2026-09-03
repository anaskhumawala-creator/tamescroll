// THE THUMBNAIL CLEAR BAR HAS NEVER BEEN SWEPT, AND IT IS THE ONE HE NAMED.
//
// `GENDER_IMAGE_MIN_SCORE` 0.4 decides every thumbnail on the feed:
// `flaggedFaceIndices` clears a face only when it is same-gender AND
// adult AND `score >= 0.4`, and covers it otherwise. The video path's
// pair (`GENDER_CLEAR_SCORE` 0.45 / `_FEMALE` 0.35) has been swept four
// times -- `clear-bar-roc.mjs`, `bar-ab`, `bar-risk`, `critic-lowbar`.
// The image bar has been swept ZERO times. It was set on 2026-08-28 by
// looking at a distribution after the crop-squash fix, not at a curve.
//
// BOTH DIRECTIONS, ALWAYS, because a bar has two costs and every
// published one-sided bar number in this repo has later moved:
//
//   FALSE COVER  a same-gender face the bar refuses to clear.
//                His oldest complaint, in his words "it blurs males".
//   EXPOSURE     an opposite-gender face the bar clears.
//                The reason the bar exists at all.
//   PHANTOM      a non-face crop that gets flagged. A patch on nothing,
//                on the feed -- "random blur marks here and there".
//
// THE GROUND TRUTH AND ITS LIMIT, stated before the numbers rather than
// under them. `spikes/gauntlet/nmtruth-{face,nonface}.json`, banked
// 2026-09-01: 25 real faces (16 female / 9 male by their own
// full-resolution read at 152-206px) re-read at nine sizes, and 85
// corner crops from thumbnails where BlazeFace found NOTHING, force-read
// at the same nine.
//
//   - The "truth" gender is FACERES AT NATIVE RESOLUTION, not a human.
//     So this measures whether the bar holds as a face SHRINKS, which is
//     the question his 38-62px regime asks. It cannot find a face the
//     model reads wrong at every size -- that is M-4 and needs the
//     human cluster labels, which cover the VIDEO corpus only.
//   - The non-face arm is crops where the detector found nothing, FORCE
//     read. In production gender only runs on boxes BlazeFace produced,
//     so its phantom column is the refusal rate on face-free crops and
//     not a prediction of how many patches vanish from his feed.
//
// THE BAR IS PATCHED BY NAME out of the built bundle (`_patch.mjs`) and
// the SHIPPED `flaggedFaceIndices` decides every row. Nothing here
// re-implements the rule: three benches published wrong numbers for
// exactly that (phase-g G1/G5/G9), and a fourth swept a literal that had
// moved and reported one arm against itself.
//
// Run: node bench/image-bar-roc.mjs [man|woman|both]
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import './_build.mjs';
import { patchConsts, readConst, controlIsByteIdentical } from './_patch.mjs';

const WHICH = process.argv[2] || process.env.GENDER || 'both';
const P = new URL('../../../spikes/gauntlet/', import.meta.url);
const face = JSON.parse(fs.readFileSync(new URL('nmtruth-face.json', P), 'utf8'));
const nonface = JSON.parse(fs.readFileSync(new URL('nmtruth-nonface.json', P), 'utf8'));

const srcPath = new URL('./.cache/shipped.mjs', import.meta.url);
const src = fs.readFileSync(srcPath, 'utf8');
const NAME = 'GENDER_IMAGE_MIN_SCORE';
const SHIPPED = readConst(src, NAME);
// A control point that is not byte-identical is a trap this repo already
// walked into once (phase-D D7: esbuild writes 2000 as `2e3`). Say which
// kind this constant is instead of assuming.
const CTRL_EXACT = controlIsByteIdentical(src, NAME);

// The banked series call it `child` and carry nm at the top level; the
// shipped predicates read `childP` and `shape.norm`. Convert rather than
// loosening the predicates -- an arm that relaxes the code it is testing
// is testing something else. (Same conversion as `image-null.mjs`; kept
// identical on purpose so the two arms are comparable.)
const asFace = (s) => ({
  gender: s.gender, score: s.score, raw: s.raw, age: s.age,
  childP: s.child, shape: { norm: s.nm },
});

const SIZES = [32, 40, 48, 56, 64, 80, 100, 120, 160];
// His measured regime. Faces reach faceres at px p50 38-62 on his
// player, and a feed thumbnail is smaller again -- so the whole-table
// row is a summary and THIS row is the one that describes him.
const HIS_BAND = [32, 40, 48, 56, 64];

// WRITTEN INTO bench/.cache BY ABSOLUTE PATH, not into a temp dir: the
// variant re-exports the bundle's own imports, so it only resolves
// `@tensorflow/tfjs-core` from inside the package. `./.cache/...`
// resolves against the CWD for writeFileSync and against the MODULE for
// import(), so the two halves disagree unless the bench is run from
// bench/ -- the same trap iou-ab.mjs names.
async function variantAt(v) {
  const f = fileURLToPath(new URL(`./.cache/imgbar${v}.mjs`, import.meta.url));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, patchConsts(src, { [NAME]: v }));
  return import(pathToFileURL(f).href + '?v=' + v);
}

/** One bar, one user gender: the three errors, over a size set. */
function measure(mod, g, sizes) {
  const opp = g === 'man' ? 'female' : 'male';
  let falseCover = 0, sameN = 0, exposure = 0, oppN = 0, phantom = 0, nfN = 0;
  for (const r of face.rows) {
    const ref = r.ref && r.ref.gender;
    if (ref !== 'female' && ref !== 'male') continue;
    for (const s of r.series) {
      if (!sizes.includes(s.px)) continue;
      const flagged = mod.flaggedFaceIndices(g, [asFace(s)]).length > 0;
      if (ref === opp) { oppN++; if (!flagged) exposure++; }
      else { sameN++; if (flagged) falseCover++; }
    }
  }
  for (const r of nonface.nullRows) {
    for (const s of r.series) {
      if (!sizes.includes(s.px)) continue;
      nfN++;
      if (mod.flaggedFaceIndices(g, [asFace(s)]).length > 0) phantom++;
    }
  }
  return { falseCover, sameN, exposure, oppN, phantom, nfN };
}

const pc = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : '--';
const BARS = [];
for (let v = 0; v <= 0.90001; v += 0.05) BARS.push(Math.round(v * 100) / 100);
if (!BARS.includes(SHIPPED)) BARS.push(SHIPPED);
BARS.sort((a, b) => a - b);

console.log(`THE THUMBNAIL CLEAR BAR, SWEPT -- ${NAME} ships ${SHIPPED}`);
console.log(`control point byte-identical: ${CTRL_EXACT}`);
console.log(`ground truth: ${face.rows.length} real faces `
  + `(${JSON.stringify(face.refGenders)}) x ${SIZES.length} sizes, `
  + `${nonface.nullRows.length} non-face crops x ${SIZES.length} sizes`);
console.log('TRUTH IS FACERES AT NATIVE RESOLUTION, NOT A HUMAN. This asks');
console.log('whether the bar holds as a face shrinks, not whether the model');
console.log('is right about that face at any size.\n');

const genders = WHICH === 'both' ? ['man', 'woman'] : [WHICH];
const mods = new Map();
for (const v of BARS) mods.set(v, await variantAt(v));

for (const g of genders) {
  for (const [label, sizes] of [['ALL SIZES', SIZES], ['HIS BAND (32-64px)', HIS_BAND]]) {
    console.log(`--- gender=${g}   ${label} ---`);
    console.log('  bar    FALSE COVER (same-gender covered)   EXPOSURE (opposite cleared)   PHANTOM (non-face flagged)');
    for (const v of BARS) {
      const m = measure(mods.get(v), g, sizes);
      const mark = v === SHIPPED ? ' <- SHIPPED' : '';
      console.log('  ' + v.toFixed(2).padEnd(7)
        + `${String(m.falseCover).padStart(5)} of ${String(m.sameN).padEnd(4)} ${pc(m.falseCover, m.sameN).padStart(7)}`
        + `${String(m.exposure).padStart(12)} of ${String(m.oppN).padEnd(4)} ${pc(m.exposure, m.oppN).padStart(7)}`
        + `${String(m.phantom).padStart(11)} of ${String(m.nfN).padEnd(4)} ${pc(m.phantom, m.nfN).padStart(7)}`
        + mark);
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------
// ARM 2: THE SAME SWEEP ON HUMAN LABELS, because arm 1's ground truth is
// 25 faces and the whole decision turns out to rest on FOUR misread
// instances belonging to TWO subjects.
//
// The corpus carries 3,465 banked reads over 107 HUMAN-labelled clusters
// -- strictly better truth than faceres-at-native-resolution, and two
// orders of magnitude more of it. It is VIDEO rather than thumbnails, so
// it cannot answer "how does a feed thumbnail behave"; what it CAN
// answer is the only question this bar actually decides, which is the
// same on both paths: WHEN THE MODEL SAYS SAME-GENDER, HOW SURE MUST IT
// BE. Reported beside arm 1 rather than instead of it.
console.log('=== ARM 2: HUMAN LABELS (corpus reads, n in thousands) ===');
console.log('Video crops, not thumbnails. Same question, better truth.\n');
{
  const { ROOT, winFiles } = await import('./corpus-lib.mjs');
  const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
  const cropLabel = new Map();
  for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
    if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

  const reads = [];
  for (const file of winFiles()) {
    const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${file}`, 'utf8'));
    for (const fr of win.frames) for (const f of (fr.faces || [])) {
      const lab = f.crop && cropLabel.get(f.crop);
      // `mixed` and `bodypart` carry no single readable gender, and
      // `notperson` is the phantom arm's population, not this one.
      if (lab === 'man' || lab === 'woman') {
        reads.push({ lab, px: (f.shape && f.shape.px) || null, f: {
          gender: f.gender, score: f.score, raw: f.raw, age: f.age,
          childP: f.childP, shape: f.shape } });
      } else if (lab === 'notperson') {
        reads.push({ lab, px: (f.shape && f.shape.px) || null, f: {
          gender: f.gender, score: f.score, raw: f.raw, age: f.age,
          childP: f.childP, shape: f.shape } });
      }
    }
  }
  const people = reads.filter((r) => r.lab !== 'notperson');
  const nonpeople = reads.filter((r) => r.lab === 'notperson');
  console.log(`labelled reads: ${people.length} people `
    + `(man ${people.filter((r) => r.lab === 'man').length} / `
    + `woman ${people.filter((r) => r.lab === 'woman').length}), `
    + `${nonpeople.length} notperson\n`);

  for (const g of genders) {
    const same = g === 'man' ? 'man' : 'woman';
    console.log(`--- gender=${g}   HUMAN-LABELLED ---`);
    console.log('  bar    FALSE COVER (same-gender covered)   EXPOSURE (opposite cleared)   PHANTOM (notperson flagged)');
    for (const v of BARS) {
      const mod = mods.get(v);
      let fc = 0, sameN = 0, ex = 0, oppN = 0, ph = 0;
      for (const r of people) {
        const flagged = mod.flaggedFaceIndices(g, [r.f]).length > 0;
        if (r.lab === same) { sameN++; if (flagged) fc++; }
        else { oppN++; if (!flagged) ex++; }
      }
      for (const r of nonpeople) if (mod.flaggedFaceIndices(g, [r.f]).length > 0) ph++;
      console.log('  ' + v.toFixed(2).padEnd(7)
        + `${String(fc).padStart(5)} of ${String(sameN).padEnd(5)} ${pc(fc, sameN).padStart(7)}`
        + `${String(ex).padStart(12)} of ${String(oppN).padEnd(5)} ${pc(ex, oppN).padStart(7)}`
        + `${String(ph).padStart(11)} of ${String(nonpeople.length).padEnd(5)} ${pc(ph, nonpeople.length).padStart(7)}`
        + (v === SHIPPED ? ' <- SHIPPED' : ''));
    }
    console.log('');
  }
}

// THE READING RULE, written down so the table cannot be quoted one-sided.
console.log('HOW TO READ IT. Raising the bar covers MORE: false cover rises,');
console.log('exposure falls, phantom rises. Lowering it clears more: the');
console.log('reverse. There is no free direction -- if a column is flat while');
console.log('another moves, that flat column is the finding, and if BOTH are');
console.log('flat across the whole sweep then this ground truth cannot see');
console.log('the bar at all and no move may be justified from this table.');
