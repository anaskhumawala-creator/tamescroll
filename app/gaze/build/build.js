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

async function main() {
  if (!fs.existsSync(path.join(__dirname, '../src/model-embed.js'))) {
    console.error('src/model-embed.js missing — run gen-embed.js first (npm run build:gaze does both).');
    process.exit(1);
  }

  const outfile = path.join(__dirname, '../../src-tauri/gaze-init.js');
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, '../src/init-entry.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    outfile,
    legalComments: 'none',
    metafile: true,
  });
  // Rewrite the marker in the built artifact rather than the source, so
  // the source stays a stable string and the stamp cannot drift.
  const stamp = buildStamp();
  const built = fs.readFileSync(outfile, 'utf8');
  const stamped = built.replace(/__TS_GAZE_BUNDLE__="v7"/, '__TS_GAZE_BUNDLE__="' + stamp + '"');
  if (stamped === built) {
    console.warn('WARNING: bundle marker not found — runs will not be attributable to a build');
  } else {
    fs.writeFileSync(outfile, stamped);
  }
  console.log(`bundle marker: ${stamp}`);

  const stat = fs.statSync(outfile);
  console.log(`built ${outfile}: ${(stat.size / 1024 / 1024).toFixed(3)} MB (${stat.size} bytes)`);
  void result;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
