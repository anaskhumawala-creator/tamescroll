// Throwaway: how big is the page runtime with the four model blobs
// aliased away? Answers whether the split is worth building.
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const STUB = path.join(__dirname, 'stub-embed.js');
fs.writeFileSync(STUB, `
export const MODEL_JSON = null; export const MODEL_WEIGHTS_B64 = '';
export const NSFW_MODEL_JSON = null; export const NSFW_WEIGHTS_B64 = '';
export const GENDER_MODEL_JSON = null; export const GENDER_WEIGHTS_B64 = '';
export const PERSON_MODEL_JSON = null; export const PERSON_WEIGHTS_B64 = '';
`);

esbuild.build({
  entryPoints: [path.resolve('Z:/Apps/Disconnect/app/gaze/src/init-entry.js')],
  bundle: true, minify: true, format: 'iife', target: ['es2019'],
  outfile: path.join(__dirname, 'gaze-page-probe.js'),
  legalComments: 'none',
  alias: {
    './model-embed.js': STUB,
    './nsfw-model-embed.js': STUB,
    './gender-model-embed.js': STUB,
    './person-model-embed.js': STUB,
  },
}).then(() => {
  const n = fs.statSync(path.join(__dirname, 'gaze-page-probe.js')).size;
  console.log('page-only bundle:', (n / 1048576).toFixed(3), 'MB');
}).catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
