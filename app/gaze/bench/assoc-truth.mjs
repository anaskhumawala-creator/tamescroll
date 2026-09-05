// RUN THIS AT HEAD, OR IN A CLEAN WORKTREE. `_build.mjs` bundles
// whatever is in src/ right now, so running it while another session has
// an unfinished track-mean in the tree measures THAT, not what ships.
// The numbers in the report were taken from `git worktree add <dir>
// --detach HEAD` for exactly this reason.
//
// PER-READ ASSOCIATION ACCURACY OF THE SHIPPED TRACKER, AGAINST THE HAND
// CLUSTERING. The one number that decides whether a track-mean can ship.
//
// The proposal replaces a track's LATEST gender read with a running mean
// over the reads on that track. Its whole value is conditional on the
// tracker putting reads on the right person: a prior sweep priced the
// corrupted-grouping curve and break-even against the shipped single
// read is ~10% mis-association at every window length.
//
// NOTHING IN THIS REPO MEASURED THAT. `identity-memory.mjs:6` (the
// covering id changes 260 times in 482 frames, median run ONE FRAME) and
// `docs/detection-engine.md:96` (32% of DIFFERENT-person pairs score
// >= MEM_SIM 0.6) are both about the CROSS-TRACK DESCRIPTOR join, not
// about the within-window IoU association that would accumulate a mean.
//
// THE INSTRUMENT RUNS THE SHIPPED RULE, IT DOES NOT RE-DERIVE IT. The
// association, the gates, the coast and the cut handler all come from
// `.cache/shipped.mjs` through `arch-arms.makeArms`, exactly as every
// other arm in this directory. The ONLY change is three recording lines
// spliced into the bundle at the sites where a track claims an
// observation, so that "which track did this read land on" stops having
// to be inferred from geometry afterwards. If any splice fails to match,
// this file throws rather than reporting a number (bench/_patch.mjs
// doctrine).
//
// GROUND TRUTH is bank/label/clusters.json -- the hand clustering, keyed
// by the same crop path the banked reads carry -- restricted to clusters
// bank/label/labels.json calls `man` or `woman`, which is the same
// population every accuracy finding in this round was scored on.
import './_build.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT, W, H } from './corpus-lib.mjs';
import { makeArms, hisRegimeOpts, thinFrames, K_HIS, loadWin, HIS_EFFZOOM } from './arch-arms.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_PATH = path.join(HERE, '.cache/shipped.mjs');
const PROBE_PATH = path.join(HERE, '.cache/assoc-probe.mjs');

// ---------------------------------------------------------------------
// THE SPLICE. Three sites, each asserted.
// ---------------------------------------------------------------------
const SPLICES = [
  [
    'function updatePersonTracks(tracks, observations, dtMs, hold) {',
    'function updatePersonTracks(tracks, observations, dtMs, hold) {\n'
    + '  if (globalThis.__ASSOC) globalThis.__ASSOC.push({ k: "frame" });',
  ],
  [
    'next.push(matchedStep(tracks[pair.t], observations[pair.o], dt));',
    '{ var __m = matchedStep(tracks[pair.t], observations[pair.o], dt);\n'
    + '  if (globalThis.__ASSOC) globalThis.__ASSOC.push({ k: "match", tid: __m.id,\n'
    + '    crop: observations[pair.o].box && observations[pair.o].box.__crop,\n'
    + '    oi: observations[pair.o].box && observations[pair.o].box.__oi,\n'
    + '    iou: pair.iou, demoted: !!tracks[pair.t].demoted });\n'
    + '  next.push(__m); }',
  ],
  [
    'next.push(newTrack(observations[j]));',
    '{ var __n = newTrack(observations[j]);\n'
    + '  if (globalThis.__ASSOC) globalThis.__ASSOC.push({ k: "birth", tid: __n.id,\n'
    + '    crop: observations[j].box && observations[j].box.__crop,\n'
    + '    oi: observations[j].box && observations[j].box.__oi, best: bestIou[j] });\n'
    + '  next.push(__n); }',
  ],
];

