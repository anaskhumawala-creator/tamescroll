// WHY DOES A5 NOT FIX THE MAN HE NAMED?
//
// NWoT1ZVd1Lo#1 is Linus. His pooled confidence is 0.731 CLEAR against a
// 0.40 bar, so the SUBJECT decision is right on essentially every frame
// -- and he is still covered 43% of the time. Something downstream of
// the decision re-covers him.
//
// This does not argue about it. It replays A5 and, for every frame in
// which Linus is on screen, records BOTH states side by side:
//   subject   what the pooled per-subject decision says
//   track     what person-track actually renders
// If subject=clear and track=blurred is the bulk of it, the tracker is
// the mechanism and the state machine is the thing to rebuild. If not,
// the hypothesis is wrong and this prints what is really happening.
//
// The A5 loop is duplicated here rather than imported because the arm
// exposes no internals, and a diagnostic that cannot see inside the
// thing it is diagnosing is how three rounds ended in an argument.
import fs from 'fs';
import {
  faceMeta, personFromFace, dedupeObservations, updatePersonTracks, setVerdictCadence,
} from './.cache/shipped.mjs';
import { ROOT, W, H } from './corpus-lib.mjs';
import { loadWin } from './arch-arms.mjs';

const ASPECT = W / H, D = 1024;
const SIM = 0.60, NM_FLOOR = 5, CLEAR = 0.60, MIN_VOTES = 3, POOL_BAR = 0.40;
const logit = (v) => Math.log(Math.max(1e-6, v) / Math.max(1e-6, 1 - v));
const sigm = (z) => 1 / (1 + Math.exp(-z));
const TARGET = process.env.SUBJECT || 'NWoT1ZVd1Lo#1';

