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
import { lumaGrid, meanAbsDelta, CUT_DELTA, GATE_SIZE } from './.cache/shipped.mjs';

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
  const deltas = [];
  for (let i = 1; i < g.length; i++) {
    const d = meanAbsDelta(g[i - 1], g[i]);
    deltas.push(d);
    if (d >= CUT_DELTA) { const k = Math.min(n - 1, Math.ceil(i / per)); marks[k] = 1; }
  }
  cuts[tag] = marks;
  allD = allD.concat(deltas);
  const srt = deltas.slice().sort((a, b) => a - b);
  const q = (p) => (srt.length ? srt[Math.floor(p * (srt.length - 1))].toFixed(1) : '-');
  console.log(`${tag.padEnd(22)} 10Hz samples ${g.length}  cut frames ${marks.reduce((a, b) => a + b, 0)}/${n}` +
    `   delta p50 ${q(0.5)}  p95 ${q(0.95)}  max ${q(1)}`);
}
fs.writeFileSync(`${ROOT}/bank/cuts.json`, JSON.stringify(cuts));
const tot = Object.values(cuts).reduce((s, m) => s + m.reduce((a, b) => a + b, 0), 0);
const over = allD.filter((d) => d >= CUT_DELTA).length;
console.log(`
wrote ${ROOT}/bank/cuts.json`);
console.log(`  ${over} of ${allD.length} 10Hz deltas over CUT_DELTA ${CUT_DELTA} (${(100 * over / allD.length).toFixed(2)}%)`);
console.log(`  ${tot} of ${files.length * 120} banked frames land in a cut window`);
