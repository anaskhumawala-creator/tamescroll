// WHAT ELEVEN RELEASES BOUGHT, as one number he can read.
//
// He asked "from 1080 what improvement did we make" and nothing in this
// repo could answer it. Every A/B here prices ONE constant against the
// arm beside it; nobody had ever run the release he installed against
// the release he runs.
//
// THE 1080 CONFIGURATION, read out of the tree at commit 94f7ee6
// ("1080: the clear bar and the adjacency clamp, for a device run")
// rather than remembered:
//
//   PTRACK_IOU_MIN            0.2   (1090 shipped 0.15)
//   CUT_DELTA                 28    (1085 shipped 50, then 60)
//   PTRACK_ASSIGN             absent -- greedy (1091 shipped optimal)
//   PTRACK_MIN_COAST_PASSES   2     (unchanged, still 2)
//
// 1080 already had the clear bar (0.45/0.35) and `body-clamp.mjs`; those
// are what that release WAS, so they stay on in both arms.
//
// WHAT THIS CANNOT PRICE, and it matters for reading the total. Four of
// the eleven releases changed behaviour the corpus replay cannot see:
// 1083's no-descriptor-signal guard, 1084's memory-push guard, 1087's
// unreadable-adult fix and 1088's birth rung are all modelled by
// `hisRegimeOpts` flags that are ON in both arms here, because the arm
// options are not versioned. So this is the DECISION-LAYER delta only,
// and the honest total is at least this and probably more.
//
// And 1089's letterbox fix is on the WHOLE-FRAME path, which is the four
// non-YouTube platforms -- outside this instrument entirely.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { winFiles, ROOT } from './corpus-lib.mjs';
import {
  makeArms, loadWin, thinFrames, hisRegimeOpts, K_HIS, CONTROL,
} from './arch-arms.mjs';
import { score } from './corpus-score.mjs';
import { patchConsts } from './_patch.mjs';

const K = Number(process.env.K || K_HIS);
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropLabel = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  if (labels[c.id]) for (const m of c.members) cropLabel.set(m.crop, labels[c.id]);

const shippedPath = fileURLToPath(new URL('./.cache/shipped.mjs', import.meta.url));
const src = fs.readFileSync(shippedPath, 'utf8');

// CUT_DELTA is deliberately NOT patched, and saying so is the point.
// `bank/cuts.json` holds BOOLEANS decided at the shipped threshold, so a
// variant constant has nothing to re-decide -- findings 10 records this
// and `bench/cut-value.mjs` refuses to print a sweep because of it. So
// the cut half of 1080 -> 1091 is invisible here and the delta below is
// the association + assignment half only.
// `PTRACK_ASSIGN` is a STRING, so `patchConsts` refuses it -- correctly:
// its whole job is to fail loudly rather than sweep nothing. The module
// exports `setAssign` for exactly this, and it is what `assign-ab.mjs`
// uses. Restored in a `finally` so one arm cannot leak into the next.
const ARMS = [
  ['1080  greedy, iou 0.20', 0.2, 'greedy'],
  ['1090  greedy, iou 0.15', 0.15, 'greedy'],
  ['1091  optimal, iou 0.15', 0.15, 'optimal'],
];

async function run(g, name, iou, assign) {
  const key = name.replace(/[^a-z0-9]/gi, '');
  const f = fileURLToPath(new URL(`./.cache/rel${key}.mjs`, import.meta.url));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, patchConsts(src, { PTRACK_IOU_MIN: iou }));
  const V = await import(pathToFileURL(f).href + '?v=' + key);
  V.setAssign(assign);
  try {
    const arm = makeArms(V)(hisRegimeOpts(g));
    const agg = { exposureS: 0, falseCoverS: 0, phantomS: 0 };
    for (const file of winFiles()) {
      const s = score(arm(thinFrames(loadWin(file), K), g), g, (c) => cropLabel.get(c));
      for (const k of Object.keys(agg)) agg[k] += s[k];
    }
    return agg;
  } finally {
    V.setAssign('optimal');
  }
}

console.log(`18 windows, k=${K} (${(K * 0.5).toFixed(1)}s/verdict), his regime`);
console.log('exposure = someone who should be covered was left sharp');
console.log('falseCover = someone who should be sharp was covered');
console.log('phantom = a patch on nobody -- the "random blur marks"');

for (const g of ['man', 'woman']) {
  console.log('');
  console.log(`-- ${g.toUpperCase()}${g === 'man' ? '  (HIS SETTING)' : ''} --`);
  console.log('arm'.padEnd(26) + '  exposure   falseCover     phantom');
  let first = null;
  for (const [name, iou, assign] of ARMS) {
    const a = await run(g, name, iou, assign);
    if (!first) first = a;
    const d = (k) => {
      const v = a[k];
      if (a === first) return `${v.toFixed(1)}s`.padStart(12);
      const p = first[k] ? (100 * (v - first[k]) / first[k]) : 0;
      return `${v.toFixed(1)}s ${p >= 0 ? '+' : ''}${p.toFixed(0)}%`.padStart(12);
    };
    console.log(name.padEnd(26) + d('exposureS') + d('falseCoverS') + d('phantomS'));
  }
  // The shipped arm must land on the published control triple, or every
  // percentage above is against a baseline nobody can reproduce.
  const want = CONTROL[g];
  const L = ARMS[ARMS.length - 1];
  const last = await run(g, L[0], L[1], L[2]);
  if (last.exposureS !== want.exposureS || last.falseCoverS !== want.falseCoverS
    || last.phantomS !== want.phantomS) {
    console.error(`SHIPPED ARM DID NOT REPRODUCE THE CONTROL TRIPLE in ${g}: `
      + `${last.exposureS}/${last.falseCoverS}/${last.phantomS} against `
      + `${want.exposureS}/${want.falseCoverS}/${want.phantomS}`);
    process.exitCode = 2;
  }
}

console.log('');
console.log('SCOPE, and it bounds the total in BOTH directions.');
console.log('CUT_DELTA 28 -> 60 is NOT in this table: the corpus banks cut');
console.log('BOOLEANS, so a variant threshold has nothing to re-decide');
console.log('(findings 10). 1085 was measured on his own footage instead --');
console.log('17 of 27 "cuts" were his camera moving. And 1083/1084/1087/');
console.log('1088 are modelled by hisRegimeOpts flags that are on in BOTH');
console.log('arms, because the arm options are not versioned. So this is');
console.log('the association + assignment delta only, and the real');
console.log('improvement from 1080 is AT LEAST this.');
