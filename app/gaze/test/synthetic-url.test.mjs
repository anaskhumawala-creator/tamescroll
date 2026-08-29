import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { synthetic } from '../src/synthetic-url.mjs';

test('every synthetic url carries a query, which is what clears the service worker', () => {
  delete globalThis.__TS_GAZE_BUNDLE__;
  assert.match(synthetic('/__tamescroll/gaze-page.js'), /^\/__tamescroll\/gaze-page\.js\?v=/);
});

test('the bundle stamp is read late, so module order cannot matter', () => {
  globalThis.__TS_GAZE_BUNDLE__ = 'v9';
  assert.equal(synthetic('/a'), '/a?v=v9');
  delete globalThis.__TS_GAZE_BUNDLE__;
});

test('no caller asks our interceptor for a bare path', () => {
  for (const f of ['worker-client.mjs', 'model-blobs-lazy.mjs', 'detector.js']) {
    const src = readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');
    for (const line of src.split('\n')) {
      if (!/fetch\(|importScripts\(|s\.src =|origin \+ /.test(line)) continue;
      if (!/PATH|__tamescroll|base \+ '\./.test(line)) continue;
      assert.ok(
        line.includes('synthetic('),
        f + ' reaches our interceptor without a query: ' + line.trim()
      );
    }
  }
});
