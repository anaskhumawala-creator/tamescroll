// THE BUNDLE IS REBUILT BEFORE ANYTHING IMPORTS IT.
//
// This module exists ONLY for its evaluation order. ESM evaluates a
// module's dependencies depth-first in import order and BEFORE any
// statement in the importing module's body, so a `execFileSync` in
// arch-arms' body runs AFTER `.cache/shipped.mjs` has already been
// evaluated -- it would rebuild for the next process, not this one.
// Importing this first is the only way to get the build in ahead.
//
// It matters because .cache/shipped.mjs is an esbuild of src/ and
// NOTHING re-ran the build: an arm silently scored whatever the source
// was the last time somebody ran _mkesm by hand. Caught by a sweep that
// reported `birthCleared 0` in every row while the counter beside it was
// rising -- the bundle predated the counter by an hour.
//
// AND THROWING IS THE POINT, not rebuilding.
//
// Node parses and LINKS every module before evaluating any of them, so
// .cache/shipped.mjs has already been read off disk by the time this
// body runs -- rewriting the file here cannot change what this process
// imported. What it CAN do is notice, and refuse. The next run is
// correct, and no run is ever silently wrong.
//
// ---------------------------------------------------------------------
// THIS FILE RACED WITH ITSELF, AND THE TWO TESTS IT PROTECTS WERE COIN
// FLIPS BECAUSE OF IT.
//
// `node --test "test/**/*.test.mjs"` runs each file in its own process,
// concurrently. Two test files import arch-arms, which imports this, so
// two processes reached `execFileSync(_mkesm)` at the same time and both
// wrote `.cache/shipped.mjs`. Whichever one read `before` while the
// other was mid-write got a truncated string, `before !== after`, and
// THREW -- reported by the runner as a whole test file failing with
// 'test failed' and no assertion named. Observed twice in eight runs, on
// two different files, both green when run alone. A guard against a
// defect class may not itself be a coin flip.
//
// Two changes make it race-free, and the first one does most of the work:
//
//   1. NO WRITE WHEN NOTHING CHANGED. The build only runs if some input
//      is newer than the bundle. Repeated runs -- which is every run
//      after the first -- now touch nothing at all, so there is no
//      window to race in.
//   2. ONE WRITER. When a build IS needed, a `wx` lock file elects one
//      process to run esbuild; everybody else waits for it to finish and
//      then throws for the ordinary reason (they, too, imported the old
//      bundle). Nobody reads the file while it is being written.
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const d = path.dirname(fileURLToPath(import.meta.url));
const f = path.join(d, '.cache/shipped.mjs');
const lock = path.join(d, '.cache/shipped.lock');
const SRC = path.join(d, '../src');

// Newest mtime across every input the bundle is built from. `_mkesm.cjs`
// counts as an input: change how the bundle is made and the bundle is
// stale even if no source moved.
function newestInput() {
  let newest = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  walk(SRC);
  newest = Math.max(newest, fs.statSync(path.join(d, '_mkesm.cjs')).mtimeMs);
  return newest;
}

const built = fs.existsSync(f) ? fs.statSync(f).mtimeMs : -1;
if (built >= newestInput()) {
  // Up to date. Nothing is executed and nothing is written, which is what
  // makes concurrent test files safe.
} else {
  let held = false;
  try {
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
    held = true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  if (held) {
    try {
      execFileSync(process.execPath, [path.join(d, '_mkesm.cjs')], { stdio: 'inherit' });
    } finally {
      try { fs.unlinkSync(lock); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  } else {
    // Somebody else is building. Wait for them rather than reading a file
    // that is being written. A stale lock cannot hang a run for long:
    // the wait is bounded and the throw below happens either way.
    const nap = new Int32Array(new SharedArrayBuffer(4));
    const until = Date.now() + 60000;
    while (fs.existsSync(lock) && Date.now() < until) Atomics.wait(nap, 0, 0, 50);
  }
  // RUN AS A COMMAND, THIS IS A BUILD. IMPORTED, IT IS A REFUSAL.
  //
  // The throw exists because node links before it evaluates, so a
  // process that IMPORTED a stale bundle cannot be saved by rebuilding
  // it -- the only honest thing left is to refuse. But when this file is
  // the ENTRY POINT nobody has imported anything yet: the rebuild above
  // has already happened and the right exit is 0. That is what makes a
  // `pretest` possible, and a pretest is the actual fix for the
  // stale-cache flakiness that `--test-concurrency=1` only reduced from
  // three failures to one (phase-g G4).
  if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(d, "_build.mjs")) {
    process.stderr.write('bench/.cache/shipped.mjs rebuilt (src/ had changed).\n');
  } else {
  // SAY IT ON stderr AS WELL AS THROWING. Under `node --test` a module
  // that throws at import time is reported as the FILE failing with
  // 'test failed' and no message, which reads exactly like a regression
  // -- it cost an evidence packet's oracle a false alarm. The line below
  // is what lands in any captured output.
  process.stderr.write([
    '',
    '*** bench/.cache/shipped.mjs WAS STALE and has been rebuilt.',
    '*** This is NOT a test regression: node links before it evaluates,',
    '*** so every process that imported the old bundle must be re-run.',
    '*** Re-run the suite; it is green on the second pass.',
    '', '',
  ].join('\n'));
  throw new Error(
    '.cache/shipped.mjs was stale -- src/ has changed since it was built. '
    + 'It has been rebuilt now; re-run this arm. (Node links before it '
    + 'evaluates, so this process already imported the old bundle.)');
  }
}
export const BUILT = true;
