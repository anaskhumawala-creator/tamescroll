// WHAT THE TRACK MEAN IS WORTH WHEN IT IS AVERAGED OVER THE TRACKS THE
// SHIPPED TRACKER ACTUALLY BUILDS.
//
// bench/assoc-truth.mjs measures the association itself. This one closes
// the loop: it re-runs the proposal's OWN table -- false cover on men at
// woman-exposure <= 1.6%, matched exposure, the only comparison this
// repo accepts -- three ways.
//
//   single    the read that ships today
//   oracle    mean over the last K reads of the SAME GROUND-TRUTH
//             IDENTITY, which is what the proposal's table assumed
//   real      mean over the last K reads ON THE SAME TRACK, which is
//             what the app can actually build
//
// The gap between `oracle` and `real` IS the cost of mis-association,
// priced in the currency the decision is made in, instead of inferred
// from a corruption sweep whose corruption was synthetic.
//
// SELF-CHECK FIRST: the `single` arm must reproduce the published 18.2%
// (finding 47, grey, matched exposure). An arm that cannot reproduce a
// number already in the record is not measuring the same thing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = 'Z:/tamescroll-corpus';
const ARMNAME = process.env.ARM || 'control';
const track = JSON.parse(fs.readFileSync(path.join(HERE, `.cache/assoc-truth-${ARMNAME}-man.json`), 'utf8'));
const reads = JSON.parse(fs.readFileSync(`${ROOT}/bank/gpu-grey-mirror.json`, 'utf8'));
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));

// crop -> the SHIPPED read (grey, which is what 1103 ships) and truth
const byCrop = new Map();
for (const r of reads) byCrop.set(r.crop, { raw: r.grey.raw, who: r.who, cid: r.cid });

// The tracker's rows, in frame order, joined to the read.
const rows = [];
for (const r of track.rows) {
  const rd = byCrop.get(r.crop);
  if (!rd) continue;
  rows.push({ ...r, raw: rd.raw, who: rd.who });
}
const missing = track.rows.length - rows.length;

// running mean of the last K raw values within a group key
function meanArm(keyOf, K) {
  const hist = new Map();
  return rows.map((r) => {
    const k = keyOf(r);
    if (!hist.has(k)) hist.set(k, []);
    const h = hist.get(k);
    h.push(r.raw);
    const use = K === Infinity ? h : h.slice(-K);
    let s = 0; for (const v of use) s += v;
    return { ...r, score: s / use.length };
  });
}

// MATCHED EXPOSURE. Man mode: a read is CLEARED when it reads male
// enough. Exposure = a woman cleared. False cover = a man not cleared.
// Solve each arm's own bar to the same woman exposure, then read false
// cover -- the rule findings 29/40/41/45/47/50 all turn on.
function scoreAt(scored, expBudget) {
  const women = scored.filter((r) => r.who === 'woman').map((r) => r.score).sort((a, b) => b - a);
  const men = scored.filter((r) => r.who === 'man').map((r) => r.score);
  if (!women.length || !men.length) return null;
  // largest bar count of women allowed above it
  const allow = Math.floor(expBudget * women.length);
  // bar just above the (allow)-th highest woman score
  const bar = allow >= women.length ? -Infinity : women[allow] + 1e-12;
  const exposed = women.filter((v) => v >= bar).length;
  const fc = men.filter((v) => v < bar).length;
  return { bar, expPct: 100 * exposed / women.length, fcPct: 100 * fc / men.length,
           nW: women.length, nM: men.length };
}

function auc(scored) {
  const m = scored.filter((r) => r.who === 'man').map((r) => r.score);
  const w = scored.filter((r) => r.who === 'woman').map((r) => r.score);
  let win = 0;
  for (const a of m) for (const b of w) win += a > b ? 1 : a === b ? 0.5 : 0;
  return win / (m.length * w.length);
}

