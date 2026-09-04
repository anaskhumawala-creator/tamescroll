// THE DESCRIPTOR AS A ONE-WAY VETO, WHICH FINDING 33 FLAGGED AND NOBODY RAN.
//
// The linear probe on the 1024-d descriptor LOSES as a replacement: 9.4%
// wrong against the head's 6.7%. But the two are wrong about DIFFERENT
// people, and lopsidedly so:
//
//     women wrong   head 15.8%   probe  7.2%
//     men   wrong   head  0.4%   probe 11.0%
//
// The head is male-biased; the probe is balanced. Averaging them, or
// swapping one for the other, throws that away -- which is what the two
// arms in finding 33 did, and why both lost.
//
// THIS APP DOES NOT NEED A BALANCED CLASSIFIER. It needs to not clear a
// woman. So use the probe in ONE DIRECTION ONLY: the head proposes a
// clear, and the fingerprint may REFUSE it. Never the reverse -- the probe
// can never grant a clear the head did not, so its 11.0% error on men can
// only ever cost false cover, never exposure. Monotone toward covering,
// which is the same shape as every other guard this repo ships.
//
//     clear(man)  =  head raw >= BAR   AND   probe >= VETO
//
// COSTS NOTHING AT RUNTIME. The descriptor comes out of the same forward
// pass as the gender sigmoid -- it is already computed on every read and
// already carried on the face object for the identity memory. The veto is
// 1024 multiply-adds against a ~4KB weight vector.
//
// SCORED AT MATCHED EXPOSURE, because a veto trivially reduces exposure by
// clearing less, and comparing against the shipped arm at a FIXED bar
// would measure that and call it a win. So each arm solves its own BAR to
// hit a common exposure and only then is false cover read -- the control
// findings 40, 41 and 45 all turned on.
//
// HELD OUT BY VIDEO: the banked `probe` column is already leave-one-video-
// out, so every scored read is of a person the weights never saw.
//
// LIMIT, and it is the one finding 33 named: 1024 free parameters fitted
// on 52 identities is badly under-powered, and the corpus is ten videos of
// mostly white presenters. A win here does NOT transfer to the FairFace
// bias result and does not license shipping. It licenses the FairFace run.
import fs from 'fs';

const ROWS = 'Z:/tamescroll-corpus/bank/desc-probe-rows.json';
const NL = String.fromCharCode(10);
const rows = JSON.parse(fs.readFileSync(ROWS, 'utf8'));
const F = rows.filter(r => r.y === 0);   // women -- clearing one is EXPOSURE
const M = rows.filter(r => r.y === 1);   // men   -- not clearing one is FALSE COVER
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');

console.log(NL + 'reads ' + rows.length + '   women ' + F.length + '   men ' + M.length);

// ARMS. Each takes a bar and answers "is this read cleared as a man".
const ARMS = {
  'head alone (ships)': (r, bar) => r.raw >= bar,
  'probe alone': (r, bar) => r.probe >= bar,
  'head AND probe>=0.30': (r, bar) => r.raw >= bar && r.probe >= 0.30,
  'head AND probe>=0.50': (r, bar) => r.raw >= bar && r.probe >= 0.50,
  'head AND probe>=0.70': (r, bar) => r.raw >= bar && r.probe >= 0.70,
  'mean(head,probe)': (r, bar) => (r.raw + r.probe) / 2 >= bar,
};

// Solve each arm's bar for a target exposure. Clearing is monotone
// decreasing in the bar, so exposure is too -- sweep upward and stop.
function barFor(fn, target) {
  for (let b = 0.00; b <= 1.001; b += 0.002) {
    if (F.filter(r => fn(r, b)).length / F.length <= target) return b;
  }
  return null;
}

const targets = [0.024, 0.016, 0.010, 0.005];
console.log(NL + 'MATCHED EXPOSURE -- false cover on men at a common exposure.');
console.log('Lower is better. The veto may only REFUSE a clear, so it can never');
console.log('raise exposure above the head arm at the same bar.');
console.log('  ' + 'arm'.padEnd(22) + targets.map(t => ('<=' + (t * 100).toFixed(1) + '%').padStart(11)).join(''));
const bars = {};
for (const k of Object.keys(ARMS)) {
  bars[k] = [];
  const cells = [];
  for (const t of targets) {
    const b = barFor(ARMS[k], t);
    bars[k].push(b);
    cells.push(b === null ? 'n/a'.padStart(11)
      : pct(M.filter(r => !ARMS[k](r, b)).length, M.length).padStart(11));
  }
  console.log('  ' + k.padEnd(22) + cells.join(''));
}
console.log('  ' + 'bar solved'.padEnd(22)
  + targets.map((_, i) => (bars['head alone (ships)'][i] === null ? '--' : bars['head alone (ships)'][i].toFixed(3)).padStart(11)).join('')
  + '   (head arm; each solves its own)');

// WHERE THE VETO ACTUALLY BITES. A guard that fires on nobody is free and
// worthless; one that fires on everybody is the bar moved. Count it.
console.log(NL + 'WHAT THE VETO TOUCHES, at the shipped-equivalent bar (exposure <= 1.6%)');
const bHead = barFor(ARMS['head alone (ships)'], 0.016);
for (const V of [0.30, 0.50, 0.70]) {
  const clearedByHead = r => r.raw >= bHead;
  const vetoed = r => clearedByHead(r) && !(r.probe >= V);
  const fV = F.filter(vetoed).length, mV = M.filter(vetoed).length;
  console.log('  veto ' + V.toFixed(2)
    + '   women rescued ' + String(fV).padStart(3) + ' of ' + String(F.filter(clearedByHead).length).padStart(3)
    + ' cleared   men newly covered ' + String(mV).padStart(4) + ' of ' + String(M.filter(clearedByHead).length).padStart(4)
    + '   ratio ' + (mV ? (mV / Math.max(1, fV)).toFixed(1) : '--') + ' men per woman');
}
console.log('  A veto is worth having only if that ratio beats what simply RAISING');
console.log('  the head bar costs for the same women -- the matched table above is');
console.log('  that comparison done properly.');

// Are the two signals independent? If the probe only fires where the head
// is already unsure, it carries nothing new and the matched table will say
// so -- but the correlation says WHY.
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return n / Math.sqrt(da * db);
};
console.log(NL + 'INDEPENDENCE -- pearson(head raw, probe), per population');
for (const [k, s] of [['women', F], ['men', M], ['all', rows]]) {
  console.log('  ' + k.padEnd(7) + 'n ' + String(s.length).padStart(5) + '   r '
    + corr(s.map(r => r.raw), s.map(r => r.probe)).toFixed(3));
}
console.log('  Low correlation is what makes a veto able to add anything at all.');

console.log(NL + 'PER VIDEO at exposure <= 1.6% (an arm that wins on one video won nothing)');
const best = Object.keys(ARMS).filter(k => k.startsWith('head AND'));
console.log('  ' + 'video'.padEnd(14) + 'men'.padStart(5) + 'head'.padStart(9)
  + best.map(k => k.replace('head AND probe>=', 'v').padStart(9)).join(''));
for (const v of [...new Set(rows.map(r => r.vid))].sort()) {
  const s = M.filter(r => r.vid === v);
  if (!s.length) continue;
  const cell = k => {
    const b = bars[k][1];
    return b === null ? '--' : pct(s.filter(r => !ARMS[k](r, b)).length, s.length);
  };
  console.log('  ' + v.padEnd(14) + String(s.length).padStart(5)
    + cell('head alone (ships)').padStart(9) + best.map(k => cell(k).padStart(9)).join(''));
}
