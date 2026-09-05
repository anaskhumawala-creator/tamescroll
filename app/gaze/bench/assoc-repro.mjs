// SELF-CHECK: does this scorer reproduce finding 47's published table?
// rgb 21.8% / grey 18.2% false cover on men at woman exposure <= 1.6%,
// full 2,159-read population, no tracker involved. If it does not, every
// number assoc-value.mjs prints is measuring something else.
import fs from 'fs';
const ROOT = 'Z:/tamescroll-corpus';
const reads = JSON.parse(fs.readFileSync(`${ROOT}/bank/gpu-grey-mirror.json`, 'utf8'));
const BUDGET = 0.016;
function scoreAt(scored) {
  const women = scored.filter((r) => r.who === 'woman').map((r) => r.score).sort((a, b) => b - a);
  const men = scored.filter((r) => r.who === 'man').map((r) => r.score);
  const allow = Math.floor(BUDGET * women.length);
  const bar = women[allow] + 1e-12;
  return { exp: 100 * women.filter((v) => v >= bar).length / women.length,
           fc: 100 * men.filter((v) => v < bar).length / men.length, nW: women.length, nM: men.length };
}
function auc(scored) {
  const m = scored.filter((r) => r.who === 'man').map((r) => r.score);
  const w = scored.filter((r) => r.who === 'woman').map((r) => r.score);
  let win = 0;
  for (const a of m) for (const b of w) win += a > b ? 1 : a === b ? 0.5 : 0;
  return win / (m.length * w.length);
}
console.log('arm      n     women  men    false cover @ exp<=1.6%   AUC');
for (const arm of ['rgb', 'grey', 'rgbMir', 'greyMir']) {
  const scored = reads.filter((r) => r[arm]).map((r) => ({ who: r.who, score: r[arm].raw }));
  const s = scoreAt(scored);
  console.log(`${arm.padEnd(8)} ${String(scored.length).padStart(5)} ${String(s.nW).padStart(5)}  ${String(s.nM).padStart(5)}    ${s.fc.toFixed(1).padStart(6)}%  (exp ${s.exp.toFixed(1)}%)   ${auc(scored).toFixed(4)}`);
}
console.log('');
console.log('finding 47 publishes: rgb 21.8  grey 18.2  rgbMir 21.5  greyMir 17.2');
console.log('');
// ORACLE track mean on the FULL population, the proposal's own arm.
console.log('ORACLE identity mean on the full population (the proposal\'s table):');
for (const K of [2, 3, 5, Infinity]) {
  const hist = new Map();
  const scored = reads.map((r) => {
    const k = r.vid + '|' + r.cid;
    if (!hist.has(k)) hist.set(k, []);
    const h = hist.get(k); h.push(r.grey.raw);
    const use = K === Infinity ? h : h.slice(-K);
    let s = 0; for (const v of use) s += v;
    return { who: r.who, score: s / use.length };
  });
  const s = scoreAt(scored);
  console.log(`  K=${String(K === Infinity ? 'all' : K).padEnd(4)} ${s.fc.toFixed(1).padStart(6)}%  (exp ${s.exp.toFixed(1)}%)   AUC ${auc(scored).toFixed(4)}`);
}
console.log('proposal claims: K=3 11.4 / K=5 9.8 / K=all 5.9, single 18.2');
