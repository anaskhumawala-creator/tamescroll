// Bundles tfjs (core+cpu+webgl+converter, Apache-2.0) + the embedded
// BlazeFace model + our runtime into one self-contained minified IIFE,
// written straight to app/src-tauri/gaze-init.js — a committed generated
// artifact, `include_str!`-ed into the Rust binary, same treatment as the
// vendored EasyList/EasyPrivacy rule snapshots. Zero runtime network/fetch
// deps: this has to run unmodified under Reddit's `default-src 'none'`.
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

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
  const stat = fs.statSync(outfile);
  console.log(`built ${outfile}: ${(stat.size / 1024 / 1024).toFixed(3)} MB (${stat.size} bytes)`);
  void result;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
