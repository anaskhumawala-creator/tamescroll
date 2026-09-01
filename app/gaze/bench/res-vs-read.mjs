// DOES THE STREAM RESOLUTION DECIDE WHETHER A MAN CAN BE CLEARED?
//
// His phone reads male raw sigmoid p50 0.616 with a MAX of 0.745 over 41
// reads -- |v-0.5| never reaches 0.3, so with GENDER_CLEAR_SCORE at 0.6
// NOT ONE MAN IN HIS PLAYER CAN EVER BE CLEARED. The banked gauntlet
// corpus, which is the SAME video path and the same code, reads male p50
// 0.845 with 58.7% clearing. Two candidates were live: the DEVICE, and
// the PIXEL PATH.
//
//   PATH is dead: the corpus IS the player path (every read sits under
//        frames.reads of a gauntlet run).
//   fp16 SHADERS are dead: his Adreno 610 reports HIGH_FLOAT precision
//        23 in both the fragment and the vertex shader (probe_glprec).
//
// What is left is what the model was SHOWN. His player decodes at
// 640x360 (measured live); the corpus runs are desktop players. Every
// gauntlet frame banks `vw`, so this is answerable offline, on thousands
// of reads, without spending a device run.
//
// `px` is the native face size in DECODED pixels, so it is NOT a control
// for this: 100px of a 360p frame and 100px of a 1080p frame are the
// same count of very different pixels. Stratify by both.
import fs from 'fs'; import path from 'path';

const files = [];
(function walk(d) {
  let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) walk(p);
    else if (x.name === 'meta.json') files.push(p);
  }
})('Z:/Apps/Disconnect/spikes/gauntlet/runs');

const reads = [];
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  for (const fr of (j.frames || [])) {
    if (!fr || !Array.isArray(fr.reads)) continue;
    for (const r of fr.reads) {
      if (!r || typeof r.s !== 'number') continue;
      reads.push({ g: r.g, s: r.s, v: r.v, px: r.px, vw: fr.vw, vh: fr.vh, vid: fr.vid, run: f });
    }
  }
}

function rawOf(r) {
  if (typeof r.v === 'number') return r.v;
  if (r.s >= 0.99) return null;               // the clamp is uninvertible
  return r.g === 'male' ? 0.5 + r.s / 2 : 0.5 - r.s / 2;
}
const q = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))] : null);
const f3 = (v) => (v == null ? '  -  ' : v.toFixed(3));

function row(label, rs) {
  const male = rs.filter((r) => r.g === 'male').map(rawOf).filter((v) => v != null);
  // GENDER_CLEAR_SCORE is 0.6 on a certainty of 2*|v-0.5|, i.e. v >= 0.8.
  const clear = male.filter((v) => 2 * Math.abs(v - 0.5) >= 0.6).length;
  console.log(
    label.padEnd(26),
    'male n', String(male.length).padStart(5),
    ' v p05/p50/p95/max', [q(male, .05), q(male, .5), q(male, .95), male.length ? Math.max(...male) : null].map(f3).join(' '),
    ' clearable', String(clear).padStart(5),
    male.length ? ((100 * clear / male.length).toFixed(1) + '%').padStart(7) : '     - '
  );
}

console.log('gauntlet runs', files.length, ' reads', reads.length);
const widths = [...new Set(reads.map((r) => r.vw))].filter((w) => w).sort((a, b) => a - b);
console.log('decode widths present in the corpus:', widths.join(', '));
console.log('');
for (const w of widths) row('vw ' + w, reads.filter((r) => r.vw === w));
console.log('');
// Within one size band, so a smaller face cannot explain a weaker read.
for (const [lo, hi] of [[40, 80], [80, 140], [140, 1e9]]) {
  console.log('-- native face px ' + lo + '..' + (hi === 1e9 ? 'inf' : hi));
  for (const w of widths) {
    const rs = reads.filter((r) => r.vw === w && typeof r.px === 'number' && r.px >= lo && r.px < hi);
    if (rs.length) row('   vw ' + w, rs);
  }
}
console.log('');
console.log('HIS PHONE, same columns, for comparison:');
const ph = JSON.parse(fs.readFileSync('Z:/Apps/Disconnect/spikes/gauntlet/phone-1078.json', 'utf8'));
row('phone 1078 (vw 640)', ph.reads);
for (const [lo, hi] of [[40, 80], [80, 140], [140, 1e9]]) {
  const rs = ph.reads.filter((r) => typeof r.px === 'number' && r.px >= lo && r.px < hi);
  if (rs.length) row('   phone px ' + lo + '..' + (hi === 1e9 ? 'inf' : hi), rs);
}
