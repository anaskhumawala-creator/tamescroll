// Bundle the SHIPPED src modules into ESM the bench can import, with
// tfjs left external so the bench and the models share one tf instance.
// Regenerated on every run: a stale copy is exactly the drift this repo
// has been bitten by before.
const esbuild = require('esbuild');
const path = require('path');
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'esm-shim.js')],
  bundle: true, format: 'esm', platform: 'neutral',
  outfile: path.join(__dirname, '.cache/shipped.mjs'),
  external: ['@tensorflow/tfjs-core', '@tensorflow/tfjs-converter', '@tensorflow/tfjs-backend-cpu', '@tensorflow/tfjs-backend-webgl'],
});
