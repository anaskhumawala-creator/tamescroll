// arbiter.mjs -- the shipped tfjs MoveNet graph on the tfjs CPU backend
// over the same dumped frames arbiter.py reads, so the tfjs WEBGL
// answer on the phone can be judged against its own model on a runtime
// that does not involve the phone's GPU.
//   node arbiter.mjs ../gauntlet/native-frames-<ts>.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const nm = path.join(repoRoot, 'app', 'gaze', 'node_modules');
const require = createRequire(import.meta.url);
const tf = require(path.join(nm, '@tensorflow', 'tfjs-core'));
require(path.join(nm, '@tensorflow', 'tfjs-backend-cpu'));
const tfconv = require(path.join(nm, '@tensorflow', 'tfjs-converter'));
const MODELS_DIR = path.join(repoRoot, 'app', 'gaze', 'models');
const PERSON_MIN_SCORE = 0.35; // person-gate.mjs:25

function artifacts(name) {
  const j = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, name + '.json'), 'utf8'));
  const weightData = fs.readFileSync(path.join(MODELS_DIR, name + '.bin')).buffer;
  const weightSpecs = [];
  for (const g of j.weightsManifest) for (const w of g.weights) weightSpecs.push(w);
  return { modelTopology: j.modelTopology, weightSpecs, weightData, format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy, signature: j.signature, userDefinedMetadata: j.userDefinedMetadata };
}

async function main() {
  await tf.setBackend('cpu');
  const bank = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const model = await tfconv.loadGraphModel({ load: () => Promise.resolve(artifacts('movenet-multipose')) });
  for (const fr of bank.frames) {
    const n = fr.N;
    for (const key of ['plain', 'shifted']) {
      const rgba = Buffer.from(fr[key], 'base64');
      const rgb = new Int32Array(n * n * 3);
      for (let i = 0, j = 0; i < n * n; i++, j += 3) { rgb[j] = rgba[i * 4]; rgb[j + 1] = rgba[i * 4 + 1]; rgb[j + 2] = rgba[i * 4 + 2]; }
      const x = tf.tensor4d(rgb, [1, n, n, 3], 'int32');
      const out = model.execute(x);
      const arr = (Array.isArray(out) ? out[0] : out).dataSync();
      let maxKp = 0; const slots = [];
      for (let s = 0; s < 6; s++) {
        for (let k = 0; k < 17; k++) maxKp = Math.max(maxKp, arr[s * 56 + k * 3 + 2]);
        slots.push(Math.round(arr[s * 56 + 55] * 1000) / 1000);
      }
      const admitted = slots.filter((s) => s >= PERSON_MIN_SCORE).length;
      console.log('t=' + String(fr.target).padEnd(6) + ' ' + key.padEnd(8) + ' tfjs-cpu   maxKp ' + maxKp.toFixed(3) + ' admitted ' + admitted + ' slots ' + JSON.stringify(slots));
      x.dispose(); tf.dispose(out);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
