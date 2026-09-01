// THE EVIDENCE PACKET. docs/critic-loop.md §5.1.
//
// This file is NOT edited per run. That constraint is the whole design:
// the moment I get to choose what the critic sees, the critic is reading
// my conclusion again, and every negative result in the literature about
// intrinsic self-correction applies.
//
// WHAT GOES IN: the diff, commit SUBJECTS only, raw test stdout with exit
// codes, raw measurement files touched in range, the path to the EMITTED
// bundle, the standing brief, the findings doc, the open ledger.
//
// WHAT STAYS OUT, and this is a hard rule: my session summary, my
// CLAUDE.md entry, commit message BODIES, and any prose in which I state
// a conclusion. Commit bodies are excluded deliberately -- they are the
// most convincingly-written statement of my own conclusion in the repo,
// which is exactly the self-recognition signal that drives
// self-preference.
//
// Usage: node bench/critic-packet.mjs <base-ref> [outdir]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const BASE = process.argv[2] || 'HEAD~1';
const OUT = process.argv[3]
  || path.join(process.env.TEMP || '/tmp', `critic-packet-${BASE.replace(/[^\w]/g, '_')}`);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\//, ''), '../../..');

const git = (...a) => execFileSync('git', a, { cwd: REPO, maxBuffer: 1 << 28 }).toString();
fs.mkdirSync(OUT, { recursive: true });
const w = (name, body) => fs.writeFileSync(path.join(OUT, name), body);

// 1. the actual change
// The emitted bundle is excluded from the DIFF and handed over as a path
// (see 07): it is 1MB of minified JS, a diff of it is unreadable, and
// the check that matters is a grep the critic runs itself.
w('01-diff.patch', git('diff', `${BASE}..HEAD`, '--',
  '.', ':(exclude)app/src-tauri/gaze-page.js'));
w('02-diffstat.txt', git('diff', '--stat', `${BASE}..HEAD`));

// 2. SUBJECTS ONLY. `--format=%s` cannot emit a body even if one exists,
// so the exclusion is structural rather than a promise.
w('03-commit-subjects.txt', git('log', '--format=%s', `${BASE}..HEAD`));

// 3. the executable oracle: raw stdout, exit code recorded, never summarised
function run(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, { cwd, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString() };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status,
      out: (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '') };
  }
}
// node --test directly rather than through npm: on Windows npm.cmd needs
// a shell, and a packet that reports "exit null" for the executable
// oracle is a packet with no oracle in it.
// The glob is the one package.json declares. `test/` alone made node
// treat the directory as one test file and report a single opaque
// failure -- a packet whose oracle says "1 failed" with no name is worse
// than no oracle, because it reads exactly like a real regression.
const t1 = run(process.execPath, ['--test', 'test/**/*.test.mjs'], path.join(REPO, 'app/gaze'));
w('04-gaze-test.txt', `EXIT CODE ${t1.code}\n\n${t1.out}`);
const t2 = run('cargo', ['test'], path.join(REPO, 'app/src-tauri'));
w('05-cargo-test.txt', `EXIT CODE ${t2.code}\n\n${t2.out}`);

// 4. raw measurement files touched in range -- the numbers, not my table
const touched = git('diff', '--name-only', `${BASE}..HEAD`).split('\n').filter(Boolean);
const raw = touched.filter((f) => /\.(json|txt)$/.test(f)
  && /^(spikes|rules|app\/gaze\/bench)/.test(f) && !/manifest\.json$/.test(f));
let idx = 'Raw measurement / config files changed in range:\n';
for (const f of raw) {
  const p = path.join(REPO, f);
  if (!fs.existsSync(p)) continue;
  const st = fs.statSync(p);
  idx += `  ${f}  ${st.size} bytes\n`;
  if (st.size < 400000) w('raw--' + f.replace(/[\\/]/g, '__'), fs.readFileSync(p, 'utf8'));
}
w('06-raw-index.txt', idx);

// 5. THE EMITTED BUNDLE. Handed over as a PATH plus its size and hash,
// never as content -- it is 1MB of minified JS and the point is that the
// critic greps it itself. Source is not evidence; a constant has shipped
// dead here for six rounds.
const bundle = path.join(REPO, 'app/src-tauri/gaze-page.js');
w('07-emitted-bundle.txt',
  `PATH   ${bundle}\nBYTES  ${fs.statSync(bundle).size}\n`
  + `MTIME  ${fs.statSync(bundle).mtime.toISOString()}\n\n`
  + 'C4: grep THIS FILE for any constant the diff claims to have changed.\n'
  + 'The source is not evidence. Build it fresh with:\n'
  + '  node app/gaze/build/build.js\n'
  + 'and check the bytes moved -- a stale bundle is how a change ships dead.\n');

// 6. the standing brief and the constitution
for (const [n, f] of [['08-run-goal.md', 'docs/run-goal.md'],
  ['09-engine-findings.md', 'docs/engine-findings.md'],
  ['10-ledger.md', 'docs/critic/ledger.md']]) {
  const p = path.join(REPO, f);
  w(n, fs.existsSync(p) ? fs.readFileSync(p, 'utf8')
    : `(${f} does not exist yet -- no findings have been filed)\n`);
}

// 7. harness state for C11, read rather than asserted
const adb = process.env.ANDROID_HOME
  ? path.join(process.env.ANDROID_HOME, 'platform-tools/adb.exe')
  : 'C:/Users/zvcla/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const dev = run(adb, ['devices', '-l']);
w('11-harness.txt', `adb devices:\n${dev.out}\n`
  + 'C11: a 0 after a context reset is a FRESH COUNTER, not a clean run.\n'
  + 'Check the WebView pid behind any device number in the diff.\n');

console.log(OUT);
console.log(`  diff ${fs.statSync(path.join(OUT, '01-diff.patch')).size} bytes`);
console.log(`  gaze test exit ${t1.code}   cargo test exit ${t2.code}`);
console.log(`  ${raw.length} raw measurement file(s)`);
