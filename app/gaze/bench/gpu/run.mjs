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

const { work: allWork, root: CROPROOT } = POP === 'fairface' ? fairfaceWork() : corpusWork();
const work = LIMIT ? allWork.slice(0, LIMIT) : allWork;
const job = { backend: BACKEND, arms: ARMS, work, mirror: MIRROR, keepDesc: KEEPDESC };

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
