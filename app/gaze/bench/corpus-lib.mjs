// Shared plumbing for the video corpus. Kept in one place because the
// scan, the bank and the parity arm must decode frames IDENTICALLY --
// two decoders is two chances to compare different pixels.
import { spawnSync, execFileSync } from 'child_process';
import fs from 'fs';

export const ROOT = 'Z:/tamescroll-corpus';
export const W = 640, H = 360;          // his measured decode, itag 134
export const FRAME = W * H * 3;
export const VIDEOS = (process.env.VIDS || [
  // The original five, from prior gauntlet runs.
  'NWoT1ZVd1Lo', 'H14bBuluwB8', 'z86LGEFyQpo', 'Ary1gIbaOTc', 'RcGyVTAoXEU',
  // Round two. A result tuned and scored on ONE set of five videos is a
  // result about those five; the owner asked for more footage and it is
  // also the only honest answer to "were the constants fitted here".
  '4u3jS_cTHH0', '8R1hy3uHds0', '1L_R0MB2W5A', 'KAWvDsghyc8', 'eIho2S0ZahI',
].join(',')).split(',').filter(Boolean);

// A staging bank, so a corpus expansion can be prepared while another
// process is still scoring the current one. Two writers in one bank is
// how a window file gets half-written and read as a result.
export const BANK = process.env.BANK || 'bank';
export const MODELS = 'Z:/Apps/Disconnect/app/gaze/models/';

export function fsHandler(name) {
  const j = JSON.parse(fs.readFileSync(MODELS + name + '.json', 'utf8'));
  const b = fs.readFileSync(MODELS + name + '.bin');
  const specs = [];
  for (const g of j.weightsManifest) for (const w of g.weights) specs.push(w);
  return { load: async () => ({
    modelTopology: j.modelTopology, weightSpecs: specs,
    weightData: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy,
    signature: j.signature, userDefinedMetadata: j.userDefinedMetadata }) };
}

export function dur(file) {
  return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());
}

/** n consecutive frames starting at t, at `fps` if given. Raw rgb24. */
export function grabRaw(file, t, n, fps) {
  const args = ['-v', 'error', '-ss', String(t), '-i', file];
  if (fps) args.push('-vf', `fps=${fps}`);
  args.push('-frames:v', String(n), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: FRAME * n + (1 << 22) });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const out = [];
  for (let i = 0; i + FRAME <= r.stdout.length; i += FRAME) out.push(r.stdout.subarray(i, i + FRAME));
  return out;
}

// NATIVE FACE SIZE, THE WAY THE APP MEASURES IT -- and it is not the
// width of the normalized box times the frame width.
//
// detectFaceBoxes squarifies in 256x256 MODEL space, so a face has
// EQUAL normalized extents; in native pixels that is norm*640 across
// and norm*360 down, and init-entry's `nativePx` takes the MIN, i.e.
// the height. Measuring it as norm*W overstates every face by 640/360
// = 1.78x, which would have banked this corpus at px p50 ~119 against
// his measured 38-62 and calibrated the wrong population entirely.
//
// This is the FOURTH time normalized units hiding the frame aspect has
// cost this codebase something -- personFromFace, person-gate and
// init-entry's own comment record the first three.
export function nativePx(box) {
  return Math.min((box.x2 - box.x1) * W, (box.y2 - box.y1) * H);
}
