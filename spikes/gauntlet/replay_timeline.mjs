// Offline replay of the SHIPPED timeline + presentation merge over the
// snapshots banked by probe_events.py: for every certain same-gender read
// under a presented patch, was the TARGET the renderer was handed (boxesAt
// + mergePresented at the frame's presented media time) also over his
// face, or only the rect the renderer drew? Approximations, stated: the
// snapshot box is the RAW tracker box (padTrackBox stands in for the drawn
// one), flagCertain is lv === 'flag-certain', a cut's media time is the
// live currentTime at detection.
//   node replay_timeline.mjs events-<label>.json
import fs from 'node:fs';
import { makeTimeline, pushSnapshot, pushCut, boxesAt } from '../../app/gaze/src/track-timeline.mjs';
import { mergePresented, padTrackBox } from '../../app/gaze/src/person-track.mjs';

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).raw;
const same = (d.gender || 'man') === 'man' ? 'male' : 'female';
const firstTick = Math.min(...d.tracks.map((s) => s.ms));
const sn = d.tracks.filter((s) => s.lm != null && s.ms > firstTick).sort((a, b) => a.ms - b.ms);
const frames = d.frames.filter((f) => f.pm != null);
const B = (a) => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[3] });
const contains = (p, fb) => {
  const cx = (fb[0] + fb[2]) / 2, cy = (fb[1] + fb[3]) / 2;
  return p.x1 - 0.01 <= cx && cx <= p.x2 + 0.01 && p.y1 - 0.01 <= cy && cy <= p.y2 + 0.01;
};
// Build the timeline exactly as the app would have, in wall order.
const tl = makeTimeline(1e12);
const cuts = d.cuts.filter((c) => c.vt != null).map((c) => ({ ms: c.ms, vt: c.vt }));
let ci = 0;
const snapAt = new Map();
for (const s of sn) {
  while (ci < cuts.length && cuts[ci].ms <= s.ms) { pushCut(tl, cuts[ci].vt); ci++; }
  const entries = s.tr.filter((t) => t.b).map((t) => {
    const box = padTrackBox({ box: B(t.b), headW: t.hf ? t.hf[2] - t.hf[0] : 0, headY: t.hf ? (t.hf[1] + t.hf[3]) / 2 : undefined, headH: t.hf ? t.hf[3] - t.hf[1] : undefined });
    const hd = t.hf ? B(t.hf) : null;
    if (t.st === 'blurred') {
      return { id: t.id, box, state: 'blurred', core: t.co && (t.cf === 1 || (t.mm || 0) > 0) ? B(t.co) : null, head: hd,
        headX: hd ? (hd.x1 + hd.x2) / 2 : undefined, headW: hd ? hd.x2 - hd.x1 : undefined, headY: hd ? (hd.y1 + hd.y2) / 2 : undefined, headH: hd ? hd.y2 - hd.y1 : undefined,
        face: null, flagCertain: t.lv === 'flag-certain', coasting: (t.mm || 0) > 0 };
    }
    return { id: t.id, box, state: 'cleared', core: null, face: hd, flagCertain: false, coasting: (t.mm || 0) > 0 };
  });
  pushSnapshot(tl, s.lm, entries);
  snapAt.set(s.lm, s);
}
const reads = d.reads.filter((r) => r.ms > firstTick);
for (const r of reads) { const nxt = sn.length && r.ms >= sn[0].ms ? sn.find((s) => s.ms >= r.ms) : null; r.pass = nxt ? nxt.lm : null; }
let rows = 0, targetCovers = 0, drawnOnly = 0;
for (const s of sn) {
  for (const r of reads) {
    if (r.pass !== s.lm || r.g !== same || r.ab || (r.s || 0) < 0.45 || !r.b) continue;
    const near = frames.filter((f) => Math.abs(f.pm - s.lm) <= 0.25);
    const cov = near.filter((f) => f.p.some((p) => contains(B(p), r.b)));
    if (!cov.length) continue;
    rows++;
    let tcov = 0;
    for (const f of cov) {
      const b = boxesAt(tl, f.pm);
      const merged = b ? mergePresented(b) : [];
      if (merged.some((e) => contains(e.box, r.b))) tcov++;
    }
    if (tcov > 0) targetCovers++; else drawnOnly++;
    console.log(JSON.stringify({ m: s.lm, s: r.s, drawnCovered: cov.length, targetCovered: tcov }));
  }
}
console.log(JSON.stringify({ rows, targetCovers, drawnOnly }));
