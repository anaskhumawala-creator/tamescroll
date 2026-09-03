// JUDGE A FACE AGAINST THE ROOM, NOT AGAINST A FIXED LINE.
//
// The head's failure is per-PERSON and deterministic: 19 of 22 corpus
// women never leak, one leaks on every read she has. An absolute
// threshold cannot see that, because her 0.55 looks like any other 0.55.
//
// But she is not alone in the frame. If the men beside her -- same
// camera, same lighting, same encoder, same distance -- read 0.92, then
// her 0.55 is 0.37 BELOW the room. That gap is a different measurement
// from her absolute score, and it costs nothing: every read in the frame
// is already computed.
//
// TESTED THREE WAYS, because "relative" can mean several things and only
// one of them is honest:
//   gapMax   raw minus the highest raw in the frame
//   gapMean  raw minus the mean of the OTHER faces in the frame
//   rank     is this the lowest-scoring face in the frame
//
// ONLY MULTI-FACE FRAMES CAN BE SCORED. A frame with one face has no
// room to compare against, and that is most frames -- so whatever this
// buys, it buys on a minority of reads. The single-face share is
// reported first for exactly that reason.
//
// PER READ, not seconds. Same caveat as proof-gates.mjs.
import fs from 'fs';

const rows = JSON.parse(fs.readFileSync('Z:/Apps/Disconnect/app/gaze/bench/.cache/yaw-rows.json', 'utf8'));
for (const r of rows) {
  r.head = r.right ? (r.who === 'man' ? 'male' : 'female') : (r.who === 'man' ? 'female' : 'male');
  r.raw = r.head === 'male' ? 0.5 + r.score / 2 : 0.5 - r.score / 2;
  r.man = r.who === 'man';
  r.clearNow = r.head === 'male' && r.score >= 0.45;
  const m = /^(.*)\/f(\d+)_b/.exec(r.crop);
  r.frame = m ? `${m[1]}/${m[2]}` : r.crop;
}

const byFrame = new Map();
for (const r of rows) {
  if (!byFrame.has(r.frame)) byFrame.set(r.frame, []);
  byFrame.get(r.frame).push(r);
}
let solo = 0;
for (const a of byFrame.values()) {
  if (a.length < 2) { solo += a.length; for (const r of a) r.multi = false; continue; }
  for (const r of a) {
    r.multi = true;
    const others = a.filter((o) => o !== r);
    r.gapMax = r.raw - Math.max(...a.map((o) => o.raw));
    r.gapMean = r.raw - others.reduce((s, o) => s + o.raw, 0) / others.length;
    r.lowest = r.raw === Math.min(...a.map((o) => o.raw));
  }
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '--');
console.log(`reads ${rows.length}   frames ${byFrame.size}`);
console.log(`reads ALONE in their frame: ${solo} = ${pct(solo, rows.length)}  <- relative rules cannot touch these`);

const multi = rows.filter((r) => r.multi);
const F = multi.filter((r) => !r.man), M = multi.filter((r) => r.man);
console.log(`\nMULTI-FACE reads ${multi.length}   women ${F.length}   men ${M.length}`);
console.log(`women in multi-face frames: ${new Set(F.map((r) => r.cid)).size} people\n`);

console.log('baseline on multi-face reads only:');
console.log(`  shipped rule   exposure ${pct(F.filter((r) => r.clearNow).length, F.length)}`
  + `   false cover ${pct(M.filter((r) => !r.clearNow).length, M.length)}`);

console.log('\nADD: refuse to clear when the face is far BELOW the room');
for (const g of [-0.05, -0.10, -0.15, -0.20, -0.30]) {
  const ok = (r) => r.clearNow && r.gapMax > g;
  console.log(`  gapMax > ${g.toFixed(2)}   exposure ${pct(F.filter(ok).length, F.length).padStart(6)}`
    + `   false cover ${pct(M.filter((r) => !ok(r)).length, M.length).padStart(6)}`);
}
console.log('\nsame, against the mean of the other faces');
for (const g of [-0.05, -0.10, -0.15, -0.20, -0.30]) {
  const ok = (r) => r.clearNow && r.gapMean > g;
  console.log(`  gapMean > ${g.toFixed(2)}  exposure ${pct(F.filter(ok).length, F.length).padStart(6)}`
    + `   false cover ${pct(M.filter((r) => !ok(r)).length, M.length).padStart(6)}`);
}
console.log('\nrefuse to clear the LOWEST face in a frame of 2+');
{
  const ok = (r) => r.clearNow && !r.lowest;
  console.log(`  exposure ${pct(F.filter(ok).length, F.length)}   false cover ${pct(M.filter((r) => !ok(r)).length, M.length)}`);
}

// Does the gap SEPARATE better than the absolute score? If the two
// distributions overlap the same way, the gap carries nothing new.
const qs = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log('\nDOES THE GAP CARRY ANYTHING? (multi-face reads)');
for (const [name, key] of [['raw', 'raw'], ['gapMax', 'gapMax'], ['gapMean', 'gapMean']]) {
  const f = F.map((r) => r[key]).filter(Number.isFinite);
  const m = M.map((r) => r[key]).filter(Number.isFinite);
  console.log(`  ${name.padEnd(8)} women p50 ${qs(f, .5).toFixed(2)} p90 ${qs(f, .9).toFixed(2)}`
    + `   men p10 ${qs(m, .1).toFixed(2)} p50 ${qs(m, .5).toFixed(2)}`);
}
// The leaking women specifically -- the whole point of the exercise.
console.log('\nTHE LEAKING WOMEN, in multi-face frames:');
for (const cid of new Set(F.filter((r) => r.clearNow).map((r) => r.cid))) {
  const s = F.filter((r) => r.cid === cid && r.clearNow);
  const gm = s.map((r) => r.gapMax).filter(Number.isFinite);
  console.log(`  ${cid.padEnd(20)} leaked reads ${String(s.length).padStart(3)}`
    + (gm.length ? `   gapMax p50 ${qs(gm, .5).toFixed(2)}  worst ${Math.min(...gm).toFixed(2)}` : '   (no gap)'));
}
