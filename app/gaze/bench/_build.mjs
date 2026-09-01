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
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
// AND THROWING IS THE POINT, not rebuilding.
//
// Node parses and LINKS every module before evaluating any of them, so
// .cache/shipped.mjs has already been read off disk by the time this
// body runs -- rewriting the file here cannot change what this process
// imported. What it CAN do is notice, and refuse. The next run is
// correct, and no run is ever silently wrong.
import fs from 'fs';
const d = path.dirname(fileURLToPath(import.meta.url));
const f = path.join(d, '.cache/shipped.mjs');
const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
execFileSync(process.execPath, [path.join(d, '_mkesm.cjs')], { stdio: 'inherit' });
const after = fs.readFileSync(f, 'utf8');
if (before !== after) throw new Error(
  '.cache/shipped.mjs was stale -- src/ has changed since it was built. '
  + 'It has been rebuilt now; re-run this arm. (Node links before it '
  + 'evaluates, so this process already imported the old bundle.)');
export const BUILT = true;
