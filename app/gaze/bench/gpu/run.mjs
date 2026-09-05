// THE NODE HALF: BUILD, SERVE, DRIVE A HEADLESS CHROME, BANK THE ROWS.
//
// Usage:
//   node bench/gpu/run.mjs --pop=corpus --backend=webgl --arms=rgb,grey --out=NAME
//   node bench/gpu/run.mjs --pop=corpus --backend=cpu   --arms=rgb,grey --out=NAME
//
// The two lines above are the parity check. Same population, same arms,
// same preprocessing module, only the backend differs -- so a difference
// in the output IS the backend, which is the only way a GPU number earns
// the right to be believed.
//
// NOTHING IS SHOWN ON HIS SCREEN. Chrome runs --headless=new against
// 127.0.0.1 and the only content it ever loads is our own crops and
// models off local disk. No feed, no thumbnails, no network.
//
// There is deliberately no CDP here. The page fetches its own job and
// POSTs its own result, so the driver is an HTTP server and a process
// handle -- no websocket, no protocol version to drift, and a failure
// shows up as a POST that says ok:false with a stack.
import './../_build.mjs';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const GAZE = path.resolve(HERE, '..', '..');
const BANK = 'Z:/tamescroll-corpus/bank';
const FAIR = 'Z:/tamescroll-corpus/fairface';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const POP = arg('pop', 'corpus');
const BACKEND = arg('backend', 'webgl');
const ARMS = arg('arms', 'rgb,grey').split(',');
const LIMIT = Number(arg('limit', '0'));
const MIRROR = arg('mirror', '0') === '1';
const KEEPDESC = arg('desc', '0') === '1';
// --sizes=24,32,40,48,64,96,128,224 emits one row per NATIVE pixel size,
// degrading each crop to that size and back (arms.degrade). 0 or absent
// means the crop is used untouched.
const SIZES = arg('sizes', '').split(',').map(Number).filter((x) => x > 0);
// --mode=detect runs the DETECTOR false-fire chain over whole frames
// (BlazeFace + MoveNet + faceres) instead of the gender arms over crops.
const MODE = arg('mode', 'arms');
const OUT = arg('out', 'gpu-' + POP + '-' + BACKEND);
const PORT = Number(arg('port', '8931'));

// ---------------------------------------------------------------- work
function corpusWork() {
  const labels = JSON.parse(fs.readFileSync(BANK + '/label/labels.json', 'utf8'));
  const clusters = JSON.parse(fs.readFileSync(BANK + '/label/clusters.json', 'utf8'));
  const work = [];
  for (const c of clusters) {
    const who = labels[c.id];
    if (who !== 'woman' && who !== 'man') continue;
    for (const m of c.members) work.push({ who, cid: c.id, vid: c.vid, crop: m.crop, px: m.px });
  }
  return { work, root: BANK + '/crops' };
}

function fairfaceWork() {
  const meta = JSON.parse(fs.readFileSync(FAIR + '/sample.json', 'utf8'));
  // sample.json is GROUPED BY RACE, so a head-N slice is a single-race
  // sample. Interleave by (race,gender) so any --limit stays balanced.
  const buckets = new Map();
  for (const m of meta) {
    const k = m.race + '|' + m.gender;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(m);
  }
  const keys = [...buckets.keys()].sort();
  const work = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const k of keys) {
      const b = buckets.get(k);
      if (i < b.length) {
        any = true;
        work.push({ who: b[i].gender === 'Male' ? 'man' : 'woman', race: b[i].race, crop: b[i].file });
      }
    }
    if (!any) break;
  }
  return { work, root: FAIR + '/sample' };
}

