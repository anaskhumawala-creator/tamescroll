// IS THIS CORPUS HIS POPULATION? Compared against the numbers measured
// live on his phone (1078, watch page, 90s, 300-entry ring) recorded in
// docs/handoff-video-blur.md. If the corpus does not reproduce them it
// is the wrong population and nothing calibrated on it transfers.
import fs from 'fs';
import { isNullRead, GENDER_CLEAR_SCORE, NULL_MINT_NM_FLOOR } from './.cache/shipped.mjs';
import { ROOT } from './corpus-lib.mjs';
const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
const faces = [];
for (const f of fs.readdirSync(`${ROOT}/bank/reads`).filter((x) => x.endsWith('.json')))
  for (const fr of JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8')).frames)
    faces.push(...fr.faces);
const rd = (x) => ({ gender: x.gender, score: x.score, raw: x.raw, age: x.age, childP: x.childP, shape: x.shape });
const nulls = faces.filter((x) => isNullRead(rd(x)));
const male = faces.filter((x) => x.gender === 'male');
const female = faces.filter((x) => x.gender === 'female');
const clearing = faces.filter((x) => x.score >= GENDER_CLEAR_SCORE);
const nm = (a) => a.map((x) => x.nm).filter((v) => typeof v === 'number');
console.log('reads', faces.length);
console.log(`  null reads      ${nulls.length} = ${(100 * nulls.length / faces.length).toFixed(1)}%      [his phone: 89/300 = 29.7%]`);
console.log(`  male / female   ${male.length} / ${female.length}                 [his phone: 284 / 3]`);
console.log(`  male raw p50    ${q(male.map((x) => x.raw), 0.5).toFixed(3)}                [his phone: 0.786]`);
console.log(`  over CLEAR bar  ${clearing.length}/${faces.length} = ${(100 * clearing.length / faces.length).toFixed(0)}%   [his phone: 137/284 male = 48%]`);
console.log(`  px p05/p50/p95  ${q(faces.map((x) => x.px), 0.05).toFixed(0)}/${q(faces.map((x) => x.px), 0.5).toFixed(0)}/${q(faces.map((x) => x.px), 0.95).toFixed(0)}          [his phone: p50 38-62]`);
console.log(`  nm p50 clearing ${q(nm(clearing), 0.5).toFixed(2)}               [his phone: 12.66]`);
console.log(`  nm p50 null     ${q(nm(nulls), 0.5).toFixed(2)}                [his phone: 2.88]`);
console.log(`  nm < floor(${NULL_MINT_NM_FLOOR})   ${nm(faces).filter((v) => v < NULL_MINT_NM_FLOOR).length}/${nm(faces).length}`);
