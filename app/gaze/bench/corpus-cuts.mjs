// SCENE CUTS FOR THE BANKED WINDOWS, computed with the SHIPPED gate.
//
// arch-arms replays faceMeta, personFromFace, dedupeObservations and
// updatePersonTracks -- and NOT scene-gate.mjs, which the app runs and
// which WIPES every track on a cut. That omission is not cosmetic:
// bar-blame traced this corpus's biggest single exposure to a shot
// change where a woman's observation re-associated onto a stale CLEARED
// track left behind by a man in the previous shot, and took two
// verdicts to revoke it. The gate exists precisely to stop that, so a
// bench without it is charging the bar change for a failure the app
// already prevents.
//
// The grid, the delta and the threshold are all imported from the
// shipped module -- a reimplementation here could only ever agree with
// itself.
import fs from 'fs';
import { spawnSync } from 'child_process';
import { ROOT } from './corpus-lib.mjs';
import { lumaGrid, meanAbsDelta, CUT_DELTA as SHIPPED_DELTA, GATE_SIZE } from './.cache/shipped.mjs';

// "CUT_DELTA CANNOT BE SWEPT ON THE CORPUS AT ALL" IS NO LONGER TRUE.
//
// That note (loop 40) was right about the BANK -- cuts.json holds
// booleans, so a variant constant has nothing to re-decide. It was never
// true of the corpus: the deltas come from the video, so the bank can
// simply be re-derived per value. This is the deltas cache that makes
// that cheap (one ffmpeg pass over the whole corpus instead of one per
// value) and the argument that names the value.
//
// The DELTAS are a property of the footage and the gate's own geometry,
// so they are cached under bank/deltas.json keyed by GATE_SIZE and RATE
// -- never by CUT_DELTA, which is only the comparison at the end.
const CUT_DELTA = process.argv[2] ? Number(process.argv[2]) : SHIPPED_DELTA;
// THE DEFAULT PATH IS SELF-NAMING FOR ANY NON-SHIPPED VALUE, and that is
// a guard, not a convenience. It used to default to bank/cuts.json for
// every delta, so sweeping `for v in 35 50 75 90; do corpus-cuts $v` --
// which is exactly how a sweep is run -- silently left the DEFAULT bank
// holding whichever value ran last. It did: cuts.json ended up stamped
// 50 against a bundle shipping 60, and every corpus arm refused to start
// until it was noticed. The stamp check caught it, which is the point of
// the stamp check; this stops it happening.
const OUT = process.argv[3]
  || `${ROOT}/bank/cuts${CUT_DELTA === SHIPPED_DELTA ? '' : `-${CUT_DELTA}`}.json`;
if (!Number.isFinite(CUT_DELTA)) throw new Error('CUT_DELTA must be a number');

// AT THE APP'S OWN RATE, NOT THE BANK'S.
//
// The first working version of this ran the gate between frames 500ms
// apart, because that is what the corpus banks. CUT_DELTA 28 was
// calibrated for samples <=100ms apart, so at 2fps ordinary MOTION
// clears it: one window reported 72 "cuts" in 120 frames at a median
// delta of 35.9. That is the sampling rate, not the footage, and using
// it would have credited the scene gate with wiping tracks 330 times.
//
// So the deltas are computed at 10Hz -- STATIC_INTERVAL_MS is 1000 and
// the gate samples at up to 10Hz -- and ffmpeg does the downscale, which
// also removes the hand-rolled box filter the previous version needed.
// `scale=16:16:flags=area` is a box average, the same thing drawImage
// onto a 16x16 canvas does.
const RATE = 10;
const N = GATE_SIZE, CELL = N * N * 3;

function grids(file, t0, secs) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t0), '-i', file,
    '-t', String(secs), '-vf', `fps=${RATE},scale=${N}:${N}:flags=area`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const out = [];
  for (let i = 0; i + CELL <= r.stdout.length; i += CELL) {
    const rgb = r.stdout.subarray(i, i + CELL);
    const rgba = new Uint8ClampedArray(N * N * 4);
    for (let p = 0, j = 0; p < CELL; p += 3, j += 4) {
      rgba[j] = rgb[p]; rgba[j + 1] = rgb[p + 1]; rgba[j + 2] = rgb[p + 2]; rgba[j + 3] = 255;
    }
    out.push(lumaGrid(rgba, N * N));
  }
  return out;
}

