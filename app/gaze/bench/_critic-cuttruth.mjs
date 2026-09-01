// CRITIC SCRATCH: cut-truth with the scdet threshold swept, deltas cached.
import fs from 'fs';
import { spawnSync } from 'child_process';
import { ROOT } from './corpus-lib.mjs';
import './_build.mjs';
import { lumaGrid, meanAbsDelta, GATE_SIZE } from './.cache/shipped.mjs';
const RATE = 10, N = GATE_SIZE, CELL = N * N * 3;
const CACHE = process.env.CCACHE;
function grids(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file,
    '-vf', `fps=${RATE},scale=${N}:${N}:flags=area`,
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
  const out = [];
  for (let i = 0; i + CELL <= r.stdout.length; i += CELL) {
    const rgb = r.stdout.subarray(i, i + CELL);
    const rgba = new Uint8ClampedArray(N * N * 4);
    for (let p = 0, j = 0; p < CELL; p += 3, j += 4) {
      rgba[j] = rgb[p]; rgba[j+1] = rgb[p+1]; rgba[j+2] = rgb[p+2]; rgba[j+3] = 255;
    }
    out.push(lumaGrid(rgba, N * N));
  }
  return out;
}
function scenes(file) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file,
    '-vf', `scdet=threshold=0.5`, '-f', 'null', '-'], { maxBuffer: 1 << 27 });
  const txt = (r.stderr || '').toString();
  const rx = /lavfi\.scd\.score:\s*([0-9.]+),\s*lavfi\.scd\.time:\s*([0-9.]+)/g;
  const o = []; let m; while ((m = rx.exec(txt))) o.push([parseFloat(m[1]), parseFloat(m[2])]);
  return o;
}
const files = fs.readdirSync(`${ROOT}/video`).filter(f => f.endsWith('.mp4'));
const data = [];
if (CACHE && fs.existsSync(CACHE)) {
  for (const e of JSON.parse(fs.readFileSync(CACHE,'utf8'))) data.push(e);
  console.error('cache hit');
} else {
  for (const f of files) {
    const p = `${ROOT}/video/${f}`;
    const g = grids(p);
    const d = []; for (let i=1;i<g.length;i++) d.push(meanAbsDelta(g[i-1],g[i]));
    data.push({ f, n: g.length, d, sc: scenes(p) });
    console.error(f, 'grids', g.length, 'scdet@0.5', data[data.length-1].sc.length);
  }
  if (CACHE) fs.writeFileSync(CACHE, JSON.stringify(data));
}
const q=(a,p)=>a.length?a[Math.floor(p*(a.length-1))]:NaN;
for (const SC of [0.5, 4, 8, 15, 25, 35, 50, 65]) {
  const cutD=[], restD=[]; let ncut=0;
  for (const e of data) {
    const times = e.sc.filter(([s])=>s>=SC).map(([,t])=>t);
    ncut += times.length;
    const idx = new Set(times.map(t=>Math.min(e.n-1, Math.max(1, Math.ceil(t*RATE)))));
    for (let i=1;i<e.n;i++) (idx.has(i)?cutD:restD).push(e.d[i-1]);
  }
  cutD.sort((a,b)=>a-b); restD.sort((a,b)=>a-b);
  const line = [28,50,60,75,90].map(t=>{
    const c=cutD.filter(d=>d>=t).length, r=restD.filter(d=>d>=t).length;
    return `${t}:${(100*c/(cutD.length||1)).toFixed(1)}%/${r}`;
  }).join('  ');
  console.log(`scdet>=${String(SC).padEnd(5)} rawEvents ${String(ncut).padStart(5)} cutFrames ${String(cutD.length).padStart(5)}` +
    ` | AT-CUT p50 ${q(cutD,0.5).toFixed(1)} p95 ${q(cutD,0.95).toFixed(1)}` +
    ` | REST p95 ${q(restD,0.95).toFixed(1)} p99 ${q(restD,0.99).toFixed(1)} | ${line}`);
}
