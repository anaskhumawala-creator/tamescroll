// DOES APPLYING THE VERDICT AT BIRTH PAY, AT THE SHIPPED CUT THRESHOLD?
//
// The change (loop 41, shipped in 1088): newTrack hardcoded
// state:'blurred' and threw away the read that birthed the track. It now
// takes the SAME rung a matched track takes -- `obs.instant`, which at
// birth is the only reachable term of
// `obs.instant || clearMs >= CLEAR_HOLD_MS || clearStreak >= CLEAR_STREAK_N`.
//
// RE-RUN, because the first measurement of this was taken against a
// STALE bank/cuts.json holding CUT_DELTA 28 booleans while the app ships
// 50 -- 221 cut frames against the true 115. A cut wipes every track, so
// the stale file roughly doubled the number of births the change gets to
// act on, in the direction that FLATTERS it.
//
// The BEFORE arm is built by patching the shipped bundle back, so the
// two arms differ in exactly one expression and nothing else.
import fs from 'fs';
import { ROOT, winFiles } from '../bench/corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import { loadWin, makeArms, cutBankDelta } from './arch-arms.mjs';

const g = process.env.GENDER || 'man';
const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
// The BEFORE arm makes bornCleared always false, which is exactly the
// pre-change behaviour (`state: 'blurred'` hardcoded) and leaves the
// birthCleared/birthBlurred counters intact so both arms stay readable.
// The bundler may reshape whitespace, so locate the function rather than
// assume its formatting -- and THROW if it is not found. A patch that
// silently does nothing is how a null result gets reported as a win, and
// this guard has already fired once, on the refactor that moved the
// expression into bornCleared.
const m = /(function bornCleared\([A-Za-z0-9_$]+\)\s*\{[\s\S]*?var\s+[A-Za-z0-9_$]+\s*=\s*)(!!\()/.exec(src);
if (!m) throw new Error('bornCleared not found in the bundle -- it changed shape');
fs.writeFileSync(new URL('./.cache/preBirth.mjs', import.meta.url),
  src.replace(m[0], m[1] + 'false && ('));
const OLD = await import('./.cache/preBirth.mjs');

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m2 of c.members) cropLabel.set(m2.crop, labels[c.id]);
const wins = winFiles().map(loadWin);

const thin = (w, e) => ({ ...w, frames: w.frames.map((fr, i) =>
  i % e === 0 ? fr : { ...fr, faces: [], _labelFaces: fr.faces }) });

const NEWARM = makeArms(await import('./.cache/shipped.mjs'));
const OLDARM = makeArms(OLD);
const OPTS = { hold: true, clampPad: 0.02, cut: true };

// k=3 is his regime: the corpus banks at 2fps and the replay treats
// every frame as a verdict, so k=1 is 0.5s per verdict against his
// MEASURED 1.45s. Both are reported -- an arm that only wins at the
// cadence the app does not have is not a win.
for (const k of [3, 1]) {
  const row = (name, arm) => {
    let e = 0, fc = 0, ph = 0;
    for (const w of wins) {
      const s = score(arm(thin(w, k), g), g, (c) => cropLabel.get(c));
      e += s.exposureS; fc += s.falseCoverS; ph += s.phantomS;
    }
    console.log(`  ${name.padEnd(22)} exposure ${e.toFixed(1).padStart(7)}s` +
      `   falseCover ${fc.toFixed(1).padStart(7)}s   phantom ${ph.toFixed(1).padStart(7)}s`);
    return [e, fc, ph];
  };
  console.log(`\n${g} mode, k=${k} (${(k * 0.5).toFixed(1)}s per verdict), ` +
    // FROM THE BANK'S OWN STAMP. This was the literal `CUT_DELTA 50`,
    // so when the shipped constant moved to 60 the arm kept PRINTING 50
    // over numbers measured at 60 -- and the -38.0s it produced was
    // copied into shipped source as the benefit of a change that
    // actually costs +5.0s of exposure at the value that ships. A label
    // that cannot be wrong is worth more than a comment saying so.
    `${wins.length} windows, CUT_DELTA ${cutBankDelta()}`);
  const a = row('BEFORE (born blurred)', OLDARM(OPTS));
  const b = row('AFTER  (birth rung)', NEWARM(OPTS));
  console.log(`  ${'delta'.padEnd(22)}          ${(b[0] - a[0] >= 0 ? '+' : '')}` +
    `${(b[0] - a[0]).toFixed(1)}s              ${(b[1] - a[1] >= 0 ? '+' : '')}` +
    `${(b[1] - a[1]).toFixed(1)}s              ${(b[2] - a[2] >= 0 ? '+' : '')}` +
    `${(b[2] - a[2]).toFixed(1)}s`);
}
