// CAN OUR TRUNK ABSORB dima806's ADVANTAGE FOR FREE?
//
// This is the test that decides whether the student project in finding 50
// is necessary. If our own [1024] descriptor carries enough signal, then
// dima806's only job is to LABEL -- run it once, offline, on his own
// footage, retrain our head on the result, and ship ~4KB of new weights
// with zero extra inference on the phone. If it does not, the trunk is
// the ceiling and a student is the only route.
//
// THE ARMS, all leave-one-video-out so a head never sees the video it is
// judged on -- his corpus is 52 identities across 10 videos, so a random
// row split would put the SAME PERSON on both sides and every arm would
// look excellent:
//
//   SHIPPED           the head that ships, no training           (control)
//   GREY              the same head on grey                      (the bar)
//   dima806           the teacher itself                         (the ceiling)
//   ours + TRUE       our descriptors, TRUE hand labels          (upper bound
//                     -- what our trunk can do with perfect labels)
//   ours + PSEUDO     our descriptors, DIMA'S labels             (the product)
//
// *** THE ARM THAT MAKES IT READABLE IS "ours + TRUE". Pseudo-labels can
// only be worse than true ones, so if our trunk cannot reach dima806 even
// with perfect in-domain labels, then pseudo-labelling is dead for a
// reason that has nothing to do with label quality -- and reporting the
// pseudo arm alone would blame the wrong thing.
//
// WHAT BOUNDS THE HOPE, stated before the run: finding 46 measured
// pearson(shipped head raw, linear probe on this descriptor) = 0.893 --
// the descriptor is the same signal read off an earlier layer, not a
// second opinion. And finding 50's own head-retrain arm already failed
// with TRUE FairFace labels. So this is a TEST, not a plan.
//
//   node app/gaze/bench/pseudo-label.mjs
import fs from 'fs';
import { fitBest, featOf, scoreArm, TARGETS, QUICK_GRID, FULL_GRID } from './head-train.mjs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank/';
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith('--' + k + '='));
  return h ? h.slice(k.length + 3) : d;
};
const KIND = arg('kind', 'rgb');
const EPOCHS = Number(arg('epochs', '40'));
const GRID = arg('quick', '1') === '1' ? QUICK_GRID : FULL_GRID;

const ship = JSON.parse(fs.readFileSync(BANK + 'gpu-corpus-desc.json', 'utf8'));
const dima = JSON.parse(fs.readFileSync(BANK + 'dima-corpus.json', 'utf8'));
const byCrop = new Map();
for (const r of dima) byCrop.set(r.crop, r);

const rows = [];
for (const r of ship) {
  const d = byCrop.get(r.crop);
  if (!d || !r.rgb || !r.grey) continue;
  if (r.who !== 'man' && r.who !== 'woman') continue;
  if (!Array.isArray(r.rgbDesc) || !Array.isArray(r.greyDesc)) continue;
  rows.push({
    who: r.who, vid: r.vid, cid: r.cid, px: r.px,
    rgbDesc: r.rgbDesc, greyDesc: r.greyDesc,
    shipRaw: r.rgb.raw, greyRaw: r.grey.raw, dimaRaw: d.raw,
    // dima806's label, which is what a pseudo-labelling run would write.
    pseudo: d.raw >= 0.5 ? 'man' : 'woman',
  });
}
const vids = [...new Set(rows.map((r) => r.vid))].sort();
console.log(NL + 'PSEUDO-LABELLING: can our trunk absorb dima806 for free?');
console.log('  ' + rows.length + ' reads, ' + vids.length + ' videos, arm ' + KIND);
const agree = rows.filter((r) => r.pseudo === r.who).length;
console.log('  dima806 label vs hand label: agree ' + (100 * agree / rows.length).toFixed(1)
  + '%  -- the pseudo arm is training on ' + (100 - 100 * agree / rows.length).toFixed(1)
  + '% wrong labels');

