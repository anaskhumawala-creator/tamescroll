// THE PAGE NO LONGER CARRIES THE MODELS, so this module is the only
// thing standing between a worker-less device and a pipeline with no
// models at all. It is worth pinning: if ready() resolves without the
// blobs actually being there, the detector will ask for bytes that do
// not exist and every image stays covered for the life of the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const MODULE = '../src/model-blobs-lazy.mjs';

/** A DOM small enough to reason about: appendChild fires the handler. */
function fakeDom({ succeed = true, publish = true } = {}) {
  const scripts = [];
  const el = () => {
    const node = { onload: null, onerror: null, set src(v) { node._src = v; } , get src(){ return node._src; } };
    return node;
  };
  global.document = {
    createElement: () => el(),
    documentElement: {
      appendChild(node) {
        scripts.push(node);
        setTimeout(() => {
          if (!succeed) return node.onerror && node.onerror();
          if (publish) global.window.__TS_GAZE_MODELS = { face: [{}, 'AAA'] };
          node.onload && node.onload();
        }, 0);
      },
    },
    head: null,
  };
  global.window = {};
  global.location = { origin: 'https://m.youtube.com' };
  return scripts;
}

test('ready() resolves without fetching anything when the blobs are already here', async () => {
  fakeDom();
  const mod = await import(`${MODULE}?case=already`);
  global.window.__TS_GAZE_MODELS = { face: [{}, 'AAA'] };
  await mod.ready();
  assert.deepEqual(mod.blob('face'), [{}, 'AAA']);
});

test('a missing blob is undefined, never a throw', async () => {
  fakeDom();
  const mod = await import(`${MODULE}?case=missing`);
  assert.equal(mod.blob('face'), undefined);
});

test('ready() loads the full artifact once and publishes the blobs', async () => {
  const scripts = fakeDom();
  const mod = await import(`${MODULE}?case=load`);
  await mod.ready();
  assert.equal(scripts.length, 1, 'exactly one fetch');
  assert.match(scripts[0].src, /\/__tamescroll\/gaze-init\.js$/);
  assert.ok(mod.blob('face'), 'blobs are readable after ready()');
  // A second caller must not start a second 22MB load.
  await mod.ready();
  assert.equal(scripts.length, 1, 'the load is not repeated');
});

test('a failed load REJECTS rather than resolving with no models', async () => {
  fakeDom({ succeed: false });
  const mod = await import(`${MODULE}?case=fail`);
  await assert.rejects(mod.ready());
});

test('a load that does not publish is a failure, not a success', async () => {
  // The dangerous shape: the script 200s but is the wrong artifact. If
  // this resolved, the detector would call blob() and get undefined.
  fakeDom({ publish: false });
  const mod = await import(`${MODULE}?case=nopublish`);
  await assert.rejects(mod.ready());
});