const BUDGET = 0.016;
const out = [];
out.push(`TRACK-MEAN VALUE OVER REAL TRACKS -- arm '${ARMNAME}', grey reads, man mode`);
out.push(`  ${rows.length} reads joined (${missing} tracker rows had no banked grey read)`);
out.push(`  men ${rows.filter((r) => r.who === 'man').length}, women ${rows.filter((r) => r.who === 'woman').length}`);
out.push(`  identities ${new Set(rows.map((r) => r.cid)).size}, tracks ${new Set(rows.map((r) => r.win + '|' + r.tid)).size}`);
out.push('');
out.push('grouping   K      false cover on men @ woman exposure <=1.6%     AUC');
// REMEDY ARM: reset the mean on a scene cut. `demoteTracks` KEEPS the
// track id and box across a cut (person-track.mjs:1983 -- it resets
// clearMs/clearStreak/weakStreak and sets state 'blurred', but `id` and
// `box` survive), so a mean keyed on the track id would ride straight
// through a shot change unless it is reset explicitly. This arm prices
// that reset.
let epoch = 0, lastWin = null;
for (const r of rows) {
  if (r.win !== lastWin) { epoch = 0; lastWin = r.win; }
  if (r.cut) epoch++;
  r.epoch = epoch;
}
const arms = [];
for (const [name, keyOf] of [
  ['oracle', (r) => r.win + '|' + r.cid],
  ['real  ', (r) => r.win + '|' + r.tid],
  ['cutrst', (r) => r.win + '|' + r.tid + '|' + r.epoch],
]) {
  for (const K of [1, 2, 3, 5, Infinity]) {
    if (name === 'oracle' && K === 1) continue;
    const scored = meanArm(keyOf, K);
    const s = scoreAt(scored, BUDGET);
    arms.push({ name: name.trim(), K, s, auc: auc(scored), scored });
    out.push(`${name}   ${String(K === Infinity ? 'all' : K).padEnd(4)}  ${s.fcPct.toFixed(1).padStart(6)}%   (exposure ${s.expPct.toFixed(1)}%)               ${auc(scored).toFixed(4)}`);
  }
  if (name === 'oracle') out.push('');
}
// the shipped single read is K=1 under either grouping
{
  const scored = meanArm((r) => r.win + '|' + r.tid, 1);
  const s = scoreAt(scored, BUDGET);
  out.push('');
  out.push(`SHIPS TODAY (single read)      ${s.fcPct.toFixed(1)}%   (exposure ${s.expPct.toFixed(1)}%)               ${auc(scored).toFixed(4)}`);
  out.push('  reference: finding 47 publishes 18.2% for grey on the full 2,159-read');
  out.push('  population. This is the K_HIS-thinned half of it, so a few points of');
  out.push('  drift is expected; a LARGE gap would mean the populations differ.');
}

// GENDER-RELEVANT POLLUTION. Identity mis-association only hurts a
// GENDER mean when the foreign read belongs to the other gender.
out.push('');
out.push('-- pollution of the averaged window, split by whether it can move a gender mean --');
out.push('K     foreign reads   of which OPPOSITE gender   (this is what a gender mean feels)');
const seq = new Map();
for (const r of rows) {
  const k = r.win + '|' + r.tid;
  if (!seq.has(k)) seq.set(k, []);
  seq.get(k).push(r);
}
for (const K of [2, 3, 5, Infinity]) {
  let tot = 0, foreign = 0, opp = 0;
  for (const [, list] of seq) {
    for (let i = 0; i < list.length; i++) {
      const lo = K === Infinity ? 0 : Math.max(0, i - (K - 1));
      for (let j = lo; j <= i; j++) {
        tot++;
        if (list[j].cid !== list[i].cid) {
          foreign++;
          if (list[j].who !== list[i].who) opp++;
        }
      }
    }
  }
  out.push(`${String(K === Infinity ? 'all' : K).padEnd(5)} ${(100 * foreign / tot).toFixed(1).padStart(6)}%         ${(100 * opp / tot).toFixed(1).padStart(6)}% of all averaged reads`);
}

// BOOTSTRAP OVER IDENTITIES on the decisive comparison.
function bootstrap(scoredA, scoredB) {
  const cids = [...new Set(rows.map((r) => r.cid))];
  const idx = new Map();
  cids.forEach((c, i) => idx.set(c, i));
  const buckets = cids.map(() => []);
  for (let i = 0; i < rows.length; i++) buckets[idx.get(rows[i].cid)].push(i);
  let seed = 20260905;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dA = [], dB = [], dD = [];
  for (let b = 0; b < 2000; b++) {
    const A = [], B = [];
    for (let i = 0; i < cids.length; i++) {
      const bucket = buckets[Math.floor(rnd() * cids.length)];
      for (const j of bucket) { A.push(scoredA[j]); B.push(scoredB[j]); }
    }
    const sa = scoreAt(A, BUDGET), sb = scoreAt(B, BUDGET);
    if (!sa || !sb) continue;
    dA.push(sa.fcPct); dB.push(sb.fcPct); dD.push(sb.fcPct - sa.fcPct);
  }
  const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
  return { a: [q(dA, 0.025), q(dA, 0.975)], b: [q(dB, 0.025), q(dB, 0.975)],
           d: [q(dD, 0.025), q(dD, 0.975)], worse: 100 * dD.filter((v) => v > 0).length / dD.length };
}
const single = meanArm((r) => r.win + '|' + r.tid, 1);
for (const K of [3, 5, Infinity]) {
  const real = meanArm((r) => r.win + '|' + r.tid, K);
  const bs = bootstrap(single, real);
  out.push('');
  out.push(`bootstrap over identities, single vs REAL-track mean K=${K === Infinity ? 'all' : K}:`);
  out.push(`  single    95% CI [${bs.a[0].toFixed(1)}%, ${bs.a[1].toFixed(1)}%]`);
  out.push(`  trackmean 95% CI [${bs.b[0].toFixed(1)}%, ${bs.b[1].toFixed(1)}%]`);
  out.push(`  delta     95% CI [${bs.d[0].toFixed(1)}, ${bs.d[1].toFixed(1)}] pts   P(track mean WORSE) = ${bs.worse.toFixed(1)}%`);
}
console.log(out.join('\n'));
