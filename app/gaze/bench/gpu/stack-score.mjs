// DO GREY AND MIRROR ADD UP, OR DO THEY FIX THE SAME PEOPLE?
//
// Findings 40 and 41 each measured a win against the SHIPPED arm, on the
// same corpus, at matched exposure -- grey 3.7-5.8 points of false cover,
// mirror-averaging 18.0% -> 12.3%. Neither was measured against the
// other, and two fixes for one failure are worth one fix, not two. That
// distinction decides whether mirror's 1.4-1.6x of gender inference buys
// anything on top of grey, which is free.
//
// Four arms over the SAME 2,159 labelled reads and the SAME detector box:
//   rgb      what ships
//   grey     Rec.601 luma (finding 41)
//   rgbMir   mean of raw(rgb) and raw(mirror(rgb))     (finding 40)
//   greyMir  mean of raw(grey) and raw(mirror(grey))   both together
//
// MATCHED EXPOSURE THROUGHOUT. An arm that leans female wins any raw
// accuracy column for free, and both of these arms DO lean female -- that
// is a large part of how they help women. So each arm solves its own bar
// to a common exposure and only then is false cover read. Findings 29, 40
// and 41 were each nearly published without this control.
import fs from 'fs';

const NL = String.fromCharCode(10);
const IN = process.argv[2] || 'Z:/tamescroll-corpus/bank/gpu-grey-mirror.json';
const rows = JSON.parse(fs.readFileSync(IN, 'utf8'));
const ARMS = ['rgb', 'grey', 'rgbMir', 'greyMir'];
const usable = rows.filter((r) => ARMS.every((a) => r[a] && typeof r[a].raw === 'number'));
const F = usable.filter((r) => r.who === 'woman');
const M = usable.filter((r) => r.who === 'man');
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');

console.log(NL + 'rows ' + usable.length + ' of ' + rows.length
  + '   women ' + F.length + '   men ' + M.length);

// A man is CLEARED (goes uncovered) when his read is confidently male.
// Exposure is a woman cleared; false cover is a man not cleared.
const cleared = (r, a, bar) => r[a].raw >= bar;
function barFor(a, target) {
  for (let b = 0.30; b <= 1.001; b += 0.002) {
    if (F.filter((r) => cleared(r, a, b)).length / F.length <= target) return b;
  }
  return null;
}

const targets = [0.030, 0.024, 0.016, 0.010, 0.005];
console.log(NL + 'MATCHED EXPOSURE -- false cover on men. Lower is better.');
console.log('  ' + 'arm'.padEnd(10) + targets.map((t) => ('<=' + (t * 100).toFixed(1) + '%').padStart(10)).join(''));
const bars = {};
for (const a of ARMS) {
  bars[a] = targets.map((t) => barFor(a, t));
  console.log('  ' + a.padEnd(10) + bars[a].map((b, i) => (b === null ? 'n/a'
    : pct(M.filter((r) => !cleared(r, a, b)).length, M.length)).padStart(10)).join(''));
}
console.log('  ' + 'bar(grey)'.padEnd(10)
  + bars.grey.map((b) => (b === null ? '--' : b.toFixed(3)).padStart(10)).join(''));

// THE QUESTION. If the two are independent, greyMir should beat the better
// of grey and rgbMir by roughly the amount the worse one beat rgb. If they
// attack the same errors, greyMir lands on top of the better single arm
// and mirror's compute buys nothing on a grey build.
console.log(NL + 'DO THEY ADD? at exposure <= 1.6%');
const i16 = targets.indexOf(0.016);
const fc = (a) => M.filter((r) => !cleared(r, a, bars[a][i16])).length / M.length;
const base = fc('rgb');
console.log('  rgb            ' + pct(base * M.length, M.length));
console.log('  grey    alone  ' + pct(fc('grey') * M.length, M.length)
  + '   gains ' + ((base - fc('grey')) * 100).toFixed(1) + ' pts');
console.log('  mirror  alone  ' + pct(fc('rgbMir') * M.length, M.length)
  + '   gains ' + ((base - fc('rgbMir')) * 100).toFixed(1) + ' pts');
console.log('  both           ' + pct(fc('greyMir') * M.length, M.length)
  + '   gains ' + ((base - fc('greyMir')) * 100).toFixed(1) + ' pts');
const sum = (base - fc('grey')) + (base - fc('rgbMir'));
const got = base - fc('greyMir');
console.log('  additive would be ' + (sum * 100).toFixed(1) + ' pts; observed '
  + (got * 100).toFixed(1) + ' pts = ' + (sum ? (100 * got / sum).toFixed(0) : '--') + '% of it.');
console.log('  Near 100% = independent, worth stacking. Near 50% = the same');
console.log('  errors twice, and mirror\u2019s compute is wasted on a grey build.');

// WHOSE ERRORS. The percentage above is a summary; this is the join that
// produces it, on the actual women the shipped arm gets wrong.
console.log(NL + 'THE SAME WOMEN? (a woman is WRONG when her read is male-labelled)');
const wrong = (r, a) => r[a].raw >= 0.5;
const W = F.filter((r) => wrong(r, 'rgb'));
const byGrey = W.filter((r) => !wrong(r, 'grey')).length;
const byMir = W.filter((r) => !wrong(r, 'rgbMir')).length;
const byBoth = W.filter((r) => !wrong(r, 'grey') && !wrong(r, 'rgbMir')).length;
const byEither = W.filter((r) => !wrong(r, 'grey') || !wrong(r, 'rgbMir')).length;
console.log('  women the shipped arm reads male   ' + W.length + ' of ' + F.length + '  (' + pct(W.length, F.length) + ')');
console.log('    grey fixes       ' + String(byGrey).padStart(4) + '   ' + pct(byGrey, W.length));
console.log('    mirror fixes     ' + String(byMir).padStart(4) + '   ' + pct(byMir, W.length));
console.log('    BOTH fix (overlap)' + String(byBoth).padStart(3) + '   ' + pct(byBoth, W.length));
console.log('    either fixes     ' + String(byEither).padStart(4) + '   ' + pct(byEither, W.length));
console.log('  Overlap close to the smaller of the two = one fix, not two.');

console.log(NL + 'BY FACE SIZE at exposure <= 1.6% -- his player reads px 38-62');
const bands = [[0, 32], [32, 48], [48, 64], [64, 96], [96, 1e9]];
console.log('  ' + 'px'.padEnd(10) + 'n'.padStart(6) + ARMS.map((a) => a.padStart(10)).join(''));
for (const [lo, hi] of bands) {
  const s = F.filter((r) => r.px >= lo && r.px < hi);
  if (!s.length) continue;
  console.log('  ' + (lo + '-' + (hi > 1e8 ? '+' : hi)).padEnd(10) + String(s.length).padStart(6)
    + ARMS.map((a) => pct(s.filter((r) => wrong(r, a)).length, s.length).padStart(10)).join(''));
}
console.log('  (raw label error by band -- not exposure-matched, so read it as');
console.log('   WHERE an arm acts, never as how much it is worth.)');
