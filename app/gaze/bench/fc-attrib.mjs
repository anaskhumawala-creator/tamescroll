// WHY: the pad sweep changed patch AREA sevenfold and moved FALSE COVER
// by 1.0s. A quantity that ignores geometry is not a geometry problem,
// so before swapping the person model -- which only ever changes
// geometry -- this asks what the wrong-gender face is actually inside.
//
// Two mutually exclusive causes, decided per false-cover event off the
// SAME patch that covered him:
//   ABSORBED  the patch ALSO covers a face that should be covered, so
//             one patch spans two people -- association/merge.
//   OWN       no coverable face is in it, so the patch was minted for
//             him: a misgender, an abstain failing closed, or a phantom
//             he happens to stand in.
// Only ABSORBED is reachable by a better person detector. OWN is the
// gender read.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { overlapFrac } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const COVER = 0.15;                      // same constant corpus-score uses
const g = process.env.GENDER || 'man';
const shouldCover = (l) => g === 'man' ? (l === 'woman' || l === 'child')
                                       : (l === 'man' || l === 'child');
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const all = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const have = new Set(fs.existsSync(`${ROOT}/bank/ssd`) ? fs.readdirSync(`${ROOT}/bank/ssd`) : []);
const files = process.env.SSD ? all.filter((f) => have.has(f)) : all;
const wins = files.map(loadWin);
console.log(`gender=${g}   windows ${files.length} of ${all.length}`);

const ARM = makeArms(await import('./.cache/shipped.mjs'));
function thin(win, every) {
  return { ...win, frames: win.frames.map((fr, i) =>
    i % every === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) };
}
const BASE = { hold: true, clampPad: 0.02, cut: true, inertNoSignal: true, memSignal: true,
  mem: g === 'man' ? 'loose2' : 'loose' };
const ARMS = process.env.SSD
  ? [['1087 SHIPPED', ARM(BASE)], ['ssd pad .15', ARM({ ...BASE, ssdMin: 0.35, ssdPad: 0.15 })]]
  : [['1087 SHIPPED', ARM(BASE)]];

console.log('\narm                      ABSORBED (one patch, two people)      OWN (his own read)');
for (const [name, arm] of ARMS) {
  let absorbed = 0, misread = 0, stale = 0;
  for (const win of wins) {
    const out = arm(thin(win, 3), g);
    const dt = out.length > 1 ? (out[1].t - out[0].t) : 0.5;
    for (const fr of out) {
      const labs = fr.faces.map((f) => cropLabel.get(f.crop));
      fr.faces.forEach((f, fi) => {
        const lab = labs[fi];
        if (!lab || lab === 'mixed' || lab === 'notperson' || lab === 'bodypart') return;
        if (shouldCover(lab)) return;
        let b = -1, bf = 0;
        fr.patches.forEach((p, i) => { const o = overlapFrac(f, p); if (o > bf) { bf = o; b = i; } });
        if (bf < COVER || b < 0) return;                    // left sharp, correct
        const p = fr.patches[b];
        const shared = fr.faces.some((h, hi) =>
          hi !== fi && shouldCover(labs[hi]) && overlapFrac(h, p) >= COVER);
        if (shared) { absorbed += dt; return; }
        // SPLIT THE REST BY PROVENANCE, because the two halves need
        // different work. A patch whose originating faceBox IS his face
        // is a GENDER READ that covered him. A patch carrying someone
        // else's faceBox, or none, is a track he is merely standing in
        // -- stale, coasting, or minted off a graphic.
        // newTrack builds its box as a LITERAL, so faceBox does not
        // ride the track and provenance has to come from geometry.
        // A patch minted for him is CENTRED on him; one he is standing
        // in the edge of is not.
        const fcx = (f.x1 + f.x2) / 2, pcx = (p.x1 + p.x2) / 2;
        const mine = Math.abs(fcx - pcx) <= 0.25 * (p.x2 - p.x1);
        mine ? (misread += dt) : (stale += dt);
      });
    }
  }
  const tot = absorbed + misread + stale || 1;
  const pc = (v) => (v.toFixed(1) + 's ' + (100 * v / tot).toFixed(0) + '%').padStart(14);
  console.log(name.padEnd(16) + pc(absorbed) + pc(misread) + pc(stale));
}
