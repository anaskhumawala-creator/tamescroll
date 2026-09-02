// Offline replay of the SHIPPED R27 directional clamp over the track
// snapshots banked by probe_events.py (fields co/cf/hf), to price
// "present the drawn geometry instead of the raw tracker box" BEFORE a
// build. Imports the shipped function -- never a copy of the rule.
//
//   node replay_clamp.mjs events-<label>.json
//
// For every certain same-gender read under a presented patch (the
// reclass rows), re-draws each BLURRED track of that pass's snapshot as
// blurredTracks would (side pad + clampPatchOffFaces against the
// cleared tracks' face boxes) and asks whether the read's face centre
// is still inside any blurred box. Two arms: the shipped rule (a stale
// core stands the clamp down, cf === 0) and a variant that clamps with
// a stale core too.
import fs from 'node:fs';
import { clampPatchOffFaces, PTRACK_PAD } from '../../app/gaze/src/person-track.mjs';

const path = process.argv[2];
const doc = JSON.parse(fs.readFileSync(path, 'utf8'));
const d = doc.raw;
const same = (d.gender || 'man') === 'man' ? 'male' : 'female';
// The first collector tick dumps the ring backlog under one timestamp
// (events_reclass.py has the same drop).
const firstTick = d.tracks.length ? Math.min(...d.tracks.map((s) => s.ms)) : 0;
const sn = d.tracks.filter((s) => s.lm != null && s.ms > firstTick);
d.reads = d.reads.filter((r) => r.ms > firstTick);
const box = (b) => ({ x1: b[0], y1: b[1], x2: b[2], y2: b[3] });
const contains = (p, fb) => {
  const cx = (fb[0] + fb[2]) / 2, cy = (fb[1] + fb[3]) / 2;
  return p.x1 - 0.01 <= cx && cx <= p.x2 + 0.01 && p.y1 - 0.01 <= cy && cy <= p.y2 + 0.01;
};
const pad = (b) => {
  const w = b.x2 - b.x1, h = b.y2 - b.y1;
  return { x1: Math.max(0, b.x1 - w * PTRACK_PAD), y1: Math.max(0, b.y1 - h * 0.06), x2: Math.min(1, b.x2 + w * PTRACK_PAD), y2: Math.min(1, b.y2 + h * PTRACK_PAD) };
};
// reads -> next snapshot (same join as events_reclass)
// A read that landed before the first snapshot belongs to a pass this
// file never saw (same join as events_reclass.py).
for (const r of d.reads) {
  const nxt = sn.length && r.ms >= sn[0].ms ? sn.find((s) => s.ms >= r.ms) : null;
  r.pass = nxt ? nxt.lm : null;
}
const rows = { raw: 0, shipped: 0, staleCore: 0, headFloor: 0, headFloorStale: 0, n: 0, ownCleared: 0 };
const detail = [];
for (const s of sn) {
  const reads = d.reads.filter((r) => r.pass === s.lm && r.g === same && !r.ab && (r.s || 0) >= 0.45 && r.b);
  if (!reads.length) continue;
  const faces = s.tr.filter((t) => t.st === 'cleared' && t.hf).map((t) => box(t.hf)).sort((p, q) => p.x1 - q.x1 || p.y1 - q.y1);
  for (const r of reads) {
    const own = s.tr.filter((t) => t.b && contains(box(t.b), r.b));
    const ownCleared = own.some((t) => t.st === 'cleared');
    const blurred = s.tr.filter((t) => t.st === 'blurred' && t.b);
    if (!blurred.some((t) => contains(box(t.b), r.b))) continue; // not covered by the raw box either
    rows.n++;
    rows.raw++;
    if (ownCleared) rows.ownCleared++;
    const arm = (allowStale, useHead) => blurred.some((t) => {
      let b = pad(box(t.b));
      const core = t.co ? box(t.co) : null;
      // `hf` on a BLURRED track is its own head box (clearedFaceBox is
      // computed for every track the probe records), the head floor.
      const head = useHead && t.hf ? box(t.hf) : null;
      if (faces.length && core && (t.cf === 1 || allowStale)) b = clampPatchOffFaces(b, core, faces, head);
      return contains(b, r.b);
    });
    const a1 = arm(false, false), a2 = arm(true, false), a3 = arm(false, true), a4 = arm(true, true);
    if (a1) rows.shipped++;
    if (a2) rows.staleCore++;
    if (a3) rows.headFloor++;
    if (a4) rows.headFloorStale++;
    detail.push({ m: s.lm, s: r.s, ownCleared, shipped: a1, stale: a2, headFloor: a3, headFloorStale: a4,
      neighbours: blurred.filter((t) => contains(box(t.b), r.b)).map((t) => ({ id: t.id, f: t.f, mm: t.mm, cf: t.cf, w: +(t.b[2] - t.b[0]).toFixed(3), co: t.co, hf: t.hf })),
      faces: faces.length, face: r.b });
  }
}
console.log(JSON.stringify(rows));
for (const x of detail) console.log(JSON.stringify(x));