// THE FULL FairFace VALIDATION SPLIT -- 10,954 rows, not the 1,400 in
// sample/. Extracted by bench/gpu/extract-fairface.py straight out of
// val025.parquet, with the class names read from the parquet's own
// metadata and cross-checked against sample/ by MD5 of decoded pixels
// (60 of 60 agree on race AND gender), so rows from the two banks are
// the same labelling and are comparable.
//
// WHY IT EXISTS: every head-retraining question is bounded by labels,
// not by compute. 1,024 free parameters fitted on 1,348 rows overfits,
// and the first ceiling probe did exactly that -- 60 epochs scored WORSE
// than 6, which reads as 'the trunk is the wall' when it is a training
// defect. 8x the rows is the cheapest way to remove that confound.
//
// Interleaved by (race,gender) for the same reason fairfaceWork() is:
// the source is ordered, so a --limit slice must stay balanced or a
// truncated run silently measures one group.
function fairfaceFullWork() {
  const meta = JSON.parse(fs.readFileSync(FAIR + '/full.json', 'utf8'));
  const buckets = new Map();
  for (const m of meta) {
    const k = m.race + '|' + m.gender;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(m);
  }
  const keys = [...buckets.keys()].sort();
  const work = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const k of keys) {
      const b = buckets.get(k);
      if (i < b.length) {
        any = true;
        work.push({
          who: b[i].gender === 'Male' ? 'man' : 'woman',
          race: b[i].race, age: b[i].age, row: b[i].row, crop: b[i].file,
        });
      }
    }
    if (!any) break;
  }
  return { work, root: FAIR + '/full' };
}
// WHOLE VIDEO FRAMES, NOT CROPS -- the detector false-fire population.
//
// Every crop in bank/crops is a crop BlazeFace already fired on, so the
// whole corpus is conditioned on detection and is structurally incapable
// of measuring a false fire. Findings 35, 38 and 45 each say so in their
// own words; finding 38 measured RECALL on frames that all contained a
// face, which cannot see a false POSITIVE at all.
//
// These are ffmpeg frames at 1 per 4s off the ten corpus videos at their
// production 640x360 -- the resolution his player actually decodes, so a
// detection here is a detection he would get. 3,809 frames.
//
// Interleaved by video so a --limit slice does not become one video.
// `--pop=dense` is the SAME function over the 2fps bank. The student's
// domain gap (FairFace AUC 0.94 against his corpus 0.785) is the reason
// it exists: `frames-scan` samples one frame every FOUR SECONDS, so the
// in-domain half of the student's training set was 1.3% of it. One
// function, two roots -- a second copy of the interleave would drift,
// and the interleave is load-bearing (a --limit slice of a per-video
// listing is one video).
function framesWork(root) {
  root = root || 'Z:/tamescroll-corpus/frames-scan';
  const vids = fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory()).sort();
  const buckets = vids.map((v) => fs.readdirSync(path.join(root, v)).filter((f) => f.endsWith('.ppm')).sort()
    .map((f) => ({ vid: v, frame: f, crop: v + '/' + f })));
  const work = [];
  for (let i = 0; ; i++) {
    let any = false;
    for (const b of buckets) if (i < b.length) { any = true; work.push(b[i]); }
    if (!any) break;
  }
  return { work, root };
}
// REAL THUMBNAILS, INCLUDING PERSON-FREE ONES -- the half of his
// complaint finding 48 could not reach.
//
// Finding 48 used video frames from videos that CONTAIN PEOPLE and found
// the detector nearly innocent (5 false fires in 5,451 detections). His
// words were about THUMBNAILS -- 'randomly just blur some text' -- and a
// gaming or coding thumbnail often holds no person at all, which is a
// population that bench structurally could not contain.
//
// 370 thumbnails off 14 searches chosen to span both kinds, fetched at
// hq720 and normalised to 640x360. hqdefault was REFUSED: it is 480x360,
// i.e. a 16:9 image letterboxed into 4:3, so every face would be smaller
// than his feed shows and two hard black edges would enter the frame --
// an artifact the app never sees.
function thumbsWork() {
  const root = 'Z:/tamescroll-corpus/thumbs-ppm';
  const idx = JSON.parse(fs.readFileSync('Z:/tamescroll-corpus/thumbs/index.json', 'utf8'));
  const meta = new Map(idx.map((r) => [r.id, r]));
  const work = [];
  for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.ppm')).sort()) {
    const id = f.slice(0, -4);
    const m = meta.get(id) || {};
    // `q`/`expect` ride along for slicing only. They are a HINT, never a
    // label -- a gameplay thumbnail often carries a facecam.
    work.push({ vid: id, frame: f, crop: f, q: m.q, expect: m.expect });
  }
  return { work, root };
}
const { work: allWork, root: CROPROOT } =
  POP === 'thumbs' ? thumbsWork()
    : POP === 'frames' ? framesWork()
      : POP === 'dense' ? framesWork('Z:/tamescroll-corpus/frames-dense')
      : POP === 'fairfull' ? fairfaceFullWork()
        : POP === 'fairface' ? fairfaceWork()
          : corpusWork();
const work = LIMIT ? allWork.slice(0, LIMIT) : allWork;
const job = { backend: BACKEND, arms: ARMS, work, mirror: MIRROR, keepDesc: KEEPDESC, sizes: SIZES, mode: MODE };

