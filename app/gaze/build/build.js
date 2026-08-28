// Bundles tfjs (core+cpu+webgl+converter, Apache-2.0) + the embedded
// BlazeFace model + our runtime into one self-contained minified IIFE,
// written straight to app/src-tauri/gaze-init.js — a committed generated
// artifact, `include_str!`-ed into the Rust binary, same treatment as the
// vendored EasyList/EasyPrivacy rule snapshots. Zero runtime network/fetch
// deps: this has to run unmodified under Reddit's `default-src 'none'`.
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// STAMP THE BUILD, not a hand-edited version string. `__TS_GAZE_BUNDLE__`
// read 'v7' across at least three distinct code states, so every gauntlet
// run recorded a boot marker that could not identify what it was running
// — two runs minutes apart reported the same 'v7' while logging different
// diagnostic counters. A round whose evidence cannot be attributed to a
// commit cannot be compared to any other round.
function buildStamp() {
  try {
    const head = execSync('git rev-parse --short HEAD', {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    // A dirty tree is the normal state mid-round, and it is exactly when
    // the marker matters most — say so rather than implying the commit.
    const dirty = execSync('git status --porcelain -- . ../src-tauri/gaze-init.js', {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return head + (dirty ? '-dirty' : '');
  } catch (e) {
    // No git, no problem: never fail a build over a debug marker.
    return 'nogit';
  }
}

// globalThis, not window: the same artifact is also a worker script, and
// the worker's own eval cost is the thing that has to come down now.
const EVAL_CLOCK =
  'try{globalThis.__TS_GAZE_EVAL0=performance.now();}catch(e){}' + String.fromCharCode(10);

async function main() {
  if (!fs.existsSync(path.join(__dirname, '../src/model-embed.js'))) {
    console.error('src/model-embed.js missing — run gen-embed.js first (npm run build:gaze does both).');
    process.exit(1);
  }

  // TWO ARTIFACTS, ONE COPY OF THE MODELS.
  //
  // gaze-init.js is the full one: the worker loads it from
  // /__tamescroll/gaze-init.js, and it is also where the in-page
  // fallback gets model bytes from (model-blobs.mjs publishes them on
  // window when this artifact runs in a page).
  //
  // gaze-page.js is what the PAGE is injected with. Same entry, same
  // code, no models: model-blobs.mjs is swapped for model-blobs-lazy.mjs,
  // which fetches the full artifact only if the worker is unavailable.
  // The page was parsing 22MB on every single navigation for bytes it
  // does not use once inference moved off-thread.
  async function build(outfile, pageBuild) {
    return esbuild.build({
      entryPoints: [path.join(__dirname, '../src/init-entry.js')],
      bundle: true,
      minify: true,
      format: 'iife',
      target: ['es2019'],
      outfile,
      legalComments: 'none',
      metafile: true,
      plugins: pageBuild
        ? [
            {
              name: 'ts-page-models',
              setup(b) {
                b.onResolve({ filter: /\/model-blobs\.mjs$/ }, () => ({
                  path: path.join(__dirname, '../src/model-blobs-lazy.mjs'),
                }));
              },
            },
          ]
        : [],
    });
  }

  const outfile = path.join(__dirname, '../../src-tauri/gaze-init.js');
  const pagefile = path.join(__dirname, '../../src-tauri/gaze-page.js');
  const result = await build(outfile, false);
  await build(pagefile, true);
  // Rewrite the marker in the built artifact rather than the source, so
  // the source stays a stable string and the stamp cannot drift.
  const stamp = buildStamp();
  // EVAL CLOCK, first statement in each output: what evaluating this
  // artifact costs on THIS device, per page load. Only the build can
  // guarantee the position -- an import in the entry module would
  // already be after the bundler's own module init. It is also how the
  // page/full split gets to prove itself rather than be assumed.
  for (const f of [outfile, pagefile]) {
    const raw = fs.readFileSync(f, 'utf8');
    const marked = raw.replace(/__TS_GAZE_BUNDLE__="v7"/, '__TS_GAZE_BUNDLE__="' + stamp + '"');
    if (marked === raw) {
      console.warn(`WARNING: bundle marker not found in ${f} — runs will not be attributable`);
      continue;
    }
    fs.writeFileSync(f, EVAL_CLOCK + marked);
  }
  console.log(`bundle marker: ${stamp}`);

  for (const f of [outfile, pagefile]) {
    const stat = fs.statSync(f);
    console.log(`built ${f}: ${(stat.size / 1024 / 1024).toFixed(3)} MB (${stat.size} bytes)`);
  }
  void result;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
