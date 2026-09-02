import fs from 'node:fs';
import { makeTimeline, pushSnapshot, pushCut, boxesAt } from '../../app/gaze/src/track-timeline.mjs';
import { mergePresented, padTrackBox, clampPatchOffFaces } from '../../app/gaze/src/person-track.mjs';
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).raw;
const pms = process.argv.slice(3).map(Number);
const firstTick = Math.min(...d.tracks.map((s) => s.ms));
const sn = d.tracks.filter((s) => s.lm != null && s.ms > firstTick).sort((a, b) => a.ms - b.ms);
const B = (a) => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[3] });
const R = (b) => b ? [b.x1, b.y1, b.x2, b.y2].map((v) => +v.toFixed(3)) : null;
const tl = makeTimeline(1e12);
const cuts = d.cuts.filter((c) => c.vt != null); let ci = 0;
for (const s of sn) {
  while (ci < cuts.length && cuts[ci].ms <= s.ms) { pushCut(tl, cuts[ci].vt); ci++; }
  pushSnapshot(tl, s.lm, s.tr.filter((t) => t.b).map((t) => {
    const hd = t.hf ? B(t.hf) : null;
    const box = padTrackBox({ box: B(t.b), headW: hd ? hd.x2 - hd.x1 : 0, headY: hd ? (hd.y1 + hd.y2) / 2 : undefined, headH: hd ? hd.y2 - hd.y1 : undefined });
    if (t.st === 'blurred') return { id: t.id, box, state: 'blurred', core: t.co && (t.cf === 1 || (t.mm || 0) > 0) ? B(t.co) : null, head: hd, headX: hd ? (hd.x1 + hd.x2) / 2 : undefined, headW: hd ? hd.x2 - hd.x1 : undefined, headY: hd ? (hd.y1 + hd.y2) / 2 : undefined, headH: hd ? hd.y2 - hd.y1 : undefined, face: null, flagCertain: t.lv === 'flag-certain', coasting: (t.mm || 0) > 0 };
    return { id: t.id, box, state: 'cleared', core: null, face: hd, flagCertain: false, coasting: (t.mm || 0) > 0 };
  }));
}
for (const pm of pms) {
  const b = boxesAt(tl, pm);
  console.log('pm', pm, 'entries', JSON.stringify((b || []).map((e) => [e.id, e.state, R(e.box), 'core', R(e.core), 'head', R(e.head), 'face', R(e.face), 'hw', e.headW])));
  console.log('   merged', JSON.stringify(mergePresented(b || []).map((e) => [e.id, R(e.box)])));
}
