// WHERE THE BAR CHANGE BUYS ITS EXPOSURE.
//
// bar-risk.mjs counted READS: 0 of 701 must-cover reads in man mode
// cross from covered to clear when GENDER_CLEAR_SCORE drops 0.60 ->
// 0.45. The time-score in his coasting regime says exposure rises 13.5s
// -> 16.5s. Both cannot be a direct effect of the same constant on the
// same reads, so one of them is measuring something the other cannot
// see, and shipping before knowing which would be shipping on a number
// I do not understand.
//
// This diffs the two arms FRAME BY FRAME and reports, for every frame
// the control covers and the low-bar arm does not, which labelled face
// went sharp and what the pipeline knew about her at that moment.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);

const ARM = makeArms(await import('./.cache/shipped.mjs'));
const ARM_LOW = makeArms(await import('./.cache/lowbar.mjs'));
const a = ARM({ hold: true }), b = ARM_LOW({ hold: true });

function thinCoast(win, every) {
  return { ...win, frames: win.frames.map((fr, i) => (i % every === 0 ? fr
    : { ...fr, faces: [], _labelFaces: fr.faces })) };
}
const MUST = new Set(['woman', 'child']);
const ov = (f, p) => {
  const w = Math.max(0, Math.min(f.x2, p.x2) - Math.max(f.x1, p.x1));
  const h = Math.max(0, Math.min(f.y2, p.y2) - Math.max(f.y1, p.y1));
  const A = (f.x2 - f.x1) * (f.y2 - f.y1);
  return A > 0 ? (w * h) / A : 0;
};
const covered = (f, patches) => patches.some((p) => ov(f, p) >= 0.6);

let rows = [];
for (const win of wins) {
  const t = thinCoast(win, 3);
  const A = a(t, g), B = b(t, g);
  A.forEach((fa, i) => {
    const fb = B[i];
    fa.faces.forEach((f) => {
      if (!MUST.has(cropLabel.get(f.crop))) return;
      const ca = covered(f, fa.patches), cb = covered(f, fb.patches);
      if (ca && !cb) rows.push({ vid: win.vid, t: fa.t, lab: cropLabel.get(f.crop),
        g: f.gender, s: +f.score.toFixed(2), nm: +f.nm.toFixed(1),
        read: !!win.frames[i].faces.length, pa: fa.patches.length, pb: fb.patches.length });
    });
  });
}
console.log(`gender=${g}  frames the CONTROL covers and the LOW BAR does not: ${rows.length}`);
console.log('(each row is 0.5s of the time-score)\n');
const onRead = rows.filter((r) => r.read).length;
console.log(`  on a VERDICT frame: ${onRead}      on a COASTED frame: ${rows.length - onRead}`);
const byVid = {};
for (const r of rows) byVid[r.vid] = (byVid[r.vid] || 0) + 1;
console.log('  by video:', JSON.stringify(byVid));
console.log('\n  vid            t      label   read(g,score,nm)        patches A->B');
for (const r of rows.slice(0, 40)) {
  console.log(`  ${r.vid.padEnd(12)} ${String(r.t.toFixed(1)).padStart(6)}  ${r.lab.padEnd(6)}  ` +
    (r.read ? `${r.g} ${r.s} nm${r.nm}`.padEnd(22) : 'coasted (no read)'.padEnd(22)) +
    `  ${r.pa} -> ${r.pb}`);
}
