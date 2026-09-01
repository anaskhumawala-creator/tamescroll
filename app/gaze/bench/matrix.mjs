// THE MATRIX, rebuilt after an adversarial review took the first version
// apart. Every arm is scored at TWO cadences, because the corpus is
// banked at 2fps and the replay treats every frame as a verdict pass --
// which is 0.5s per verdict against his phone's MEASURED 1.45s. An arm
// scored only at k=1 is scored at three times the evidence rate the app
// actually gets, and a pooled decision is exactly the thing that
// flatters.
//
// AND IT CARRIES THE CONTROL THE FIRST VERSION LACKED: the shipped
// per-frame layer with ONE CONSTANT CHANGED (GENDER_CLEAR_SCORE 0.60 ->
// 0.45). Without it, "the per-subject architecture won" cannot be told
// apart from "the bar got lower", and the pooled arm's own bar is 0.40.
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

// A bundle with one shipped constant changed and nothing else.
const src = fs.readFileSync('./.cache/shipped.mjs', 'utf8');
const patched = src
  .replace('var GENDER_CLEAR_SCORE = 0.6;', 'var GENDER_CLEAR_SCORE = 0.45;')
  .replace('var GENDER_CLEAR_SCORE_FEMALE = 0.45;', 'var GENDER_CLEAR_SCORE_FEMALE = 0.35;');
if (patched === src) throw new Error('constant patch failed -- the bundle changed shape');
fs.mkdirSync('./.cache', { recursive: true });
fs.writeFileSync('./.cache/lowbar.mjs', patched);
const LOW = await import('./.cache/lowbar.mjs');

const ARM = makeArms(await import('./.cache/shipped.mjs'));
const ARM_LOW = makeArms(LOW);

const ARMS = [
  ['A0  1078 (hold off)', ARM({})],
  ['A0  1079 SHIPPED', ARM({ hold: true })],
  ['A0  1079 + bar .45  <- control', ARM_LOW({ hold: true })],
  ['A5  per-subject pool', ARM({ hold: true, pool: true })],
  ['A5  + adjacency clamp', ARM({ hold: true, pool: true, clampPad: 0.02 })],
  ['A5  + clamp, bar .45', ARM_LOW({ hold: true, pool: true, clampPad: 0.02 })],
  // The cheap candidate the review points at: keep the SHIPPED per-frame
  // verdict, lower the one constant, and clamp the body box off that
  // verdict. No pooling, no identity memory, no vote counting -- so
  // nothing to starve when the cadence drops.
  ['A0  1079 + bar .45 + CLAMP', ARM_LOW({ hold: true, clampPad: 0.02 })],
  ['A0  1079 + CLAMP only', ARM({ hold: true, clampPad: 0.02 })],
];

/**
 * Every Nth frame keeps its reads. What the OTHER frames become is a
 * modelling choice, and it turns out to decide the answer:
 *
 *   'position'  the face is still observed, the box still moves, no
 *               verdict is remade -- a position pass in the GENERAL
 *               case, where MoveNet admitted somebody.
 *   'coast'     no observation at all; the track coasts on velocity.
 *               HIS regime, measured three times (loops 35/36/37): all
 *               twelve MoveNet slots read n:0 on his phone, so a pass
 *               that does not run faceres observes nobody.
 *
 * The first version of this bench had only 'position', and modelled it
 * with the face still carrying its read -- which let a face push a
 * clamp edge on a frame the app spent no inference on. No shippable
 * code can do that.
 */
function thin(win, every, mode) {
  if (every <= 1) return win;
  return { ...win, frames: win.frames.map((fr, i) => {
    if (i % every === 0) return fr;
    if (mode === 'coast') return { ...fr, faces: [], _labelFaces: fr.faces };
    return { ...fr, faces: fr.faces.map((f) => ({ ...f, _noRead: true })) };
  }) };
}

const MODES = [[1, 'position'], [3, 'position'], [3, 'coast']];
for (const [every, mode] of MODES) {
  const secs = (0.5 * every).toFixed(1);
  console.log(`
=== ${secs}s per verdict, non-verdict frames ${mode} ` +
    (every === 3 ? (mode === 'coast'
      ? '<- HIS REGIME (MoveNet n:0, a non-verdict pass observes NOBODY)'
      : '<- his cadence, general regime')
      : '(3x his rate -- the bank rate, not the app)') + ' ===');
  console.log('arm                                EXPOSURE  FALSECOVER   PHANTOM   covered  sharp');
  for (const [name, arm] of ARMS) {
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
    for (const win of wins) {
      const s = score(arm(thin(win, every, mode), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    console.log(name.padEnd(33) +
      (agg.exposureS.toFixed(1) + 's').padStart(10) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) +
      (agg.phantomS.toFixed(1) + 's').padStart(10) +
      (agg.coveredS.toFixed(1) + 's').padStart(10) +
      (agg.sharpOkS.toFixed(1) + 's').padStart(8));
  }
}