// LEAVE ONE VIDEO OUT. A random row split puts the same identity on both
// sides (52 identities generate 2,159 rows) and every trained arm would
// score near-perfectly on memorised faces.
const trained = { true: [], pseudo: [] };
for (const v of vids) {
  const tr = rows.filter((r) => r.vid !== v);
  const te = rows.filter((r) => r.vid === v);
  if (te.length < 40) continue;
  for (const mode of ['true', 'pseudo']) {
    const lab = tr.map((r) => ({
      who: mode === 'true' ? r.who : r.pseudo,
      rgbDesc: r.rgbDesc, greyDesc: r.greyDesc,
    }));
    const f = fitBest(lab, KIND, 1, { epochs: EPOCHS, grid: GRID });
    for (const r of te) {
      trained[mode].push({ who: r.who, v: f(Float64Array.from(featOf(r, KIND))) });
    }
  }
  process.stderr.write('  held out ' + v + '\n');
}

const arms = [
  ['SHIPPED head', rows.map((r) => ({ who: r.who, v: r.shipRaw })), 'control'],
  ['SHIPPED + GREY', rows.map((r) => ({ who: r.who, v: r.greyRaw })), 'the bar'],
  ['ours + TRUE labels', trained.true, 'UPPER BOUND on our trunk'],
  ['ours + dima PSEUDO', trained.pseudo, 'the free version'],
  ['dima806 itself', rows.map((r) => ({ who: r.who, v: r.dimaRaw })), 'the ceiling (cannot ship)'],
];
console.log(NL + '  FALSE COVER ON MEN at a common woman-exposure -- lower is better');
console.log('  ' + 'arm'.padEnd(22)
  + TARGETS.map((t) => ('<=' + (t * 100).toFixed(1) + '%').padStart(8)).join('') + '     AUC');
for (const [name, data, note] of arms) {
  if (!data.length) continue;
  const a = scoreArm(data, (r) => r.v);
  console.log('  ' + name.padEnd(22)
    + a.cells.map((c) => (c === null ? 'n/a' : (100 * c).toFixed(1) + '%').padStart(8)).join('')
    + '   ' + a.auc.toFixed(4) + '   ' + note);
}
// *** WHAT THE RESULT ACTUALLY SAYS, and it is NOT the reading this file
// was written expecting. Both trained arms land far WORSE than the head
// that ships (68.5% and 58.0% against 21.8% at the <=1.6% cell), and the
// PSEUDO arm BEATS the TRUE one. A wrong-label arm beating a right-label
// arm is not a result about labels -- it is the signature of a fit that
// is dominated by noise.
//
// The cause is countable and it is not the trunk: this corpus holds 51
// clusters over ten videos, so each leave-one-video-out fit sees about
// 46 DISTINCT PEOPLE and is then judged on people it has never seen.
// Fitting 1,024 inputs on 46 identities does not generalise, whoever
// wrote the labels.
//
// So the honest conclusion is "his corpus cannot train a head", NOT "the
// trunk is the ceiling". Those need opposite next steps, and reporting
// the first as the second would kill the pseudo-labelling route on
// evidence that does not support it. Settling it needs a labelling run
// over THOUSANDS of identities, which is a data project -- and the
// FairFace arm in finding 50 (10,580 faces, 10,580 identities, TRUE
// labels) is the closest thing to it that exists, and that arm also
// failed to beat grey on this corpus.
const cl = new Set(rows.map((r) => r.cid)).size;
console.log(NL + '  READ IT THIS WAY -- AND MIND THE IDENTITY COUNT:');
console.log('  ' + rows.length + ' reads come from only ' + cl + ' clusters over '
  + vids.length + ' videos, so each');
console.log('  fold fits 1024 inputs on ~46 distinct people and is judged on people');
console.log('  it has never seen. If both trained arms lose to the shipped head AND');
console.log('  the PSEUDO arm beats the TRUE one, that is noise, not a finding about');
console.log('  labels -- it says this corpus is too small to train a head, which is');
console.log('  a different problem from the trunk being the ceiling.' + NL);
