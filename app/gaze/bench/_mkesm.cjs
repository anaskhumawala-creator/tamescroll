// Bundle the SHIPPED src modules into ESM the bench can import, with
// tfjs left external so the bench and the models share one tf instance.
// Regenerated on every run: a stale copy is exactly the drift this repo
// has been bitten by before.
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// AND EVERY VARIANT BUILT FROM IT GOES WITH IT.
//
// Arms build a variant by text-patching .cache/shipped.mjs and writing
// .cache/<name>.mjs. Those were never cleared, so half of them were
// carrying CUT_DELTA 28 (loop 40 shipped 50) and none of them carried
// the loop-41 birth verdict -- an A/B whose two arms differ in the named
// constant AND in a fortnight of source changes. The variants did not
// corrupt the cut axis (the replay reads bank/cuts.json booleans, never
// the module's CUT_DELTA), but nothing made that true on purpose.
//
// A variant is now strictly younger than the source, or it does not
// exist and its arm fails loudly. See docs/engine-findings.md 10a.
const cache = path.join(__dirname, '.cache');
if (fs.existsSync(cache))
  for (const f of fs.readdirSync(cache))
    if (f.endsWith('.mjs') && f !== 'shipped.mjs') fs.unlinkSync(path.join(cache, f));
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'esm-shim.js')],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: path.join(__dirname, '.cache/shipped.mjs'),
  external: ['@tensorflow/tfjs-core', '@tensorflow/tfjs-converter', '@tensorflow/tfjs-backend-cpu', '@tensorflow/tfjs-backend-webgl'],
});
