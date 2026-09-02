// WHAT DOES THE SHIPPED PER-FRAME ARM DO WITH THE CLEAR BAR MOVED?
//
// A5's apparent gain decomposed into (a) pooling and (b) lowering the
// pooled bar. (b) is `clear-bar-roc.mjs`'s already-refuted move, so this
// file asks the control question: move the bar on the arm that SHIPS.
//
// THREE THINGS WERE WRONG WITH THE FIRST ANSWER, all found by the
// phase-D critic and all fixed here.
//
// 1. IT RAN UNTHINNED (D2). Every window was handed whole, so the
//    tracker was told 500ms and coasted 1250ms -- the row 13 exists to
//    retract -- while the table was published as "same k=3". It thins at
//    K and is told HIS_EFFZOOM now.
//
// 2. IT SWEPT TWO CONSTANTS TOGETHER AND ONE WAS INERT (D3). The bar is
//    chosen by the READ's own label (`t === "female" ? vfe : yfe`, loop
//    39), so in MAN mode only `GENDER_CLEAR_SCORE` is live and in WOMAN
//    mode only `GENDER_CLEAR_SCORE_FEMALE` is. A man-mode sweep of the
//    pair therefore never tested `_FEMALE` at all -- and `_FEMALE` is a
//    separate OTA key with its own clamp [0.30, 0.90]. Each constant is
//    swept ALONE against the shipped pair now, so a flat column means
//    "this constant does nothing in this mode" and says so.
//
// 3. IT HAND-ROLLED THE ARM. Fifteen lines re-implementing what
//    `makeArms` does, which is how the option set drifted (D5). It calls
//    `makeArms(patchedModule)(hisRegimeOpts(g))` now: the SHIPPED
//    behaviour, with only the swept constant different.
//
// The first row of each sweep is the shipped value, which makes it a
// self-check -- it must reproduce the A0 row above it, line for line,
// and `patchConsts` at the shipped value must be byte-identical.
//
// Usage: GENDER=man node bench/critic-lowbar.mjs
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { ROOT, winFiles } from './corpus-lib.mjs';
import { score } from './corpus-score.mjs';
import {
  loadWin, makeArms, armSubject, ARM, POOL_BAR,
  HIS_EFFZOOM, K_HIS, thinFrames, hisRegimeOpts,
} from './arch-arms.mjs';
import { patchConsts, shippedBar } from './_patch.mjs';

const src = fs.readFileSync(new URL('./.cache/shipped.mjs', import.meta.url), 'utf8');
const g = process.env.GENDER || 'man';
const K = Number(process.env.K || K_HIS);
const TOLD = Number(process.env.TOLD || HIS_EFFZOOM);
const OPTS = hisRegimeOpts(g, TOLD);

const L = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cl = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (L[c.id]) for (const m of c.members) cl.set(m.crop, L[c.id]);
const wins = winFiles().map(loadWin);

function run(a) {
  const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0, coveredS: 0, sharpOkS: 0 };
  for (const w of wins) {
    const s = score(a(thinFrames(w, K), g), g, (c) => cl.get(c));
    for (const k in agg) agg[k] += s[k];
  }
  return agg;
}
const line = (n, af) => {
  const a = run(af);
  console.log(n.padEnd(40) + a.exposureS.toFixed(1).padStart(8)
    + a.falseCoverS.toFixed(1).padStart(12) + a.phantomS.toFixed(1).padStart(9)
    + a.coveredS.toFixed(1).padStart(10) + a.sharpOkS.toFixed(1).padStart(9));
};

// One patched module per (constant, value). Cached by name so a repeat
// value does not re-import.
const seen = new Map();
async function armAt(values, tag) {
  const key = JSON.stringify(values);
  if (!seen.has(key)) {
    const patched = patchConsts(src, values);
    const p = fileURLToPath(new URL(`./.cache/critic-lb-${tag}.mjs`, import.meta.url));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, patched);
    const mod = await import(pathToFileURL(p).href + '?v=' + tag);
    seen.set(key, makeArms(mod)(OPTS));
  }
  return seen.get(key);
}

const [SHIP_M, SHIP_F] = shippedBar(src);
console.log(`gender=${g}  ${wins.length} windows  k=${K} (${(K * 0.5).toFixed(1)}s/verdict)  told ${TOLD}ms`);
console.log(`shipped clear bar ${SHIP_M} (male read) / ${SHIP_F} (female read)`);
console.log('');
console.log('arm                                   EXPOSURE  FALSECOVER  PHANTOM   covered   sharp');

// The unpatched shipped arm, from the same options. The first row of
// each sweep below must reproduce it exactly.
line(`A0 shipped, unpatched`, ARM(OPTS));

// EACH CONSTANT ALONE. The other stays shipped, so a flat column is a
// statement about THIS constant in THIS mode and nothing else.
console.log('');
console.log(`-- GENDER_CLEAR_SCORE swept, _FEMALE held at ${SHIP_F}`);
for (const m of [SHIP_M, 0.40, 0.35, 0.30, 0.25, 0.60, 0.90]) {
  const a = await armAt({ GENDER_CLEAR_SCORE: m, GENDER_CLEAR_SCORE_FEMALE: SHIP_F }, `m${m}`);
  line(`  GENDER_CLEAR_SCORE ${m.toFixed(2)}`, a);
}

console.log('');
console.log(`-- GENDER_CLEAR_SCORE_FEMALE swept, male bar held at ${SHIP_M}`);
for (const f of [SHIP_F, 0.30, 0.45, 0.60, 0.90]) {
  const a = await armAt({ GENDER_CLEAR_SCORE: SHIP_M, GENDER_CLEAR_SCORE_FEMALE: f }, `f${f}`);
  line(`  GENDER_CLEAR_SCORE_FEMALE ${f.toFixed(2)}`, a);
}

// THE JOINT MOVE, which is what an OTA push would actually be -- both
// keys are on the channel and nothing stops a tuning.json carrying both.
console.log('');
console.log('-- both together (what one tuning.json can do)');
for (const [m, f] of [[0.40, 0.30], [0.30, 0.25]]) {
  const a = await armAt({ GENDER_CLEAR_SCORE: m, GENDER_CLEAR_SCORE_FEMALE: f }, `b${m}_${f}`);
  line(`  ${m.toFixed(2)} / ${f.toFixed(2)}`, a);
}

// THESE TWO WERE THE SAME ARM. `poolBar` was never read, so "bar .60"
// and "bar .40" both ran at the module constant and printed identical
// rows. Labelled by the number that is actually applied now.
console.log('');
line(`A1 pool, bar ${POOL_BAR.toFixed(2)} (default)`, armSubject(OPTS));
line('A1 pool, bar 0.60', armSubject({ ...OPTS, poolBar: 0.60 }));
