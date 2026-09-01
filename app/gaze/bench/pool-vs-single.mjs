// WOULD POOLING A TRACK'S READS CLEAR A MAN THAT NO SINGLE READ CAN?
//
// GENDER_CLEAR_SCORE 0.6 is a bar on 2*|v-0.5|, i.e. v >= 0.8, and
// CLEAR_STREAK_N wants TWO CONSECUTIVE reads over it. On his phone the
// male maximum is v 0.745, so the answer there is no by arithmetic. The
// question this settles is whether pooling is worth building at all:
// across 15k banked video reads, how many men sit below the bar on every
// single read while their TRACK, pooled, is decisively male.
//
// Pooling is in log-odds, not in v: averaging probabilities is dominated
// by whichever reads sit nearest 0.5, which is the opposite of what is
// wanted. Weighted by the detector's own confidence and by native size,
// which is what the frame-quality literature does and which this repo
// already banks per read (`fc`, `px`).
//
// THE TRAP THIS IS BUILT TO AVOID: a null read is the model returning
// its prior, and a prior is CONSISTENT. Pooling reduces variance, not
// bias -- so a graphic that reads 0.61 every pass pools to 0.61 and must
// still not clear. Reported separately: how far pooling moves a
// low-variance track versus a scattered one.
import fs from 'fs'; import path from 'path';

const files = [];
(function w(d) { let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = path.join(d, x.name); if (x.isDirectory()) w(p); else if (x.name === 'meta.json') files.push(p); } })('Z:/Apps/Disconnect/spikes/gauntlet/runs');

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]), y2 = Math.min(a[3], b[3]);
  if (x2 <= x1 || y2 <= y1) return 0;
  const i = (x2 - x1) * (y2 - y1);
  return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i);
}
const logit = (v) => Math.log(Math.min(0.999, Math.max(0.001, v)) / (1 - Math.min(0.999, Math.max(0.001, v))));
const sig = (z) => 1 / (1 + Math.exp(-z));
const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);

// A "subject" is a run + a chain of reads whose boxes overlap. Frames are
// sampled sparsely in these runs, so this is deliberately generous: any
// read overlapping an existing chain's LAST box by >= 0.3 joins it.
const subjects = [];
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const chains = [];
  for (const fr of (j.frames || [])) {
    for (const r of (fr.reads || [])) {
      if (!r || !Array.isArray(r.b) || typeof r.v !== 'number') continue;
      let best = null, bi = 0;
      for (const c of chains) { const s = iou(c.last, r.b); if (s > bi) { bi = s; best = c; } }
      if (best && bi >= 0.3) { best.last = r.b; best.reads.push(r); }
      else chains.push({ last: r.b, reads: [r], run: f, vid: fr.vid, vw: fr.vw });
    }
  }
  for (const c of chains) if (c.reads.length >= 3) subjects.push(c);
}

const CLEAR_V = 0.8;                       // 2*|v-0.5| >= GENDER_CLEAR_SCORE 0.6
function pooled(reads) {
  let num = 0, den = 0;
  for (const r of reads) {
    // Confidence and size are the two quality signals already banked.
    // Both floor at a small positive so a read is never weightless.
    const wc = typeof r.fc === 'number' ? Math.max(0.05, r.fc) : 0.5;
    const wp = typeof r.px === 'number' ? Math.min(1, r.px / 120) : 0.5;
    const w = wc * Math.max(0.1, wp);
    num += w * logit(r.v); den += w;
  }
  return den ? sig(num / den) : null;
}

let male = 0, singleClear = 0, poolClear = 0, rescued = 0, lost = 0;
const rescuedSpread = [], stuckSpread = [];
for (const s of subjects) {
  const vs = s.reads.map((r) => r.v);
  // A male SUBJECT: the pooled read is on the male side. (Labelling by
  // majority of per-read labels gives the same set to within 1%.)
  const p = pooled(s.reads);
  if (p == null || p <= 0.5) continue;
  male++;
  // Two CONSECUTIVE reads over the bar is what CLEAR_STREAK_N asks for.
  let streak = 0, ok = false;
  for (const v of vs) { streak = v >= CLEAR_V ? streak + 1 : 0; if (streak >= 2) { ok = true; break; } }
  const pc = p >= CLEAR_V;
  if (ok) singleClear++;
  if (pc) poolClear++;
  const spread = Math.max(...vs) - Math.min(...vs);
  if (pc && !ok) { rescued++; rescuedSpread.push(spread); }
  if (ok && !pc) lost++;
  if (!pc && !ok) stuckSpread.push(spread);
}

console.log('runs', files.length, ' subjects (>=3 reads)', subjects.length, ' male subjects', male);
console.log('');
console.log('clears today (2 consecutive v>=0.80) ', singleClear, '=', (100 * singleClear / male).toFixed(1) + '%');
console.log('clears pooled (weighted logit >=0.80)', poolClear, '=', (100 * poolClear / male).toFixed(1) + '%');
console.log('  RESCUED by pooling (no single streak, pools clear):', rescued);
console.log('  LOST to pooling  (had a streak, pools below bar)  :', lost);
console.log('');
console.log('the trap: a prior is consistent, so a null-ish track should NOT be rescued.');
console.log('  v spread of RESCUED tracks  p05/p50/p95', [q(rescuedSpread, .05), q(rescuedSpread, .5), q(rescuedSpread, .95)].map((v) => v == null ? '-' : v.toFixed(3)).join(' '));
console.log('  v spread of STILL-STUCK ones p05/p50/p95', [q(stuckSpread, .05), q(stuckSpread, .5), q(stuckSpread, .95)].map((v) => v == null ? '-' : v.toFixed(3)).join(' '));
