// DOES THE GPU AGREE WITH THE CPU? UNTIL THIS PASSES, EVERY GPU NUMBER IS
// A CLAIM ABOUT A BACKEND AND NOT ABOUT THE MODEL.
//
// WebGL is not fp32 arithmetic by default. tfjs renders to half-float
// textures wherever EXT_color_buffer_float is missing, and even with it
// the shader path is a different order of operations from the CPU kernel.
// This repo has already been burned by exactly that: findings 25 measured
// tfjs-WebGL on an Adreno reading MoveNet's best keypoint at 0.03-0.19 --
// admitting NOBODY -- where TFLite CPU, tfjs CPU and native GPU all read
// 0.77-0.82 on the same frames. The bench that trusted WebGL there
// reported a regime that did not exist for six loops.
//
// So the rule is the one finding 43 paid for: an agreement number needs a
// SPREAD number beside it. Two dead constant outputs agree perfectly.
// This prints both, and refuses to call it parity without both.
//
// WHAT COUNTS AS AGREEMENT is not "the same float". It is "the same
// decision", because that is the only thing that reaches a screen. Raw
// deltas are reported as the underlying evidence, and the decision flip
// rate is quoted at the bar that actually ships.
import fs from 'fs';

const NL = String.fromCharCode(10);
const BANK = 'Z:/tamescroll-corpus/bank';
const A = process.argv[2] || 'gpu-smoke-webgl';
const B = process.argv[3] || 'gpu-smoke-cpu';

const load = (n) => JSON.parse(fs.readFileSync(BANK + '/' + n + '.json', 'utf8'));
const a = load(A), b = load(B);

// Join on the crop, never on position -- a skipped noFace row on one side
// shifts every later index and the diff becomes noise that looks like a
// backend difference.
const byCrop = new Map(b.map((r) => [r.crop, r]));
const pairs = [];
for (const r of a) { const m = byCrop.get(r.crop); if (m) pairs.push([r, m]); }

console.log(NL + A + '  n ' + a.length + '   vs   ' + B + '  n ' + b.length
  + '   joined ' + pairs.length);
if (!pairs.length) { console.log('NO OVERLAP -- nothing to compare.'); process.exit(1); }

const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const arms = Object.keys(pairs[0][0]).filter((k) => pairs[0][0][k] && typeof pairs[0][0][k] === 'object'
  && typeof pairs[0][0][k].raw === 'number');

// The shipped male clear bar. GENDER_CLEAR_SCORE 0.45 on a male read means
// raw >= 0.725 -- the number that decides whether a man goes uncovered.
const CLEAR = 0.725;

console.log(NL + 'PER ARM -- raw agreement, spread, and decision flips at the shipped bar');
console.log('  ' + 'arm'.padEnd(10) + 'spreadA'.padStart(9) + 'spreadB'.padStart(9)
  + '|d| p50'.padStart(10) + '|d| p95'.padStart(10) + '|d| max'.padStart(10)
  + 'labelFlip'.padStart(11) + 'clearFlip'.padStart(11));
let worstSpread = 1, worstFlip = 0;
for (const arm of arms) {
  const ra = pairs.map(([x]) => x[arm].raw), rb = pairs.map(([, y]) => y[arm].raw);
  const d = pairs.map(([x, y]) => Math.abs(x[arm].raw - y[arm].raw));
  const spreadA = Math.max(...ra) - Math.min(...ra);
  const spreadB = Math.max(...rb) - Math.min(...rb);
  const labelFlip = pairs.filter(([x, y]) => (x[arm].raw >= 0.5) !== (y[arm].raw >= 0.5)).length;
  const clearFlip = pairs.filter(([x, y]) => (x[arm].raw >= CLEAR) !== (y[arm].raw >= CLEAR)).length;
  worstSpread = Math.min(worstSpread, spreadA, spreadB);
  worstFlip = Math.max(worstFlip, clearFlip / pairs.length);
  console.log('  ' + arm.padEnd(10) + spreadA.toFixed(3).padStart(9) + spreadB.toFixed(3).padStart(9)
    + q(d, 0.5).toExponential(2).padStart(10) + q(d, 0.95).toExponential(2).padStart(10)
    + Math.max(...d).toExponential(2).padStart(10)
    + (labelFlip + '/' + pairs.length).padStart(11)
    + (clearFlip + '/' + pairs.length).padStart(11));
}

// The descriptor is the other head of the same forward pass and it is what
// the identity memory matches on at MEM_SIM 0.6. A backend that agrees on
// the sigmoid can still move the 1024-d vector, so it is checked too when
// the rows carry it.
const dArms = Object.keys(pairs[0][0]).filter((k) => Array.isArray(pairs[0][0][k]));
for (const arm of dArms) {
  const cos = pairs.map(([x, y]) => {
    const u = x[arm], v = y[arm];
    let n = 0, du = 0, dv = 0;
    for (let i = 0; i < u.length; i++) { n += u[i] * v[i]; du += u[i] * u[i]; dv += v[i] * v[i]; }
    return n / Math.sqrt(du * dv);
  });
  console.log('  descriptor ' + arm + '  cosine  min ' + Math.min(...cos).toFixed(5)
    + '  p05 ' + q(cos, 0.05).toFixed(5) + '  (MEM_SIM is 0.60)');
}

console.log(NL + 'VERDICT');
if (worstSpread < 0.2) {
  console.log('  REFUSED: an arm spans ' + worstSpread.toFixed(3) + ' of raw output. A model');
  console.log('  that barely moves agrees with itself perfectly and says nothing.');
  console.log('  This is the finding-43 saturation shape. Do not read the table above.');
  process.exit(1);
}
if (worstFlip > 0.005) {
  console.log('  REFUSED: ' + (worstFlip * 100).toFixed(1) + '% of shipped-bar decisions flip between');
  console.log('  backends. The GPU is answering a different question; score on CPU.');
  process.exit(1);
}
console.log('  PASS. Output spans ' + worstSpread.toFixed(3) + ', worst shipped-bar flip rate '
  + (worstFlip * 100).toFixed(2) + '%.');
console.log('  The GPU rows may be scored by the same scorers as the CPU rows.');
