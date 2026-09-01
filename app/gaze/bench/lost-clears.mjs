// WHY: 87.1% of faces labelled MAN read male AND clear the shipped bar,
// yet 72% of FALSE COVER is a patch centred on a man. Both cannot be
// true unless the verdict layer is discarding reads that were correct
// and certain when they arrived. This finds where.
//
// For every frame where a man is covered, it asks what the pipeline
// knew about HIM at that moment:
//   noReadYet   no verdict frame has carried his face yet -- blur-first,
//               correct, and the cost is cadence not logic.
//   hadClear    a clear-certain read on his face already landed on some
//               earlier verdict frame. The pipeline HAD the answer.
// hadClear is the recoverable number.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
import { overlapFrac } from './corpus-score.mjs';
const S = await import('./.cache/shipped.mjs');
const YFE = S.GENDER_CLEAR_SCORE, COVER = 0.15;

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const ARM = makeArms(S);
const arm = ARM({ hold: true, clampPad: 0.02, cut: true });
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

let noReadYet = 0, hadClear = 0, hadWeak = 0, dt = 0.5;
let afterCut = 0, noCut = 0;
const ageBins = [0, 0, 0, 0, 0, 0];
for (const f of fs.readdirSync(`${ROOT}/bank/reads`).filter((x) => x.endsWith('.json'))) {
  const win = loadWin(f);
  const out = arm(thin(win, 3), 'man');
  // A CLEAR IS AN EVENT IN TIME, so it has to be accumulated forward
  // frame by frame -- asking "was he ever read" over the whole window
  // would credit the pipeline with answers that arrive later.
  const cleared = [];                       // face boxes that have read clear-certain
  const weak = [];
  out.forEach((fr, fi) => {
    const src = win.frames[fi];
    fr.faces.forEach((fc) => {
      if (cropLabel.get(fc.crop) !== 'man') return;
      const seen = (list) => list.some((b) => overlapFrac(fc, b) >= 0.5);
      let best = -1, bf = 0;
      fr.patches.forEach((p) => { const o = overlapFrac(fc, p); if (o > bf) bf = o; });
      if (bf >= COVER) {
        if (seen(cleared)) {
          hadClear += dt;
          // WHAT HAPPENED BETWEEN HIS CLEAR AND THIS FRAME. A cut wipes
          // every track by design, so a clear that predates one was
          // deliberately discarded; one with no cut behind it was lost
          // by the tracker itself, which is a defect rather than a
          // policy. Age separates "coast expired" from "just now".
          const last = cleared.filter((b) => overlapFrac(fc, b) >= 0.5)
                              .reduce((a, b) => Math.max(a, b.i), -1);
          const cutSince = (win.cuts || []).some((c) => c > last && c <= fi);
          cutSince ? (afterCut += dt) : (noCut += dt);
          ageBins[Math.min(5, Math.floor((fi - last) / 6))] += dt;
        }
        else if (seen(weak)) hadWeak += dt;
        else noReadYet += dt;
      }
      // bank his read AFTER scoring this frame
      if (fi % 3 === 0 && typeof fc.raw === 'number') {
        const sc = 2 * Math.abs(fc.raw - 0.5);
        (fc.raw >= 0.5 && sc >= YFE ? cleared : weak).push({ x1: fc.x1, y1: fc.y1, x2: fc.x2, y2: fc.y2, i: fi });
      }
    });
  });
}
const tot = noReadYet + hadClear + hadWeak || 1;
const pc = (v) => v.toFixed(1) + 's  ' + (100 * v / tot).toFixed(0) + '%';
console.log('\nMAN COVERED, by what the pipeline already knew about him:');
console.log('  no read yet (cadence)   ' + pc(noReadYet));
console.log('  had a WEAK read         ' + pc(hadWeak));
console.log('  HAD A CLEAR-CERTAIN READ ' + pc(hadClear));
console.log('');
console.log('  of that clear-and-still-covered time:');
console.log('    a scene CUT wiped it      ' + pc(afterCut));
console.log('    NO cut -- tracker lost it ' + pc(noCut));
console.log('');
console.log('  age of his clear when he was covered (seconds ago):');
['0-3', '3-6', '6-9', '9-12', '12-15', '15+'].forEach((lab, i) =>
  console.log('    ' + lab.padEnd(7) + ageBins[i].toFixed(1) + 's'));
