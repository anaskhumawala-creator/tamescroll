// THE CLOSE-UP BODY IS 63% OF THE FRAME AND THAT IS WHY BOTH OF THEM
// ARE UNDER ONE PATCH.
//
// Read off his phone LIVE under 1083, from the observation ring: a
// single synthetic body reads b [0.1, 0.098, 0.8, 1.0] -- 0.70 wide by
// 0.90 tall for ONE face. The width is exactly PFF_HALF_CAP*2, so the
// close-up cap is binding and 0.70 is still most of the picture; the
// vertical is uncapped by design (cy + 6.0h).
//
// person-gate's own note says the widest MoveNet box ever observed in
// the two bands where the cap binds is 0.650 and 0.590, so there is
// measured room below 0.70 before the patch is narrower than a
// successful person pass would have drawn. This sweeps that room.
import fs from 'fs';
import { ROOT } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms } from './arch-arms.mjs';
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);
const wins = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).map(loadWin);
const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });
const mods = [['1083 cap .35', './.cache/shipped.mjs'],
  ['halfCap .30 (0.60 wide)', './.cache/cap0.30.mjs'],
  ['halfCap .25 (0.50 wide)', './.cache/cap0.25.mjs'],
  ['halfCap .22 (0.44 wide)', './.cache/cap0.22.mjs'],
  ['closeup h .12', './.cache/cu0.12.mjs'],
  ['closeup h .08', './.cache/cu0.08.mjs']];
for (const g of ['man', 'woman']) {
  const MEM = g === 'man' ? 'loose2' : 'loose';
  const BASE = { hold: true, clampPad: 0.02, cut: true, mem: MEM, inertNoSignal: true };
  console.log(`\ngender=${g}` + '\narm                        EXPOSURE  FALSECOVER   PHANTOM');
  for (const [name, path] of mods) {
    const arm = makeArms(await import(path))(BASE);
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    for (const w of wins) {
      const s = score(arm(thin(w, 3), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    console.log(name.padEnd(26) + (agg.exposureS.toFixed(1) + 's').padStart(9) +
      (agg.falseCoverS.toFixed(1) + 's').padStart(12) + (agg.phantomS.toFixed(1) + 's').padStart(10));
  }
}