function buildProbe() {
  const src = fs.readFileSync(SHIPPED_PATH, 'utf8');
  let out = src;
  for (const [from, to] of SPLICES) {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error(
      `assoc-truth: splice site occurs ${n} times in .cache/shipped.mjs, expected 1:\n  ${from}\n`
      + 'The tracker changed shape. Fix the splice; do NOT report a number from an unspliced bundle.');
    out = out.replace(from, to);
  }
  fs.writeFileSync(PROBE_PATH, out);
}
buildProbe();
const PROBE_RAW = await import('./.cache/assoc-probe.mjs?' + Date.now());

// The banked face object carries `crop`, which is the key the hand
// clustering is written in. `personFromFace` is the ONE call every
// face-derived observation box goes through in the control arm, and both
// `clampAway` and `dedupeObservations` copy every own property of the
// box/observation they rebuild -- so the tag survives to association.
// Verified below by `taggedObs` / `untaggedObs`.
//
// AND A SECOND, SOURCE-INDEPENDENT TAG, because the crop tag rides on
// `personFromFace` and the `mnBody` arm replaces that box with a MEASURED
// MoveNet body -- which would silently drop every tag and leave the arm
// reporting on a fraction of its own reads. `dedupeObservations` is the
// last call before association and receives the observation array in
// `fr.faces` order, so the INDEX is a tag no body source can remove.
// The two tags must agree wherever both exist; `tagDisagree` below is
// that check, and it is the reason the crop tag is kept at all.
const PROBE = { ...PROBE_RAW,
  personFromFace: (f, aspect) => {
    const b = PROBE_RAW.personFromFace(f, aspect);
    if (b && f && f.crop) b.__crop = f.crop;
    return b;
  },
  // COPIES, never mutates: `preferred` hands one of the caller's own
  // objects back and writing into it is the laundering dedupe was
  // already caught doing once (person-track.mjs, loop 37c).
  dedupeObservations: (obs) => PROBE_RAW.dedupeObservations(
    (obs || []).map((o, i) => (o && o.box ? { ...o, box: { ...o.box, __oi: i } } : o))),
};