const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropId = new Map();
for (const c of JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8')))
  for (const m of c.members) cropId.set(m.crop, c.id);

const descOf = (win, i) => {
  const o = i * D;
  return (i != null && i >= 0 && o + D <= win.desc.length) ? win.desc.subarray(o, o + D) : null;
};
const cos = (a, b) => { let s = 0; for (let i = 0; i < D; i++) s += a[i] * b[i]; return s; };
const readOf = (f) => ({ gender: f.gender, score: f.score, raw: f.raw, age: f.age,
  childP: f.childP, shape: f.shape, desc: null });
function overlapFrac(f, p) {
  const x1 = Math.max(f.x1, p.x1), y1 = Math.max(f.y1, p.y1);
  const x2 = Math.min(f.x2, p.x2), y2 = Math.min(f.y2, p.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const a = (f.x2 - f.x1) * (f.y2 - f.y1);
  return a > 0 ? ((x2 - x1) * (y2 - y1)) / a : 0;
}

const cell = new Map();     // "subjectState/trackState" -> frames
let births = 0, coveredAfterBirth = 0, n = 0;
const trackAges = [];       // how old the covering track was, in frames
const byOwner = new Map(); // whose patch is actually covering him

for (const file of fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'))) {
  const win = loadWin(file);
  if (TARGET !== 'ALL' && !win.frames.some((fr) => fr.faces.some((f) => cropId.get(f.crop) === TARGET))) continue;
  const dt = 1000 / win.fps;
  setVerdictCadence(dt);
  let tracks = [];
  const subs = [];
  const seenIds = new Map();   // track id -> first frame index

  win.frames.forEach((fr, fi) => {
    const base = faceMeta('man', fr.faces.map(readOf));
    let mine = null;
    const meta = fr.faces.map((f, i) => {
      const b = base[i] || {};
      const d = descOf(win, f.descIdx);
      if (!d) return b;
      let best = null, bs = SIM;
      for (const s of subs) { const c = cos(d, s.proto); if (c > bs) { bs = c; best = s; } }
      if (best) for (let k = 0; k < D; k++) best.proto[k] = best.proto[k] * 0.9 + d[k] * 0.1;
      else { best = { proto: Float32Array.from(d), votes: 0, sumLogit: 0, decided: null }; subs.push(best); }
      if (f.nm >= NM_FLOOR) { best.sumLogit += logit(1 - f.raw); best.votes++; }
      if (best.votes >= MIN_VOTES) {
        const p = sigm(best.sumLogit / best.votes);
        const conf = 2 * Math.abs(p - 0.5);
        if (conf >= Math.max(POOL_BAR, CLEAR / Math.sqrt(best.votes))) {
          best.decided = p > 0.5 ? 'cover' : 'clear';
        }
      }
      if (TARGET === 'ALL' ? labels[cropId.get(f.crop)] === 'man' : cropId.get(f.crop) === TARGET) mine = { face: f, sub: best };
      if (best.decided === 'clear') return { ...b, flagged: false, certain: true, abstained: false };
      return { ...b, flagged: true, certain: true, abstained: false, instant: true };
    });

    let obs = fr.faces.map((f, i) => {
      const m = meta[i] || {};
      return { box: personFromFace(f, ASPECT), flagged: m.flagged, certain: m.certain,
        abstained: m.abstained, instant: m.instant, weak: m.weak, nullMint: !!m.nullRead,
        faceFound: true, verdictDt: dt, desc: descOf(win, f.descIdx) };
    });
    obs = dedupeObservations(obs);
    tracks = updatePersonTracks(tracks, obs, dt, null);
    for (const t of tracks) if (!seenIds.has(t.id)) { seenIds.set(t.id, fi); births++; }

    if (!mine) return;
    n++;
    // The track actually covering him, if any.
    let cov = null, bf = 0;
    for (const t of tracks) {
      if (t.state === 'cleared') continue;
      const o = overlapFrac(mine.face, t.box);
      if (o > bf) { bf = o; cov = t; }
    }
    const covered = bf >= 0.15;
    const subState = mine.sub.decided === 'clear' ? 'clear'
      : mine.sub.decided === 'cover' ? 'cover' : 'undecided';
    const key = `subject=${subState.padEnd(9)} track=${covered ? 'BLURRED' : 'sharp  '}`;
    cell.set(key, (cell.get(key) || 0) + 1);
    if (covered && cov) {
      const age = fi - (seenIds.get(cov.id) ?? fi);
      trackAges.push(age);
      if (age <= 2) coveredAfterBirth++;
      // WHOSE PATCH IS IT? A long-lived track covering a man whose own
      // subject reads clear is not necessarily a decision bug -- it is
      // the accepted cost of a SOLID patch when someone the app is
      // correctly covering stands next to him. Separating those two is
      // the whole question: one is a bug to fix, the other is a ruling
      // he has already made twice and must not be re-litigated.
      let owner = 'nobody';
      let bo = 0;
      for (const other of fr.faces) {
        if (other === mine.face) continue;
        const o = overlapFrac(other, cov.box);
        if (o > bo) { bo = o; owner = cropId.get(other.crop) || 'unlabelled'; }
      }
      const lab = owner === 'nobody' || owner === 'unlabelled' ? owner : (labels[owner] || '?');
      const oc = bo >= 0.5 ? `${lab} (${owner})` : 'HIS OWN PATCH';
      byOwner.set(oc, (byOwner.get(oc) || 0) + 1);
    }
  });
}

console.log(`subject ${TARGET}   frames on screen ${n}   track births in those windows ${births}\n`);
[...cell.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
  console.log(`  ${k}   ${String(v).padStart(4)} frames   ${(100 * v / n).toFixed(0)}%`));

if (trackAges.length) {
  trackAges.sort((a, b) => a - b);
  const q = (p) => trackAges[Math.floor(trackAges.length * p)];
  console.log(`\n  when he IS covered, the covering track's age in frames:`);
  console.log(`    p05 ${q(0.05)}   p50 ${q(0.5)}   p95 ${q(0.95)}   max ${trackAges[trackAges.length - 1]}`);
  console.log(`    covered by a track <= 2 frames old: ${coveredAfterBirth} of ${trackAges.length}` +
    `  (${(100 * coveredAfterBirth / trackAges.length).toFixed(0)}%)`);
  console.log('\n  whose patch is covering him:');
  [...byOwner.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`    ${k.padEnd(30)} ${String(v).padStart(4)} frames`));
  console.log('\n  A track age at p50 near ZERO means the tracker keeps re-BIRTHING him and');
  console.log('  each newborn starts blurred -- the hypothesis. A large p50 means the same');
  console.log('  long-lived track is holding him covered, which is a different bug.');
}
