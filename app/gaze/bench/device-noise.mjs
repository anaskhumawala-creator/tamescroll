// PRICE 1083 BY REPRODUCING HIS DEVICE'S FAILURE IN THE CORPUS.
//
// The corpus decodes frames from files and faceres behaves: only 0.8%
// of reads fall under NULL_MINT_NM_FLOOR. His phone, measured live
// under 1082 over 116 reads on one face at a time, px p50 140, face
// confidence p50 0.80: 42% fall under it, alternating on the SAME
// subject (11.0, 1.1, 3.8, 11.0, 0.2, 0.2, 0.3, 6.5 -- 57 flips), each
// one reading v~0.62 age~37, which is the model's prior.
//
// So 1083's benefit could not be scored: the corpus has no instances of
// the thing it fixes. This injects them -- replacing a share of reads
// with the prior, deterministically by index so both arms corrupt
// exactly the same reads -- and scores 1082's ABSTAIN against 1083's
// INERT on identical input.
//
// This does NOT prove 1083 helps on his phone. It proves what the two
// policies do to the same corrupted stream, which is the part a bench
// can answer.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const RATE = Number(process.env.RATE || 0.42);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

// The prior itself, read off his ring rather than invented.
const PRIOR = { v: 0.628, raw: 0.628, age: 37.5, childP: 0.17, nm: 0.2 };
function corrupt(win, rate) {
  let n = 0;
  return { ...win, frames: win.frames.map((fr) => ({ ...fr, faces: fr.faces.map((f) => {
    // Deterministic and ALTERNATING, which is what the device does --
    // a random mask would let a subject be corrupted in long runs and
    // that is a different failure with a different cost.
    const hit = ((n++ * 100) % 100) < rate * 100;
    if (!hit) return f;
    return { ...f, raw: PRIOR.raw, score: 2 * Math.abs(PRIOR.raw - 0.5),
      gender: 'male', age: PRIOR.age, childP: PRIOR.childP, nm: PRIOR.nm,
      shape: { ...(f.shape || {}), norm: PRIOR.nm } };
  }) })) };
}
// Alternating pattern: every other read corrupted up to the rate.
let k = 0;
function corruptAlt(win, rate) {
  return { ...win, frames: win.frames.map((fr) => ({ ...fr, faces: fr.faces.map((f) => {
    const hit = (k++ % 100) < rate * 100;
    if (!hit) return f;
    return { ...f, raw: PRIOR.raw, score: 2 * Math.abs(PRIOR.raw - 0.5),
      gender: 'male', age: PRIOR.age, childP: PRIOR.childP, nm: PRIOR.nm,
      shape: { ...(f.shape || {}), norm: PRIOR.nm } };
  }) })) };
}
const ARM = makeArms(await import('./.cache/shipped.mjs'));
const MEM = g === 'man' ? 'loose2' : 'loose';
const BASE = { hold: true, clampPad: 0.02, cut: true, mem: MEM };
console.log(`gender=${g}  corrupted share ${(RATE * 100).toFixed(0)}%`);
console.log('\narm                                EXPOSURE  FALSECOVER   PHANTOM');
for (const [name, opts, rate] of [
  ['clean corpus (control)', BASE, 0],
  ['1082 ABSTAIN on signal-less', BASE, RATE],
  ['1083 INERT on signal-less', { ...BASE, inertNoSignal: true }, RATE],
]) {
  const arm = ARM(opts);
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
  k = 0;
  for (const w of wins) {
    const src = rate > 0 ? corruptAlt(w, rate) : w;
    const s = score(arm(thin(src, 3), g), g, (c) => cropLabel.get(c));
    for (const kk of Object.keys(agg)) agg[kk] += s[kk];
  }
  console.log(name.padEnd(34) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
    (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
}
