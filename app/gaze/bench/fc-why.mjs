// WHICH READ COVERS HIM?
//
// fc-attrib says 69% of false cover (149.0s of 216.5s in man mode) is a
// patch CENTRED on the man -- his own read, not association and not
// geometry. That kills the model-swap direction for this number: a
// person detector only ever changes where a box is, and this box is in
// the right place, drawn for the right person, for the wrong reason.
//
// So bucket the read that did it. The four buckets need completely
// different work:
//   MISGENDER   the model read him female, and was CERTAIN.
//   WEAK        read male but under the clear bar -- fails closed.
//   ABSTAIN     null read or child -- fails closed.
//   NO SIGNAL   descriptor magnitude under the floor: the model
//               returned nothing at all.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { overlapFrac } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
import { GENDER_CLEAR_SCORE, GENDER_CLEAR_SCORE_FEMALE, NULL_MINT_NM_FLOOR }
  from './.cache/shipped.mjs';

const COVER = 0.15;
const g = process.env.GENDER || 'man';
const shouldCover = (l) => g === 'man' ? (l === 'woman' || l === 'child')
                                       : (l === 'man' || l === 'child');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const thin = (win, e) => ({ ...win, frames: win.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const arm = ARM({ hold: true, clampPad: 0.02, cut: true, inertNoSignal: true,
  memSignal: true, mem: g === 'man' ? 'loose2' : 'loose' });

// The bar the SAME-gender branch applies to this read's own label.
const barFor = (lab) => (g === 'man' ? GENDER_CLEAR_SCORE : GENDER_CLEAR_SCORE_FEMALE);
const b = { misgender: 0, weak: 0, nosignal: 0, child: 0, other: 0 };
let px = [], sc = [];
for (const win of wins) {
  const out = arm(thin(win, 3), g);
  const dt = out.length > 1 ? (out[1].t - out[0].t) : 0.5;
  for (const fr of out) {
    const labs = fr.faces.map((f) => cropLabel.get(f.crop));
    fr.faces.forEach((f, fi) => {
      const lab = labs[fi];
      if (!lab || lab === 'mixed' || lab === 'notperson' || lab === 'bodypart') return;
      if (shouldCover(lab)) return;                 // he should be sharp
      let bi = -1, bf = 0;
      fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bf) { bf = o; bi = i; } });
      if (bf < COVER || bi < 0) return;
      const p = fr.patches[bi];
      if (fr.faces.some((h, hi) => hi !== fi && shouldCover(labs[hi]) && overlapFrac(h, p) >= COVER))
        return;                                      // ABSORBED, not his read
      const fcx = (f.x1 + f.x2) / 2, pcx = (p.x1 + p.x2) / 2;
      if (Math.abs(fcx - pcx) > 0.25 * (p.x2 - p.x1)) return;   // STALE
      // His own read, centred on him. Why did it not clear?
      const own = g === 'man' ? 'male' : 'female';
      const s = 2 * Math.abs(f.raw - 0.5);
      px.push(f.px); sc.push(s);
      if (f.nm < NULL_MINT_NM_FLOOR) b.nosignal += dt;
      else if (f.gender !== own) b.misgender += dt;
      else if (s < barFor(lab)) b.weak += dt;
      else if (f.childP != null && f.childP >= 0.25) b.child += dt;
      else b.other += dt;
    });
  }
}
const q = (a, p) => { a = [...a].sort((x, y) => x - y); return a.length ? a[Math.floor(p * a.length)] : 0; };
const tot = Object.values(b).reduce((x, y) => x + y, 0) || 1;
console.log(`gender=${g}   MISREAD false cover ${tot.toFixed(1)}s`);
for (const [k, v] of Object.entries(b).sort((x, y) => y[1] - x[1]))
  console.log('  ' + k.padEnd(11) + (v.toFixed(1) + 's').padStart(8) +
    ('  ' + (100 * v / tot).toFixed(0) + '%').padStart(7));
console.log(`  those faces: px p50 ${q(px, .5)}  score p50 ${q(sc, .5).toFixed(2)}`);