// --------------------------------------------------------------- build
process.stderr.write('bundling browser entry...\n');
// The JS API, not the .cmd shim -- execFileSync cannot spawn a .cmd on
// Windows without a shell, and going through a shell to build the bundle
// invites a quoting bug in the one step that decides what actually ran.
const esbuild = (await import('esbuild')).default;
esbuild.buildSync({
  entryPoints: [path.join(HERE, 'entry.js')],
  bundle: true, format: 'esm', platform: 'browser',
  outfile: path.join(HERE, '.bundle.js'),
});

const HTML = '<!doctype html><meta charset=utf8><title>ts gpu bench</title>'
  + '<body><pre id=log>booting</pre><script type=module src="/bundle.js"></script></body>';

// -------------------------------------------------------------- server
let resolveDone;
const doneP = new Promise((r) => { resolveDone = r; });

const MIME = { '.json': 'application/json', '.js': 'text/javascript',
  '.bin': 'application/octet-stream', '.ppm': 'application/octet-stream' };

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const send = (code, type, body) => { res.writeHead(code, { 'content-type': type }); res.end(body); };

  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (url === '/progress') { process.stderr.write('  ' + raw + '\n'); return send(204, 'text/plain', ''); }
      if (url === '/done') { send(204, 'text/plain', ''); resolveDone(JSON.parse(raw)); return; }
      send(404, 'text/plain', '');
    });
    return;
  }

  if (url === '/' || url === '/index.html') return send(200, 'text/html', HTML);
  if (url === '/job.json') return send(200, 'application/json', JSON.stringify(job));
  if (url === '/bundle.js') return send(200, 'text/javascript', fs.readFileSync(path.join(HERE, '.bundle.js')));

  // movenet-multipose.json's weightsManifest names 'weights.bin' -- the app
  // loads it through embeddedIoHandler, which never reads that field, so
  // the mismatch has never mattered. A plain URL load DOES read it and
  // fetches a file that is not there; the 404 body then decodes as a
  // 3-value tensor and the failure reads like a corrupt model. Rewrite the
  // path on serve rather than editing the shipped manifest -- the bench
  // must load the same bytes the app does.
  if (url === '/models/movenet-multipose.json') {
    const m = JSON.parse(fs.readFileSync(path.join(GAZE, 'models', 'movenet-multipose.json'), 'utf8'));
    for (const g of m.weightsManifest) g.paths = ['movenet-multipose.bin'];
    return send(200, 'application/json', JSON.stringify(m));
  }

  // Static, with the traversal guard stated rather than assumed: the
  // resolved path must still sit under the root it was resolved from.
  let file = null;
  if (url.startsWith('/models/')) file = path.join(GAZE, 'models', decodeURIComponent(url.slice(8)));
  else if (url.startsWith('/crops/')) file = path.join(CROPROOT, decodeURIComponent(url.slice(7)));
  if (!file) return send(404, 'text/plain', 'no route');
  const rootOf = url.startsWith('/models/') ? path.join(GAZE, 'models') : CROPROOT;
  if (!path.resolve(file).startsWith(path.resolve(rootOf))) return send(403, 'text/plain', 'nope');
  if (!fs.existsSync(file)) return send(404, 'text/plain', 'missing');
  send(200, MIME[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file));
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
process.stderr.write('serving on 127.0.0.1:' + PORT + '  work ' + work.length
  + '  arms ' + ARMS.join('/') + '  backend ' + BACKEND + '\n');

// -------------------------------------------------------------- chrome
const profile = 'Z:/tmp/chrome-bench-' + PORT;
const chrome = spawn(CHROME, [
  '--headless=new', '--use-angle=default', '--disable-gpu-sandbox',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + profile,
  'http://127.0.0.1:' + PORT + '/',
], { stdio: 'ignore' });

const TIMEOUT_MS = Number(arg('timeout', String(6 * 60 * 60 * 1000)));
const timeout = new Promise((r) => setTimeout(() => r({ ok: false, error: 'timeout' }), TIMEOUT_MS));
const result = await Promise.race([doneP, timeout]);

try { chrome.kill(); } catch (e) { /* already gone */ }
server.close();

if (!result.ok) {
  process.stderr.write('\nFAILED: ' + result.error + '\n');
  process.exit(1);
}

const outFile = BANK + '/' + OUT + '.json';
fs.writeFileSync(outFile, JSON.stringify(result.rows));
process.stderr.write('\nbackend  ' + result.backend + '\nrenderer ' + result.renderer
  + '\nrows     ' + result.rows.length + '  (noFace ' + result.noFace + ', noPPM ' + result.noPPM + ')'
  + '\ntime     ' + result.secs.toFixed(1) + 's   ' + result.rate.toFixed(2) + ' crop/s'
  + '\nbanked   ' + outFile + '\n');
process.exit(0);
