// WHERE DOES THE +1.0s OF EXPOSURE LAND?
//
// 10g says PTRACK_IOU_MIN 0.20 -> 0.15 is man +1.0s exposure / -16.0s
// false cover / -12.5s phantom, and woman -1.0s exposure / -16.5s
// phantom. A net-zero exposure change across two arms is not a licence
// to ship it: 1.0s spread as 0.5s over two windows is noise in the
// association layer, and 1.0s landing entirely on ONE subject is a
// person going sharp -- the same distinction that made loop 39 trace
// five frames by hand rather than quote a total.
//
// Per window, per gender, deltas only.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import {
  loadWin, makeArms, K_HIS, thinFrames, hisRegimeOpts, HIS_EFFZOOM,
} from './arch-arms.mjs';
import { patchConsts, readConst } from './_patch.mjs';

const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const SHIPPED = readConst(src, 'PTRACK_IOU_MIN');
// THE CANDIDATE MAY NOT DEFAULT TO A LITERAL. It defaulted to 0.15 while
// 0.20 shipped, which was right for exactly as long as it took 1090 to
// ship 0.15 -- after which this instrument compared the shipped value
// against itself and printed `0 of 18 windows moved` in both arms. The
// tool that justified the release then reported, confidently, that the
// release changed nothing. Caught by the phase-E critic.
//
// A candidate equal to the shipped value is refused rather than run: a
// control row is a legitimate thing to want from `iou-ab`, and a
// PER-WINDOW DELTA of an arm against itself is nothing but zeros.
const CAND = Number(process.env.IOU || (SHIPPED > 0.15 ? 0.15 : 0.20));
if (CAND === SHIPPED) {
  console.error(`IOU=${CAND} is the SHIPPED value -- a delta against itself is all zeros.`);
  console.error('Pass IOU= something else. This refuses rather than printing a false null.');
  process.exit(2);
}
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

async function armAt(v) {
  const f = fileURLToPath(new URL(`./.cache/iouw${v}.mjs`, import.meta.url));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, patchConsts(src, { PTRACK_IOU_MIN: v }));
  return makeArms(await import(pathToFileURL(f).href + '?v=' + v));
}
const A = await armAt(SHIPPED);
const B = await armAt(CAND);

console.log(`PTRACK_IOU_MIN ${SHIPPED} -> ${CAND}   k=${K_HIS} (1.5s/verdict)  told ${HIS_EFFZOOM}ms`);
for (const g of ['man', 'woman']) {
  const o = hisRegimeOpts(g, HIS_EFFZOOM);
  const a = A(o), b = B(o);
  const rows = [];
  for (const w of wins) {
    const s0 = score(a(thinFrames(w, K_HIS), g), g, (c) => cropLabel.get(c));
    const s1 = score(b(thinFrames(w, K_HIS), g), g, (c) => cropLabel.get(c));
    rows.push([w.tag, s1.exposureS - s0.exposureS,
      s1.falseCoverS - s0.falseCoverS, s1.phantomS - s0.phantomS]);
  }
  rows.sort((x, y) => y[1] - x[1]);
  const sg = (n) => (n >= 0 ? '+' : '') + n.toFixed(1);
  console.log(`\n-- ${g} --                        dEXPOSURE  dFALSECOVER   dPHANTOM`);
  for (const [n, de, df, dp] of rows) {
    if (de === 0 && df === 0 && dp === 0) continue;
    console.log(String(n).slice(0, 30).padEnd(32) + sg(de).padStart(8)
      + sg(df).padStart(13) + sg(dp).padStart(11));
  }
  const T = rows.reduce((a2, r) => [a2[0] + r[1], a2[1] + r[2], a2[2] + r[3]], [0, 0, 0]);
  const moved = rows.filter((r) => r[1] !== 0).length;
  console.log('TOTAL'.padEnd(32) + sg(T[0]).padStart(8) + sg(T[1]).padStart(13) + sg(T[2]).padStart(11));
  console.log(`windows whose EXPOSURE moved at all: ${moved} of ${rows.length}`);
}
