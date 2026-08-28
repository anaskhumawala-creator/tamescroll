// WHERE THE MODEL BYTES COME FROM (full artifact).
//
// 93.9% of the built bundle is four inlined base64 model blobs, and the
// page evaluated all of it on EVERY page load -- measured 76-111ms on
// this desktop, and this desktop is not a Helio G88. Since inference
// moved into the worker (2026-08-28) the page usually never touches a
// model at all, so it was paying that on every navigation for bytes it
// would not use.
//
// So the page now gets a model-free build (build.js swaps this module
// for model-blobs-lazy.js) and this one -- the full artifact, still what
// the worker loads from /__tamescroll/gaze-init.js -- publishes the
// blobs on `window` when it happens to run in a page. That is what makes
// the in-page fallback possible without a second copy of 22MB in the
// APK: the fallback loads THIS artifact, by the same url the worker
// already uses.
import { MODEL_JSON, MODEL_WEIGHTS_B64 } from './model-embed.js';
import { NSFW_MODEL_JSON, NSFW_WEIGHTS_B64 } from './nsfw-model-embed.js';
import { GENDER_MODEL_JSON, GENDER_WEIGHTS_B64 } from './gender-model-embed.js';
import { PERSON_MODEL_JSON, PERSON_WEIGHTS_B64 } from './person-model-embed.js';

var BLOBS = {
  face: [MODEL_JSON, MODEL_WEIGHTS_B64],
  nsfw: [NSFW_MODEL_JSON, NSFW_WEIGHTS_B64],
  gender: [GENDER_MODEL_JSON, GENDER_WEIGHTS_B64],
  person: [PERSON_MODEL_JSON, PERSON_WEIGHTS_B64],
};

try {
  if (typeof window !== 'undefined') window.__TS_GAZE_MODELS = BLOBS;
} catch (e) {
  /* publishing is for the fallback only; never break the worker over it */
}

/** Resolves once the blobs are available. They already are, here. */
export function ready() {
  return Promise.resolve();
}

/** [modelJson, weightsBase64] for one model name. */
export function blob(name) {
  return BLOBS[name];
}
