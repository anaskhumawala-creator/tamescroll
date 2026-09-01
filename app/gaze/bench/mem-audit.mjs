import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const ARM = makeArms(await import('./.cache/shipped.mjs'));
for (const [g, mode, lean] of [['man', 'loose2', true], ['woman', 'loose', true]]) {
  const audit = [];
  const arm = ARM({ hold: true, clampPad: 0.02, cut: true, mem: mode, lean: lean, memAudit: audit });
  for (const w of wins) arm(thin(w, 3), g);
  const shouldCover = (l) => g === 'man' ? (l === 'woman' || l === 'child') : (l === 'man' || l === 'child');
  const tal = {};
  for (const a of audit) { const l = cropLabel.get(a.crop) || 'unlabelled'; tal[l] = (tal[l] || 0) + 1; }
  const bad = audit.filter((a) => shouldCover(cropLabel.get(a.crop)));
  // THE BENCH DOES NOT APPLY THE PX FLOOR -- the corpus banks a read for
  // every face regardless of size, so a face the shipped path would
  // never have asked still carries a verdict here. A firing under
  // FACE_MIN_NATIVE_PX cannot happen in the app, so it is reported
  // separately rather than silently dropped.
  const bad40 = bad.filter((a) => a.px >= 40);
  console.log(`\ngender=${g} mem=${mode}+lean   memory fired ${audit.length} times`);
  for (const k of Object.keys(tal).sort()) console.log('   ' + k.padEnd(12) + tal[k]);
  console.log(`   >>> fired on someone who SHOULD BE COVERED: ${bad.length}` +
    (bad.length ? '   (of which px>=40, i.e. reachable in the app: ' + bad40.length + ')  ' + bad.slice(0, 6).map((b) => `sim ${b.sim.toFixed(2)} raw ${b.raw.toFixed(2)} px ${Math.round(b.px)} nm ${b.nm.toFixed(1)} ${b.crop}`).join(' | ') : ''));
}