// ---------------------------------------------------------------------
// GROUND TRUTH
// ---------------------------------------------------------------------
const clusters = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/clusters.json`, 'utf8'));
const labels = JSON.parse(fs.readFileSync(`${ROOT}/bank/label/labels.json`, 'utf8'));
const cropCid = new Map();
for (const c of clusters) for (const m of c.members) cropCid.set(m.crop, c.id);
const PERSONY = new Set(['man', 'woman']);
const cidLabel = (cid) => labels[cid] || 'unlabelled';

// ---------------------------------------------------------------------
// REPLAY
// ---------------------------------------------------------------------
const GENDER = process.env.G || 'man';
// THE BODY SOURCE IS THE FIRST THING TO SWEEP, NOT AN AFTERTHOUGHT.
// arch-arms' own comment calls the synthetic body "THE SINGLE BIGGEST
// LIMIT ON EVERY NUMBER THIS FILE PRODUCES": the control arm paints
// `personFromFace`'s 4.4-face-height rectangle for 100% of observations,
// and IoU association is a function of exactly those rectangles. The app
// takes a MEASURED MoveNet body for 83.2% of banked faces here
// (extent-reach.mjs). So association measured on the guess is a bound,
// not a figure, and the `mnbody` arm is the other end of it.
const ARMS = {
  control: {},
  mnbody: { mnBody: true, ssdMin: 0 },
  mnbodyEdge: { mnBody: true, ssdMin: 0, ssdEdge: true },
  iou30: {},   // patched below
};
const ARMNAME = process.env.ARM || 'control';
const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json')).sort();
if (ARMNAME === 'iou30') PROBE_RAW.setIouMin(0.30);
if (ARMNAME === 'iou50') PROBE_RAW.setIouMin(0.50);
const arm = makeArms(PROBE)({ ...hisRegimeOpts(GENDER), ...(ARMS[ARMNAME] || {}) });

const rows = [];          // one per labelled read that reached association
let taggedObs = 0, untaggedObs = 0, framesSeen = 0, tagDisagree = 0, tagCropOnly = 0;
// which identities were ever visible in the SAME FRAME, per window.
// Two clusters that co-occur are provably two people; two that never do
// may be one person the hand clustering split, and a track carrying both
// is then a LABEL artefact rather than an association failure.
const coSeen = new Map();

for (const file of files) {
  const win0 = loadWin(file);
  const win = thinFrames(win0, K_HIS);
  const cuts = win0.cuts || [];
  globalThis.__ASSOC = [];
  arm(win, GENDER);
  const ev = globalThis.__ASSOC;
  globalThis.__ASSOC = null;

  // Reconstruct frames from the markers. One `frame` marker per
  // updatePersonTracks call, and the arm calls it once per win.frames
  // entry in order.
  let fi = -1;
  const bornAt = new Map();          // track id -> frame index of birth
  const perFrame = [];               // [{fi, events:[]}]
  for (const e of ev) {
    if (e.k === 'frame') { fi++; perFrame.push({ fi, events: [] }); continue; }
    if (fi < 0) throw new Error('assoc-truth: event before first frame marker');
    perFrame[fi].events.push(e);
    if (e.k === 'birth') bornAt.set(e.tid, fi);
  }
  if (perFrame.length !== win.frames.length) throw new Error(
    `assoc-truth: ${perFrame.length} tracker passes for ${win.frames.length} frames in ${file}`);

  for (const { fi: i, events } of perFrame) {
    const fr = win.frames[i];
    const faces = fr._labelFaces || fr.faces || [];
    // px by crop, and how many labelled people are in this frame.
    const pxOf = new Map();
    let inFrame = 0;
    const here = [];
    for (const f of faces) {
      if (f.crop) pxOf.set(f.crop, f.px);
      const cid = cropCid.get(f.crop);
      if (cid && PERSONY.has(cidLabel(cid))) { inFrame++; here.push(cid); }
    }
    for (let a = 0; a < here.length; a++) for (let b = 0; b < here.length; b++) {
      if (here[a] === here[b]) continue;
      const key = win.tag + '|' + here[a] + '|' + here[b];
      coSeen.set(key, true);
    }
    for (const e of events) {
      // The index tag is authoritative (it survives every body source);
      // the crop tag is the cross-check.
      const f = (typeof e.oi === 'number' && e.oi < faces.length) ? faces[e.oi] : null;
      const crop = f && f.crop ? f.crop : e.crop;
      if (!crop) { untaggedObs++; continue; }
      taggedObs++;
      if (e.crop && f && f.crop && e.crop !== f.crop) tagDisagree++;
      if (!e.crop && f) tagCropOnly++;
      const cid = cropCid.get(crop);
      if (!cid || !PERSONY.has(cidLabel(cid))) continue;
      rows.push({
        win: win.tag, vid: win0.vid, fi: i, crop, cid,
        tid: e.tid, kind: e.k, iou: e.iou == null ? null : e.iou,
        best: e.best == null ? null : e.best,
        demoted: !!e.demoted,
        age: e.k === 'birth' ? 0 : (bornAt.has(e.tid) ? i - bornAt.get(e.tid) : null),
        px: pxOf.get(crop) == null ? null : pxOf.get(crop),
        cut: !!cuts[i],
        // a cut anywhere in the last two frames -- the tracker's own
        // demote window at this cadence
        nearCut: !!(cuts[i] || cuts[i - 1] || cuts[i - 2]),
        inFrame,
      });
    }
  }
  framesSeen += perFrame.length;
}

// ---------------------------------------------------------------------
// SCORE
// ---------------------------------------------------------------------
/** majority ground-truth cid per (window, track id) */
function majorities(rs) {
  const per = new Map();
  for (const r of rs) {
    const k = r.win + '|' + r.tid;
    if (!per.has(k)) per.set(k, new Map());
    const m = per.get(k);
    m.set(r.cid, (m.get(r.cid) || 0) + 1);
  }
  const maj = new Map();
  for (const [k, m] of per) {
    let bc = null, bn = -1;
    for (const [cid, n] of m) if (n > bn || (n === bn && cid < bc)) { bc = cid; bn = n; }
    maj.set(k, bc);
  }
  return maj;
}
const MAJ = majorities(rows);
for (const r of rows) {
  const maj = MAJ.get(r.win + '|' + r.tid);
  r.bad = maj !== r.cid;
  // STRICT: only count it when the two identities were seen in the SAME
  // FRAME somewhere in this window, i.e. they are provably two people
  // rather than one person the hand clustering split in two. This is the
  // conservative floor of the same number.
  r.badStrict = r.bad && !!coSeen.get(r.win + '|' + r.cid + '|' + maj);
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '  -  ');
function line(name, rs) {
  const bad = rs.filter((r) => r.bad).length;
  return `${name.padEnd(26)} ${String(rs.length).padStart(6)}  ${String(bad).padStart(5)}  ${pct(bad, rs.length).padStart(6)}%`;
}

const out = [];
out.push(`ASSOCIATION TRUTH -- shipped tracker, arm '${ARMNAME}', ${GENDER}, his regime`);
out.push(`  told ${HIS_EFFZOOM.toFixed(0)}ms, K_HIS ${K_HIS}, ${files.length} windows, ${framesSeen} tracker passes`);
out.push(`  observations tagged ${taggedObs}, untagged ${untaggedObs}`);
out.push(`  index-vs-crop tag disagreements ${tagDisagree} (dedupe merges), crop tag missing ${tagCropOnly}`);
out.push(`  labelled reads reaching association: ${rows.length}`);
out.push(`  distinct identities: ${new Set(rows.map((r) => r.cid)).size}`);
out.push(`  distinct tracks: ${new Set(rows.map((r) => r.win + '|' + r.tid)).size}`);
out.push('');
out.push('population                      n    bad    rate');
out.push(line('ALL', rows));
out.push('');
out.push('-- by scene cut --');
out.push(line('cut on this frame', rows.filter((r) => r.cut)));
out.push(line('cut within 2 frames', rows.filter((r) => r.nearCut)));
out.push(line('no recent cut', rows.filter((r) => !r.nearCut)));
out.push(line('landed on a demoted track', rows.filter((r) => r.demoted)));
out.push('');
out.push('-- by track age (frames since birth) --');
for (const [lo, hi] of [[0, 0], [1, 2], [3, 6], [7, 14], [15, 1e9]]) {
  out.push(line(`age ${lo}-${hi === 1e9 ? 'inf' : hi}`, rows.filter((r) => r.age != null && r.age >= lo && r.age <= hi)));
}
out.push('');
out.push('-- by face size (native px) --');
for (const [lo, hi] of [[0, 32], [32, 48], [48, 64], [64, 100], [100, 1e9]]) {
  out.push(line(`px ${lo}-${hi === 1e9 ? 'inf' : hi}`, rows.filter((r) => r.px != null && r.px >= lo && r.px < hi)));
}
out.push('');
out.push('-- by labelled people in frame --');
for (const n of [1, 2, 3]) {
  out.push(line(n === 3 ? 'people >=3' : `people ${n}`, rows.filter((r) => (n === 3 ? r.inFrame >= 3 : r.inFrame === n))));
}
out.push('');
out.push('-- by how the read joined --');
out.push(line('birth (new track)', rows.filter((r) => r.kind === 'birth')));
out.push(line('match, iou < 0.30', rows.filter((r) => r.kind === 'match' && r.iou < 0.30)));
out.push(line('match, iou 0.30-0.60', rows.filter((r) => r.kind === 'match' && r.iou >= 0.30 && r.iou < 0.60)));
out.push(line('match, iou >= 0.60', rows.filter((r) => r.kind === 'match' && r.iou >= 0.60)));
out.push('');
out.push('-- per window --');
for (const f of files) {
  const tag = f.replace(/\.json$/, '');
  out.push(line(tag, rows.filter((r) => r.win === tag)));
}

// WINDOWED MIS-ASSOCIATION. The proposal does not average a whole track
// unconditionally -- K=3 and K=5 average the last K reads. A read is
// "polluted" for window K if any of the K-1 reads before it ON THE SAME
// TRACK belongs to a different identity. That is the quantity the
// corrupted-grouping sweep was modelling, so it is the one to compare
// against break-even, and it is NOT the same as the majority rate.
const seq = new Map();
for (const r of rows) {
  const k = r.win + '|' + r.tid;
  if (!seq.has(k)) seq.set(k, []);
  seq.get(k).push(r);
}
out.push('');
out.push('-- what a K-read running mean would actually average --');
out.push('K      reads   windows mixing   share of AVERAGED READS that are foreign');
out.push('                identities      (this is the sweep\'s mis-association axis)');
for (const K of [2, 3, 5, 1e9]) {
  let n = 0, mixedW = 0, tot = 0, foreign = 0;
  for (const [, list] of seq) {
    for (let i = 0; i < list.length; i++) {
      const lo = K === 1e9 ? 0 : Math.max(0, i - (K - 1));
      let mixed = false;
      for (let j = lo; j <= i; j++) {
        tot++;
        if (list[j].cid !== list[i].cid) { mixed = true; foreign++; }
      }
      n++; if (mixed) mixedW++;
    }
  }
  out.push(`${String(K === 1e9 ? 'all' : K).padEnd(6)} ${String(n).padStart(5)}   ${pct(mixedW, n).padStart(6)}%          ${pct(foreign, tot).padStart(6)}%`);
}
out.push('');
out.push('-- the same table counting only identities PROVEN distinct (seen in one frame together) --');
out.push(line('ALL, strict', rows.map((r) => ({ bad: r.badStrict }))));
{
  const strictSeq = new Map();
  for (const r of rows) {
    const k = r.win + '|' + r.tid;
    if (!strictSeq.has(k)) strictSeq.set(k, []);
    strictSeq.get(k).push(r);
  }
  for (const K of [3, 5]) {
    let tot = 0, foreign = 0;
    for (const [, list] of strictSeq) {
      for (let i = 0; i < list.length; i++) {
        const lo = Math.max(0, i - (K - 1));
        for (let j = lo; j <= i; j++) {
          tot++;
          if (list[j].cid !== list[i].cid
            && coSeen.get(list[i].win + '|' + list[i].cid + '|' + list[j].cid)) foreign++;
        }
      }
    }
    out.push(`K = ${K}, strict foreign share of averaged reads: ${pct(foreign, tot)}%`);
  }
}

// ---------------------------------------------------------------------
// BOOTSTRAP OVER IDENTITIES. 51 clusters is the unit of independence.
// ---------------------------------------------------------------------
const byCid = new Map();
for (const r of rows) {
  if (!byCid.has(r.cid)) byCid.set(r.cid, []);
  byCid.get(r.cid).push(r);
}
const cids = [...byCid.keys()];
let seed = 20260905;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const draws = [];
for (let b = 0; b < 4000; b++) {
  let n = 0, bad = 0;
  for (let i = 0; i < cids.length; i++) {
    const rs = byCid.get(cids[Math.floor(rnd() * cids.length)]);
    n += rs.length; for (const r of rs) if (r.bad) bad++;
  }
  draws.push(100 * bad / n);
}
draws.sort((a, b) => a - b);
const q = (p) => draws[Math.floor(p * (draws.length - 1))];
out.push('');
out.push(`bootstrap over ${cids.length} IDENTITIES, 4000 draws:`);
out.push(`  point ${pct(rows.filter((r) => r.bad).length, rows.length)}%   95% CI [${q(0.025).toFixed(1)}%, ${q(0.975).toFixed(1)}%]`);
out.push(`  P(rate >= 10% break-even) = ${(100 * draws.filter((d) => d >= 10).length / draws.length).toFixed(1)}%`);

// WORST OFFENDERS, named. A bench that reports a bound must name the rows
// behind it (finding 48's own 388-vs-5 error).
const perTrack = [];
for (const [k, list] of seq) {
  const bad = list.filter((r) => r.bad).length;
  if (bad) perTrack.push({ k, n: list.length, bad, ids: [...new Set(list.map((r) => r.cid))], frames: [list[0].fi, list[list.length - 1].fi] });
}
perTrack.sort((a, b) => b.bad - a.bad);
out.push('');
out.push(`-- tracks that mixed identities: ${perTrack.length} of ${seq.size} --`);
for (const t of perTrack.slice(0, 20)) {
  out.push(`  ${t.k.padEnd(28)} n${String(t.n).padStart(4)} bad${String(t.bad).padStart(4)}  frames ${t.frames[0]}-${t.frames[1]}  ${t.ids.join(' + ')}`);
}

const text = out.join('\n');
console.log(text);
fs.writeFileSync(path.join(HERE, `.cache/assoc-truth-${ARMNAME}-${GENDER}.json`), JSON.stringify({ rows, ci: [q(0.025), q(0.975)] }));
