// parity.mjs -- runs the three shipped tfjs graph models (blazeface,
// faceres, movenet-multipose) on a deterministic synthetic input using
// the tfjs already installed under app/gaze/node_modules, and dumps
// each model's raw outputs to out/<model>-tfjs.json for parity.py to
// compare against the converted .tflite files.
//
// IOHandler pattern copied from app/gaze/src/detector.js's
// embeddedIoHandler/artifacts (reads model.json + a local .bin instead
// of base64/fetch).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const gazeNodeModules = path.join(repoRoot, 'app', 'gaze', 'node_modules');
const require = createRequire(import.meta.url);

function req(pkg) {
  return require(path.join(gazeNodeModules, '@tensorflow', pkg));
}

const tf = req('tfjs-core');
require(path.join(gazeNodeModules, '@tensorflow', 'tfjs-backend-cpu'));
const tfconv = req('tfjs-converter');

const MODELS_DIR = path.join(repoRoot, 'app', 'gaze', 'models');
const OUT_DIR = path.join(__dirname, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

function artifactsFromDisk(name) {
  const modelJson = JSON.parse(fs.readFileSync(path.join(MODELS_DIR, `${name}.json`), 'utf8'));
  const weightData = fs.readFileSync(path.join(MODELS_DIR, `${name}.bin`)).buffer;
  const weightSpecs = [];
  for (const group of modelJson.weightsManifest) {
    for (const w of group.weights) weightSpecs.push(w);
  }
  return {
    modelTopology: modelJson.modelTopology,
    weightSpecs,
    weightData,
    format: modelJson.format,
    generatedBy: modelJson.generatedBy,
    convertedBy: modelJson.convertedBy,
    signature: modelJson.signature,
    userDefinedMetadata: modelJson.userDefinedMetadata,
  };
}

function ioHandlerFor(name) {
  const a = artifactsFromDisk(name);
  return { load: () => Promise.resolve(a) };
}

// Deterministic synthetic input: a seeded pseudo-random gradient so
// every channel/pixel differs (a flat image would hide broadcasting
// bugs in the converted graph). xorshift32, fixed seed.
function seededFloats(n, seed) {
  let x = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    out[i] = x / 4294967295;
  }
  return out;
}

function tensorToJSON(t) {
  return { shape: t.shape, dtype: t.dtype, data: Array.from(t.dataSync()) };
}

async function dumpOutputs(name, execOutputNames, outputMap) {
  const outObj = {};
  for (const [outName, t] of outputMap) {
    outObj[outName] = tensorToJSON(t);
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}-tfjs.json`), JSON.stringify(outObj));
  console.log(`${name}: wrote ${Object.keys(outObj).length} output(s) -> out/${name}-tfjs.json`);
}

async function runBlazeface() {
  const model = await tfconv.loadGraphModel(ioHandlerFor('blazeface'));
  // input [1,256,256,3] float32, normalized to app's own (x/127.5)-1
  // convention (see detector.js detectFaceBoxes) so the tflite parity
  // check exercises the same numeric range the app actually feeds it.
  const n = 1 * 256 * 256 * 3;
  const raw = seededFloats(n, 0xC0FFEE);
  const norm = raw.map((v) => v * 255 / 127.5 - 1);
  const input = tf.tensor4d(norm, [1, 256, 256, 3], 'float32');
  const outNames = ['Identity:0', 'Identity_1:0', 'Identity_2:0', 'Identity_3:0'];
  const res = model.execute(input, outNames);
  const outputMap = outNames.map((n, i) => [n, res[i]]);
  await dumpOutputs('blazeface', outNames, outputMap);
  fs.writeFileSync(
    path.join(OUT_DIR, 'blazeface-input.json'),
    JSON.stringify({ shape: [1, 256, 256, 3], dtype: 'float32', data: Array.from(norm) })
  );
  tf.dispose([input, ...res]);
  tf.dispose(model);
}

async function runFaceres() {
  const model = await tfconv.loadGraphModel(ioHandlerFor('faceres'));
  // input_1 [1,224,224,3] float32, 0..1 range per detector.js usage
  // (crop bytes / 255).
  const n = 1 * 224 * 224 * 3;
  const raw = seededFloats(n, 0xFACE5);
  const input = tf.tensor4d(raw, [1, 224, 224, 3], 'float32');
  const outNames = ['gender_pred/Sigmoid:0', 'age_pred/Softmax:0', 'global_pooling/Mean'];
  const res = model.execute({ input_1: input }, outNames);
  const outputMap = outNames.map((n, i) => [n, res[i]]);
  await dumpOutputs('faceres', outNames, outputMap);
  fs.writeFileSync(
    path.join(OUT_DIR, 'faceres-input.json'),
    JSON.stringify({ shape: [1, 224, 224, 3], dtype: 'float32', data: Array.from(raw) })
  );
  tf.dispose([input, ...res]);
  tf.dispose(model);
}

async function runMovenet() {
  const model = await tfconv.loadGraphModel(ioHandlerFor('movenet-multipose'));
  // input [1,256,256,3] int32, 0..255 per detector.js detectPersons
  // (tf.cast(resized, 'int32') on a resized-to-256 frame, no letterbox
  // for parity -- fixed square input keeps this deterministic).
  const n = 1 * 256 * 256 * 3;
  const raw = seededFloats(n, 0x0b0d1e);
  const int255 = Int32Array.from(raw, (v) => Math.round(v * 255));
  const input = tf.tensor4d(Array.from(int255), [1, 256, 256, 3], 'int32');
  const res = model.execute(input);
  const outputMap = [['output_0', res]];
  await dumpOutputs('movenet-multipose', ['output_0'], outputMap);
  fs.writeFileSync(
    path.join(OUT_DIR, 'movenet-multipose-input.json'),
    JSON.stringify({ shape: [1, 256, 256, 3], dtype: 'int32', data: Array.from(int255) })
  );
  tf.dispose([input, res]);
  tf.dispose(model);
}

async function main() {
  await tf.setBackend('cpu');
  await tf.ready();
  console.log('backend:', tf.getBackend());
  await runBlazeface();
  await runFaceres();
  await runMovenet();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