const files = fs.readdirSync(`${ROOT}/bank/reads`).filter((f) => f.endsWith('.json'));
const cuts = {};
const peaks = {};
let allD = [];
for (const f of files) {
  const win = JSON.parse(fs.readFileSync(`${ROOT}/bank/reads/${f}`, 'utf8'));
  const tag = f.replace(/\.json$/, '');
  const t0 = win.frames[0].t, n = win.frames.length, secs = n / win.fps;
  const g = grids(`${ROOT}/video/${win.vid}.mp4`, t0, secs + 1 / win.fps);
  // A banked frame is marked when a cut happened anywhere in the 1/fps
  // window ENDING at it -- which is what the tracker would have seen
  // between its two verdict passes.
  const per = Math.max(1, Math.round(RATE / win.fps));
  const marks = new Array(n).fill(0);
  // PER BANKED FRAME, THE LARGEST 10Hz DELTA IN THE WINDOW ENDING AT IT.
  // Same mapping the marks use, with the VALUE kept instead of the
  // comparison. That makes it a property of the footage and the gate's
  // geometry only -- which is what the header above has always claimed
  // for bank/deltas.json, while nothing ever wrote the file.
  const peak = new Array(n).fill(0);
  const deltas = [];
  for (let i = 1; i < g.length; i++) {
    const d = meanAbsDelta(g[i - 1], g[i]);
    deltas.push(d);
    const k = Math.min(n - 1, Math.ceil(i / per));
    if (d > peak[k]) peak[k] = d;
    if (d >= CUT_DELTA) marks[k] = 1;
  }
  cuts[tag] = marks;
  peaks[tag] = peak.map((d) => Math.round(d * 100) / 100);
  allD = allD.concat(deltas);
  const srt = deltas.slice().sort((a, b) => a - b);
  const q = (p) => (srt.length ? srt[Math.floor(p * (srt.length - 1))].toFixed(1) : '-');
  console.log(`${tag.padEnd(22)} 10Hz samples ${g.length}  cut frames ${marks.reduce((a, b) => a + b, 0)}/${n}` +
    `   delta p50 ${q(0.5)}  p95 ${q(0.95)}  max ${q(1)}`);
}
// STAMPED WITH THE CONSTANT IT WAS BANKED AT.
//
// It was not, and it cost a wrong number in the flattering direction:
// loop 40 moved CUT_DELTA 28 -> 50 and this file was never re-run, so
// every arm reading it for a fortnight ran 221 cut frames against the
// true 115, and a cut wipes every track. Nothing in the harness could
// say so, because a stale derivative of a shipped constant looks exactly
// like a fresh one. arch-arms refuses a file whose stamp disagrees with
// the bundle it is running.
const tot = Object.values(cuts).reduce((s, m) => s + m.reduce((a, b) => a + b, 0), 0);
cuts.__meta = { CUT_DELTA, GATE_SIZE, rate: RATE };
fs.writeFileSync(OUT, JSON.stringify(cuts));
// NOT KEYED BY CUT_DELTA, and that is the point: the deltas are the
// footage, the threshold is only the comparison at the end. One file
// serves every value and every arm that wants to place work by how much
// the picture moved rather than by a clock.
peaks.__meta = { GATE_SIZE, rate: RATE };
fs.writeFileSync(`${ROOT}/bank/deltas.json`, JSON.stringify(peaks));
const over = allD.filter((d) => d >= CUT_DELTA).length;
console.log(`
wrote ${OUT}`);
console.log(`  ${over} of ${allD.length} 10Hz deltas over CUT_DELTA ${CUT_DELTA} (${(100 * over / allD.length).toFixed(2)}%)`);
console.log(`  ${tot} of ${files.length * 120} banked frames land in a cut window`);
